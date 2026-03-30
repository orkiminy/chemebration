import React, { useState, useMemo, useEffect } from "react";
import { atomFill, atomTextColor, atomRadius } from "../engine/atomColors";
import { Link } from "react-router-dom";
import { extractRule, saveRule, loadRules, deleteRule, updateRule, autoSubscript } from "../engine/reactionRules";
import "../App.css";

const WIDTH = 400;
const HEIGHT = 400;
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

// ─── Read-only molecule renderer (used in View modal) ────────────────────────

function MoleculeView({ atoms, bonds, width = 200, height = 200 }) {
  return (
    <svg width={width} height={height} viewBox="0 0 400 400"
      style={{ display: "block", background: "#fff", border: "1px solid #ccc", borderRadius: 6 }}>
      {bonds.map(bond => {
        const a1 = atoms.find(a => a.id === bond.from);
        const a2 = atoms.find(a => a.id === bond.to);
        if (!a1 || !a2) return null;
        if (bond.style === "wedge") {
          const angle = Math.atan2(a2.y - a1.y, a2.x - a1.x);
          const w = 6;
          const perp = angle + Math.PI / 2;
          return (
            <polygon key={bond.id}
              points={`${a1.x},${a1.y} ${a2.x + Math.cos(perp) * w},${a2.y + Math.sin(perp) * w} ${a2.x - Math.cos(perp) * w},${a2.y - Math.sin(perp) * w}`}
              fill="#000" />
          );
        }
        const dx = a2.y - a1.y;
        const dy = a2.x - a1.x;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const ox = (dx / len) * 4;
        const oy = (dy / len) * 4;
        return (
          <g key={bond.id}>
            {Array.from({ length: bond.order ?? 1 }).map((_, i) => (
              <line key={i}
                x1={a1.x + ox * i} y1={a1.y - oy * i}
                x2={a2.x + ox * i} y2={a2.y - oy * i}
                stroke="#000" strokeWidth="3"
                strokeDasharray={bond.style === "striped" ? "6,4" : "0"} />
            ))}
          </g>
        );
      })}
      {atoms.map(atom => {
        const isC = !atom.label || atom.label === "C";
        return (
          <g key={atom.id}>
            {!isC && <circle cx={atom.x} cy={atom.y} r={atomRadius(atom.label)} fill={atomFill(atom.label)} stroke="#222" strokeWidth="1" />}
            {!isC && (
              <text x={atom.x} y={atom.y + 4} textAnchor="middle" fontSize="12" fill={atomTextColor(atom.label)}>
                {atom.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Reusable interactive canvas panel ───────────────────────────────────────

function CanvasEditor({ atoms, setAtoms, bonds, setBonds, label, initialAtoms, initialBonds, resetKey }) {
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);
  const [ringType, setRingType] = useState(null);

  useEffect(() => {
    if (resetKey === null || resetKey === undefined) return;
    setAtoms(initialAtoms ?? []);
    setBonds(initialBonds ?? []);
    setHistory([]);
    setFuture([]);
    setSelectedAtom(null);
    setSelectedBond(null);
  }, [resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveHistory = (currentAtoms, currentBonds) => {
    setHistory(h => [...h.slice(-30), { atoms: currentAtoms, bonds: currentBonds }]);
    setFuture([]);
  };

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
      setAtomType(newLabel); setTool('pencil'); setRingType(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedBond, selectedAtom, atoms, bonds, setBonds, setAtoms]);

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
        stampRing(ringType, end.x, end.y, atoms, bonds);
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
      setBonds(bonds.filter(b => b.id !== bondId));
      return;
    }
    saveHistory(atoms, bonds);
    setBonds(bonds.map(b => b.id === bondId ? { ...b, order: b.order === 3 ? 1 : b.order + 1 } : b));
    setSelectedBond(bondId);
  };


  return (
    <div>
      <div className="exercise-panel-box" style={{ width: WIDTH }}>
      <div className="exercise-panel-label">{label}</div>
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
            const w = 6;
            const perp = angle + Math.PI / 2;
            return (
              <polygon
                key={bond.id}
                points={`${a1.x},${a1.y} ${a2.x + Math.cos(perp) * w},${a2.y + Math.sin(perp) * w} ${a2.x - Math.cos(perp) * w},${a2.y - Math.sin(perp) * w}`}
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
                  x1={a1.x + offsetX * i} y1={a1.y - offsetY * i}
                  x2={a2.x + offsetX * i} y2={a2.y - offsetY * i}
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
              cx={atom.x} cy={atom.y} r={atomRadius(atom.label)}
              fill="transparent"
              onMouseDown={(e) => handleAtomMouseDown(e, atom.id)}
              onClick={(e) => handleAtomClick(e, atom.id)}
            />
            {/* Visible circle — non-carbon only, OR any atom when selected */}
            {(!isC || atom.id === selectedAtom) && (
              <circle
                cx={atom.x} cy={atom.y} r={atomRadius(atom.label)}
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
              <option value="OH">OH</option>
              <option value="Ph">Ph</option>
              <option value="Mg">Mg</option>
              <option value="X">X (any halogen)</option>
              <option value="S">S</option>
              <option value="Na">Na</option>
              <option value="R">R</option>
              <option value="R'">R'</option>
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

export default function RuleBuilder() {
  const [leftAtoms, setLeftAtoms] = useState([]);
  const [leftBonds, setLeftBonds] = useState([]);
  const [rightAtoms, setRightAtoms] = useState([]);
  const [rightBonds, setRightBonds] = useState([]);

  const [reagentSteps, setReagentSteps] = useState([""]);
  const [ruleName, setRuleName] = useState("");
  const [explanation, setExplanation] = useState("");
  const [reactionType, setReactionType] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [editingRule, setEditingRule] = useState(null);
  const [viewRule, setViewRule] = useState(null);
  const [resetKey, setResetKey] = useState(null);

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
      reactionType: reactionType.trim(),
      ...snapshot,
    };

    setSaveMsg("Saving...");
    if (editingRule) {
      await updateRule(editingRule.id, rule);
    } else {
      await saveRule(rule);
    }
    const updated = await loadRules();
    setRules(updated);
    setSaveMsg(editingRule ? `Rule "${rule.name}" updated!` : `Rule "${rule.name}" saved!`);
    setReagentSteps([""]);
    setRuleName("");
    setExplanation("");
    setReactionType("");
    setEditingRule(null);
  };

  const handleDelete = async (ruleId) => {
    await deleteRule(ruleId);
    setRules(await loadRules());
  };

  const handleEdit = (rule) => {
    setLeftAtoms(rule.patternAtoms ?? []);
    setLeftBonds(rule.patternBonds ?? []);
    setRightAtoms(rule.resultAtoms ?? []);
    setRightBonds(rule.resultBonds ?? []);
    setReagentSteps(rule.reagent ? rule.reagent.split(" / ") : [""]);
    setRuleName(rule.name ?? "");
    setExplanation(rule.explanation ?? "");
    setReactionType(rule.reactionType ?? "");
    setEditingRule(rule);
    setViewRule(null);
    setResetKey(k => (k ?? 0) + 1);
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
              label="Reactant"
              initialAtoms={leftAtoms} initialBonds={leftBonds}
              resetKey={resetKey}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", paddingTop: "3rem", gap: "6px", minWidth: "160px" }}>
            {/* Numbered reagent steps above the arrow */}
            {reagentSteps.map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", width: "100%" }}>
                <span style={{ color: "#5f021f", fontWeight: "bold", fontSize: "0.85rem", minWidth: "20px" }}>{i + 1}.</span>
                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                  <input
                    type="text"
                    value={step}
                    onChange={(e) => updateStep(i, toPlainDigits(e.target.value))}
                    placeholder=""
                    style={{ width: "100%", padding: "5px 6px 8px", border: "1.5px solid #5f021f", borderRadius: "5px", fontSize: "1rem", textAlign: "center", lineHeight: "1.6", color: "transparent", caretColor: "#5f021f", background: "white", boxSizing: "border-box" }}
                  />
                  <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", pointerEvents: "none", overflow: "hidden" }}>
                    <span style={{ whiteSpace: "nowrap", color: step ? "#000" : "#999" }}>
                      {step ? formatReagentDisplay(step) : (i === 0 ? "e.g. HBr" : "e.g. H2O")}
                    </span>
                  </div>
                </div>
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
              label="Product"
              initialAtoms={rightAtoms} initialBonds={rightBonds}
              resetKey={resetKey}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.85rem", color: "#666" }}>Reaction type (optional)</label>
            <input
              type="text"
              value={reactionType}
              onChange={(e) => setReactionType(e.target.value)}
              placeholder="e.g. Electrophilic Addition"
              style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: "6px", fontSize: "1rem", width: "220px" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-start" }}>
            {editingRule && (
              <div style={{ padding: "5px 10px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: "6px", fontSize: "0.85rem", color: "#856404" }}>
                Editing: <strong>{editingRule.name}</strong>
                <span
                  onClick={() => { setEditingRule(null); setReagentSteps([""]); setRuleName(""); setExplanation(""); setReactionType(""); }}
                  style={{ marginLeft: "10px", cursor: "pointer", color: "#c00", fontWeight: 600 }}
                >Cancel</span>
              </div>
            )}
            <button className="toolbar-btn toolbar-btn-check" onClick={handleSave}>
              {editingRule ? "Update Rule" : "Save Rule"}
            </button>
          </div>
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
            <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: "900px" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Reagent</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Name</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Explanation</th>
                  <th style={{ padding: "8px 12px", textAlign: "left", border: "1px solid #ddd" }}>Type</th>
                  <th style={{ padding: "8px 12px", border: "1px solid #ddd" }}></th>
                  <th style={{ padding: "8px 12px", border: "1px solid #ddd" }}></th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd", fontFamily: "monospace" }}>{autoSubscript(r.reagent)}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd" }}>{r.name}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd", color: "#666", fontSize: "0.9rem" }}>{r.explanation || '—'}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd", color: "#666", fontSize: "0.9rem" }}>{r.reactionType || '—'}</td>
                    <td style={{ padding: "8px 12px", border: "1px solid #ddd", textAlign: "center" }}>
                      <button
                        onClick={() => setViewRule(r)}
                        style={{ background: "none", border: "1px solid #5f021f", color: "#5f021f", borderRadius: "4px", cursor: "pointer", padding: "2px 8px" }}
                      >
                        View
                      </button>
                    </td>
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

      {/* View modal */}
      {viewRule && (
        <div
          onClick={() => setViewRule(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 10, padding: "2rem", maxWidth: 720, width: "95%", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ color: "#5f021f", margin: 0 }}>{viewRule.name}</h3>
              <button onClick={() => setViewRule(null)} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#666", lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>Reactant</div>
                <MoleculeView atoms={viewRule.patternAtoms ?? []} bonds={viewRule.patternBonds ?? []} />
              </div>

              <div style={{ textAlign: "center", minWidth: 90 }}>
                <div style={{ fontSize: "0.85rem", color: "#5f021f", fontWeight: 600, marginBottom: 4 }}>
                  {autoSubscript(viewRule.reagent)}
                </div>
                <svg width="80" height="20" viewBox="0 0 80 20">
                  <line x1="2" y1="10" x2="66" y2="10" stroke="#5f021f" strokeWidth="2.5" />
                  <polygon points="66,5 80,10 66,15" fill="#5f021f" />
                </svg>
              </div>

              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.8rem", color: "#888", marginBottom: 4 }}>Product</div>
                <MoleculeView atoms={viewRule.resultAtoms ?? []} bonds={viewRule.resultBonds ?? []} />
              </div>
            </div>

            {viewRule.reactionType && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#555" }}>
                <strong>Type:</strong> {viewRule.reactionType}
              </div>
            )}
            {viewRule.explanation && (
              <div style={{ marginTop: "0.4rem", fontSize: "0.9rem", color: "#555" }}>
                <strong>Note:</strong> {viewRule.explanation}
              </div>
            )}

            <div style={{ marginTop: "1.25rem", textAlign: "right" }}>
              <button
                onClick={() => handleEdit(viewRule)}
                style={{ background: "#5f021f", color: "#fff", border: "none", borderRadius: 6, padding: "8px 20px", cursor: "pointer", fontSize: "1rem" }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
