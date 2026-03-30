import React, { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import SetCanvas from "../setCanvas";
import { findRule, applyRule } from "../engine/reactionRules";
import { atomFill, atomTextColor, atomRadius } from "../engine/atomColors";
import "../App.css";

const WIDTH = 480;
const HEIGHT = 480;
const GRID_SPACING = 40;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);
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
  // Match subscript digits after a letter, OR a charge (+/-) that follows a letter/digit/closing paren
  const re = /([A-Za-z])(\d+)|([+-])(?=[A-Z()\s,/]|$)/g;
  let last = 0, m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    if (m[2]) {
      parts.push(m[1]);
      parts.push(<sub key={m.index} style={{ fontSize: "0.72em" }}>{m[2]}</sub>);
    } else {
      parts.push(<sup key={m.index} style={{ fontSize: "0.72em" }}>{m[3]}</sup>);
    }
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
  const [debugInfo, setDebugInfo] = useState(null);   // [{reagent, ruleName, noMatch, inputAtoms, inputBonds, mapping, rGroupCaptures, patternAtoms, delta}]
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [fbAtoms, setFbAtoms] = useState([]);
  const [fbBonds, setFbBonds] = useState([]);
  const [fbTool, setFbTool] = useState("pencil");
  const [fbAtomType, setFbAtomType] = useState("C");
  const [fbBondStyle, setFbBondStyle] = useState("solid");
  const [fbDragFrom, setFbDragFrom] = useState(null);
  const [fbDragTo, setFbDragTo] = useState(null);

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
    const ringCenter = {
      x: tmpl.offsets.reduce((s, o) => s + baseX + o.dx, 0) / tmpl.offsets.length,
      y: tmpl.offsets.reduce((s, o) => s + baseY + o.dy, 0) / tmpl.offsets.length,
    };
    tmpl.offsets.forEach(({ dx, dy }, i) => {
      const x = baseX + dx, y = baseY + dy;
      const existing = currentAtoms.find(a => Math.round(a.x) === Math.round(x) && Math.round(a.y) === Math.round(y));
      if (existing) { idMap[i] = existing.id; }
      else { idMap[i] = ts + i; newAtoms.push({ id: ts + i, x, y, label: 'C' }); }
    });
    const newBonds = tmpl.bonds
      .map((b, i) => ({ id: ts + 100 + i, from: idMap[b.a], to: idMap[b.b], order: b.order, style: 'solid', ringCenter }))
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
    setDebugInfo(null);
    setShowFeedback(false);

    let currentAtoms = atoms;
    let currentBonds = bonds;
    const steps = [];
    const debugSteps = [];

    for (const step of filledSteps) {
      const rule = await findRule(step);
      if (!rule) {
        setAiError(`No rule found for "${step}". Add it in Rule Builder first.`);
        setComputing(false);
        return;
      }

      // Snapshot the input molecule for this step (for debug display)
      const inputAtoms = currentAtoms;
      const inputBonds = currentBonds;

      const result = applyRule(currentAtoms, currentBonds, rule);
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

      // Collect debug info for this step
      debugSteps.push({
        reagent: step,
        ruleName: rule.name || rule.reagent,
        noMatch: result.noMatch || false,
        inputAtoms,
        inputBonds,
        mapping: result._debug?.mapping ?? new Map(),
        rGroupCaptures: result._debug?.rGroupCaptures ?? new Map(),
        patternAtoms: result._debug?.patternAtoms ?? [],
        delta: {
          removedAtoms: rule.delta?.removedAtomIds?.length ?? 0,
          addedAtoms: rule.delta?.addedAtoms?.length ?? 0,
          changedBonds: rule.delta?.changedBonds?.length ?? 0,
          addedBonds: rule.delta?.addedBonds?.length ?? 0,
        },
      });

      // Feed this step's product into the next step
      currentAtoms = product.atoms;
      currentBonds = product.bonds;
    }

    setProductSteps(steps);
    setDebugInfo(debugSteps);
    setComputing(false);
  };


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

                  const bpDx = a2.y - a1.y;
                  const bpDy = a2.x - a1.x;
                  const len = Math.sqrt(bpDx * bpDx + bpDy * bpDy) || 1;
                  let offsetX = (bpDx / len) * 4;
                  let offsetY = (bpDy / len) * 4;

                  if (bond.ringCenter && (bond.order || 1) > 1) {
                    const midX = (a1.x + a2.x) / 2;
                    const midY = (a1.y + a2.y) / 2;
                    const dot = offsetX * (bond.ringCenter.x - midX) + (-offsetY) * (bond.ringCenter.y - midY);
                    if (dot < 0) { offsetX = -offsetX; offsetY = -offsetY; }
                  }

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
                        fill={atom.id === selectedAtom ? "red" : atomFill(atom.label)}
                        stroke="#222"
                        strokeWidth="1"
                        pointerEvents="none"
                      />
                    )}
                    {!isC && (
                      <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12" fill={atomTextColor(atom.label)} pointerEvents="none">
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
                    <option value="Mg">Mg</option>
                    <option value="X">X (any halogen)</option>
                    <option value="R">R</option>
                    <option value="R'">R'</option>
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

        {/* Report Wrong Answer button */}
        {(productSteps.length > 0 || aiError) && (
          <div style={{ marginTop: "1rem" }}>
            <button
              onClick={() => {
                setShowFeedback(v => {
                  if (!v) { setFbAtoms([]); setFbBonds([]); setFeedbackText(""); }
                  return !v;
                });
              }}
              style={{ background: showFeedback ? "#5f021f" : "#f5e8eb", color: showFeedback ? "#fff" : "#5f021f", border: "1.5px solid #5f021f", borderRadius: "6px", padding: "7px 16px", fontSize: "0.9rem", cursor: "pointer", fontWeight: 600 }}
            >
              {showFeedback ? "✕ Close Report" : "📝 Report Wrong Answer"}
            </button>
          </div>
        )}

        {/* Report Wrong Answer panel */}
        {showFeedback && (
          <div style={{ marginTop: "0.75rem", border: "1.5px solid #5f021f", borderRadius: "10px", background: "#fff", padding: "1.25rem 1.5rem" }}>
            <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "#5f021f", marginBottom: "1rem" }}>
              📝 Report Wrong Answer
            </div>

            {/* What the app did */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
                What the app produced:
              </div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                {/* Step 0: original reactant */}
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: "3px" }}>Reactant</div>
                  <SetCanvas atoms={atoms} bonds={bonds} width={200} height={200} />
                </div>
                {/* Each step arrow + product */}
                {productSteps.map((step, si) => (
                  <React.Fragment key={si}>
                    <div style={{ textAlign: "center", fontSize: "0.82rem", color: "#5f021f", fontWeight: 600 }}>
                      <div style={{ marginBottom: "4px" }}>{formatReagentDisplay(step.reagent)}</div>
                      <svg width="50" height="16" viewBox="0 0 50 16">
                        <line x1="2" y1="8" x2="38" y2="8" stroke="#5f021f" strokeWidth="2" />
                        <polygon points="38,4 50,8 38,12" fill="#5f021f" />
                      </svg>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: "3px" }}>
                        {productSteps.length > 1 ? `Step ${si + 1}` : "Product"}
                        {step.noMatch && <span style={{ color: "#b87700" }}> ⚠️</span>}
                      </div>
                      <SetCanvas atoms={step.atoms} bonds={step.bonds} width={200} height={200} />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Draw correct product */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.6rem" }}>
                Draw what the correct product should be:
              </div>
              {/* Feedback canvas toolbar */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px", alignItems: "center" }}>
                <button className={`toolbar-btn${fbTool === "pencil" ? " toolbar-btn-active" : ""}`} onClick={() => setFbTool("pencil")}>Pencil</button>
                <button className={`toolbar-btn${fbTool === "eraser" ? " toolbar-btn-active" : ""}`} onClick={() => setFbTool("eraser")}>Eraser</button>
                <button className="toolbar-btn" onClick={() => { setFbAtoms([]); setFbBonds([]); }}>Clear</button>
                <select className="toolbar-select" value={fbAtomType} onChange={e => setFbAtomType(e.target.value)}>
                  <option value="C">C</option>
                  <option value="H">H</option>
                  <option value="O">O</option>
                  <option value="N">N</option>
                  <option value="Br">Br</option>
                  <option value="Cl">Cl</option>
                  <option value="F">F</option>
                  <option value="I">I</option>
                  <option value="OH">OH</option>
                  <option value="R">R</option>
                </select>
                <select className="toolbar-select" value={fbBondStyle} onChange={e => setFbBondStyle(e.target.value)}>
                  <option value="solid">Solid</option>
                  <option value="wedge">Wedge</option>
                  <option value="striped">Dashed</option>
                </select>
              </div>
              {/* Feedback canvas SVG */}
              <svg
                width={480} height={480}
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                style={{ display: "block", border: "1.5px solid #ccc", borderRadius: 6, background: "#fff", cursor: fbTool === "eraser" ? "not-allowed" : "crosshair", maxWidth: "100%" }}
                onMouseDown={e => {
                  if (fbTool === "eraser") return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const { snap } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
                  if (!snap) return;
                  const existing = fbAtoms.find(a => a.x === snap.x && a.y === snap.y);
                  setFbDragFrom({ x: snap.x, y: snap.y, atomId: existing?.id ?? null });
                  setFbDragTo(snap);
                }}
                onMouseMove={e => {
                  if (!fbDragFrom) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const { snap } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
                  if (snap) setFbDragTo(snap);
                }}
                onMouseUp={e => {
                  if (!fbDragFrom) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const { snap } = snapNearest(e.clientX - rect.left, e.clientY - rect.top);
                  const end = snap ?? fbDragTo;
                  const wasDrag = end && Math.hypot(end.x - fbDragFrom.x, end.y - fbDragFrom.y) > SNAP_RADIUS;
                  if (!wasDrag) {
                    // Click on grid point: add atom if nothing there, or erase
                    if (fbTool === "eraser") {
                      const hit = fbAtoms.find(a => a.x === fbDragFrom.x && a.y === fbDragFrom.y);
                      if (hit) { setFbAtoms(prev => prev.filter(a => a.id !== hit.id)); setFbBonds(prev => prev.filter(b => b.from !== hit.id && b.to !== hit.id)); }
                    } else {
                      const hit = fbAtoms.find(a => a.x === fbDragFrom.x && a.y === fbDragFrom.y);
                      if (!hit) setFbAtoms(prev => [...prev, { id: Date.now(), x: fbDragFrom.x, y: fbDragFrom.y, label: fbAtomType }]);
                    }
                  } else if (end) {
                    // Drag: create bond between grid points
                    let newA = [...fbAtoms];
                    let startId = fbDragFrom.atomId;
                    if (!startId) { startId = Date.now(); newA = [...newA, { id: startId, x: fbDragFrom.x, y: fbDragFrom.y, label: fbAtomType }]; }
                    const endAtom = newA.find(a => a.x === end.x && a.y === end.y);
                    let endId;
                    if (endAtom) { endId = endAtom.id; }
                    else { endId = Date.now() + 1; newA = [...newA, { id: endId, x: end.x, y: end.y, label: fbAtomType }]; }
                    if (startId !== endId && !fbBonds.some(b => (b.from === startId && b.to === endId) || (b.from === endId && b.to === startId))) {
                      setFbAtoms(newA);
                      setFbBonds(prev => [...prev, { id: Date.now() + 2, from: startId, to: endId, order: 1, style: fbBondStyle }]);
                    } else {
                      setFbAtoms(newA);
                    }
                  }
                  setFbDragFrom(null); setFbDragTo(null);
                }}
                onMouseLeave={() => { setFbDragFrom(null); setFbDragTo(null); }}
              >
                {/* Triangular grid dots — same as main canvas */}
                {gridPoints.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
                ))}

                {fbBonds.map(bond => {
                  const a1 = fbAtoms.find(a => a.id === bond.from);
                  const a2 = fbAtoms.find(a => a.id === bond.to);
                  if (!a1 || !a2) return null;
                  if (bond.style === "wedge") {
                    const angle = Math.atan2(a2.y - a1.y, a2.x - a1.x);
                    const perp = angle + Math.PI / 2;
                    return (
                      <polygon key={bond.id}
                        points={`${a1.x},${a1.y} ${a2.x + Math.cos(perp) * 6},${a2.y + Math.sin(perp) * 6} ${a2.x - Math.cos(perp) * 6},${a2.y - Math.sin(perp) * 6}`}
                        fill="#000"
                        onClick={() => setFbBonds(prev => prev.map(b => b.id === bond.id ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b))}
                      />
                    );
                  }
                  const ddx = a2.y - a1.y, ddy = a2.x - a1.x;
                  const len = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
                  const ox = (ddx / len) * 4, oy = (ddy / len) * 4;
                  return (
                    <g key={bond.id} onClick={() => setFbBonds(prev => prev.map(b => b.id === bond.id ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b))}>
                      <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="transparent" strokeWidth="14" />
                      {Array.from({ length: bond.order }).map((_, i) => (
                        <line key={i} x1={a1.x + ox * i} y1={a1.y - oy * i} x2={a2.x + ox * i} y2={a2.y - oy * i}
                          stroke="#000" strokeWidth="3" strokeDasharray={bond.style === "striped" ? "6,4" : "0"} pointerEvents="none" />
                      ))}
                    </g>
                  );
                })}

                {fbAtoms.map(atom => {
                  const isC = !atom.label || atom.label === "C";
                  const r = atomRadius(atom.label);
                  return (
                    <g key={atom.id}>
                      <circle cx={atom.x} cy={atom.y} r={r} fill="transparent"
                        onClick={() => {
                          if (fbTool === "eraser") {
                            setFbAtoms(prev => prev.filter(a => a.id !== atom.id));
                            setFbBonds(prev => prev.filter(b => b.from !== atom.id && b.to !== atom.id));
                          }
                        }}
                      />
                      {(!isC) && <circle cx={atom.x} cy={atom.y} r={r} fill={atomFill(atom.label)} stroke="#222" strokeWidth="1" />}
                      {(!isC) && <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12" fill={atomTextColor(atom.label)} pointerEvents="none">{atom.label}</text>}
                    </g>
                  );
                })}

                {/* Drag preview line */}
                {fbDragFrom && fbDragTo && Math.hypot(fbDragTo.x - fbDragFrom.x, fbDragTo.y - fbDragFrom.y) > SNAP_RADIUS && (
                  <line x1={fbDragFrom.x} y1={fbDragFrom.y} x2={fbDragTo.x} y2={fbDragTo.y} stroke="#999" strokeWidth="2" strokeDasharray="5,3" pointerEvents="none" />
                )}
              </svg>
              <div style={{ fontSize: "0.75rem", color: "#888", marginTop: "4px" }}>
                Click a grid point to place an atom · Drag between grid points to draw bonds · Click a bond to cycle order (single→double→triple) · Eraser tool to delete
              </div>
            </div>

            {/* Describe what's wrong */}
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
                Describe what went wrong:
              </div>
              <textarea
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder='e.g. "Br ended up on the wrong carbon" or "the double bond disappeared"'
                rows={3}
                style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #ccc", borderRadius: "6px", fontSize: "0.95rem", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>

            {/* Copy report button */}
            <button
              onClick={() => {
                const reagents = reagentSteps.filter(s => s.trim()).join(", ");
                const techLines = (debugInfo || []).map((step, si) => {
                  const mapping = [...step.mapping.entries()].map(([pid, mid]) => {
                    const pa = step.patternAtoms.find(a => a.id === pid);
                    const ma = step.inputAtoms.find(a => a.id === mid);
                    const rCap = step.rGroupCaptures.get(pid);
                    return `    ${pa?.label || 'C'} → ${ma?.label || 'C'}${rCap ? ` (+${rCap.size - 1} R-group atoms)` : ''}`;
                  }).join('\n');
                  const rGroups = [...step.rGroupCaptures.entries()].map(([pid, ids], ri) => {
                    const labels = [...ids].map(id => step.inputAtoms.find(a => a.id === id)?.label || 'C');
                    return `    R[${ri}]: ${ids.size} atoms [${labels.join(', ')}]`;
                  }).join('\n');
                  return [
                    `Step ${si + 1} (${step.reagent}) — Rule: "${step.ruleName}"${step.noMatch ? ' ⚠️ PATTERN NOT FOUND' : ''}`,
                    `  Mapping:\n${mapping || '    (none)'}`,
                    rGroups ? `  R groups:\n${rGroups}` : null,
                    `  Delta: removed ${step.delta.removedAtoms} atoms · added ${step.delta.addedAtoms} atoms · changed ${step.delta.changedBonds} bonds · added ${step.delta.addedBonds} bonds`,
                  ].filter(Boolean).join('\n');
                }).join('\n\n');

                const finalProduct = productSteps[productSteps.length - 1];
                const report = [
                  "=== Wrong Answer Report ===",
                  `Reagent(s): ${reagents}`,
                  `What went wrong: ${feedbackText || "(not described)"}`,
                  "",
                  "--- App's answer ---",
                  `Reactant: ${atoms.length} atoms, ${bonds.length} bonds`,
                  finalProduct ? `Product: ${finalProduct.atoms?.length ?? 0} atoms, ${finalProduct.bonds?.length ?? 0} bonds` : "(no product computed)",
                  fbAtoms.length > 0 ? `Correct product drawn: ${fbAtoms.length} atoms, ${fbBonds.length} bonds` : "Correct product: (not drawn)",
                  "",
                  "--- Technical details (for diagnosis) ---",
                  techLines || "(no debug info available)",
                ].join('\n');

                navigator.clipboard.writeText(report).then(() => alert("Report copied to clipboard! Paste it in the chat."));
              }}
              style={{ background: "#1a7a3a", color: "#fff", border: "none", borderRadius: "6px", padding: "9px 20px", fontSize: "0.95rem", fontWeight: 700, cursor: "pointer" }}
            >
              📋 Copy Report to Clipboard
            </button>
            <span style={{ marginLeft: "10px", fontSize: "0.82rem", color: "#888" }}>
              Then paste it in the chat with Claude to get help diagnosing the issue.
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
