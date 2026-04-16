import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { loadRules } from "../engine/reactionRules";
import { ruleToExercise } from "../engine/ruleToExercise";
import SetCanvas from "../setCanvas";
import ReactionArrow from "../addingReaction";

export default function ReactionLibrary() {
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadRules()
      .then(rules => {
        const exs = rules
          .filter(r => r.patternAtoms?.length > 0 && r.resultAtoms?.length > 0)
          .map(r => ruleToExercise(r));
        setExercises(exs);
      })
      .catch(err => console.error("Failed to load rules:", err))
      .finally(() => setLoading(false));
  }, []);

  // Filter exercises by selected chapter
  const filtered = selectedChapter && selectedChapter !== "all"
    ? exercises.filter(ex => ex.chapter === selectedChapter)
    : exercises;

  // Chapter selection screen
  if (!selectedChapter) {
    // Count rules per chapter
    // Build chapter list dynamically from rule reactionTypes
    const counts = {};
    exercises.forEach(ex => {
      const ch = ex.chapter || "Uncategorized";
      counts[ch] = (counts[ch] || 0) + 1;
    });
    const reactionTypes = Object.keys(counts).sort();

    return (
      <div className="exercise-page">
        <nav className="exercise-nav">
          <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
          <span className="exercise-nav-title">Reaction Library</span>
          <span className="exercise-nav-spacer"></span>
        </nav>

        <div style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
          <h2 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#333" }}>
            Choose a Reaction Type
          </h2>
          {loading ? (
            <p style={{ textAlign: "center", color: "#888" }}>Loading rules...</p>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "1rem",
            }}>
              <button
                onClick={() => setSelectedChapter("all")}
                style={{
                  padding: "1.25rem 1rem",
                  fontSize: "1rem",
                  fontWeight: 500,
                  border: "2px solid #ddd",
                  borderRadius: 10,
                  background: "#fff",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  textAlign: "center",
                  color: "#333",
                }}
                onMouseEnter={e => { e.target.style.borderColor = "#2d7d9a"; e.target.style.background = "#f0f7fa"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#ddd"; e.target.style.background = "#fff"; }}
              >
                All Reactions
                <span style={{ display: "block", fontSize: "0.8rem", color: "#888", marginTop: 4 }}>
                  {exercises.length} reaction{exercises.length !== 1 ? "s" : ""}
                </span>
              </button>
              {reactionTypes.map(rt => (
                <button
                  key={rt}
                  onClick={() => setSelectedChapter(rt)}
                  style={{
                    padding: "1.25rem 1rem",
                    fontSize: "1rem",
                    fontWeight: 500,
                    border: "2px solid #ddd",
                    borderRadius: 10,
                    background: "#fff",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "center",
                    color: "#333",
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = "#2d7d9a"; e.target.style.background = "#f0f7fa"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "#ddd"; e.target.style.background = "#fff"; }}
                >
                  {rt}
                  <span style={{ display: "block", fontSize: "0.8rem", color: "#888", marginTop: 4 }}>
                    {counts[rt]} reaction{counts[rt] !== 1 ? "s" : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Library view — show all rules for selected chapter
  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <button
          onClick={() => setSelectedChapter(null)}
          className="exercise-nav-back"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "inherit", color: "inherit" }}
        >
          &larr; Back to Reaction Types
        </button>
        <span className="exercise-nav-title">
          {selectedChapter === "all" ? "All Reactions" : selectedChapter}
        </span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <div style={{ maxWidth: 1200, margin: "1rem auto", padding: "0 1rem" }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: "center", color: "#888", marginTop: "2rem" }}>
            No reactions found for this chapter.
          </p>
        ) : (
          filtered.map(ex => (
            <div
              key={ex.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: "1rem",
                marginBottom: "1.5rem",
                background: "#fff",
              }}
            >
              <h3 style={{ margin: "0 0 0.25rem", color: "#1a3a4a" }}>{ex.title}</h3>
              {ex.description && (
                <p style={{ margin: "0 0 0.75rem", color: "#666", fontSize: "0.9rem" }}>{ex.description}</p>
              )}
              <div className="exercise-layout" style={{ justifyContent: "center" }}>
                <div className="exercise-panel">
                  <div className="exercise-panel-box">
                    <div className="exercise-panel-label">Reactant</div>
                    <SetCanvas atoms={ex.question.atoms} bonds={ex.question.bonds} size={260} hideGrid />
                  </div>
                </div>

                <div className="exercise-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
                  <div className="exercise-panel-box">
                    <div className="exercise-panel-label">Reagent</div>
                    <div style={{ padding: "10px" }}>
                      <ReactionArrow
                        text={ex.reagents}
                        backwardText={ex.reversible ? ex.backwardReagent : undefined}
                      />
                    </div>
                  </div>
                </div>

                <div className="exercise-panel">
                  <div className="exercise-panel-box">
                    <div className="exercise-panel-label">Product</div>
                    <SetCanvas atoms={ex.solutions[0].atoms} bonds={ex.solutions[0].bonds} size={260} hideGrid />
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
