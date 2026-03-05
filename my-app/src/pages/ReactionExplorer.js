import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import SetCanvas from "../setCanvas";
import { findRule, applyRule } from "../engine/reactionRules";
import "../App.css";

const WIDTH = 480;
const HEIGHT = 480;
const GRID_SPACING = 40;
const ATOM_RADIUS = 12;
const SNAP_RADIUS = 10;

export default function ReactionExplorer() {
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);

  const [reagentSteps, setReagentSteps] = useState([""]);
  const [productSteps, setProductSteps] = useState([]); // [{reagent, atoms, bonds, explanation, noMatch}]
  const [computing, setComputing] = useState(false);
  const [aiError, setAiError] = useState(null);

  /* ---------- GRID ---------- */
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

  /* ---------- DELETE KEY ---------- */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Delete" && selectedBond) {
        setBonds(prev => prev.filter(b => b.id !== selectedBond));
        setSelectedBond(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBond]);

  /* ---------- CANVAS INTERACTIONS ---------- */
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
    if (tool === "eraser") {
      setBonds(bonds.filter(b => b.id !== bondId));
      return;
    }
    setBonds(bonds.map(b => b.id === bondId ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b));
    setSelectedBond(bondId);
  };

  const updateStep = (i, val) => setReagentSteps(steps => steps.map((s, j) => j === i ? val : s));
  const addStep = () => setReagentSteps(steps => [...steps, ""]);
  const removeStep = (i) => setReagentSteps(steps => steps.length === 1 ? steps : steps.filter((_, j) => j !== i));

  /* ---------- COMPUTE (rule engine — multi-step) ---------- */
  const handleCompute = async () => {
    if (atoms.length === 0) { setAiError("Draw a molecule first."); return; }
    const filledSteps = reagentSteps.map(s => s.trim()).filter(Boolean);
    if (filledSteps.length === 0) { setAiError("Enter at least one reagent above the arrow."); return; }

    setComputing(true);
    setAiError(null);
    setProductSteps([]);

    let currentAtoms = atoms;
    let currentBonds = bonds;
    const steps = [];

    for (const step of filledSteps) {
      const rule = await findRule(step);
      if (!rule) {
        setAiError(`No rule found for "${step}". Add it in Rule Builder first.`);
        setComputing(false);
        return;
      }

      const result = applyRule(currentAtoms, currentBonds, rule);
      console.log(`[ReactionExplorer] "${step}" →`, {
        noMatch: result?.noMatch ?? false,
        productAtoms: result?.products[0]?.atoms?.length,
        productBonds: result?.products[0]?.bonds?.length,
        atoms: result?.products[0]?.atoms,
      });
      if (!result) {
        setAiError(`Could not apply rule for "${step}".`);
        setComputing(false);
        return;
      }

      const product = result.products[0];
      steps.push({
        reagent: step,
        atoms: product.atoms,
        bonds: product.bonds,
        explanation: result.explanation,
        noMatch: result.noMatch || false,
      });

      // Feed this step's product into the next step
      currentAtoms = product.atoms;
      currentBonds = product.bonds;
    }

    setProductSteps(steps);
    setComputing(false);
  };

  const atomRadius = (label) => (label && label.length > 1 ? 18 : ATOM_RADIUS);

  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">Reaction Explorer</span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <div style={{ padding: "1rem 2rem" }}>
        <p style={{ color: "#666", marginBottom: "1.5rem" }}>
          Draw any molecule, type a reaction or reagent, and click <strong>Compute</strong> to see the product.
          <br />
          <span style={{ color: "#5f021f", fontSize: "0.9rem" }}>
            Tip: Click a bond <strong>twice</strong> for double bond, <strong>three times</strong> for triple bond. Rules must be added in <Link to="/rule-builder" style={{ color: "#5f021f" }}>Rule Builder</Link> first.
          </span>
        </p>

        <div className="exercise-layout">
          {/* Left: Drawing canvas */}
          <div className="exercise-panel">
            <div className="exercise-panel-box">
              <div className="exercise-panel-label">Your Molecule</div>
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
                    const width = 6;
                    const perp = angle + Math.PI / 2;
                    const p2x = a2.x + Math.cos(perp) * width;
                    const p2y = a2.y + Math.sin(perp) * width;
                    const p3x = a2.x - Math.cos(perp) * width;
                    const p3y = a2.y - Math.sin(perp) * width;
                    return (
                      <polygon
                        key={bond.id}
                        points={`${a1.x},${a1.y} ${p2x},${p2y} ${p3x},${p3y}`}
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
                      x1={a1.x + offsetX * i}
                      y1={a1.y - offsetY * i}
                      x2={a2.x + offsetX * i}
                      y2={a2.y - offsetY * i}
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
                      cx={atom.x}
                      cy={atom.y}
                      r={atomRadius(atom.label)}
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

              {/* Toolbar */}
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
                      <option value="S">S</option>
                      <option value="P">P</option>
                      <option value="OH">OH</option>
                      <option value="Ph">Ph</option>
                      <option value="CH3">CH3</option>
                      <option value="Mg">Mg</option>
                      <option value="X">X (any halogen)</option>
                      <option value="R">R (any group)</option>
                    </select>
                    <select className="toolbar-select" value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
                      <option value="solid">Solid (Line)</option>
                      <option value="wedge">Solid (Wedge)</option>
                      <option value="striped">Dashed (Striped)</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Middle: reagent steps + arrow + compute */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", background: "#fff", minWidth: "200px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, textTransform: "uppercase", color: "#5f021f", padding: "8px 0", textAlign: "center", background: "#faf5f7", borderBottom: "1px solid #eee", borderRadius: "8px 8px 0 0" }}>Reaction</div>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch" }}>

                {/* Numbered reagent steps */}
                {reagentSteps.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#5f021f", fontWeight: "bold", fontSize: "0.9rem", minWidth: "20px" }}>{i + 1}.</span>
                    <input
                      type="text"
                      value={step}
                      onChange={(e) => updateStep(i, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCompute()}
                      placeholder={i === 0 ? "e.g. HBr" : "e.g. H2O"}
                      style={{ flex: 1, padding: "6px 8px", border: "1.5px solid #5f021f", borderRadius: "5px", fontSize: "0.9rem", textAlign: "center", minWidth: 0 }}
                    />
                    {reagentSteps.length > 1 && (
                      <span
                        onClick={() => removeStep(i)}
                        style={{ color: "#999", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 4px", userSelect: "none" }}
                        title="Remove"
                      >×</span>
                    )}
                  </div>
                ))}

                {/* Add step link */}
                <div
                  onClick={addStep}
                  style={{ color: "#5f021f", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, textAlign: "right", userSelect: "none", paddingRight: "4px" }}
                >+ Add Step</div>

                {/* Reaction arrow */}
                <div style={{ textAlign: "center", padding: "4px 0" }}>
                  <svg width="160" height="20" viewBox="0 0 160 20">
                    <line x1="4" y1="10" x2="145" y2="10" stroke="#5f021f" strokeWidth="2.5" />
                    <polygon points="145,5 160,10 145,15" fill="#5f021f" />
                  </svg>
                </div>

                {/* Compute button */}
                <button
                  onClick={handleCompute}
                  disabled={atoms.length === 0 || reagentSteps.every(s => !s.trim())}
                  style={{ padding: "8px 0", background: "#1a7a3a", color: "#fff", border: "none", borderRadius: "6px", fontSize: "1rem", fontWeight: 700, cursor: "pointer", opacity: (atoms.length === 0 || reagentSteps.every(s => !s.trim())) ? 0.5 : 1 }}
                >
                  Compute
                </button>
              </div>
            </div>
          </div>

          {/* Right: product steps */}
          <div className="exercise-panel">
            <div className="exercise-panel-box">
              <div className="exercise-panel-label" style={{ color: "#1a6b3a" }}>Product</div>

              {computing && (
                <div style={{ padding: "2rem", color: "#888", textAlign: "center" }}>Computing…</div>
              )}

              {!computing && productSteps.length === 0 && !aiError && (
                <div style={{ padding: "2rem", color: "#aaa", textAlign: "center", fontSize: "0.95rem" }}>
                  Draw a molecule and click Compute
                </div>
              )}

              {aiError && (
                <div style={{ padding: "1rem", color: "red", background: "#fff0f0", borderRadius: 4, margin: "1rem" }}>
                  {aiError}
                </div>
              )}

              {productSteps.length > 0 && (() => {
                const final = productSteps[productSteps.length - 1];
                return (
                  <div style={{ padding: "0.75rem 1rem" }}>
                    {final.noMatch && (
                      <div style={{ fontSize: "0.8rem", color: "#b87700", background: "#fff8e1", border: "1px solid #f0d070", padding: "6px 10px", borderRadius: 4, marginBottom: "8px" }}>
                        ⚠️ Pattern not found in your molecule — showing the stored example instead.
                        Check the browser console (F12) for details.
                      </div>
                    )}
                    <div style={{ fontSize: "0.72rem", color: "#aaa", textAlign: "right", marginBottom: "4px" }}>
                      {final.atoms?.length ?? 0} atoms · {final.bonds?.length ?? 0} bonds
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <SetCanvas atoms={final.atoms} bonds={final.bonds} />
                    </div>
                    {final.explanation && (
                      <div style={{ fontSize: "0.85rem", color: "#555", fontStyle: "italic", marginTop: "6px" }}>
                        {final.explanation}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
