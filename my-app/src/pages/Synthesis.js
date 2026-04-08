import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { atomFill, atomTextColor, atomRadius } from "../engine/atomColors";
import { loadRules } from "../engine/reactionRules";
import { findPossibleDisconnections, isSimpleMolecule } from "../engine/retroSynthesis";
import { checkTopologicalIsomorphism } from "../chemistryUtils";
import SetCanvas from "../setCanvas";
import "../App.css";

const WIDTH = 480;
const HEIGHT = 480;
const GRID_SPACING = 40;
const SNAP_RADIUS = 10;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);

const RING_TEMPLATES = {
  benzene: {
    offsets: [
      { dx: 0, dy: 0 },           { dx: -60, dy: ROW_H },
      { dx: -60, dy: 3 * ROW_H }, { dx: 0, dy: 4 * ROW_H },
      { dx: 60, dy: 3 * ROW_H },  { dx: 60, dy: ROW_H },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 1, b: 2, order: 1 },
      { a: 2, b: 3, order: 2 }, { a: 3, b: 4, order: 1 },
      { a: 4, b: 5, order: 2 }, { a: 5, b: 0, order: 1 },
    ],
  },
  cyclohexane: {
    offsets: [
      { dx: 0, dy: 0 },           { dx: -60, dy: ROW_H },
      { dx: -60, dy: 3 * ROW_H }, { dx: 0, dy: 4 * ROW_H },
      { dx: 60, dy: 3 * ROW_H },  { dx: 60, dy: ROW_H },
    ],
    bonds: Array.from({ length: 6 }, (_, i) => ({ a: i, b: (i + 1) % 6, order: 1 })),
  },
};

export default function Synthesis() {
  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [ringType, setRingType] = useState(null);
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);

  // Retrosynthesis state
  const [rules, setRules] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const loadedRef = useRef(false);

  // Interactive retro state
  const [disconnections, setDisconnections] = useState([]); // possible next steps
  const [steps, setSteps] = useState([]); // accumulated path [{atoms, bonds, reagent, ruleName}]
  const [currentTarget, setCurrentTarget] = useState(null); // eslint-disable-line no-unused-vars
  const [pathComplete, setPathComplete] = useState(false);

  // Load rules from Firestore on mount
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadRules().then(r => {
      console.log(`[Synthesis] Loaded ${r.length} rules`);
      setRules(r);
      window.__DEBUG_RULES__ = r; // for test-retro.mjs debugging
    });
  }, []);

  const handleFindDisconnections = (targetAtoms, targetBonds, previousSteps = []) => {
    setAnalyzing(true);
    setDisconnections([]);

    setTimeout(() => {
      console.log(`[Synthesis] Finding disconnections for ${targetAtoms.length} atoms, ${targetBonds.length} bonds`);
      let results = findPossibleDisconnections(targetAtoms, targetBonds, rules);

      // Filter out disconnections whose precursor matches an ancestor step (prevents cycles).
      // Exclude the last element — that's the current molecule being analyzed, not an ancestor.
      const ancestors = previousSteps.slice(0, -1);
      if (ancestors.length > 0) {
        const before = results.length;
        results = results.filter(disc => {
          const blocked = ancestors.some((step, i) =>
            checkTopologicalIsomorphism(disc.precursor.atoms, disc.precursor.bonds, step.atoms, step.bonds)
          );
          if (blocked) console.log(`[Synthesis] FILTERED by ancestor check: "${disc.rule.name}"`);
          return !blocked;
        });
        if (results.length < before) console.log(`[Synthesis] Ancestor filter removed ${before - results.length} disconnection(s)`);
      }

      console.log(`[Synthesis] Found ${results.length} possible disconnections (${results.filter(d => d.verified).length} verified)`);
      setDisconnections(results);
      setAnalyzing(false);
    }, 50);
  };

  const handleStartAnalysis = () => {
    if (atoms.length === 0) return;
    setSteps([{ atoms, bonds, reagent: null, ruleName: "Target" }]);
    setCurrentTarget({ atoms, bonds });
    setPathComplete(false);
    handleFindDisconnections(atoms, bonds);
  };

  const handlePickDisconnection = (disc) => {
    const precursor = disc.precursor;
    const newSteps = [...steps, {
      atoms: precursor.atoms,
      bonds: precursor.bonds,
      reagent: disc.rule.reagent,
      ruleName: disc.rule.name,
    }];
    setSteps(newSteps);
    setCurrentTarget(precursor);

    // Check if precursor is simple
    if (isSimpleMolecule(precursor.atoms, precursor.bonds)) {
      setPathComplete(true);
      setDisconnections([]);
    } else {
      handleFindDisconnections(precursor.atoms, precursor.bonds, newSteps);
    }
  };

  const handleUndo = () => {
    if (steps.length <= 1) return;
    const newSteps = steps.slice(0, -1);
    const prev = newSteps[newSteps.length - 1];
    setSteps(newSteps);
    setCurrentTarget(prev);
    setPathComplete(false);
    handleFindDisconnections(prev.atoms, prev.bonds, newSteps);
  };

  const handleReset = () => {
    setSteps([]);
    setCurrentTarget(null);
    setDisconnections([]);
    setPathComplete(false);
  };

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

  const snapNearest = (x, y) => {
    let closest = null, minDist = Infinity;
    for (const p of gridPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; closest = p; }
    }
    return { snap: closest, dist: minDist };
  };

  /* ---------- HISTORY ---------- */
  const saveHistory = (a, b) => {
    setHistory(h => [...h.slice(-30), { atoms: a, bonds: b }]);
    setFuture([]);
  };

  /* ---------- RING STAMP ---------- */
  const stampRing = (type, baseX, baseY) => {
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
      const existing = atoms.find(a => Math.round(a.x) === Math.round(x) && Math.round(a.y) === Math.round(y));
      if (existing) { idMap[i] = existing.id; }
      else { idMap[i] = ts + i; newAtoms.push({ id: ts + i, x, y, label: "C" }); }
    });
    const newBonds = tmpl.bonds
      .map((b, i) => ({ id: ts + 100 + i, from: idMap[b.a], to: idMap[b.b], order: b.order, style: "solid", ringCenter }))
      .filter(nb => !bonds.some(eb =>
        (eb.from === nb.from && eb.to === nb.to) || (eb.from === nb.to && eb.to === nb.from)
      ));
    saveHistory(atoms, bonds);
    setAtoms(prev => [...prev, ...newAtoms]);
    setBonds(prev => [...prev, ...newBonds]);
  };

  /* ---------- INTERACTION HANDLERS ---------- */
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
      if (ringType && end) {
        stampRing(ringType, end.x, end.y);
      } else if (!atoms.some(a => a.x === dragFrom.x && a.y === dragFrom.y)) {
        saveHistory(atoms, bonds);
        setAtoms(prev => [...prev, { id: Date.now(), x: dragFrom.x, y: dragFrom.y, label: atomType }]);
      }
      setSelectedAtom(null);
    } else if (end) {
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
    if (dragFrom) return;
    if (selectedAtom === null) { setSelectedAtom(atomId); return; }
    if (selectedAtom === atomId) { setSelectedAtom(null); return; }
    const exists = bonds.some(b =>
      (b.from === selectedAtom && b.to === atomId) || (b.from === atomId && b.to === selectedAtom)
    );
    if (!exists) {
      saveHistory(atoms, bonds);
      setBonds([...bonds, { id: Date.now(), from: selectedAtom, to: atomId, order: 1, style: bondStyle }]);
    }
    setSelectedAtom(null);
  };

  const handleBondClick = (bondId) => {
    if (tool === "eraser") {
      saveHistory(atoms, bonds);
      const newBonds = bonds.filter(b => b.id !== bondId);
      const connectedIds = new Set();
      newBonds.forEach(b => { connectedIds.add(b.from); connectedIds.add(b.to); });
      setAtoms(atoms.filter(a => connectedIds.has(a.id)));
      setBonds(newBonds);
      return;
    }
    saveHistory(atoms, bonds);
    setBonds(bonds.map(b => b.id === bondId ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b));
    setSelectedBond(bondId);
  };

  /* ---------- KEYBOARD SHORTCUTS ---------- */
  useEffect(() => {
    const ATOM_CODES = {
      KeyC: "C", KeyH: "H", KeyO: "O", KeyN: "N",
      KeyF: "F", KeyI: "I", KeyS: "S", KeyP: "P",
      KeyB: "Br", KeyL: "Cl", KeyR: "R", KeyX: "X",
    };
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;
      if (e.ctrlKey && !e.shiftKey && e.key === "z") {
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
      if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
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
      const newLabel = ATOM_CODES[e.code];
      if (!newLabel) return;
      if (selectedAtom !== null) {
        saveHistory(atoms, bonds);
        setAtoms(atoms.map(a => a.id === selectedAtom ? { ...a, label: newLabel } : a));
        setSelectedAtom(null);
        return;
      }
      if (selectedBond !== null) {
        const newStyle = e.code === "KeyW" ? "wedge" : e.code === "KeyD" ? "striped" : null;
        if (newStyle) {
          saveHistory(atoms, bonds);
          setBonds(bonds.map(b => b.id === selectedBond ? { ...b, style: newStyle } : b));
        }
        setSelectedAtom(null);
        return;
      }
      setAtomType(newLabel);
      setTool("pencil");
      setRingType(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedBond, selectedAtom, atoms, bonds]);

  /* ---------- RENDER ---------- */
  const showCanvas = steps.length === 0;
  const forwardSteps = [...steps].reverse(); // forward order: precursor first, target last

  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">Retrosynthesis</span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      <div style={{ maxWidth: 1200, margin: "1.5rem auto", padding: "0 1rem" }}>

        {/* ===== PHASE 1: Drawing canvas (before analysis) ===== */}
        {showCanvas && (
          <>
            <h2 style={{ color: "#5f021f", marginBottom: "0.5rem" }}>Draw your target molecule</h2>
            <p style={{ color: "#666", marginTop: 0 }}>
              Draw the product you want to synthesize, then click "Find Disconnections".
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div>
                <div className="exercise-panel-box">
                  <div className="exercise-panel-label">Target Product</div>
                  <svg
                    width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    style={{ display: "block", maxWidth: "100%", height: "auto", cursor: tool === "eraser" ? "not-allowed" : ringType ? "copy" : "crosshair" }}
                    onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp} onMouseLeave={() => { setDragFrom(null); setDragTo(null); }}
                  >
                    {gridPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />)}
                    {bonds.map(bond => {
                      const a1 = atoms.find(a => a.id === bond.from);
                      const a2 = atoms.find(a => a.id === bond.to);
                      if (!a1 || !a2) return null;
                      const bondHandlers = { onMouseDown: (e) => e.stopPropagation(), onClick: (e) => { e.stopPropagation(); handleBondClick(bond.id); } };
                      if (bond.style === "wedge") {
                        const dx = a2.x - a1.x, dy = a2.y - a1.y, angle = Math.atan2(dy, dx), w = 6, perp = angle + Math.PI / 2;
                        return <polygon key={bond.id} points={`${a1.x},${a1.y} ${a2.x + Math.cos(perp) * w},${a2.y + Math.sin(perp) * w} ${a2.x - Math.cos(perp) * w},${a2.y - Math.sin(perp) * w}`} fill={bond.id === selectedBond ? "red" : "#000"} {...bondHandlers} />;
                      }
                      const bpDx = a2.y - a1.y, bpDy = a2.x - a1.x, len = Math.sqrt(bpDx * bpDx + bpDy * bpDy) || 1;
                      let offsetX = (bpDx / len) * 4, offsetY = (bpDy / len) * 4;
                      if (bond.ringCenter && (bond.order || 1) > 1) {
                        const midX = (a1.x + a2.x) / 2, midY = (a1.y + a2.y) / 2;
                        const dot = offsetX * (bond.ringCenter.x - midX) + (-offsetY) * (bond.ringCenter.y - midY);
                        if (dot < 0) { offsetX = -offsetX; offsetY = -offsetY; }
                      }
                      return (
                        <g key={bond.id}>
                          <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke="transparent" strokeWidth="16" {...bondHandlers} />
                          {[...Array(bond.order)].map((_, i) => (
                            <line key={i} x1={a1.x + offsetX * i} y1={a1.y - offsetY * i} x2={a2.x + offsetX * i} y2={a2.y - offsetY * i}
                              stroke={bond.id === selectedBond ? "red" : "#000"} strokeWidth="3" strokeDasharray={bond.style === "striped" ? "6,4" : "0"} pointerEvents="none" />
                          ))}
                        </g>
                      );
                    })}
                    {atoms.map(atom => {
                      const isC = !atom.label || atom.label === "C";
                      return (
                        <g key={atom.id}>
                          <circle cx={atom.x} cy={atom.y} r={atomRadius(atom.label)} fill="transparent" onMouseDown={(e) => handleAtomMouseDown(e, atom.id)} onClick={(e) => handleAtomClick(e, atom.id)} />
                          {(!isC || atom.id === selectedAtom) && <circle cx={atom.x} cy={atom.y} r={atomRadius(atom.label)} fill={atom.id === selectedAtom ? "red" : atomFill(atom.label)} stroke="#222" strokeWidth="1" pointerEvents="none" />}
                          {!isC && <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12" fill={atomTextColor(atom.label)} pointerEvents="none">{atom.label}</text>}
                        </g>
                      );
                    })}
                    {dragFrom && dragTo && (Math.hypot(dragTo.x - dragFrom.x, dragTo.y - dragFrom.y) > SNAP_RADIUS) && (
                      <line x1={dragFrom.x} y1={dragFrom.y} x2={dragTo.x} y2={dragTo.y} stroke="#999" strokeWidth="2" strokeDasharray="5,3" pointerEvents="none" />
                    )}
                  </svg>
                </div>
                <div className="exercise-toolbar" style={{ width: WIDTH, boxSizing: "border-box" }}>
                  <div className="toolbar-group">
                    <button className={`toolbar-btn${tool === "pencil" ? " toolbar-btn-active" : ""}`} onClick={() => { setTool("pencil"); setRingType(null); }}>Pencil</button>
                    <button className={`toolbar-btn${tool === "eraser" ? " toolbar-btn-active" : ""}`} onClick={() => { setTool("eraser"); setRingType(null); }}>Eraser</button>
                    <button className="toolbar-btn" onClick={() => { saveHistory(atoms, bonds); setAtoms([]); setBonds([]); }}>Clear</button>
                    <button className="toolbar-btn" disabled={!history.length} onClick={() => { const prev = history[history.length - 1]; setFuture(f => [{ atoms, bonds }, ...f]); setHistory(h => h.slice(0, -1)); setAtoms(prev.atoms); setBonds(prev.bonds); }}>&#8617; Undo</button>
                    <button className="toolbar-btn" disabled={!future.length} onClick={() => { const next = future[0]; setHistory(h => [...h, { atoms, bonds }]); setFuture(f => f.slice(1)); setAtoms(next.atoms); setBonds(next.bonds); }}>&#8618; Redo</button>
                  </div>
                  <div className="toolbar-group">
                    <button className={`toolbar-btn${ringType === "benzene" ? " toolbar-btn-active" : ""}`} onClick={() => { setRingType(r => r === "benzene" ? null : "benzene"); setTool("pencil"); }}>Benzene</button>
                    <button className={`toolbar-btn${ringType === "cyclohexane" ? " toolbar-btn-active" : ""}`} onClick={() => { setRingType(r => r === "cyclohexane" ? null : "cyclohexane"); setTool("pencil"); }}>Cyclohex</button>
                  </div>
                  {tool === "pencil" && !ringType && (
                    <div className="toolbar-group">
                      <select className="toolbar-select" value={atomType} onChange={(e) => setAtomType(e.target.value)}>
                        <option value="C">C</option><option value="H">H</option><option value="O">O</option><option value="N">N</option>
                        <option value="Br">Br</option><option value="Cl">Cl</option><option value="F">F</option><option value="I">I</option>
                        <option value="S">S</option><option value="P">P</option><option value="OH">OH</option>
                      </select>
                      <select className="toolbar-select" value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
                        <option value="solid">Solid (Line)</option><option value="wedge">Solid (Wedge)</option><option value="striped">Dashed (Striped)</option>
                      </select>
                    </div>
                  )}
                  <div className="toolbar-group">
                    <button className="toolbar-btn toolbar-btn-check" disabled={atoms.length === 0} onClick={handleStartAnalysis}>
                      Find Disconnections
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== PHASE 2: Analysis mode (after clicking Find Disconnections) ===== */}
        {!showCanvas && (
          <>
            {/* Controls bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
              <h2 style={{ color: "#5f021f", margin: 0 }}>Synthesis Path</h2>
              {steps.length > 1 && (
                <button onClick={handleUndo} style={{ padding: "8px 16px", fontSize: "0.9rem", background: "#fff", border: "2px solid #5f021f", color: "#5f021f", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>&#8617; Undo Step</button>
              )}
              <button onClick={handleReset} style={{ padding: "8px 16px", fontSize: "0.9rem", background: "#5f021f", border: "none", color: "#fff", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Start Over</button>
              {pathComplete && (
                <span style={{ color: "#1a6b3a", fontWeight: 600, fontSize: "1.1rem", marginLeft: 8 }}>Path complete!</span>
              )}
            </div>

            {/* Analyzing spinner */}
            {analyzing && (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#5f021f", border: "2px dashed #5f021f", borderRadius: 10, marginBottom: "1.5rem" }}>
                <p style={{ margin: 0 }}>Finding possible disconnections...</p>
              </div>
            )}

            {/* Disconnection choices — AT THE TOP */}
            {!analyzing && !pathComplete && disconnections.length > 0 && (
              <div style={{ marginBottom: "2rem" }}>
                <h3 style={{ color: "#333", marginBottom: "0.25rem", fontSize: "1.3rem" }}>
                  Choose a disconnection ({disconnections.length} option{disconnections.length !== 1 ? "s" : ""})
                </h3>
                <p style={{ color: "#888", fontSize: "1rem", marginTop: 0, marginBottom: "1rem" }}>
                  Which reaction produced the current molecule?
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
                  {disconnections.map((disc, i) => (
                    <button
                      key={i}
                      onClick={() => handlePickDisconnection(disc)}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        padding: "1rem 1.25rem", border: disc.verified ? "2px solid #1a6b3a" : "2px solid #ddd",
                        borderRadius: 12, background: disc.verified ? "#f0fff0" : "#fff",
                        cursor: "pointer", textAlign: "center", width: 220,
                        transition: "box-shadow 0.15s, transform 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.15)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
                    >
                      <div style={{ width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.5rem" }}>
                        <SetCanvas atoms={disc.precursor.atoms} bonds={disc.precursor.bonds} hideGrid size={140} />
                      </div>
                      <div style={{ fontWeight: 700, color: "#5f021f", fontSize: "1.05rem" }}>{disc.rule.reagent}</div>
                      <div style={{ fontSize: "0.9rem", color: "#555", marginTop: 4 }}>{disc.rule.name}</div>
                      <div style={{ fontSize: "0.8rem", color: disc.verified ? "#1a6b3a" : "#c90", marginTop: 6, fontWeight: 600 }}>
                        {disc.verified ? "Verified ✓" : "Unverified"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* No disconnections found */}
            {!analyzing && !pathComplete && disconnections.length === 0 && (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "#c00", border: "1px solid #fcc", borderRadius: 10, background: "#fff5f5", marginBottom: "1.5rem" }}>
                <p style={{ margin: 0 }}>No disconnections found. Try undoing the last step or starting over.</p>
              </div>
            )}

            {/* Synthesis chain — AT THE BOTTOM, wraps to next line */}
            <div style={{ borderTop: "2px solid #eee", paddingTop: "1.5rem" }}>
              <h3 style={{ color: "#5f021f", marginBottom: "1rem", fontSize: "1.3rem" }}>
                Synthesis Path ({steps.length - 1} step{steps.length - 1 !== 1 ? "s" : ""})
              </h3>
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "12px 0" }}>
                {forwardSteps.map((step, i) => {
                  const isLast = i === forwardSteps.length - 1;
                  const isFirst = i === 0;
                  const isCurrent = isFirst && !pathComplete;

                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {/* Arrow BEFORE this molecule (except the first) */}
                      {!isFirst && (() => {
                        const prevStep = forwardSteps[i - 1];
                        const reagent = prevStep.reagent || step.reagent;
                        const rule = prevStep.reagent ? prevStep.ruleName : step.ruleName;
                        return (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 6px", width: 120 }}>
                            {reagent && reagent !== "Target" && (
                              <div style={{ fontSize: "0.9rem", color: "#5f021f", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
                                {reagent}
                              </div>
                            )}
                            <svg width="60" height="16" viewBox="0 0 60 16" style={{ margin: "4px 0", flexShrink: 0 }}>
                              <line x1="2" y1="8" x2="46" y2="8" stroke="#5f021f" strokeWidth="2.5" />
                              <polygon points="46,4 58,8 46,12" fill="#5f021f" />
                            </svg>
                            {rule && rule !== "Target" && (
                              <div style={{ fontSize: "0.75rem", color: "#777", textAlign: "center", lineHeight: 1.2 }}>
                                {rule}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Molecule card */}
                      <div style={{
                        border: (isCurrent || isLast) ? "2px solid #5f021f" : "1px solid #ddd",
                        borderRadius: 12,
                        padding: "8px",
                        background: isLast ? "#fdf5f7" : isCurrent ? "#f5f0ff" : "#fff",
                        width: 160,
                        textAlign: "center",
                        flexShrink: 0,
                      }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: (isCurrent || isLast) ? "#5f021f" : "#666", marginBottom: 4 }}>
                          {isLast ? "Target" : isFirst && pathComplete ? "Start" : isCurrent ? "Current" : `Step ${i}`}
                        </div>
                        <div style={{ width: 144, height: 144, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <SetCanvas atoms={step.atoms} bonds={step.bonds} hideGrid size={144} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
