/**
 * reactionRules.js
 *
 * Computational reaction rule engine.
 *
 * Rules are stored in Firestore. Each rule records:
 *   - patternAtoms / patternBonds  — the substructure to find in the student's molecule
 *   - resultAtoms  / resultBonds   — what the pattern looks like after the reaction
 *   - delta                        — the diff (computed at save time, applied at match time)
 *
 * Flow:
 *   Save:   RuleBuilder draws left (pattern) + right (result) → extractRule() → saveRule()
 *   Apply:  findRule(reagent) → applyRule(molAtoms, molBonds, rule)
 *             → findMatches() finds WHERE the pattern lives in the molecule
 *             → applyDelta()  applies the transformation at that location
 *             → returns the full transformed molecule as the product
 */

import { db } from '../firebase';
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { findMatches } from './subgraphMatch';

const RULES_COLLECTION = 'reactionRules';
const GRID_SPACING = 40;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);
const HALOGENS = ['Br', 'Cl', 'F', 'I'];

// ─── POSITION HELPER ──────────────────────────────────────────────────────────

function findOpenNeighbor(atomId, allAtoms) {
  const atom = allAtoms.find(a => a.id === atomId);
  if (!atom) return { x: 100, y: 100 };
  const candidates = [
    { x: atom.x + GRID_SPACING, y: atom.y },
    { x: atom.x - GRID_SPACING, y: atom.y },
    { x: atom.x + 20, y: atom.y + ROW_H },
    { x: atom.x - 20, y: atom.y + ROW_H },
    { x: atom.x + 20, y: atom.y - ROW_H },
    { x: atom.x - 20, y: atom.y - ROW_H },
  ];
  const occupied = new Set(allAtoms.map(a => `${Math.round(a.x)},${Math.round(a.y)}`));
  for (const pos of candidates) {
    const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
    if (!occupied.has(key) && pos.x >= 0 && pos.y >= 0) return pos;
  }
  return { x: atom.x + GRID_SPACING, y: atom.y + GRID_SPACING };
}

// ─── X-WILDCARD HELPERS ───────────────────────────────────────────────────────

function extractHalogen(reagentStr) {
  const s = reagentStr.toLowerCase();
  if (s.includes('br')) return 'Br';
  if (s.includes('cl')) return 'Cl';
  if (s.includes('fl') || s.match(/\bhf\b/) || s.includes('f2')) return 'F';
  if (s.includes('i2') || s.match(/\bhi\b/)) return 'I';
  return null;
}

function xWildcardMatches(storedReagent, inputReagent) {
  const stored = storedReagent.toLowerCase().replace(/\s+/g, '');
  if (!stored.includes('x')) return false;
  const input = inputReagent.toLowerCase().replace(/\s+/g, '');
  return HALOGENS.some(hal => {
    const sub = stored.replace(/x/gi, hal.toLowerCase());
    return sub === input || sub.includes(input) || input.includes(sub);
  });
}

// ─── DELTA COMPUTATION ────────────────────────────────────────────────────────

/**
 * Compare left (pattern) and right (result) canvases — same atom IDs are "kept",
 * new IDs in result are "added", IDs only in pattern are "removed".
 *
 * Produces a delta that can be applied to ANY molecule where the pattern matches.
 */
function computeDelta(patternAtoms, patternBonds, resultAtoms, resultBonds) {
  const patIds = new Set(patternAtoms.map(a => a.id));
  const resIds = new Set(resultAtoms.map(a => a.id));

  // Atoms removed (in pattern, not in result)
  const removedAtomIds = patternAtoms.filter(a => !resIds.has(a.id)).map(a => a.id);

  // Atoms added (in result, not in pattern)
  const addedAtoms = resultAtoms.filter(a => !patIds.has(a.id)).map(a => ({ ...a }));

  // Bonds in result that touch at least one new atom
  const addedBonds = resultBonds
    .filter(b => !patIds.has(b.from) || !patIds.has(b.to))
    .map(b => ({ ...b }));

  // For bonds between kept atoms: detect changes and removals
  const changedBonds = [];
  const removedBonds = [];

  patternBonds.forEach(pb => {
    if (removedAtomIds.includes(pb.from) || removedAtomIds.includes(pb.to)) return;
    const rb = resultBonds.find(b =>
      (b.from === pb.from && b.to === pb.to) || (b.from === pb.to && b.to === pb.from)
    );
    if (!rb) {
      removedBonds.push({ from: pb.from, to: pb.to });
    } else if (rb.order !== pb.order || rb.style !== pb.style) {
      changedBonds.push({ from: pb.from, to: pb.to, newOrder: rb.order, newStyle: rb.style || 'solid' });
    }
  });

  // New bonds between kept atoms that didn't exist in the pattern
  const newKeptBonds = [];
  resultBonds.forEach(rb => {
    if (!patIds.has(rb.from) || !patIds.has(rb.to)) return;
    if (removedAtomIds.includes(rb.from) || removedAtomIds.includes(rb.to)) return;
    const exists = patternBonds.some(pb =>
      (pb.from === rb.from && pb.to === rb.to) || (pb.from === rb.to && pb.to === rb.from)
    );
    if (!exists) newKeptBonds.push({ from: rb.from, to: rb.to, order: rb.order, style: rb.style || 'solid' });
  });

  return { removedAtomIds, addedAtoms, addedBonds, changedBonds, removedBonds, newKeptBonds };
}

// ─── DELTA APPLICATION ────────────────────────────────────────────────────────

/**
 * Apply a delta to a molecule at a specific subgraph match.
 * match: Map<patternAtomId, molAtomId>
 *
 * Returns { atoms, bonds } — the full transformed molecule.
 */
function applyDelta(molAtoms, molBonds, delta, match) {
  let newAtoms = molAtoms.map(a => ({ ...a }));
  let newBonds = molBonds.map(b => ({ ...b }));
  let idCounter = Date.now();

  // 1. Remove atoms (and all their bonds)
  delta.removedAtomIds.forEach(pid => {
    const mid = match.get(pid);
    if (mid === undefined) return;
    newAtoms = newAtoms.filter(a => a.id !== mid);
    newBonds = newBonds.filter(b => b.from !== mid && b.to !== mid);
  });

  // 2. Update bond orders/styles between kept atoms
  delta.changedBonds.forEach(change => {
    const fromMol = match.get(change.from);
    const toMol   = match.get(change.to);
    if (fromMol === undefined || toMol === undefined) return;
    const bond = newBonds.find(b =>
      (b.from === fromMol && b.to === toMol) || (b.from === toMol && b.to === fromMol)
    );
    if (bond) { bond.order = change.newOrder; bond.style = change.newStyle; }
  });

  // 3. Remove bonds between kept atoms
  delta.removedBonds.forEach(rb => {
    const fromMol = match.get(rb.from);
    const toMol   = match.get(rb.to);
    if (fromMol === undefined || toMol === undefined) return;
    newBonds = newBonds.filter(b =>
      !((b.from === fromMol && b.to === toMol) || (b.from === toMol && b.to === fromMol))
    );
  });

  // 4. Add new bonds between kept atoms
  delta.newKeptBonds.forEach(nb => {
    const fromMol = match.get(nb.from);
    const toMol   = match.get(nb.to);
    if (fromMol === undefined || toMol === undefined) return;
    newBonds.push({ id: idCounter++, from: fromMol, to: toMol, order: nb.order, style: nb.style });
  });

  // 5. Add new atoms — position near their bonded kept atom
  const idRemap = new Map(); // pattern new-atom id → actual molecule id
  delta.addedAtoms.forEach(atom => {
    const newId = idCounter++;
    idRemap.set(atom.id, newId);

    // Find parent: the already-mapped atom this new atom bonds to
    const parentBond = delta.addedBonds.find(b => b.from === atom.id || b.to === atom.id);
    let pos = { x: 100, y: 100 };
    if (parentBond) {
      const parentPatId = parentBond.from === atom.id ? parentBond.to : parentBond.from;
      const parentMolId = match.get(parentPatId) ?? idRemap.get(parentPatId);
      if (parentMolId !== undefined) pos = findOpenNeighbor(parentMolId, newAtoms);
    }
    newAtoms.push({ id: newId, label: atom.label || 'C', x: pos.x, y: pos.y });
  });

  // 6. Add new bonds involving new atoms
  delta.addedBonds.forEach(bond => {
    const fromId = match.get(bond.from) ?? idRemap.get(bond.from);
    const toId   = match.get(bond.to)   ?? idRemap.get(bond.to);
    if (fromId !== undefined && toId !== undefined) {
      newBonds.push({ id: idCounter++, from: fromId, to: toId, order: bond.order || 1, style: bond.style || 'solid' });
    }
  });

  return { atoms: newAtoms, bonds: newBonds };
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Package left + right canvases into a rule (called in RuleBuilder before saving).
 * Computes and stores the delta so it can be applied to any molecule later.
 */
export function extractRule(leftAtoms, leftBonds, rightAtoms, rightBonds) {
  if (leftAtoms.length === 0) return null;
  const delta = computeDelta(leftAtoms, leftBonds, rightAtoms, rightBonds);
  return {
    patternAtoms: leftAtoms.map(a => ({ ...a })),
    patternBonds: leftBonds.map(b => ({ ...b })),
    resultAtoms:  rightAtoms.map(a => ({ ...a })),
    resultBonds:  rightBonds.map(b => ({ ...b })),
    delta,
  };
}

/**
 * Apply a rule to a drawn molecule.
 *
 * 1. Resolve any X wildcard labels using the actual halogen from the reagent.
 * 2. Run subgraph matching to find WHERE the pattern lives in the molecule.
 * 3. Apply the delta at that location to produce the transformed molecule.
 *
 * If no match is found, falls back to returning the stored example result
 * (with a noMatch flag so the UI can warn the user).
 */
export function applyRule(molAtoms, molBonds, rule) {
  const resolvedX = rule.resolvedX || null;
  const resolveLabel = lbl => (lbl === 'X' && resolvedX) ? resolvedX : lbl;

  // If rule predates the delta system, fall back to stored example
  if (!rule.delta || !rule.patternAtoms) {
    if (!rule.resultAtoms) return null;
    return {
      products: [{
        atoms: rule.resultAtoms.map(a => ({ ...a, label: resolveLabel(a.label || '') })),
        bonds: rule.resultBonds.map(b => ({ ...b })),
      }],
      explanation: rule.explanation || '',
    };
  }

  // Resolve X labels in the pattern so matching works for HBr → Br, etc.
  const patternAtoms = rule.patternAtoms.map(a => ({ ...a, label: resolveLabel(a.label || 'C') }));

  // Resolve X labels in the delta's added atoms
  const delta = {
    ...rule.delta,
    addedAtoms: (rule.delta.addedAtoms || []).map(a => ({ ...a, label: resolveLabel(a.label || 'C') })),
  };

  // Find where the pattern appears in the student's molecule
  const matches = findMatches(patternAtoms, rule.patternBonds, molAtoms, molBonds);

  if (matches.length === 0) {
    // Pattern not found — fall back to stored example with a warning
    return {
      products: [{
        atoms: rule.resultAtoms.map(a => ({ ...a, label: resolveLabel(a.label || '') })),
        bonds: rule.resultBonds.map(b => ({ ...b })),
      }],
      explanation: rule.explanation || '',
      noMatch: true,
    };
  }

  // Apply the delta at the first match location
  const { atoms, bonds } = applyDelta(molAtoms, molBonds, delta, matches[0]);
  return {
    products: [{ atoms, bonds }],
    explanation: rule.explanation || '',
  };
}

// ─── FIRESTORE STORAGE ────────────────────────────────────────────────────────

export async function saveRule(ruleData) {
  const ref = await addDoc(collection(db, RULES_COLLECTION), ruleData);
  return ref.id;
}

export async function loadRules() {
  const snapshot = await getDocs(collection(db, RULES_COLLECTION));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteRule(ruleId) {
  await deleteDoc(doc(db, RULES_COLLECTION, ruleId));
}

/**
 * Find a saved rule matching the given reagent string.
 * Tries exact/substring match first, then X-wildcard match.
 * Returns the rule with resolvedX attached, or null.
 */
export async function findRule(reagentStr) {
  const rules = await loadRules();
  const lower = reagentStr.toLowerCase().replace(/\s+/g, '');

  const exact = rules.find(r => {
    const rLower = (r.reagent || '').toLowerCase().replace(/\s+/g, '');
    return rLower === lower || lower.includes(rLower) || rLower.includes(lower);
  });
  if (exact) return { ...exact, resolvedX: extractHalogen(reagentStr) };

  const wildcard = rules.find(r => xWildcardMatches(r.reagent || '', reagentStr));
  if (wildcard) return { ...wildcard, resolvedX: extractHalogen(reagentStr) };

  return null;
}
