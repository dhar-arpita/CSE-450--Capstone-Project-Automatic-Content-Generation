import { useState, useEffect, useRef, useCallback } from "react";
import api from "./api";

const FAST_INTERVAL_MS = 2000;
const SLOW_INTERVAL_MS = 5000;
const FAST_WINDOW_MS = 30000;
const TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Polls a job-status endpoint until the job reaches a terminal state, and
 * survives a page refresh by persisting the active job_id in localStorage.
 *
 * @param {number|string|null} jobId
 * @param {string} storageKey - unique per feature, e.g. "activeJob:worksheet".
 * @param {object} [opts]
 * @param {(id) => string} [opts.buildUrl] - defaults to `/jobs/${id}` (the
 *   GenerationJob contract). Ingestion uses a different table/endpoint
 *   (`/ingest/status/{id}`) with different field names — pass an override
 *   for that case instead of forking this hook.
 * @param {string} [opts.statusField] - defaults to "status". Ingestion's
 *   endpoint calls the same concept "job_status".
 * @param {number} [opts.fastIntervalMs] - defaults to 2000. A background
 *   status widget (e.g. ActiveJobsPanel, watching a job nobody's actively
 *   staring at) should pass a slower one — the backend's DB pool is small
 *   (see core/config.py), and every concurrent poll loop is a connection.
 * @param {number} [opts.slowIntervalMs] - defaults to 5000.
 * @param {number} [opts.fastWindowMs] - defaults to 30000.
 *
 * Returns { status, stage, result, error, activeJobId }.
 */
export default function useJobPolling(jobId, storageKey, opts = {}) {
  const buildUrl = opts.buildUrl || ((id) => `/jobs/${id}`);
  const statusField = opts.statusField || "status";
  const fastInterval = opts.fastIntervalMs ?? FAST_INTERVAL_MS;
  const slowInterval = opts.slowIntervalMs ?? SLOW_INTERVAL_MS;
  const fastWindow = opts.fastWindowMs ?? FAST_WINDOW_MS;

  const resolvedInitialId =
    jobId ?? (storageKey ? localStorage.getItem(storageKey) : null);

  const [activeJobId, setActiveJobId] = useState(resolvedInitialId);
  const [status, setStatus] = useState(resolvedInitialId ? "QUEUED" : "IDLE");
  const [stage, setStage] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const timeoutIdRef = useRef(null);
  const startTimeRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  const clearPersisted = useCallback(() => {
    if (storageKey) localStorage.removeItem(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (jobId) {
      setActiveJobId(jobId);
      if (storageKey) localStorage.setItem(storageKey, String(jobId));
    }
  }, [jobId, storageKey]);

  useEffect(() => {
    stopPolling();
    setError(null);
    setResult(null);
    setStage(null);

    if (!activeJobId) {
      setStatus("IDLE");
      return;
    }

    setStatus("QUEUED");
    startTimeRef.current = Date.now();
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      if (Date.now() - startTimeRef.current > TIMEOUT_MS) {
        setError({ message: "still running - check back", isTimeout: true });
        return;
      }

      try {
        const res = await api.get(buildUrl(activeJobId));
        if (cancelled) return;

        const job = res.data;
        const jobStatus = job[statusField];
        setStatus(jobStatus);
        setStage(job.progress_stage ?? null);

        if (jobStatus === "SUCCESS") {
          setResult(job.result ?? job ?? null);
          clearPersisted();
          return;
        }

        if (jobStatus === "FAILED") {
          setError({
            message: job.error_message || "The job failed.",
            isTimeout: false,
          });
          clearPersisted();
          return;
        }

        const elapsed = Date.now() - startTimeRef.current;
        const nextDelay = elapsed < fastWindow ? fastInterval : slowInterval;
        timeoutIdRef.current = setTimeout(poll, nextDelay);
      } catch (err) {
        if (cancelled) return;
        timeoutIdRef.current = setTimeout(poll, slowInterval);
      }
    };

    poll();

    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobId, stopPolling, clearPersisted]);

  return { status, stage, result, error, activeJobId };
}

// ── Plain async polling, for non-component contexts (e.g. inside a custom
// hook's callback, like useChatSession's quizSet) where React's useJobPolling
// hook can't be called — hooks can't run inside a plain async function.
// Same cadence and contract as the hook above, just without component state.
export async function pollJobUntilDone(jobId, opts = {}) {
  const buildUrl = opts.buildUrl || ((id) => `/jobs/${id}`);
  const statusField = opts.statusField || "status";
  const onProgress = opts.onProgress || (() => {});

  const startTime = Date.now();

  while (true) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      throw { message: "still running - check back", isTimeout: true };
    }

    let job;
    try {
      const res = await api.get(buildUrl(jobId));
      job = res.data;
    } catch (err) {
      await new Promise((r) => setTimeout(r, SLOW_INTERVAL_MS));
      continue;
    }

    const status = job[statusField];
    onProgress(status, job.progress_stage ?? null);

    if (status === "SUCCESS") return job.result ?? job ?? null;

    if (status === "FAILED") {
      throw { message: job.error_message || "The job failed.", isTimeout: false };
    }

    const elapsed = Date.now() - startTime;
    const delay = elapsed < FAST_WINDOW_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
    await new Promise((r) => setTimeout(r, delay));
  }
}