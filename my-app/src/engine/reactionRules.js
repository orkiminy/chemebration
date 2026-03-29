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
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { findMatches } from './subgraphMatch';

const RULES_COLLECTION = 'reactionRules';
const GRID_SPACING = 40;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);
const HALOGENS = ['Br', 'Cl', 'F', 'I'];

// ─── POSITION HELPERS ─────────────────────────────────────────────────────────

/**
 * Compute the least-squares similarity transform (translation + rotation + uniform scale)
 * that maps pattern atom positions → matched molecule atom positions.
 * Returns a function (x, y) → {x, y}.
 */
function computePatternToMolTransform(patternAtoms, molAtoms, mapping) {
  const pairs = [];
  for (const [patId, molId] of mapping) {
    const p = patternAtoms.find(a => a.id === patId);
    const m = molAtoms.find(a => a.id === molId);
    if (p && m) pairs.push({ p, m });
  }

  if (pairs.length === 0) return (x, y) => ({ x, y });

  if (pairs.length === 1) {
    const dx = pairs[0].m.x - pairs[0].p.x;
    const dy = pairs[0].m.y - pairs[0].p.y;
    return (x, y) => ({ x: x + dx, y: y + dy });
  }

  // Closed-form least-squares: m = a*p - b*p_perp + t
  // where a = s·cos θ, b = s·sin θ
  const n = pairs.length;
  const px_mean = pairs.reduce((s, { p }) => s + p.x, 0) / n;
  const py_mean = pairs.reduce((s, { p }) => s + p.y, 0) / n;
  const mx_mean = pairs.reduce((s, { m }) => s + m.x, 0) / n;
  const my_mean = pairs.reduce((s, { m }) => s + m.y, 0) / n;

  let num_a = 0, num_b = 0, denom = 0;
  for (const { p, m } of pairs) {
    const cpx = p.x - px_mean, cpy = p.y - py_mean;
    const cmx = m.x - mx_mean, cmy = m.y - my_mean;
    num_a += cpx * cmx + cpy * cmy;
    num_b += cpx * cmy - cpy * cmx;
    denom += cpx * cpx + cpy * cpy;
  }

  if (denom < 1e-6) {
    const dx = mx_mean - px_mean, dy = my_mean - py_mean;
    return (x, y) => ({ x: x + dx, y: y + dy });
  }

  const a = num_a / denom;
  const b = num_b / denom;
  const tx = mx_mean - (a * px_mean - b * py_mean);
  const ty = my_mean - (b * px_mean + a * py_mean);

  return (x, y) => ({ x: a * x - b * y + tx, y: b * x + a * y + ty });
}

/**
 * Snap a position to the nearest point on the triangular grid used by the canvases.
 */
function snapToGrid(x, y) {
  const rowH = GRID_SPACING * Math.sin(Math.PI / 3);
  const nearRow = Math.round(y / rowH);
  let best = null;
  let bestDist = Infinity;
  for (let r = nearRow - 1; r <= nearRow + 1; r++) {
    const gy = r * rowH;
    const offset = ((r % 2) + 2) % 2 === 0 ? 0 : GRID_SPACING / 2;
    const nearCol = Math.round((x - offset) / GRID_SPACING);
    for (let c = nearCol - 1; c <= nearCol + 1; c++) {
      const gx = c * GRID_SPACING + offset;
      const d = Math.hypot(gx - x, gy - y);
      if (d < bestDist) { bestDist = d; best = { x: gx, y: gy }; }
    }
  }
  return best ?? { x, y };
}

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
function applyDelta(molAtoms, molBonds, delta, match, rGroupCaptures, addedAtomPositions = new Map()) {
  let newAtoms = molAtoms.map(a => ({ ...a }));
  let newBonds = molBonds.map(b => ({ ...b }));
  let idCounter = Date.now();

  // Pre-scan: find R-removal/replacement pairs.
  // When R has different IDs in pattern vs result (rule built without Copy Left→Right),
  // the delta shows R as "removed + new R added". Instead, we treat this as KEEP:
  // skip both the removal and the addition, and remap the replacement R's ID to the
  // original matched mol atom. This preserves the real atom (and its whole group)
  // with its original label, and any bonds from the "result R" attach to it normally.
  // Key: addedAtom.id of the replacement R → molAtomId to use in its place
  const rSkip = new Map(); // replacementR.id → originalMolId
  const rSkipPids = new Set(); // pattern atom IDs whose removal should be skipped
  delta.removedAtomIds.forEach(pid => {
    const mid = match.get(pid);
    if (mid === undefined) return;
    const groupIds = rGroupCaptures?.get(pid);
    if (!groupIds) return; // only applies to R wildcards (which have captures)
    const replacementR = delta.addedAtoms.find(
      a => (a.label || 'C').trim() === 'R' && !rSkip.has(a.id)
    );
    if (!replacementR) return;
    rSkip.set(replacementR.id, mid);
    rSkipPids.add(pid);
  });

  // 1. Remove atoms (and all their bonds).
  // If the removed atom was an R wildcard, remove the entire captured R group —
  // UNLESS it pairs with a replacement R (rSkipPids), in which case we keep
  // everything and just remap the replacement R's bonds to the original atom.
  delta.removedAtomIds.forEach(pid => {
    const mid = match.get(pid);
    if (mid === undefined) return;
    if (rSkipPids.has(pid)) return; // keep the original atom and its whole group

    const groupIds = rGroupCaptures?.get(pid) ?? new Set([mid]);
    newAtoms = newAtoms.filter(a => !groupIds.has(a.id));
    newBonds = newBonds.filter(b => !groupIds.has(b.from) && !groupIds.has(b.to));
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
    // If this is a replacement R that pairs with a kept original atom, skip adding
    // a new atom entirely — just alias the replacement R's ID to the original mol atom.
    // Any bonds in addedBonds that reference this atom will then attach to the real atom.
    if (rSkip.has(atom.id)) {
      idRemap.set(atom.id, rSkip.get(atom.id));
      return;
    }

    const newId = idCounter++;
    idRemap.set(atom.id, newId);

    // Use the answer-key-aligned position if available (computed via similarity transform),
    // otherwise fall back to finding an open neighbour slot.
    let pos = addedAtomPositions.get(atom.id) ?? null;
    if (!pos) {
      const parentBond = delta.addedBonds.find(b => b.from === atom.id || b.to === atom.id);
      pos = { x: 100, y: 100 };
      if (parentBond) {
        const parentPatId = parentBond.from === atom.id ? parentBond.to : parentBond.from;
        const parentMolId = match.get(parentPatId) ?? idRemap.get(parentPatId);
        if (parentMolId !== undefined) pos = findOpenNeighbor(parentMolId, newAtoms);
      }
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
  const { mapping, rGroupCaptures } = matches[0];

  // Compute the similarity transform (translation + rotation + scale) that maps
  // the rule's pattern canvas coordinates to the molecule's actual coordinates.
  // Then apply it to every added atom's answer-key position so new atoms land
  // in the right place relative to the matched mol atoms.
  const xform = computePatternToMolTransform(patternAtoms, molAtoms, mapping);
  const addedAtomPositions = new Map();
  (rule.resultAtoms || []).forEach(ra => {
    if (delta.addedAtoms.some(a => a.id === ra.id)) {
      const { x, y } = xform(ra.x, ra.y);
      addedAtomPositions.set(ra.id, snapToGrid(x, y));
    }
  });

  const { atoms, bonds } = applyDelta(molAtoms, molBonds, delta, mapping, rGroupCaptures, addedAtomPositions);
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

export async function updateRule(ruleId, ruleData) {
  await updateDoc(doc(db, RULES_COLLECTION, ruleId), ruleData);
}

const SUBSCRIPT_TO_NORMAL = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};

function normalizeReagentForMatch(str) {
  return str
    .toLowerCase()
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => SUBSCRIPT_TO_NORMAL[c])
    .replace(/[\s,]+/g, '');
}

const SUBSCRIPT_MAP = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉'};

export function autoSubscript(str) {
  if (!str) return str;
  return str.replace(/([A-Za-z])(\d+)/g, (_, letter, digits) =>
    letter + digits.split('').map(d => SUBSCRIPT_MAP[d] || d).join('')
  );
}

/**
 * Find a saved rule matching the given reagent string.
 * Tries exact/substring match first, then X-wildcard match.
 * Returns the rule with resolvedX attached, or null.
 * Treats spaces and commas as equivalent separators, and normalizes subscript digits.
 */
export async function findRule(reagentStr) {
  const rules = await loadRules();
  const lower = normalizeReagentForMatch(reagentStr);

  const exact = rules.find(r => {
    const rLower = normalizeReagentForMatch(r.reagent || '');
    return rLower === lower || lower.includes(rLower) || rLower.includes(lower);
  });
  if (exact) return { ...exact, resolvedX: extractHalogen(reagentStr) };

  const wildcard = rules.find(r => xWildcardMatches(r.reagent || '', reagentStr));
  if (wildcard) return { ...wildcard, resolvedX: extractHalogen(reagentStr) };

  return null;
}
