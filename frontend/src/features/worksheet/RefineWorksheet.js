import React, { useCallback, useEffect, useRef, useState } from "react";
import { getWorksheetDetails, refineWorksheet } from "../../shared/services/api";
import useJobPolling from "../../shared/services/useJobPolling";
import {
  IconAlert, IconChart, IconClose, IconMinus, IconPlus, IconPuzzle,
  IconSliders, IconSpark,
} from "../../shared/ui/icons";
import "./refine.css";

/* Refinement dialog.

   The bug this fixes: POST /generate/refine returns 202 {job_id} like every
   other long pipeline, but this component was written against the older
   synchronous contract and handed that envelope straight to onUpdate(). The
   parent then read `.html` off it, got undefined, and blanked the preview —
   while the worker went on to spend two and a half minutes producing a
   worksheet nobody ever collected. It now polls the job like the rest of the
   app and only reports back on SUCCESS.

   Because a refine really does take minutes, the dialog stays open and shows
   progress while it runs, and refuses to close mid-flight: closing would
   orphan the result all over again. */

const OPTION_ICONS = {
  add: IconPlus,
  remove: IconMinus,
  difficulty: IconSliders,
  visuals: IconChart,
  simplify: IconSpark,
};

export default function RefineWorksheet({ contentId, onClose, onUpdate }) {
  const [problems, setProblems] = useState([]);
  const [existingVisualIds, setExistingVisualIds] = useState(new Set());
  const [difficultySelectedIds, setDifficultySelectedIds] = useState(new Set());
  const [dispatchError, setDispatchError] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const initialDifficultyMap = useRef({});
  const [selectedRefinements, setSelectedRefinements] = useState({
    add_more: false,
    add_count: 2,
    remove_problems: [],
    change_difficulty: false,
    difficulty_map: {}, // {problem_id: "Easy/Medium/Hard"}
    add_visuals: false,
    visuals_map: [],    // [problem_id, ...]
    simplify: false
  });

  const [jobId, setJobId] = useState(null);
  const { status, stage, result, error } = useJobPolling(jobId, "activeJob:refine");
  const running = dispatching || status === "QUEUED" || status === "PROCESSING";

  const hasAnyChange =
    selectedRefinements.add_more ||
    selectedRefinements.remove_problems.length > 0 ||
    selectedRefinements.change_difficulty ||
    selectedRefinements.add_visuals ||
    selectedRefinements.simplify;

  const loadCurrentWorksheet = useCallback(async () => {
    if (!contentId) return;
    try {
      const { data } = await getWorksheetDetails(contentId);
      setProblems(data.problems || []);

      const initialDiff = {};
      data.problems?.forEach(p => {
        initialDiff[p.id] = p.difficulty || "Medium";
      });
      initialDifficultyMap.current = { ...initialDiff };
      setSelectedRefinements(prev => ({ ...prev, difficulty_map: initialDiff }));

      const visualIds = new Set();
      const pv = data.visuals?.problem_visuals;
      if (Array.isArray(pv)) {
        pv.forEach(v => {
          if (v?.problem_id != null) visualIds.add(v.problem_id);
        });
      }
      setExistingVisualIds(visualIds);
    } catch (err) {
      console.error("Failed to load problems", err);
    }
  }, [contentId]);

  useEffect(() => {
    loadCurrentWorksheet();
  }, [loadCurrentWorksheet]);

  // Escape closes, but never while a refinement is in flight.
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === "Escape" && !running) onClose?.();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, running]);

  // The finished worksheet arrives here, not from the dispatch response.
  useEffect(() => {
    if (status === "SUCCESS" && result) {
      onUpdate({
        html: result.html || "",
        content_id: result.content_id ?? contentId,
        problems: result.problems,
      });
      onClose?.();
    }
  }, [status, result, contentId, onUpdate, onClose]);

  const handleRefine = async () => {
    setDispatchError(null);
    setDispatching(true);
    const refinementPayload = [];

    if (selectedRefinements.add_more) {
      refinementPayload.push({ type: "add_problems", count: Number(selectedRefinements.add_count) });
    }

    if (selectedRefinements.remove_problems.length > 0) {
      refinementPayload.push({ type: "remove_problem", problem_ids: selectedRefinements.remove_problems });
    }

    if (selectedRefinements.change_difficulty) {
      const changes = Object.entries(selectedRefinements.difficulty_map)
        .filter(([pid]) => difficultySelectedIds.has(Number(pid)))
        .map(([pid, diff]) => ({ problem_id: Number(pid), new_difficulty: diff }));
      if (changes.length > 0) {
        refinementPayload.push({ type: "change_difficulty", changes });
      }
    }

    if (selectedRefinements.add_visuals) {
      refinementPayload.push({
        type: "add_visuals",
        problem_ids: selectedRefinements.visuals_map.length > 0 ? selectedRefinements.visuals_map : "all"
      });
    }

    if (selectedRefinements.simplify) {
      refinementPayload.push({ type: "simplify_language" });
    }

    try {
      const { data } = await refineWorksheet(contentId, problems, refinementPayload);
      if (!data?.job_id) throw new Error("No job id in the refine response");
      setJobId(data.job_id);
    } catch (err) {
      console.error("Refine dispatch failed:", err);
      setDispatchError(err.response?.data?.detail || "Refinement failed. Please try again.");
    } finally {
      setDispatching(false);
    }
  };

  const shownError =
    dispatchError || (error && !error.isTimeout ? error.message || "Refinement failed. Please try again." : null);

  const Option = ({ id, checked, onToggle, title, desc, readOnly, children }) => {
    const Icon = OPTION_ICONS[id];
    return (
      <section className={`rf-option${checked ? " is-on" : ""}`}>
        <label className="rf-option-head">
          <input
            type="checkbox"
            className="rf-check"
            checked={checked}
            readOnly={readOnly}
            onChange={readOnly ? undefined : (e) => onToggle(e.target.checked)}
          />
          <span className="rf-option-icon"><Icon /></span>
          <span className="rf-option-title">{title}</span>
        </label>
        <p className="rf-option-desc">{desc}</p>
        {children}
      </section>
    );
  };

  const shortLabel = (p) => (p.localized_question || p.question)?.substring(0, 40);

  return (
    <div className="rf-overlay" onClick={running ? undefined : onClose}>
      <div className="rf-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="rf-head">
          <div>
            <p className="rf-eyebrow">AI Worksheet Editor</p>
            <h2 className="rf-title">Refinement Options</h2>
            <p className="rf-sub">Tune question set, difficulty and language without regenerating from scratch.</p>
          </div>
          <button
            type="button"
            className="rf-close"
            onClick={onClose}
            disabled={running}
            aria-label="Close refine dialog"
          >
            <IconClose />
          </button>
        </header>

        <div className="rf-meta">
          <span className="rf-chip">
            <IconPuzzle />
            Problems loaded: <strong>{problems.length}</strong>
          </span>
          <span className={`rf-chip${hasAnyChange ? " is-on" : ""}`}>
            {hasAnyChange ? <IconSpark /> : <IconAlert />}
            {hasAnyChange ? "Changes selected" : "No changes selected yet"}
          </span>
        </div>

        <div className="rf-options">
          <Option
            id="add"
            checked={selectedRefinements.add_more}
            onToggle={(v) => setSelectedRefinements({ ...selectedRefinements, add_more: v })}
            title="Add more problems"
            desc="Increase worksheet length by generating additional questions aligned with this topic."
          >
            {selectedRefinements.add_more && (
              <div className="rf-sub-row">
                <span>How many to add?</span>
                <input
                  type="number"
                  min="1"
                  className="rf-number"
                  value={selectedRefinements.add_count}
                  onChange={(e) => setSelectedRefinements({ ...selectedRefinements, add_count: e.target.value })}
                />
              </div>
            )}
          </Option>

          <Option
            id="remove"
            readOnly
            checked={selectedRefinements.remove_problems.length > 0}
            title="Remove specific problems"
            desc="Select questions that should be excluded from the final worksheet."
          >
            <ul className="rf-list">
              {problems.map((p, idx) => (
                <li key={`rem-${p.id}`}>
                  <label className="rf-row">
                    <input
                      type="checkbox"
                      className="rf-check"
                      checked={selectedRefinements.remove_problems.includes(p.id)}
                      onChange={(e) => {
                        const list = e.target.checked
                          ? [...selectedRefinements.remove_problems, p.id]
                          : selectedRefinements.remove_problems.filter(id => id !== p.id);
                        setSelectedRefinements({ ...selectedRefinements, remove_problems: list });
                      }}
                    />
                    <span className="rf-row-text">#{idx + 1}: {shortLabel(p)}…</span>
                  </label>
                </li>
              ))}
            </ul>
          </Option>

          <Option
            id="difficulty"
            checked={selectedRefinements.change_difficulty}
            onToggle={(v) => setSelectedRefinements({ ...selectedRefinements, change_difficulty: v })}
            title="Change problem difficulty"
            desc="Adjust challenge level per question without changing the overall worksheet context."
          >
            {selectedRefinements.change_difficulty && (
              <ul className="rf-list">
                {problems.map((p, idx) => (
                  <li key={`diff-${p.id}`}>
                    <div className="rf-row rf-row-split">
                      <label className="rf-row">
                        <input
                          type="checkbox"
                          className="rf-check"
                          checked={difficultySelectedIds.has(p.id)}
                          onChange={() => {
                            setDifficultySelectedIds(prev => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id);
                              else next.add(p.id);
                              return next;
                            });
                          }}
                        />
                        <span className="rf-row-text">#{idx + 1}: {shortLabel(p)}…</span>
                      </label>
                      <select
                        className="rf-mini-select"
                        value={selectedRefinements.difficulty_map[p.id] || "Medium"}
                        onChange={(e) => setSelectedRefinements({
                          ...selectedRefinements,
                          difficulty_map: { ...selectedRefinements.difficulty_map, [p.id]: e.target.value }
                        })}
                      >
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Option>

          <Option
            id="visuals"
            checked={selectedRefinements.add_visuals}
            onToggle={(v) => setSelectedRefinements({ ...selectedRefinements, add_visuals: v })}
            title="Add diagrams / visuals"
            desc="Request visual aids for selected questions, or leave all unchecked to apply visuals across all."
          >
            {selectedRefinements.add_visuals && (() => {
              const visualCandidates = problems
                .filter(p => !existingVisualIds.has(p.id))
                .filter(p => !selectedRefinements.remove_problems.includes(p.id));
              return (
                <ul className="rf-list">
                  {visualCandidates.length > 0 ? (
                    visualCandidates.map((p) => (
                      <li key={`vis-${p.id}`}>
                        <label className="rf-row">
                          <input
                            type="checkbox"
                            className="rf-check"
                            checked={selectedRefinements.visuals_map.includes(p.id)}
                            onChange={(e) => {
                              const list = e.target.checked
                                ? [...selectedRefinements.visuals_map, p.id]
                                : selectedRefinements.visuals_map.filter(id => id !== p.id);
                              setSelectedRefinements({ ...selectedRefinements, visuals_map: list });
                            }}
                          />
                          <span className="rf-row-text">#{p.id}: {shortLabel(p)}…</span>
                        </label>
                      </li>
                    ))
                  ) : problems.length > 0 ? (
                    <li className="rf-empty">All problems already have visuals.</li>
                  ) : null}
                </ul>
              );
            })()}
          </Option>

          <Option
            id="simplify"
            checked={selectedRefinements.simplify}
            onToggle={(v) => setSelectedRefinements({ ...selectedRefinements, simplify: v })}
            title="Simplify language"
            desc="Reword instructions and questions for clearer, student-friendly readability."
          />
        </div>

        {running && (
          <p className="rf-note rf-note-live" role="status">
            <span className="rf-spinner" aria-hidden="true" />
            {stage ? `Refining — ${stage}…` : "Refining…"} This usually takes a couple of minutes.
          </p>
        )}

        {error?.isTimeout && !running && (
          <p className="rf-note rf-note-wait" role="status">
            <IconAlert />
            Still running — check back in a moment.
          </p>
        )}

        {shownError && (
          <p className="rf-note rf-note-bad" role="alert">
            <IconAlert />
            <span>{shownError}</span>
          </p>
        )}

        <footer className="rf-foot">
          <button type="button" className="rf-ghost" onClick={onClose} disabled={running}>
            Cancel
          </button>
          <button
            type="button"
            className="rf-send"
            onClick={handleRefine}
            disabled={running || !hasAnyChange}
          >
            {running ? (
              <>
                <span className="rf-spinner" aria-hidden="true" />
                Refining…
              </>
            ) : (
              <>
                <IconSpark />
                Send Refinement Request
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
