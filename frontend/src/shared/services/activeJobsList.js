// A small list of "generation in progress" entries, one list per content
// kind ("worksheet" | "quiz" | "studynote"). This is deliberately separate
// from useJobPolling's own single "activeJob:<kind>" key — that key still
// tracks whichever one job the wizard is currently looking at (so its
// button/progress note keep working exactly as before); this list is what
// lets a student start a second generation without losing track of the
// first one, by giving every in-progress job its own row in ActiveJobsPanel
// regardless of which topic the wizard has since moved on to.
//
// Plain localStorage, not a hook — dispatchers (WorksheetGenerator etc.) and
// the panel that displays the list are different components, so a custom
// window event is how one tells the other something changed (a same-tab
// localStorage write doesn't fire the native "storage" event; that only
// fires in *other* tabs).
const listKey = (kind) => `activeJobs:${kind}`;
const eventName = (kind) => `activeJobs:${kind}:changed`;

export function getActiveJobs(kind) {
  try {
    const raw = localStorage.getItem(listKey(kind));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(kind, list) {
  try {
    localStorage.setItem(listKey(kind), JSON.stringify(list));
  } catch {
    // Private-browsing/quota errors aren't fatal — the list just won't
    // survive a refresh this time.
  }
  window.dispatchEvent(new Event(eventName(kind)));
}

// entry: { jobId, label, dispatchedAt }
export function addActiveJob(kind, entry) {
  const list = getActiveJobs(kind).filter((j) => j.jobId !== entry.jobId);
  save(kind, [...list, entry]);
}

export function removeActiveJob(kind, jobId) {
  save(kind, getActiveJobs(kind).filter((j) => j.jobId !== jobId));
}

export function onActiveJobsChanged(kind, handler) {
  window.addEventListener(eventName(kind), handler);
  return () => window.removeEventListener(eventName(kind), handler);
}
