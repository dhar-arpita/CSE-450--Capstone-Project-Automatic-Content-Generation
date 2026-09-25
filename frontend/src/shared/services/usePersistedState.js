import { useState } from "react";

// Same contract as useState, except the value survives navigation and
// refresh via localStorage. Used for the student generation wizards
// (worksheet/quiz/study-note) so a student who steps away mid-generation to
// check another page comes back to the same wizard step — not step one —
// and the generator component (and the job-polling it owns) remounts
// immediately instead of only after the picker is redone from scratch.
//
// A falsy `key` (e.g. a teacher context, where this shouldn't persist —
// see the callers) makes this behave exactly like plain useState: no read,
// no write. That has to be a runtime branch inside the hook rather than the
// caller choosing between this hook and useState, since which one to call
// isn't always known synchronously (rules of hooks — same hook, every
// render) — passing null as the key is the way callers opt out per-render.
export default function usePersistedState(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (!key) return initialValue;
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? stored : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setPersisted = (next) => {
    setValue((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      if (!key) return resolved;
      try {
        if (resolved) localStorage.setItem(key, resolved);
        else localStorage.removeItem(key);
      } catch {
        // Private-browsing/quota errors aren't fatal — the wizard just
        // behaves as if nothing were persisted.
      }
      return resolved;
    });
  };

  return [value, setPersisted];
}
