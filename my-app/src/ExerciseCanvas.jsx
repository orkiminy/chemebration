import React, { useState, useEffect, useMemo } from "react";
import { atomFill, atomTextColor, atomRadius } from "./engine/atomColors";
import SetCanvas from "./setCanvas";
import ReactionArrow from "./addingReaction";
import { reactionLevels } from "./data/reactionLevels.js";
import { checkIsomorphism } from "./chemistryUtils";
import { applyReaction } from "./engine/transformationEngine.js";

// --- FIREBASE IMPORTS ---
import { db } from './firebase';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { useAuth } from './contexts/AuthContext';

const ROW_H = 40 * Math.sin(Math.PI / 3);

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

export default function ExerciseCanvas({ exerciseType = "OneStepReaction" }) {
  /* ---------- CONSTANTS ---------- */
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const SNAP_RADIUS = 10;

  /* ---------- STATE ---------- */
  const [levelIndex, setLevelIndex] = useState(() => Math.floor(Math.random() * reactionLevels.length));
  const [questionCount, setQuestionCount] = useState(1);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  const [atoms, setAtoms] = useState([]);
  const [bonds, setBonds] = useState([]);
  const [selectedAtom, setSelectedAtom] = useState(null);
  const [selectedBond, setSelectedBond] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [atomType, setAtomType] = useState("C");
  const [bondStyle, setBondStyle] = useState("solid");
  const [feedback, setFeedback] = useState(null);

  // Multi-step state
  const [currentStep, setCurrentStep] = useState(0);
  const [intermediateResult, setIntermediateResult] = useState(null);

  // Show Answer state
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerProducts, setAnswerProducts] = useState([]);
  const [answerEnantiomerIndex, setAnswerEnantiomerIndex] = useState(0);

  // Drawing helpers
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);
  const [ringType, setRingType] = useState(null);

const { user } = useAuth();
  const currentLevel = reactionLevels[levelIndex];

  /* Clear feedback when user modifies canvas */
  useEffect(() => {
    if (feedback) setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atoms, bonds]);

  /* ---------- FIREBASE: PERSISTENCE LOGIC ---------- */

  useEffect(() => {
    if (user) {
      loadProgress(user.uid);
    }
  }, [user]);

  const loadProgress = async (uid) => {
    try {
      const studentRef = doc(db, "students", uid);
      const docSnap = await getDoc(studentRef);
      if (docSnap.exists() && docSnap.data().questionCount) {
        setQuestionCount(docSnap.data().questionCount);
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    }
  };

  const saveProgress = async (newCount, isCorrect) => {
    if (!user) return;
    try {
      const studentRef = doc(db, "students", user.uid);
      const updateData = {
        questionCount: newCount,
        lastActive: new Date(),
      };
      if (isCorrect) {
        updateData.correctCount = increment(1);
      }
      await setDoc(studentRef, updateData, { merge: true });
    } catch (error) {
      console.error("Error saving progress:", error);
    }
  };

  const saveAttempt = async (isCorrect) => {
    if (!user) return;
    try {
      const timeTaken = Math.round((Date.now() - questionStartTime) / 1000);
      const attemptsRef = collection(db, "students", user.uid, "attempts");
      await addDoc(attemptsRef, {
        levelId: currentLevel.id,
        levelTitle: currentLevel.title,
        levelIndex: levelIndex,
        correct: isCorrect,
        timestamp: serverTimestamp(),
        timeTaken: timeTaken,
        exerciseType: exerciseType,
      });
    } catch (error) {
      console.error("Error saving attempt:", error);
    }
  };

  /* ---------- HELPER: RANDOMIZER ---------- */
  const getRandomLevelIndex = (currentIndex) => {
    const total = reactionLevels.length;
    if (total <= 1) return 0;
    let nextIndex;
    do {
      nextIndex = Math.floor(Math.random() * total);
    } while (nextIndex === currentIndex);
    return nextIndex;
  };

  /* ---------- HISTORY ---------- */
  const saveHistory = (currentAtoms, currentBonds) => {
    setHistory(h => [...h.slice(-30), { atoms: currentAtoms, bonds: currentBonds }]);
    setFuture([]);
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

  /* ---------- SNAP & RING ---------- */
  const snapNearest = (x, y) => {
    let closest = null, minDist = Infinity;
    for (const p of gridPoints) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < minDist) { minDist = d; closest = p; }
    }
    return { snap: closest, dist: minDist };
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
      setAtomType(newLabel); setTool('pencil'); setRingType(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedBond, selectedAtom, atoms, bonds]);

  /* ---------- SHOW ANSWER ---------- */
  const handleShowAnswer = () => {
    if (showAnswer) {
      setShowAnswer(false);
      return;
    }
    let products;
    if (currentLevel.multiStep && currentLevel.steps) {
      // For multi-step: show the current step's stored solution
      products = currentLevel.steps[currentStep].solutions || [];
    } else {
      products = applyReaction(currentLevel.id, currentLevel.question.atoms, currentLevel.question.bonds);
    }
    setAnswerProducts(products);
    setAnswerEnantiomerIndex(0);
    setShowAnswer(true);
  };

/* ---------- CHECK ANSWER ---------- */
  const advanceToNextQuestion = () => {
    const nextCount = questionCount + 1;
    saveAttempt(true);
    saveProgress(nextCount, true);

    setTimeout(() => {
      const nextIndex = getRandomLevelIndex(levelIndex);
      setLevelIndex(nextIndex);
      setQuestionCount(nextCount);
      setAtoms([]);
      setBonds([]);
      setFeedback(null);
      setCurrentStep(0);
      setIntermediateResult(null);
      setQuestionStartTime(Date.now());
      setShowAnswer(false);
      setAnswerProducts([]);
      setAnswerEnantiomerIndex(0);
    }, 1500);
  };

  const checkAnswer = () => {
    if (atoms.length === 0) {
      setFeedback({ type: "error", message: "Draw your answer first!" });
      return;
    }

    // Multi-step question
    if (currentLevel.multiStep && currentLevel.steps) {
      const step = currentLevel.steps[currentStep];
      const matchFound = step.solutions.some((sol) => {
        if (!sol || !sol.atoms) return false;
        return checkIsomorphism(atoms, bonds, sol.atoms, sol.bonds);
      });

      if (matchFound && currentStep < currentLevel.steps.length - 1) {
        // Step correct, but more steps remain
        setIntermediateResult({ atoms: [...atoms], bonds: [...bonds] });
        setCurrentStep(currentStep + 1);
        setAtoms([]);
        setBonds([]);
        setFeedback({ type: "success", message: `Step ${currentStep + 1} correct! Now complete step ${currentStep + 2}...` });
      } else if (matchFound) {
        // Final step correct — advance
        setFeedback({ type: "success", message: "Correct! All steps complete. Next question..." });
        advanceToNextQuestion();
      } else {
        setFeedback({ type: "error", message: `Incorrect. Check step ${currentStep + 1}!` });
        saveAttempt(false);
      }
      return;
    }

    // Single-step question (unchanged)
    let possibleSolutions = [];
    if (currentLevel.solutions) possibleSolutions = currentLevel.solutions;
    else if (currentLevel.solution) possibleSolutions = [currentLevel.solution];

    const matchFound = possibleSolutions.some((sol) => {
      if (!sol || !sol.atoms) return false;
      return checkIsomorphism(atoms, bonds, sol.atoms, sol.bonds);
    });

    if (matchFound) {
      setFeedback({ type: "success", message: "Correct! Next question..." });
      advanceToNextQuestion();
    } else {
      setFeedback({ type: "error", message: "Incorrect. Check regiochemistry and stereochemistry!" });
      saveAttempt(false);
    }
  };

  /* ---------- HELPERS ---------- */

  /* ---------- RENDER ---------- */
  return (
    <div>
      {/* Question header */}
      <div style={{ marginBottom: "1rem" }}>
        <h2 style={{ color: "#5f021f", margin: 0 }}>
          Question #{questionCount}: {currentLevel.title}
          {currentLevel.multiStep && currentLevel.steps && (
            <span style={{ fontSize: "0.7em", fontWeight: "normal", marginLeft: 12, color: "#888" }}>
              Step {currentStep + 1} of {currentLevel.steps.length}
            </span>
          )}
        </h2>
        <p style={{ color: "#666", margin: "4px 0 0" }}>
          {currentLevel.multiStep && currentLevel.steps
            ? currentLevel.steps[currentStep].description || currentLevel.description
            : currentLevel.description}
        </p>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`feedback-banner ${feedback.type === "success" ? "feedback-success" : "feedback-error"}`}>
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            style={{ marginLeft: 12, background: "none", border: "none", cursor: "pointer", fontWeight: "bold", fontSize: 16, color: "inherit" }}
          >
            &times;
          </button>
        </div>
      )}

      <div className="exercise-layout">
        {/* Given structure */}
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">Reactant</div>
            <SetCanvas atoms={currentLevel.question.atoms} bonds={currentLevel.question.bonds} />
          </div>
        </div>

        {/* Step 1 arrow */}
        <div className="exercise-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">
              {currentLevel.multiStep ? "Step 1" : "Reagent"}
            </div>
            <div style={{ padding: "10px" }}>
              <ReactionArrow
                key={`${currentLevel.id}-step0`}
                text={currentLevel.multiStep && currentLevel.steps
                  ? currentLevel.steps[0].reagents
                  : currentLevel.reagents}
              />
            </div>
          </div>
        </div>

        {/* For multi-step on step 2+: show intermediate + step 2 arrow before the drawing canvas */}
        {currentLevel.multiStep && currentStep > 0 && intermediateResult && (
          <>
            <div className="exercise-panel">
              <div className="exercise-panel-box">
                <div className="exercise-panel-label" style={{ color: "green" }}>Intermediate ✓</div>
                <SetCanvas atoms={intermediateResult.atoms} bonds={intermediateResult.bonds} />
              </div>
            </div>
            <div className="exercise-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
              <div className="exercise-panel-box">
                <div className="exercise-panel-label">Step 2</div>
                <div style={{ padding: "10px" }}>
                  <ReactionArrow
                    key={`${currentLevel.id}-step${currentStep}`}
                    text={currentLevel.steps[currentStep].reagents}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Right: Editable canvas */}
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">Product</div>
            <svg
              width={WIDTH}
              height={HEIGHT}
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              style={{ display: "block", maxWidth: "100%", height: "auto", cursor: tool === "eraser" ? "not-allowed" : ringType ? "copy" : "crosshair" }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={() => { setDragFrom(null); setDragTo(null); }}
            >
              {/* GRID */}
              {gridPoints.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
              ))}

              {/* BONDS */}
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
                    {/* Wide invisible hit-target */}
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

              {/* ATOMS */}
              {atoms.map(atom => {
                const isC = !atom.label || atom.label === "C";
                return (
                  <g key={atom.id}>
                    {/* Invisible hit target — always present so C atoms can be clicked/erased */}
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
                      <text
                        x={atom.x}
                        y={atom.y + 4}
                        textAnchor="middle"
                        fontSize="12"
                        fill={atomTextColor(atom.label)}
                        pointerEvents="none"
                      >
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
          {/* Toolbar outside panel-box so it never affects canvas width */}
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
                    <option value="R">R</option>
                    <option value="R'">R'</option>
                    <option value="R''">R''</option>
                  </select>
                  <select className="toolbar-select" value={bondStyle} onChange={(e) => setBondStyle(e.target.value)}>
                    <option value="solid">Solid (Line)</option>
                    <option value="wedge">Solid (Wedge)</option>
                    <option value="striped">Dashed (Striped)</option>
                  </select>
                </div>
              )}

              <div className="toolbar-group">
                <button className="toolbar-btn toolbar-btn-check" onClick={checkAnswer}>Check Answer</button>
                <button className="toolbar-btn" style={{ opacity: 0.75 }} onClick={handleShowAnswer}>
                  {showAnswer ? "Hide Answer" : "Show Answer"}
                </button>
              </div>
            </div>
        </div>
      </div>

      {/* Answer panel — shown when Show Answer is clicked */}
      {showAnswer && answerProducts.length > 0 && (
        <div style={{ marginTop: "1.5rem", borderTop: "2px solid #5f021f", paddingTop: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
            <span style={{ fontWeight: "bold", color: "#5f021f" }}>Correct Answer:</span>
            {answerProducts.length > 1 && (
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {answerProducts.map((_, i) => (
                  <button
                    key={i}
                    className={`toolbar-btn${answerEnantiomerIndex === i ? " toolbar-btn-active" : ""}`}
                    onClick={() => setAnswerEnantiomerIndex(i)}
                  >
                    Enantiomer {String.fromCharCode(65 + i)}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SetCanvas
            atoms={answerProducts[answerEnantiomerIndex].atoms}
            bonds={answerProducts[answerEnantiomerIndex].bonds}
          />
        </div>
      )}

    </div>
  );
}
