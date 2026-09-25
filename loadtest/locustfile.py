"""
Step 5.3 — the concurrency ladder.

Each simulated user performs one complete worksheet generation:

    POST /generate/worksheet  (refresh=true, so it always dispatches)
      -> 202 {job_id}
    GET  /jobs/{job_id}        (polled until SUCCESS or FAILED)

What Locust reports as "response time" for the `worksheet_e2e` entry is the
FULL dispatch-to-SUCCESS duration, not the HTTP call — that is the number
Step 5.3's table wants (p50 / p95 completion). Individual HTTP calls are
reported separately so a slow dispatch can be told apart from a slow job.

Run from your own machine, not the VM: a load generator sharing the VM's two
vCPUs with the backend and workers makes "the system is saturated" and "my
test tool is saturated" produce the same symptom.

USAGE
-----
    pip install locust

    # Rung 0 — 1 user, proves the task path works at all
    locust -f loadtest/locustfile.py --headless \
        -H https://seed-vm-capstone.eastasia.cloudapp.azure.com \
        -u 1 -r 1 -t 10m --csv results/rung0

    # Rung 1 — 3 users. THE key diagnostic: restart the generation worker
    # immediately before this run so all three tasks land on freshly forked
    # children. Clean completion means Step 2.4's engine.dispose() really is
    # giving each child its own connections (R6).
    locust -f loadtest/locustfile.py --headless -H <host> -u 3 -r 3 -t 20m --csv results/rung1

    # Rung 2 — 6 users (pool sizing, R5)
    locust -f loadtest/locustfile.py --headless -H <host> -u 6 -r 6 -t 25m --csv results/rung2

    # Rung 3 — 12 users
    locust -f loadtest/locustfile.py --headless -H <host> -u 12 -r 6 -t 30m --csv results/rung3

    # Rung 4 — 20 users (where the knee actually is)
    locust -f loadtest/locustfile.py --headless -H <host> -u 20 -r 5 -t 35m --csv results/rung4

Do not skip rungs: jumping to 12 conflates R1, R5 and R11 into one
indistinguishable "it's slow".

Set credentials first:
    export LOADTEST_EMAIL=...
    export LOADTEST_PASSWORD=...
"""

import os
import random
import time

from locust import HttpUser, task, constant, events

# ── Config ───────────────────────────────────────────────────────────────────

EMAIL = os.getenv("LOADTEST_EMAIL", "CHANGE_ME")
PASSWORD = os.getenv("LOADTEST_PASSWORD", "CHANGE_ME")

# Eight Physics topics read from the production DB on 20 Sep 2026. Spreading
# across topics keeps the load realistic: twenty teachers generating twenty
# different worksheets, not twenty identical ones. It also means Qdrant and
# Neon see varied queries rather than one hot row.
TOPIC_IDS = [75, 76, 77, 78, 79, 80, 81, 82]

DIFFICULTIES = ["easy", "medium", "hard"]
NUM_PROBLEMS = [2, 3, 5]

# Matches useJobPolling.js so the measurement reflects what the real frontend
# does, not an artificially tight poll.
FAST_INTERVAL = 2.0
SLOW_INTERVAL = 5.0
FAST_WINDOW = 30.0
CLIENT_TIMEOUT = 15 * 60  # give up like the UI does


# ── Counters the ladder table needs ──────────────────────────────────────────

class Counters:
    dispatch_429 = 0
    dispatch_5xx = 0
    poll_429 = 0
    poll_error = 0
    jobs_succeeded = 0
    jobs_failed = 0
    jobs_timed_out = 0


@events.quitting.add_listener
def _print_summary(environment, **kwargs):
    print("\n" + "=" * 60)
    print("RUNG SUMMARY — copy these into the results table")
    print("=" * 60)
    print(f"  jobs SUCCESS           : {Counters.jobs_succeeded}")
    print(f"  jobs FAILED            : {Counters.jobs_failed}")
    print(f"  jobs client-timed-out  : {Counters.jobs_timed_out}")
    print(f"  429 on dispatch        : {Counters.dispatch_429}")
    print(f"  5xx on dispatch        : {Counters.dispatch_5xx}")
    print(f"  429 while polling      : {Counters.poll_429}")
    print(f"  other poll errors      : {Counters.poll_error}")
    print("=" * 60)
    print("Also record from Flower at the end of the rung: peak queue depth,")
    print("peak active tasks, failed count. And grep the worker logs for")
    print("'QueuePool limit' — that is R5 firing, and it will not show up here.")
    print("=" * 60 + "\n")


# ── The user ─────────────────────────────────────────────────────────────────

class WorksheetUser(HttpUser):
    # No think time: the ladder is about how many concurrent generations the
    # system sustains, so each user starts the next one as soon as its
    # previous one lands.
    wait_time = constant(0)

    def on_start(self):
        """Log in once per simulated user and keep the token."""
        with self.client.post(
            "/login/",
            json={"email": EMAIL, "password": PASSWORD},
            name="login",
            catch_response=True,
        ) as r:
            if r.status_code != 200:
                r.failure(f"login failed: {r.status_code} {r.text[:200]}")
                self.token = None
                return
            self.token = r.json().get("access_token")

        self.headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}

    @task
    def worksheet_end_to_end(self):
        if not self.token:
            return

        started = time.time()

        job_id = self._dispatch()
        if job_id is None:
            return

        self._poll_until_done(job_id, started)

    # ── dispatch ─────────────────────────────────────────────────────────────

    def _dispatch(self):
        """POST /generate/worksheet with refresh=true; returns job_id or None."""
        form = {
            "topic_id": str(random.choice(TOPIC_IDS)),
            "difficulty": random.choice(DIFFICULTIES),
            "num_problems": str(random.choice(NUM_PROBLEMS)),
            "language": "english",
            # Without this the cache would serve a seed instantly and the run
            # would measure nothing at all.
            "refresh": "true",
        }

        with self.client.post(
            "/generate/worksheet",
            data=form,
            headers=self.headers,
            name="dispatch POST /generate/worksheet",
            catch_response=True,
        ) as r:
            if r.status_code == 429:
                Counters.dispatch_429 += 1
                r.failure("429 on dispatch")
                return None
            if r.status_code >= 500:
                Counters.dispatch_5xx += 1
                r.failure(f"{r.status_code} on dispatch")
                return None
            if r.status_code != 202:
                r.failure(f"expected 202, got {r.status_code}: {r.text[:200]}")
                return None

            job_id = r.json().get("job_id")
            if job_id is None:
                r.failure("202 with no job_id")
                return None
            return job_id

    # ── poll ─────────────────────────────────────────────────────────────────

    def _poll_until_done(self, job_id, started):
        """
        Poll on the frontend's own cadence and report the end-to-end duration
        as a single Locust entry, so p50/p95 in the CSV are completion times.
        """
        while True:
            elapsed = time.time() - started

            if elapsed > CLIENT_TIMEOUT:
                Counters.jobs_timed_out += 1
                self._report_e2e(elapsed, exc=Exception(f"job {job_id} still running at 15 min"))
                return

            time.sleep(FAST_INTERVAL if elapsed < FAST_WINDOW else SLOW_INTERVAL)

            with self.client.get(
                f"/jobs/{job_id}",
                headers=self.headers,
                name="poll GET /jobs/{id}",
                catch_response=True,
            ) as r:
                if r.status_code == 429:
                    Counters.poll_429 += 1
                    r.failure("429 while polling")
                    continue  # a contention 429 is not a dead job
                if r.status_code != 200:
                    Counters.poll_error += 1
                    r.failure(f"poll returned {r.status_code}")
                    continue

                status = r.json().get("status")

                if status == "SUCCESS":
                    Counters.jobs_succeeded += 1
                    self._report_e2e(time.time() - started)
                    return

                if status == "FAILED":
                    Counters.jobs_failed += 1
                    msg = r.json().get("error_message") or "job FAILED"
                    self._report_e2e(time.time() - started, exc=Exception(msg))
                    return
                # QUEUED / PROCESSING — keep going

    def _report_e2e(self, seconds, exc=None):
        """Record the whole dispatch-to-terminal duration as one Locust sample."""
        events.request.fire(
            request_type="JOB",
            name="worksheet_e2e",
            response_time=seconds * 1000,  # Locust wants milliseconds
            response_length=0,
            exception=exc,
        )
