import React, { useState, useEffect, useMemo, useRef } from "react";
import { atomFill, atomTextColor, atomRadius } from "./engine/atomColors";
import SetCanvas from "./setCanvas";
import ReactionArrow from "./addingReaction";
import { reactionLevels } from "./data/reactionLevels.js";
import { checkIsomorphism } from "./chemistryUtils";
import { applyReaction } from "./engine/transformationEngine.js";
import { loadRules } from "./engine/reactionRules";
import { rulesToExercises } from "./engine/ruleToExercise";

// --- FIREBASE IMPORTS ---
import { db } from './firebase';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp, increment } from "firebase/firestore";
import { useAuth } from './contexts/AuthContext';

const ROW_H = 40 * Math.sin(Math.PI / 3);

// --- Question type randomization helpers ---
// Reagents that are trivial (no structural molecule) and should NOT be asked as a reagent question
const TRIVIAL_REAGENTS = new Set(["heat", "hv", "light", "δ", "", "h+", "h⁺", "h3o+", "h₃o⁺"]);

function normalizeReagentText(s) {
  const subs = "₀₁₂₃₄₅₆₇₈₉";
  return String(s ?? "")
    .toLowerCase()
    .replace(/[₀-₉]/g, (d) => String(subs.indexOf(d)))
    .replace(/\s+/g, "")
    .replace(/[,+]/g, "/");
}

function isTrivialReagent(s) {
  return TRIVIAL_REAGENTS.has(normalizeReagentText(s));
}

function splitReagentSteps(reagentStr) {
  // Split "1. X / 2. Y" into ["X", "Y"], or return ["whole string"] for simple reagents
  const parts = String(reagentStr ?? "").split(/\s*\/\s*/).map(s => s.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
  return parts.length > 0 ? parts : [""];
}

function checkReagentMatch(userInputs, expected) {
  const expectedParts = splitReagentSteps(expected);
  const userParts = userInputs.map(s => s.trim()).filter(Boolean);
  if (userParts.length !== expectedParts.length) return false;
  return userParts.every((u, i) => normalizeReagentText(u) === normalizeReagentText(expectedParts[i]));
}

function pickQuestionType(level) {
  if (!level) return "product";
  // Multi-step levels keep the current product-only flow
  if (level.multiStep) return "product";

  const hasReactant = !!(level.question && level.question.atoms && level.question.atoms.length);
  const hasProduct = !!((level.solutions && level.solutions.length) || level.solution);
  const reagentOk = !!level.reagents && !isTrivialReagent(level.reagents);

  const choices = [];
  if (hasReactant && hasProduct) {
    choices.push("product");
    choices.push("reactant");
    if (reagentOk) choices.push("reagent");
  }
  if (choices.length === 0) return "product";
  return choices[Math.floor(Math.random() * choices.length)];
}

// Pointy-top hexagon (vertex at top), grid-aligned, double bonds on left
const RING_TEMPLATES = {
  benzene: {
    offsets: [
      { dx: 0,   dy: 0 },              { dx: -60, dy: ROW_H },
      { dx: -60, dy: 3 * ROW_H },      { dx: 0,   dy: 4 * ROW_H },
      { dx: 60,  dy: 3 * ROW_H },      { dx: 60,  dy: ROW_H },
    ],
    bonds: [
      { a: 0, b: 1, order: 2 }, { a: 1, b: 2, order: 1 },
      { a: 2, b: 3, order: 2 }, { a: 3, b: 4, order: 1 },
      { a: 4, b: 5, order: 2 }, { a: 5, b: 0, order: 1 },
    ],
  },
  cyclohexane: {
    offsets: [
      { dx: 0,   dy: 0 },              { dx: -60, dy: ROW_H },
      { dx: -60, dy: 3 * ROW_H },      { dx: 0,   dy: 4 * ROW_H },
      { dx: 60,  dy: 3 * ROW_H },      { dx: 60,  dy: ROW_H },
    ],
    bonds: Array.from({ length: 6 }, (_, i) => ({ a: i, b: (i + 1) % 6, order: 1 })),
  },
};

export default function ExerciseCanvas({ exerciseType = "OneStepReaction", chapter = null }) {
  /* ---------- CONSTANTS ---------- */
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const SNAP_RADIUS = 10;

  // --- Rule-based exercises from Firestore ---
  const [ruleLevels, setRuleLevels] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return; // prevent StrictMode double-load
    loadedRef.current = true;
    loadRules()
      .then(rules => setRuleLevels(rulesToExercises(rules)))
      .catch(err => console.error("Failed to load rules:", err))
      .finally(() => setRulesLoading(false));
  }, []);

  // Merge hardcoded + rule-based exercises, then filter by chapter
  const allLevels = useMemo(() => [...reactionLevels, ...ruleLevels], [ruleLevels]);
  const filteredLevels = useMemo(() =>
    chapter ? allLevels.filter(l => l.chapter === chapter) : allLevels,
    [chapter, allLevels]
  );

  /* ---------- STATE ---------- */
  const [levelIndex, setLevelIndex] = useState(0);
  const levelIndexRef = useRef(0);
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

  // Question type: "product" (draw product), "reactant" (draw reactant), or "reagent" (type reagent text)
  const [questionType, setQuestionType] = useState("product");
  const [reagentInputs, setReagentInputs] = useState([""]);
  const [showBackwardArrow, setShowBackwardArrow] = useState(false);

  // Drawing helpers
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);
  const [dragFrom, setDragFrom] = useState(null);
  const [dragTo, setDragTo] = useState(null);
  const [ringType, setRingType] = useState(null);

const { user } = useAuth();
  const currentLevel = filteredLevels[levelIndex];

  // Keep levelIndexRef in sync
  useEffect(() => { levelIndexRef.current = levelIndex; }, [levelIndex]);

  // Reset level index and shuffle queue when the filtered list changes
  useEffect(() => {
    if (filteredLevels.length > 0) {
      shuffleQueueRef.current = []; // force rebuild on next advance
      const idx = Math.floor(Math.random() * filteredLevels.length);
      setLevelIndex(idx);
      levelIndexRef.current = idx;
    }
  }, [filteredLevels.length]);

  /* Clear feedback when user modifies canvas or reagent input */
  useEffect(() => {
    if (feedback) setFeedback(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atoms, bonds, reagentInputs, showBackwardArrow]);

  /* Pick a new question type whenever the current level changes */
  useEffect(() => {
    const qt = pickQuestionType(currentLevel);
    setQuestionType(qt);
    // Pre-size reagent inputs to match the number of expected steps
    if (qt === "reagent" && currentLevel) {
      const stepCount = splitReagentSteps(currentLevel.reagents).length;
      setReagentInputs(Array(stepCount).fill(""));
      setShowBackwardArrow(false);
    } else {
      setReagentInputs([""]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelIndex, currentLevel?.id]);


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
  // Pre-shuffled queue — guarantees every exercise before any repeat
  const shuffleQueueRef = useRef([]);

  const buildShuffleQueue = (total, excludeIndex) => {
    const indices = Array.from({ length: total }, (_, i) => i).filter(i => i !== excludeIndex);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  };

  const getRandomLevelIndex = (currentIndex) => {
    const total = filteredLevels.length;
    if (total <= 1) return 0;
    if (shuffleQueueRef.current.length === 0) {
      shuffleQueueRef.current = buildShuffleQueue(total, currentIndex);
    }
    const nextIndex = shuffleQueueRef.current.pop();
    console.log(`[Shuffle] picked index ${nextIndex} ("${filteredLevels[nextIndex]?.title}"), queue remaining: ${shuffleQueueRef.current.length}/${total - 1}`);
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
      const newBonds = bonds.filter(b => b.id !== bondId);
      // Remove atoms that become orphaned (no remaining bonds)
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
    // Reagent question: the answer panel below renders the text directly
    if (questionType === "reagent") {
      setAnswerProducts([]);
      setAnswerEnantiomerIndex(0);
      setShowAnswer(true);
      return;
    }
    // Reactant question: the answer is the stored reactant structure
    if (questionType === "reactant") {
      setAnswerProducts(currentLevel.question ? [currentLevel.question] : []);
      setAnswerEnantiomerIndex(0);
      setShowAnswer(true);
      return;
    }
    // Product question (default)
    let products;
    if (currentLevel.multiStep && currentLevel.steps) {
      // For multi-step: show the current step's stored solution
      products = currentLevel.steps[currentStep].solutions || [];
    } else if (currentLevel.solutions) {
      // Rule-based exercises (and hardcoded ones with stored solutions)
      products = currentLevel.solutions;
    } else {
      // Legacy hardcoded exercises using descriptor-based transformation
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
      const nextIndex = getRandomLevelIndex(levelIndexRef.current);
      setLevelIndex(nextIndex);
      levelIndexRef.current = nextIndex;
      setQuestionCount(nextCount);
      setAtoms([]);
      setBonds([]);
      setReagentInputs([""]);
      setShowBackwardArrow(false);
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
    // Reagent text question — checked separately, no drawing required
    if (questionType === "reagent") {
      const isReversible = !!(currentLevel.reversible && currentLevel.backwardReagent);
      if (reagentInputs.every(s => !s.trim())) {
        setFeedback({ type: "error", message: "Type the reagent first!" });
        return;
      }
      const forwardOk = checkReagentMatch(reagentInputs, currentLevel.reagents);
      // Student must toggle backward arrow if reaction is reversible, and must NOT if it isn't
      const backwardOk = isReversible ? showBackwardArrow : !showBackwardArrow;
      if (forwardOk && backwardOk) {
        setFeedback({ type: "success", message: "Correct! Next question..." });
        advanceToNextQuestion();
      } else {
        setFeedback({ type: "error", message: "Incorrect reagent. Try again!" });
        saveAttempt(false);
      }
      return;
    }

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

    // Single-step question
    let possibleSolutions = [];
    if (questionType === "reactant") {
      // Student drew the reactant — compare against currentLevel.question
      if (currentLevel.question) possibleSolutions = [currentLevel.question];
    } else {
      if (currentLevel.solutions) possibleSolutions = currentLevel.solutions;
      else if (currentLevel.solution) possibleSolutions = [currentLevel.solution];
    }

    // Clean up any ghost atoms (orphans with no bonds) before comparing
    const connectedIds = new Set();
    bonds.forEach(b => { connectedIds.add(b.from); connectedIds.add(b.to); });
    const cleanAtoms = atoms.filter(a => connectedIds.has(a.id));
    const cleanBonds = bonds;

    // --- DEBUG LOGGING ---
    console.group(`[CheckAnswer] "${currentLevel.title}" (id: ${currentLevel.id})`);
    console.log("User atoms:", JSON.stringify(cleanAtoms.map(a => ({ id: a.id, label: a.label || "C" }))));
    console.log("User bonds:", JSON.stringify(cleanBonds.map(b => ({ from: b.from, to: b.to, order: b.order, style: b.style }))));
    console.log("User atom count:", cleanAtoms.length, "| User bond count:", cleanBonds.length);
    possibleSolutions.forEach((sol, i) => {
      console.log(`Solution[${i}] atoms:`, JSON.stringify(sol.atoms.map(a => ({ id: a.id, label: a.label || "C" }))));
      console.log(`Solution[${i}] bonds:`, JSON.stringify(sol.bonds.map(b => ({ from: b.from, to: b.to, order: b.order, style: b.style }))));
      console.log(`Solution[${i}] atom count:`, sol.atoms.length, "| bond count:", sol.bonds.length);
    });
    console.groupEnd();
    // --- END DEBUG ---

    const matchFound = possibleSolutions.some((sol) => {
      if (!sol || !sol.atoms) return false;
      return checkIsomorphism(cleanAtoms, cleanBonds, sol.atoms, sol.bonds);
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
  if (rulesLoading) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#888" }}>
        <h3>Loading exercises...</h3>
      </div>
    );
  }

  if (!currentLevel) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#888" }}>
        <h3>No questions available for this chapter yet.</h3>
        <p>Questions will appear here once they are added to this chapter.</p>
      </div>
    );
  }

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

      {/* Question-type hint */}
      {!currentLevel.multiStep && (
        <div style={{ marginBottom: "0.75rem", fontStyle: "italic", color: "#5f021f" }}>
          {questionType === "product" && "Draw the product of this reaction."}
          {questionType === "reactant" && "Draw the reactant needed for this reaction."}
          {questionType === "reagent" && "Type the reagent needed for this reaction."}
        </div>
      )}

      <div
        className="exercise-layout"
        style={questionType === "reactant" ? { flexDirection: "row-reverse" } : undefined}
      >
        {/* LEFT static panel — reactant structure (product/reagent Q) or product structure (reactant Q) */}
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">
              {questionType === "reactant" ? "Product" : "Reactant"}
            </div>
            {questionType === "reactant"
              ? (() => {
                  const sol = (currentLevel.solutions && currentLevel.solutions[0]) || currentLevel.solution;
                  return sol ? <SetCanvas atoms={sol.atoms} bonds={sol.bonds} /> : null;
                })()
              : <SetCanvas atoms={currentLevel.question.atoms} bonds={currentLevel.question.bonds} />
            }
          </div>
        </div>

        {/* MIDDLE panel — reagent arrow, OR text input when asking for reagent */}
        {questionType === "reagent" ? (
          <div className="exercise-panel" style={{ display: "flex", alignItems: "center", justifyContent: "center", alignSelf: "center" }}>
            <div className="exercise-panel-box">
              <div className="exercise-panel-label">Reagent</div>
              <div style={{ padding: "20px", textAlign: "center", minWidth: 220 }}>
                {/* Reagent inputs */}
                {reagentInputs.map((val, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, justifyContent: "center" }}>
                    {reagentInputs.length > 1 && (
                      <span style={{ fontWeight: 600, color: "#5f021f", fontSize: "0.85rem", minWidth: 18 }}>{idx + 1}.</span>
                    )}
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const next = [...reagentInputs];
                        next[idx] = e.target.value;
                        setReagentInputs(next);
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") checkAnswer(); }}
                      placeholder={idx === 0 ? "e.g. HBr" : "e.g. H2O"}
                      style={{ padding: "8px 10px", fontSize: "16px", width: "180px", border: "1px solid #ccc", borderRadius: 4 }}
                      autoFocus={idx === 0}
                    />
                    {reagentInputs.length > 1 && (
                      <span
                        onClick={() => setReagentInputs(reagentInputs.filter((_, i) => i !== idx))}
                        style={{ cursor: "pointer", color: "#999", fontWeight: "bold", fontSize: 16, userSelect: "none" }}
                      >×</span>
                    )}
                  </div>
                ))}
                <div
                  onClick={() => setReagentInputs([...reagentInputs, ""])}
                  style={{ color: "#5f021f", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, userSelect: "none", marginBottom: 10 }}
                >+ Add Step</div>

                {/* Arrows */}
                <div style={{ margin: "8px 0" }}>
                  <div style={{ fontSize: "28px", fontWeight: "bold", color: "#333", lineHeight: 1 }}>→</div>
                  {showBackwardArrow && (
                    <div style={{ fontSize: "28px", fontWeight: "bold", color: "#333", lineHeight: 1 }}>←</div>
                  )}
                </div>

                {/* Backward arrow toggle */}
                <div
                  onClick={() => setShowBackwardArrow(!showBackwardArrow)}
                  style={{ color: "#5f021f", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, userSelect: "none", marginBottom: 10 }}
                >{showBackwardArrow ? "− Remove backward arrow" : "+ Add backward arrow ←"}</div>

                <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                  <button className="toolbar-btn toolbar-btn-check" onClick={checkAnswer}>Check Answer</button>
                  <button className="toolbar-btn" style={{ opacity: 0.75 }} onClick={handleShowAnswer}>
                    {showAnswer ? "Hide Answer" : "Show Answer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
                  backwardText={currentLevel.reversible ? currentLevel.backwardReagent : undefined}
                />
              </div>
            </div>
          </div>
        )}

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

        {/* RIGHT panel (reagent mode): static product display */}
        {questionType === "reagent" && (
          <div className="exercise-panel">
            <div className="exercise-panel-box">
              <div className="exercise-panel-label">Product</div>
              {(() => {
                const sol = (currentLevel.solutions && currentLevel.solutions[0]) || currentLevel.solution;
                return sol ? <SetCanvas atoms={sol.atoms} bonds={sol.bonds} /> : null;
              })()}
            </div>
          </div>
        )}

        {/* RIGHT panel (product/reactant modes): editable drawing canvas */}
        {questionType !== "reagent" && (
        <div className="exercise-panel">
          <div className="exercise-panel-box">
            <div className="exercise-panel-label">
              {questionType === "reactant" ? "Reactant" : "Product"}
            </div>
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
        )}
      </div>

      {/* Answer panel — reagent text variant */}
      {showAnswer && questionType === "reagent" && (
        <div style={{ marginTop: "1.5rem", borderTop: "2px solid #5f021f", paddingTop: "1rem" }}>
          <span style={{ fontWeight: "bold", color: "#5f021f", marginRight: 8 }}>Correct Answer:</span>
          <span style={{ fontSize: "1.1rem" }}>→ {currentLevel.reagents}</span>
          {currentLevel.reversible && currentLevel.backwardReagent && (
            <span style={{ fontSize: "1.1rem", marginLeft: 16 }}>← {currentLevel.backwardReagent}</span>
          )}
        </div>
      )}

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
