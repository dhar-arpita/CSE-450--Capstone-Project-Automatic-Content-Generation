import { useState } from "react";

// Same contract as useState, except the value survives navigation and
// refresh via localStorage. Used for the generation wizards (worksheet/quiz/
// study-note pages) so a student who steps away mid-generation to check
// another page comes back to the same wizard step — not step one — and the
// generator component (and the job-polling it owns) remounts immediately
// instead of only after the picker is redone from scratch.
export default function usePersistedState(key, initialValue) {
  const [value, setValue] = useState(() => {
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
