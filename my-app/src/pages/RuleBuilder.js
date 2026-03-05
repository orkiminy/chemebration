import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { extractRule, saveRule, loadRules, deleteRule } from "../engine/reactionRules";
import "../App.css";

const WIDTH = 400;
const HEIGHT = 400;
const GRID_SPACING = 40;
const ATOM_RADIUS = 12;
const SNAP_RADIUS = 10;

// ─── Reusable interactive canvas panel ───────────────────────────────────────

function CanvasEditor({ atoms, setAtoms, bonds, setBonds, label }) {
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");

  const gridPoints = useMemo(() => {
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
  }, []);

  const handleCanvasClick = (e) => {
    if (tool !== "pencil") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let closest = null;
    let minDist = Infinity;
    for (const p of gridPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; closest = p; }
    }
    const snap = minDist <= SNAP_RADIUS ? closest : null;
    if (!snap) return;
    if (atoms.some(a => a.x === snap.x && a.y === snap.y)) return;
    setAtoms([...atoms, { id: Date.now(), x: snap.x, y: snap.y, label: atomType }]);
    setSelectedAtom(null);
  };

  const handleAtomClick = (atomId) => {
    if (tool === "eraser") {
      setAtoms(atoms.filter(a => a.id !== atomId));
      setBonds(bonds.filter(b => b.from !== atomId && b.to !== atomId));
      return;
    }
    if (selectedAtom === null) { setSelectedAtom(atomId); return; }
    if (selectedAtom === atomId) { setSelectedAtom(null); return; }

    const exists = bonds.some(b =>
      (b.from === selectedAtom && b.to === atomId) ||
      (b.from === atomId && b.to === selectedAtom)
    );
    if (!exists) {
      setBonds([...bonds, { id: Date.now(), from: selectedAtom, to: atomId, order: 1, style: bondStyle }]);
    }
    setSelectedAtom(null);
  };

  const handleBondClick = (bondId) => {
    if (tool === "eraser") { setBonds(bonds.filter(b => b.id !== bondId)); return; }
    setBonds(bonds.map(b => b.id === bondId ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b));
    setSelectedBond(bondId);
  };

  const atomRadius = (lbl) => (lbl && lbl.length > 1 ? 18 : ATOM_RADIUS);

  return (
    <div className="exercise-panel-box">
      <div className="exercise-panel-label">{label}</div>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ display: "block", maxWidth: "100%", height: "auto", cursor: tool === "eraser" ? "not-allowed" : "crosshair" }}
        onClick={handleCanvasClick}
      >
        {gridPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
        ))}

        {bonds.map(bond => {
          const a1 = atoms.find(a => a.id === bond.from);
          const a2 = atoms.find(a => a.id === bond.to);
          if (!a1 || !a2) return null;

          if (bond.style === "wedge") {
            const dx = a2.x - a1.x;
            const dy = a2.y - a1.y;
            const angle = Math.atan2(dy, dx);
            const w = 6;
            const perp = angle + Math.PI / 2;
            return (
              <polygon
                key={bond.id}
                points={`${a1.x},${a1.y} ${a2.x + Math.cos(perp) * w},${a2.y + Math.sin(perp) * w} ${a2.x - Math.cos(perp) * w},${a2.y - Math.sin(perp) * w}`}
                fill={bond.id === selectedBond ? "red" : "#000"}
                onClick={(e) => { e.stopPropagation(); handleBondClick(bond.id); }}
              />
            );
          }

          const dx = a2.y - a1.y;
          const dy = a2.x - a1.x;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const offsetX = (dx / len) * 4;
          const offsetY = (dy / len) * 4;

          return [...Array(bond.order)].map((_, i) => (
            <line
              key={bond.id + "-" + i}
              x1={a1.x + offsetX * i} y1={a1.y - offsetY * i}
              x2={a2.x + offsetX * i} y2={a2.y - offsetY * i}
              stroke={bond.id === selectedBond ? "red" : "#000"}
              strokeWidth="3"
              strokeDasharray={bond.style === "striped" ? "6,4" : "0"}
              onClick={(e) => { e.stopPropagation(); handleBondClick(bond.id); }}
            />
          ));
        })}

        {atoms.map(atom => (
          <g key={atom.id}>
            <circle
              cx={atom.x} cy={atom.y} r={atomRadius(atom.label)}
              fill={atom.id === selectedAtom ? "red" : "#5f021f"}
              onClick={(e) => { e.stopPropagation(); handleAtomClick(atom.id); }}
            />
            {atom.label && atom.label !== "C" && (
              <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12" fill="#fff" pointerEvents="none">
                {atom.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="exercise-toolbar">
        <div className="toolbar-group">
          <button className={`toolbar-btn${tool === "pencil" ? " toolbar-btn-active" : ""}`} onClick={() => setTool("pencil")}>Pencil</button>
          <button className={`toolbar-btn${tool === "eraser" ? " toolbar-btn-active" : ""}`} onClick={() => setTool("eraser")}>Eraser</button>
          <button className="toolbar-btn" onClick={() => { setAtoms([]); setBonds([]); }}>Clear</button>
        </div>
        {tool === "pencil" && (
          <div className="toolbar-group">
            <select className="toolbar-select" value={atomType} onChange={(e) => setAtomType(e.target.value)}>
              <option value="C">C</option>
              <option value="H">H</option>
              <option value="O">O</option>
              <option value="N">N</option>
              <option value="Br">Br</option>
              <option value="Cl">Cl</option>
              <option value="F">F</option>
              <option value="I">I</option>
              <option value="OH">OH</option>
              <option value="Ph">Ph</option>
              <option value="CH3">CH3</option>
              <option value="Mg">Mg</option>
              <option value="X">X (any halogen)</option>
              <option value="R">R (any group)</option>
            </select>
            <select className="toolbar-select" value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
              <option value="solid">Solid</option>
              <option value="wedge">Wedge</option>
              <option value="striped">Dashed</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main RuleBuilder page ────────────────────────────────────────────────────

export default function RuleBuilder() {
  const [leftAtoms, setLeftAtoms] = useState([]);
  const [leftBonds, setLeftBonds] = useState([]);
  const [rightAtoms, setRightAtoms] = useState([]);
  const [rightBonds, setRightBonds] = useState([]);

  const [reagentSteps, setReagentSteps] = useState([""]);
  const [ruleName, setRuleName] = useState("");
  const [explanation, setExplanation] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  // Use the first non-empty step as the reagent for matching
  const reagent = reagentSteps.map(s => s.trim()).filter(Boolean).join(" / ");

  const updateStep = (i, val) => setReagentSteps(steps => steps.map((s, j) => j === i ? val : s));
  const addStep = () => setReagentSteps(steps => [...steps, ""]);
  const removeStep = (i) => setReagentSteps(steps => steps.length === 1 ? steps : steps.filter((_, j) => j !== i));

  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules().then(r => { setRules(r); setLoading(false); });
  }, []);

  const handleCopy = () => {
    setRightAtoms(leftAtoms.map(a => ({ ...a })));
    setRightBonds(leftBonds.map(b => ({ ...b })));
  };

  const handleSave = async () => {
    if (!reagent.trim()) { setSaveMsg("Enter a reagent first."); return; }
    if (leftAtoms.length === 0) { setSaveMsg("Draw the reactant on the left canvas first."); return; }

    const snapshot = extractRule(leftAtoms, leftBonds, rightAtoms, rightBonds);
    if (!snapshot) { setSaveMsg("Draw the reactant on the left canvas first."); return; }

    const rule = {
      reagent: reagent.trim(),
      name: ruleName.trim() || reagent.trim(),
      explanation: explanation.trim(),
      ...snapshot,
    };

    setSaveMsg("Saving...");
    await saveRule(rule);
    const updated = await loadRules();
    setRules(updated);
    setSaveMsg(`Rule "${rule.name}" saved!`);
    setReagentSteps([""]);
    setRuleName("");
    setExplanation("");
  };

  const handleDelete = async (ruleId) => {
    await deleteRule(ruleId);
    setRules(await loadRules());
  };

  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">Reaction Rule Builder</span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <div style={{ padding: "1rem 2rem" }}>
        <p style={{ color: "#666", marginBottom: "1rem" }}>
          Draw the <strong>reactant</strong> on the left, then click <strong>Copy Left → Right</strong>, edit the right canvas to show the <strong>product</strong>, fill in the reagent, and click Save.
        </p>

        {/* Two canvases side by side */}
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <CanvasEditor
              atoms={leftAtoms} setAtoms={setLeftAtoms}
              bonds={leftBonds} setBonds={setLeftBonds}
              label="Reactant (Left)"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "3rem", gap: "6px", minWidth: "160px" }}>
            {/* Numbered reagent steps above the arrow */}
            {reagentSteps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", width: "100%" }}>
                <span style={{ color: "#5f021f", fontWeight: "bold", fontSize: "0.85rem", minWidth: "20px" }}>{i + 1}.</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => updateStep(i, e.target.value)}
                  placeholder={i === 0 ? "e.g. HBr" : "e.g. H2O"}
                  style={{ flex: 1, padding: "5px 6px", border: "1.5px solid #5f021f", borderRadius: "5px", fontSize: "0.85rem", textAlign: "center", minWidth: 0 }}
                />
                {reagentSteps.length > 1 && (
                  <span onClick={() => removeStep(i)} style={{ color: "#999", cursor: "pointer", fontSize: "1.1rem", padding: "0 2px", userSelect: "none" }}>×</span>
                )}
              </div>
            ))}
            <div onClick={addStep} style={{ color: "#5f021f", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, alignSelf: "flex-end", userSelect: "none" }}>+ Add Step</div>

            {/* Arrow */}
            <svg width="140" height="20" viewBox="0 0 140 20" style={{ marginTop: "4px" }}>
              <line x1="4" y1="10" x2="125" y2="10" stroke="#5f021f" strokeWidth="2.5" />
              <polygon points="125,5 140,10 125,15" fill="#5f021f" />
            </svg>

            <button
              style={{ marginTop: "6px", whiteSpace: "nowrap", background: "#5f021f", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 12px", cursor: "pointer", fontSize: "0.9rem" }}
              onClick={handleCopy}
            >
              Copy Left → Right
            </button>
          </div>

          <div>
            <CanvasEditor
              atoms={rightAtoms} setAtoms={setRightAtoms}
              bonds={rightBonds} setBonds={setRightBonds}
              label="Product (Right)"
            />
          </div>
        </div>

        {/* Rule inputs */}
        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.85rem", color: "#666" }}>Display name (optional)</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g. Markovnikov HBr"
              style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "1rem", width: "200px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.85rem", color: "#666" }}>Explanation (optional)</label>
            <input
              type="text"
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="e.g. Br adds to more-substituted carbon"
              style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "1rem", width: "300px" }}
            />
          </div>
          <button className="toolbar-btn toolbar-btn-check" onClick={handleSave}>
            Save Rule
          </button>
        </div>

        {saveMsg && (
          <div style={{ marginTop: "0.75rem", color: saveMsg.startsWith("Rule") ? "#1a6b3a" : "red", fontWeight: "bold" }}>
            {saveMsg}
          </div>
        )}

        {/* Saved rules list */}
        <div style={{ marginTop: "2rem" }}>
          <h3 style={{ color: "#5f021f", marginBottom: "0.75rem" }}>
            Saved Rules ({loading ? "…" : rules.length})
          </h3>
          {loading ? (
            <p style={{ color: "#aaa" }}>Loading…</p>
          ) : rules.length === 0 ? (
            <p style={{ color: "#aaa" }}>No rules saved yet.</p>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "600px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Reagent</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Name</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Explanation</th>
                  <th style={{ padding: "8px 12px", border: "1px solid #ddd" }}></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd", fontFamily: "monospace" }}>{r.reagent}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd" }}>{r.name}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd", color: "#666", fontSize: "0.9rem" }}>{r.explanation || '—'}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd", textAlign: "center" }}>
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ background: "none", border: "1px solid #c00", color: "#c00", borderRadius: "4px", cursor: "pointer", padding: "2px 8px" }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
