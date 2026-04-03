import React, { useState } from "react";
import { Link } from "react-router-dom";
import ExerciseCanvas from "../ExerciseCanvas";
import { CHAPTERS } from "../data/chapters";

export default function OneStepReaction() {
  const [selectedChapter, setSelectedChapter] = useState(null);

  // Chapter selection screen
  if (!selectedChapter) {
    return (
      <div className="exercise-page">
        <nav className="exercise-nav">
          <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
          <span className="exercise-nav-title">One Step Reactions</span>
          <span className="exercise-nav-spacer"></span>
        </nav>

        <div style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
          <h2 style={{ textAlign: "center", marginBottom: "1.5rem", color: "#333" }}>
            Choose a Chapter
          </h2>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "1rem",
          }}>
            {CHAPTERS.map(ch => (
              <button
                key={ch.id}
                onClick={() => setSelectedChapter(ch.id)}
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
                onMouseEnter={e => { e.target.style.borderColor = "#5f021f"; e.target.style.background = "#fdf5f7"; }}
                onMouseLeave={e => { e.target.style.borderColor = "#ddd"; e.target.style.background = "#fff"; }}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Exercise screen with selected chapter
  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <button
          onClick={() => setSelectedChapter(null)}
          className="exercise-nav-back"
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: "inherit", color: "inherit" }}
        >
          &larr; Back to Chapters
        </button>
        <span className="exercise-nav-title">
          {CHAPTERS.find(c => c.id === selectedChapter)?.label || "One Step Reactions"}
        </span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <ExerciseCanvas chapter={selectedChapter === "all" ? null : selectedChapter} />
    </div>
  );
}
