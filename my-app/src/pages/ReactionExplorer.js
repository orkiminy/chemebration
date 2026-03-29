import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import SetCanvas from "../setCanvas";
import { findRule, applyRule } from "../engine/reactionRules";
import "../App.css";

const WIDTH = 480;
const HEIGHT = 480;
const GRID_SPACING = 40;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);
const ATOM_RADIUS = 12;
const SNAP_RADIUS = 10;

const RING_TEMPLATES = {
  benzene: {
    offsets: [
      { dx: 0, dy: 0 }, { dx: 40, dy: 0 },
      { dx: 60, dy: ROW_H }, { dx: 40, dy: 2 * ROW_H },
      { dx: 0, dy: 2 * ROW_H }, { dx: -20, dy: ROW_H },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 1, b: 2, order: 1 },
      { a: 2, b: 3, order: 2 }, { a: 3, b: 4, order: 1 },
      { a: 4, b: 5, order: 2 }, { a: 5, b: 0, order: 1 },
    ],
  },
  cyclohexane: {
    offsets: [
      { dx: 0, dy: 0 }, { dx: 40, dy: 0 },
      { dx: 60, dy: ROW_H }, { dx: 40, dy: 2 * ROW_H },
      { dx: 0, dy: 2 * ROW_H }, { dx: -20, dy: ROW_H },
    ],
    bonds: Array.from({ length: 6 }, (_, i) => ({ a: i, b: (i + 1) % 6, order: 1 })),
  },
};

const SUB_TO_PLAIN = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
function toPlainDigits(str) {
  return str.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => SUB_TO_PLAIN[c] || c);
}
function formatReagentDisplay(str) {
  if (!str) return null;
  const s = toPlainDigits(str);
  const parts = [];
  const re = /([A-Za-z])(\d+)/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push(m[1]);
    parts.push(<span key={m.index} style={{ fontSize: "0.72em", verticalAlign: "baseline" }}>{m[2]}</span>);
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.length > 1 ? parts : s;
}

export default function ReactionExplorer() {
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [history, setHistory] = useState([]);
  const [future,  setFuture]  = useState([]);
  const [dragFrom, setDragFrom] = useState(null); // { x, y, atomId|null }
  const [dragTo,   setDragTo]   = useState(null); // { x, y }
  const [ringType, setRingType] = useState(null); // 'benzene' | 'cyclohexane' | null

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

  /* ---------- HISTORY HELPERS ---------- */
  const saveHistory = (currentAtoms, currentBonds) => {
    setHistory(h => [...h.slice(-30), { atoms: currentAtoms, bonds: currentBonds }]);
    setFuture([]);
  };

  /* ---------- RING STAMP ---------- */
  const stampRing = (type, baseX, baseY, currentAtoms, currentBonds) => {
    const tmpl = RING_TEMPLATES[type];
    const ts = Date.now();
    const newAtoms = [];
    const idMap = {};
    tmpl.offsets.forEach(({ dx, dy }, i) => {
      const x = baseX + dx, y = baseY + dy;
      const existing = currentAtoms.find(a => Math.round(a.x) === Math.round(x) && Math.round(a.y) === Math.round(y));
      if (existing) { idMap[i] = existing.id; }
      else { idMap[i] = ts + i; newAtoms.push({ id: ts + i, x, y, label: 'C' }); }
    });
    const newBonds = tmpl.bonds
      .map((b, i) => ({ id: ts + 100 + i, from: idMap[b.a], to: idMap[b.b], order: b.order, style: 'solid' }))
      .filter(nb => !currentBonds.some(eb =>
        (eb.from === nb.from && eb.to === nb.to) || (eb.from === nb.to && eb.to === nb.from)
      ));
    saveHistory(currentAtoms, currentBonds);
    setAtoms(prev => [...prev, ...newAtoms]);
    setBonds(prev => [...prev, ...newBonds]);
  };

  /* ---------- KEYBOARD SHORTCUTS ---------- */
  useEffect(() => {
    const ATOM_CODES = {
      KeyC: 'C', KeyH: 'H', KeyO: 'O', KeyN: 'N',
      KeyF: 'F', KeyI: 'I', KeyS: 'S', KeyP: 'P',
      KeyB: 'Br', KeyL: 'Cl', KeyR: 'R', KeyX: 'X',
    };
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      // Undo
      if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        setHistory(h => {
          if (!h.length) return h;
          const prev = h[h.length - 1];
          setFuture(f => [{ atoms, bonds }, ...f]);
          setAtoms(prev.atoms); setBonds(prev.bonds);
          return h.slice(0, -1);
        });
        return;
      }
      // Redo
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        setFuture(f => {
          if (!f.length) return f;
          const next = f[0];
          setHistory(h => [...h, { atoms, bonds }]);
          setAtoms(next.atoms); setBonds(next.bonds);
          return f.slice(1);
        });
        return;
      }

      if (e.key === 'Delete') {
        if (selectedBond) { setBonds(prev => prev.filter(b => b.id !== selectedBond)); setSelectedBond(null); }
        if (selectedAtom) {
          saveHistory(atoms, bonds);
          setAtoms(prev => prev.filter(a => a.id !== selectedAtom));
          setBonds(prev => prev.filter(b => b.from !== selectedAtom && b.to !== selectedAtom));
          setSelectedAtom(null);
        }
        return;
      }

      const newLabel = ATOM_CODES[e.code];
      if (!newLabel) return;

      // Relabel selected atom
      if (selectedAtom !== null) {
        saveHistory(atoms, bonds);
        setAtoms(prev => prev.map(a => a.id === selectedAtom ? { ...a, label: newLabel } : a));
        setSelectedAtom(null);
        return;
      }
      // Otherwise switch draw type
      setAtomType(newLabel); setTool('pencil'); setRingType(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBond, selectedAtom, atoms, bonds]);

  /* ---------- GRID SNAP HELPER ---------- */
  const snapNearest = (x, y) => {
    let closest = null, minDist = Infinity;
    for (const p of gridPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; closest = p; }
    }
    return { snap: closest, dist: minDist };
  };

  /* ---------- CANVAS INTERACTIONS ---------- */
  const handleCanvasMouseDown = (e) => {
    if (tool === "eraser") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { snap, dist } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
    if (!snap || dist > SNAP_RADIUS * 3) return;
    const existingAtom = atoms.find(a => a.x === snap.x && a.y === snap.y);
    setDragFrom({ x: snap.x, y: snap.y, atomId: existingAtom?.id ?? null });
    setDragTo(snap);
  };

  const handleCanvasMouseMove = (e) => {
    if (!dragFrom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { snap } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
    if (snap) setDragTo(snap);
  };

  const handleCanvasMouseUp = (e) => {
    if (!dragFrom) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const { snap } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
    const end = snap ?? dragTo;

    const wasDrag = end && (Math.hypot(end.x - dragFrom.x, end.y - dragFrom.y) > SNAP_RADIUS);

    if (!wasDrag) {
      // Treat as a plain click — add atom on empty spot, or deselect
      if (ringType && end) {
        stampRing(ringType, end.x, end.y, atoms, bonds);
      } else if (!atoms.some(a => a.x === dragFrom.x && a.y === dragFrom.y)) {
        saveHistory(atoms, bonds);
        setAtoms(prev => [...prev, { id: Date.now(), x: dragFrom.x, y: dragFrom.y, label: atomType }]);
      }
      setSelectedAtom(null);
    } else if (end) {
      // Drag → create bond (and atoms if needed)
      let newAtoms = [...atoms];
      let startId = dragFrom.atomId;
      if (!startId) {
        startId = Date.now();
        newAtoms = [...newAtoms, { id: startId, x: dragFrom.x, y: dragFrom.y, label: atomType }];
      }
      let endAtom = newAtoms.find(a => a.x === end.x && a.y === end.y);
      let endId;
      if (endAtom) {
        endId = endAtom.id;
      } else {
        endId = Date.now() + 1;
        newAtoms = [...newAtoms, { id: endId, x: end.x, y: end.y, label: atomType }];
      }
      if (startId !== endId && !bonds.some(b =>
        (b.from === startId && b.to === endId) || (b.from === endId && b.to === startId)
      )) {
        saveHistory(atoms, bonds);
        setAtoms(newAtoms);
        setBonds(prev => [...prev, { id: Date.now() + 2, from: startId, to: endId, order: 1, style: bondStyle }]);
      }
      setSelectedAtom(null);
    }

    setDragFrom(null);
    setDragTo(null);
  };

  const handleAtomMouseDown = (e, atomId) => {
    if (tool === "eraser") return;
    e.stopPropagation();
    const atom = atoms.find(a => a.id === atomId);
    if (atom) setDragFrom({ x: atom.x, y: atom.y, atomId });
  };

  const handleAtomClick = (e, atomId) => {
    e.stopPropagation();
    if (tool === "eraser") {
      saveHistory(atoms, bonds);
      setAtoms(atoms.filter(a => a.id !== atomId));
      setBonds(bonds.filter(b => b.from !== atomId && b.to !== atomId));
      return;
    }
    // Only register as click if no drag happened
    if (dragFrom) return;
    if (selectedAtom === null) { setSelectedAtom(atomId); return; }
    if (selectedAtom === atomId) { setSelectedAtom(null); return; }
    const exists = bonds.some(b =>
      (b.from === selectedAtom && b.to === atomId) || (b.from === atomId && b.to === selectedAtom)
    );
    if (!exists) {
      saveHistory(atoms, bonds);
      setBonds(prev => [...prev, { id: Date.now(), from: selectedAtom, to: atomId, order: 1, style: bondStyle }]);
    }
    setSelectedAtom(null);
  };

  const handleBondClick = (bondId) => {
    if (tool === "eraser") {
      saveHistory(atoms, bonds);
      setBonds(bonds.filter(b => b.id !== bondId));
      return;
    }
    saveHistory(atoms, bonds);
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
            <div className="exercise-panel-box" style={{ width: WIDTH }}>
              <div className="exercise-panel-label">Reactant</div>
              <svg
                width={WIDTH}
                height={HEIGHT}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                style={{ display: "block", cursor: tool === "eraser" ? "not-allowed" : ringType ? "copy" : "crosshair" }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={() => { setDragFrom(null); setDragTo(null); }}
              >
                {gridPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
                ))}

                {bonds.map(bond => {
                  const a1 = atoms.find(a => a.id === bond.from);
                  const a2 = atoms.find(a => a.id === bond.to);
                  if (!a1 || !a2) return null;

                  const bondHandlers = {
                    onMouseDown: (e) => e.stopPropagation(),
                    onClick: (e) => { e.stopPropagation(); handleBondClick(bond.id); },
                  };

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
                        {...bondHandlers}
                      />
                    );
                  }

                  const dx = a2.y - a1.y;
                  const dy = a2.x - a1.x;
                  const len = Math.sqrt(dx * dx + dy * dy) || 1;
                  const offsetX = (dx / len) * 4;
                  const offsetY = (dy / len) * 4;

                  return (
                    <g key={bond.id}>
                      {/* Invisible wide hit-target so clicks near the bond always register */}
                      <line
                        x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y}
                        stroke="transparent" strokeWidth="16"
                        {...bondHandlers}
                      />
                      {[...Array(bond.order)].map((_, i) => (
                        <line
                          key={i}
                          x1={a1.x + offsetX * i}
                          y1={a1.y - offsetY * i}
                          x2={a2.x + offsetX * i}
                          y2={a2.y - offsetY * i}
                          stroke={bond.id === selectedBond ? "red" : "#000"}
                          strokeWidth="3"
                          strokeDasharray={bond.style === "striped" ? "6,4" : "0"}
                          pointerEvents="none"
                        />
                      ))}
                    </g>
                  );
                })}

                {atoms.map(atom => {
                  const isC = !atom.label || atom.label === "C";
                  return (
                  <g key={atom.id}>
                    {/* Invisible hit target — always present so C atoms can be clicked/dragged */}
                    <circle
                      cx={atom.x}
                      cy={atom.y}
                      r={atomRadius(atom.label)}
                      fill="transparent"
                      onMouseDown={(e) => handleAtomMouseDown(e, atom.id)}
                      onClick={(e) => handleAtomClick(e, atom.id)}
                    />
                    {/* Visible circle — non-carbon only, OR any atom when selected */}
                    {(!isC || atom.id === selectedAtom) && (
                      <circle
                        cx={atom.x}
                        cy={atom.y}
                        r={atomRadius(atom.label)}
                        fill={atom.id === selectedAtom ? "red" : "#5f021f"}
                        pointerEvents="none"
                      />
                    )}
                    {!isC && (
                      <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12" fill="#fff" pointerEvents="none">
                        {atom.label}
                      </text>
                    )}
                  </g>
                  );
                })}

                {/* Drag preview line */}
                {dragFrom && dragTo && (Math.hypot(dragTo.x - dragFrom.x, dragTo.y - dragFrom.y) > SNAP_RADIUS) && (
                  <line
                    x1={dragFrom.x} y1={dragFrom.y}
                    x2={dragTo.x}   y2={dragTo.y}
                    stroke="#999" strokeWidth="2" strokeDasharray="5,3" pointerEvents="none"
                  />
                )}
              </svg>
            </div>

            {/* Toolbar lives outside the panel-box so it can never affect the canvas width */}
            <div className="exercise-toolbar" style={{ width: WIDTH, boxSizing: "border-box" }}>
              <div className="toolbar-group">
                <button className={`toolbar-btn${tool === "pencil" ? " toolbar-btn-active" : ""}`} onClick={() => { setTool("pencil"); setRingType(null); }}>Pencil</button>
                <button className={`toolbar-btn${tool === "eraser" ? " toolbar-btn-active" : ""}`} onClick={() => { setTool("eraser"); setRingType(null); }}>Eraser</button>
                <button className="toolbar-btn" onClick={() => { saveHistory(atoms, bonds); setAtoms([]); setBonds([]); }}>Clear</button>
                <button className="toolbar-btn" disabled={!history.length} onClick={() => {
                  const prev = history[history.length - 1];
                  setFuture(f => [{ atoms, bonds }, ...f]);
                  setHistory(h => h.slice(0, -1));
                  setAtoms(prev.atoms); setBonds(prev.bonds);
                }}>↩ Undo</button>
                <button className="toolbar-btn" disabled={!future.length} onClick={() => {
                  const next = future[0];
                  setHistory(h => [...h, { atoms, bonds }]);
                  setFuture(f => f.slice(1));
                  setAtoms(next.atoms); setBonds(next.bonds);
                }}>↪ Redo</button>
              </div>
              <div className="toolbar-group">
                <button className={`toolbar-btn${ringType === 'benzene' ? ' toolbar-btn-active' : ''}`} onClick={() => { setRingType(r => r === 'benzene' ? null : 'benzene'); setTool('pencil'); }}>Benzene</button>
                <button className={`toolbar-btn${ringType === 'cyclohexane' ? ' toolbar-btn-active' : ''}`} onClick={() => { setRingType(r => r === 'cyclohexane' ? null : 'cyclohexane'); setTool('pencil'); }}>Cyclohex</button>
              </div>
              {tool === "pencil" && !ringType && (
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

          {/* Middle: reagent steps + arrow + compute */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
            <div style={{ border: "1px solid #ccc", borderRadius: "8px", background: "#fff", minWidth: "200px" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, textTransform: "uppercase", color: "#5f021f", padding: "8px 0", textAlign: "center", background: "#faf5f7", borderBottom: "1px solid #eee", borderRadius: "8px 8px 0 0" }}>Reagent</div>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px", alignItems: "stretch" }}>

                {/* Numbered reagent steps */}
                {reagentSteps.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#5f021f", fontWeight: "bold", fontSize: "0.9rem", minWidth: "20px" }}>{i + 1}.</span>
                    <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                      <input
                        type="text"
                        value={step}
                        onChange={(e) => updateStep(i, toPlainDigits(e.target.value))}
                        onKeyDown={(e) => e.key === "Enter" && handleCompute()}
                        placeholder=""
                        style={{ width: "100%", padding: "6px 8px 9px", border: "1.5px solid #5f021f", borderRadius: "5px", fontSize: "1.05rem", textAlign: "center", lineHeight: "1.6", color: "transparent", caretColor: "#5f021f", background: "white", boxSizing: "border-box" }}
                      />
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.05rem", pointerEvents: "none", overflow: "hidden" }}>
                        <span style={{ whiteSpace: "nowrap", color: step ? "#000" : "#999" }}>
                          {step ? formatReagentDisplay(step) : (i === 0 ? "e.g. HBr" : "e.g. H2O")}
                        </span>
                      </div>
                    </div>
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
