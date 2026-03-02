import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { reactionLevels } from "../data/reactionLevels.js";

const WIDTH = 400;
const HEIGHT = 400;
const GRID_SPACING = 40;
const ATOM_RADIUS = 12;

/* Build grid points for centering */
function buildGrid() {
  const points = [];
  const rowHeight = GRID_SPACING * Math.sin(Math.PI / 3);
  for (let y = 0; y <= HEIGHT; y += rowHeight) {
    const row = Math.round(y / rowHeight);
    const offset = row % 2 === 0 ? 0 : GRID_SPACING / 2;
    for (let x = 0; x <= WIDTH; x += GRID_SPACING) {
      points.push({ x: x + offset, y });
    }
  }
  return points;
}

const gridPoints = buildGrid();

/* Center atoms with grid snapping (for hex-grid molecules) */
function centerAtomsSnapped(atoms) {
  if (atoms.length === 0) return atoms;
  const xs = atoms.map(a => a.x);
  const ys = atoms.map(a => a.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dx = WIDTH / 2 - cx;
  const dy = HEIGHT / 2 - cy;

  // Snap each atom to nearest grid point after translation
  return atoms.map(a => {
    const rawX = a.x + dx;
    const rawY = a.y + dy;
    let best = gridPoints[0], bestDist = Infinity;
    for (const p of gridPoints) {
      const d = (p.x - rawX) ** 2 + (p.y - rawY) ** 2;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return { ...a, x: best.x, y: best.y };
  });
}

/* Center atoms without grid snapping (preserves exact shape for custom coords) */
function centerAtomsFree(atoms) {
  if (atoms.length === 0) return atoms;
  const xs = atoms.map(a => a.x);
  const ys = atoms.map(a => a.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dx = WIDTH / 2 - cx;
  const dy = HEIGHT / 2 - cy;

  return atoms.map(a => ({
    ...a,
    x: a.x + dx,
    y: a.y + dy,
  }));
}

/* Render a molecule SVG with proper wedge/dash/solid bonds */
function MoleculeCanvas({ atoms, bonds, label, snapToGrid = true }) {
  const centered = useMemo(() => snapToGrid ? centerAtomsSnapped(atoms) : centerAtomsFree(atoms), [atoms, snapToGrid]);

  return (
    <div style={{ textAlign: "center" }}>
      {label && <div style={{ fontWeight: "bold", marginBottom: 4, color: "#5f021f", fontSize: "0.9rem" }}>{label}</div>}
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ display: "block", maxWidth: "100%", height: "auto", border: "1px solid #ddd", borderRadius: 8, background: "#fff" }}
      >
        {/* Grid */}
        {gridPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#eee" />
        ))}

        {/* Bonds */}
        {bonds.map((bond, bIdx) => {
          const a1 = centered.find(a => a.id === bond.from);
          const a2 = centered.find(a => a.id === bond.to);
          if (!a1 || !a2) return null;

          // Wedge bond (filled triangle)
          if (bond.style === "wedge") {
            const dx = a2.x - a1.x;
            const dy = a2.y - a1.y;
            const angle = Math.atan2(dy, dx);
            const width = 6;
            const perp = angle + Math.PI / 2;
            const p2x = a2.x + Math.cos(perp) * width;
            const p2y = a2.y + Math.sin(perp) * width;
            const p3x = a2.x - Math.cos(perp) * width;
            const p3y = a2.y - Math.sin(perp) * width;
            return (
              <polygon
                key={`bond-${bIdx}`}
                points={`${a1.x},${a1.y} ${p2x},${p2y} ${p3x},${p3y}`}
                fill="#000"
              />
            );
          }

          // Regular or dashed bonds (with multi-bond offset)
          const dx = a2.y - a1.y;
          const dy = a2.x - a1.x;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const offsetX = (dx / len) * 4;
          const offsetY = (dy / len) * 4;

          return [...Array(bond.order || 1)].map((_, i) => (
            <line
              key={`bond-${bIdx}-${i}`}
              x1={a1.x + offsetX * i}
              y1={a1.y - offsetY * i}
              x2={a2.x + offsetX * i}
              y2={a2.y - offsetY * i}
              stroke="#000"
              strokeWidth="3"
              strokeDasharray={bond.style === "striped" ? "6,4" : "0"}
            />
          ));
        })}

        {/* Atoms */}
        {centered.map(atom => (
          <g key={atom.id}>
            <circle
              cx={atom.x}
              cy={atom.y}
              r={atom.label && atom.label.length > 1 ? 18 : ATOM_RADIUS}
              fill="#5f021f"
            />
            {atom.label && atom.label !== "C" && (
              <text
                x={atom.x}
                y={atom.y + 4}
                textAnchor="middle"
                fontSize="12"
                fill="#fff"
                fontWeight="bold"
              >
                {atom.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function AnswerKey() {
  const [selectedLevel, setSelectedLevel] = useState(0);
  const level = reactionLevels[selectedLevel];

  const solutions = level.solutions || (level.solution ? [level.solution] : []);

  return (
    <div style={{ minHeight: "100vh", background: "#f9e1e8", fontFamily: "Arial, sans-serif" }}>
      {/* Nav bar */}
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">Answer Key - All Questions</span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px" }}>
        {/* Question selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {reactionLevels.map((lvl, idx) => (
            <button
              key={lvl.id}
              onClick={() => setSelectedLevel(idx)}
              style={{
                padding: "8px 16px",
                border: idx === selectedLevel ? "2px solid #5f021f" : "1px solid #ccc",
                borderRadius: 8,
                background: idx === selectedLevel ? "#5f021f" : "#fff",
                color: idx === selectedLevel ? "#fff" : "#333",
                cursor: "pointer",
                fontWeight: idx === selectedLevel ? "bold" : "normal",
                fontSize: "0.85rem",
              }}
            >
              Q{idx + 1}: {lvl.title}
            </button>
          ))}
        </div>

        {/* Question info */}
        <div style={{ background: "#fff", padding: 20, borderRadius: 12, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
          <h2 style={{ color: "#5f021f", margin: "0 0 8px" }}>
            Q{selectedLevel + 1}: {level.title}
          </h2>
          <p style={{ margin: "0 0 4px", fontSize: "1.1rem" }}>
            <strong>Reagent:</strong> {level.reagents}
          </p>
          <p style={{ margin: 0, color: "#666" }}>
            {level.description}
          </p>
          <p style={{ margin: "8px 0 0", fontSize: "0.85rem", color: "#999" }}>
            Atoms: {level.question.atoms.length} | Bonds: {level.question.bonds.length} |
            Solution atoms: {solutions[0]?.atoms?.length || "?"} | Solution bonds: {solutions[0]?.bonds?.length || "?"}
          </p>
        </div>

        {/* Given structure + Solutions side by side */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20, justifyContent: "center" }}>
          {/* Given structure */}
          <div style={{ background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
            <MoleculeCanvas
              atoms={level.question.atoms}
              bonds={level.question.bonds}
              label="Given Structure (Question)"
              snapToGrid={!level.question.freePosition}
            />
          </div>

          {/* Solutions */}
          {solutions.map((sol, idx) => (
            <div key={idx} style={{ background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
              <MoleculeCanvas
                atoms={sol.atoms}
                bonds={sol.bonds}
                label={solutions.length > 1 ? `Solution ${String.fromCharCode(65 + idx)} (Enantiomer)` : "Correct Answer"}
                snapToGrid={!sol.freePosition}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
