import React, { useEffect, useState } from "react";
import useJobPolling from "../services/useJobPolling";
import { getActiveJobs, removeActiveJob, onActiveJobsChanged } from "../services/activeJobsList";

// One row per in-progress job. Each row polls its own job independently
// (storageKey is null here on purpose — the singular "activeJob:<kind>" key
// belongs to whichever job the wizard's own generator is currently showing,
// not to this list), so two, three, however many generations a student
// started stay live at once instead of only the most recent.
//
// This is a SECOND poll loop for whichever job the wizard's own generator
// is also currently showing (that one already polls it, faster, for its own
// button/progress note) — deliberately slower here, because the backend's
// DB connection pool is small (core/config.py: 5 connections total) and
// every open poll loop holds one during its request. A background status
// row doesn't need 2-second responsiveness; removeActiveJobIfDispatchedElsewhere
// (called by the main generator the moment ITS OWN poll sees the same job
// finish) also cuts this loop short immediately via the unmount below,
// rather than waiting for it to notice on its own next tick.
function ActiveJobRow({ kind, entry, stageLabel, onDone }) {
  const { status, stage } = useJobPolling(entry.jobId, null, {
    fastIntervalMs: 6000, slowIntervalMs: 15000, fastWindowMs: 30000,
  });

  useEffect(() => {
    if (status === "SUCCESS" || status === "FAILED") {
      removeActiveJob(kind, entry.jobId);
      // The main generator clears this same key itself when IT notices
      // completion (see WorksheetGenerator.js) — but if the student is away
      // from that exact topic right now, nothing else will, and a stale
      // "still going" key left behind would resurrect an already-finished
      // job the next time that topic is visited fresh (the bug this fixes).
      if (entry.storageKey) localStorage.removeItem(entry.storageKey);
      onDone(status);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "SUCCESS" || status === "FAILED") return null;

  return (
    <li className="ajp-row">
      <span className="wg-spinner" aria-hidden="true" />
      <span className="ajp-text">
        <span className="ajp-label">{entry.label}</span>
        <span className="ajp-stage">{stageLabel(stage)}</span>
      </span>
    </li>
  );
}

// Rendered in the rail (next to "your saved worksheets" etc.), so a student
// starting a second generation on a different topic doesn't lose visible
// track of the first one just because the wizard has moved on. Student-only
// — callers gate this on the same isStudent/autoFillFromSaved signal the
// rest of the persisted-wizard-state feature already uses.
export default function ActiveJobsPanel({ kind, title, stageLabel, onJobDone }) {
  const [jobs, setJobs] = useState(() => getActiveJobs(kind));

  useEffect(() => onActiveJobsChanged(kind, () => setJobs(getActiveJobs(kind))), [kind]);

  if (jobs.length === 0) return null;

  return (
    <div className="ajp-panel">
      <h4 className="ajp-title">{title}</h4>
      <ul className="ajp-list">
        {jobs.map((entry) => (
          <ActiveJobRow
            key={entry.jobId}
            kind={kind}
            entry={entry}
            stageLabel={stageLabel}
            onDone={(status) => { setJobs(getActiveJobs(kind)); onJobDone?.(status); }}
          />
        ))}
      </ul>
    </div>
  );
}
