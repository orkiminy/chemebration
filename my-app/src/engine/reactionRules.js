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

// Module-level counter for unique atom/bond IDs across multiple applyDelta calls
// within the same synchronous frame (avoids Date.now() collisions).
let _idCounter = Date.now();
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);
const HALOGENS = ['Br', 'Cl', 'F', 'I'];

// ─── POSITION HELPERS ─────────────────────────────────────────────────────────

/**
 * Compute the least-squares similarity transform (translation + rotation + uniform scale)
 * that maps pattern atom positions → matched molecule atom positions.
 * Returns a function (x, y) → {x, y}.
 */
export function computePatternToMolTransform(patternAtoms, molAtoms, mapping) {
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

  const n = pairs.length;
  const px_mean = pairs.reduce((s, { p }) => s + p.x, 0) / n;
  const py_mean = pairs.reduce((s, { p }) => s + p.y, 0) / n;
  const mx_mean = pairs.reduce((s, { m }) => s + m.x, 0) / n;
  const my_mean = pairs.reduce((s, { m }) => s + m.y, 0) / n;

  let denom = 0;
  for (const { p } of pairs) {
    const cpx = p.x - px_mean, cpy = p.y - py_mean;
    denom += cpx * cpx + cpy * cpy;
  }

  if (denom < 1e-6) {
    const dx = mx_mean - px_mean, dy = my_mean - py_mean;
    return (x, y) => ({ x: x + dx, y: y + dy });
  }

  // Fit both a regular transform (rotation+scale) and a reflected one,
  // then pick whichever has lower residual error.
  // Regular:  x' = a*x - b*y + tx,  y' = b*x + a*y + ty
  // Reflected: x' = a*x + b*y + tx,  y' = b*x - a*y + ty  (mirror across x before rotate)

  // Regular least-squares
  let rA = 0, rB = 0;
  for (const { p, m } of pairs) {
    const cpx = p.x - px_mean, cpy = p.y - py_mean;
    const cmx = m.x - mx_mean, cmy = m.y - my_mean;
    rA += cpx * cmx + cpy * cmy;
    rB += cpx * cmy - cpy * cmx;
  }
  const a1 = rA / denom, b1 = rB / denom;
  const tx1 = mx_mean - (a1 * px_mean - b1 * py_mean);
  const ty1 = my_mean - (b1 * px_mean + a1 * py_mean);

  // Reflected least-squares (flip y of pattern before fitting)
  let fA = 0, fB = 0;
  for (const { p, m } of pairs) {
    const cpx = p.x - px_mean, cpy = -(p.y - py_mean); // flip y
    const cmx = m.x - mx_mean, cmy = m.y - my_mean;
    fA += cpx * cmx + cpy * cmy;
    fB += cpx * cmy - cpy * cmx;
  }
  const a2 = fA / denom, b2 = fB / denom;
  const tx2 = mx_mean - (a2 * px_mean + b2 * py_mean);
  const ty2 = my_mean - (b2 * px_mean - a2 * py_mean);

  // Compute residual errors
  let err1 = 0, err2 = 0;
  for (const { p, m } of pairs) {
    const r1x = a1 * p.x - b1 * p.y + tx1;
    const r1y = b1 * p.x + a1 * p.y + ty1;
    err1 += (r1x - m.x) ** 2 + (r1y - m.y) ** 2;

    const r2x = a2 * p.x + b2 * p.y + tx2;
    const r2y = b2 * p.x - a2 * p.y + ty2;
    err2 += (r2x - m.x) ** 2 + (r2y - m.y) ** 2;
  }

  if (err2 < err1 - 1e-6) {
    // Reflected transform is a better fit
    return (x, y) => ({ x: a2 * x + b2 * y + tx2, y: b2 * x - a2 * y + ty2 });
  }
  return (x, y) => ({ x: a1 * x - b1 * y + tx1, y: b1 * x + a1 * y + ty1 });
}

/**
 * Snap a position to the nearest point on the triangular grid used by the canvases.
 */
export function snapToGrid(x, y) {
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

// ─── EAS DIRECTING EFFECTS ───────────────────────────────────────────────────
// Meta-directing groups; everything else defaults to ortho/para.
// Single-atom labels checked directly:
const META_DIRECTOR_LABELS = new Set(['NO2', 'CN', 'CF3']);
// For multi-atom substituents, we check the root atom + its neighbors:
//   C bonded to =O → carbonyl (COR, COOH, CHO) → meta
//   S bonded to =O → sulfonyl (SO3R, SO3H) → meta
//   N with 3+ bonds and positive charge context (NR3+) → meta
function isMetaDirector(rootLabel, rootId, molAtoms, molBonds) {
  const l = (rootLabel || 'C').trim();
  if (META_DIRECTOR_LABELS.has(l)) return true;
  if (l === 'C') {
    // Carbon bonded to a double-bonded O → carbonyl → meta (COR, COOH, CHO)
    const hasDoubleBondO = molBonds.some(b => {
      const neighborId = b.from === rootId ? b.to : b.to === rootId ? b.from : null;
      if (!neighborId || (b.order || 1) < 2) return false;
      const neighbor = molAtoms.find(a => a.id === neighborId);
      return neighbor && (neighbor.label || 'C').trim() === 'O';
    });
    if (hasDoubleBondO) return true;
    // Carbon bonded to 3 fluorines → CF3 → meta
    const fCount = molBonds.filter(b => {
      const neighborId = b.from === rootId ? b.to : b.to === rootId ? b.from : null;
      if (!neighborId) return false;
      const neighbor = molAtoms.find(a => a.id === neighborId);
      return neighbor && (neighbor.label || 'C').trim() === 'F';
    }).length;
    if (fCount >= 3) return true;
  }
  // Sulfur bonded to O → sulfonyl → meta (SO3R, SO3H)
  if (l === 'S') {
    const hasBondedO = molBonds.some(b => {
      const neighborId = b.from === rootId ? b.to : b.to === rootId ? b.from : null;
      if (!neighborId) return false;
      const neighbor = molAtoms.find(a => a.id === neighborId);
      return neighbor && (neighbor.label || 'C').trim() === 'O';
    });
    if (hasBondedO) return true;
  }
  // Nitrogen with 3+ non-H bonds → NR3+ (quaternary ammonium) → meta
  if (l === 'N') {
    const nonHBonds = molBonds.filter(b => {
      const neighborId = b.from === rootId ? b.to : b.to === rootId ? b.from : null;
      if (!neighborId) return false;
      const neighbor = molAtoms.find(a => a.id === neighborId);
      return neighbor && (neighbor.label || 'C').trim() !== 'H';
    }).length;
    if (nonHBonds >= 3) return true;
  }
  return false;
}

/**
 * Walk a benzene ring starting from startId in clockwise order (using geometry).
 * @param {Set} [ringIds] - if provided, only walk through these atom IDs (avoids
 *   confusing ring carbons with non-ring carbons like methyl groups).
 * Returns ordered array of 6 ring atom IDs, or null if no valid ring found.
 */
function walkRingCW(atoms, bonds, startId, ringIds) {
  const posMap = new Map(atoms.map(a => [a.id, { x: a.x, y: a.y }]));
  const adj = new Map();
  atoms.forEach(a => adj.set(a.id, []));
  bonds.forEach(b => {
    adj.get(b.from)?.push(b.to);
    adj.get(b.to)?.push(b.from);
  });

  // Use provided ring IDs if available, otherwise fall back to label-based detection
  const ringAtomIds = ringIds || new Set(
    atoms.filter(a => { const l = (a.label || 'C').trim(); return l === 'C' || l === ''; }).map(a => a.id)
  );
  if (!ringAtomIds.has(startId)) return null;

  const ringNeighbors = (id) => (adj.get(id) || []).filter(n => ringAtomIds.has(n));

  // Start: pick the neighbor that makes a CW turn from the "up" direction.
  // We use atan2 angles sorted CW (decreasing angle from positive-x axis).
  const startPos = posMap.get(startId);
  if (!startPos) return null;

  const firstNeighbors = ringNeighbors(startId);
  if (firstNeighbors.length < 2) return null;

  // Sort neighbors by angle from startId, pick one direction consistently
  const angleFrom = (fromId, toId) => {
    const f = posMap.get(fromId), t = posMap.get(toId);
    return Math.atan2(t.y - f.y, t.x - f.x);
  };

  // Pick the neighbor with the smallest angle (most clockwise from east)
  const sorted = [...firstNeighbors].sort((a, b) => angleFrom(startId, a) - angleFrom(startId, b));
  const visited = [startId];
  const seen = new Set([startId]);
  let prev = startId;
  let current = sorted[0]; // first CW neighbor
  visited.push(current);
  seen.add(current);

  // Continue walking: at each step, pick the ring neighbor that is NOT prev
  // and makes the most CW turn (smallest signed angle change)
  for (let step = 0; step < 4; step++) {
    const neighbors = ringNeighbors(current).filter(n => !seen.has(n));
    if (neighbors.length === 0) return null;

    if (neighbors.length === 1) {
      prev = current;
      current = neighbors[0];
    } else {
      // Pick neighbor with most CW angle relative to the incoming direction
      const cur = current; // capture for closure
      const inAngle = angleFrom(cur, prev);
      const best = neighbors.reduce((a, b) => {
        const da = ((angleFrom(cur, a) - inAngle + 3 * Math.PI) % (2 * Math.PI));
        const db = ((angleFrom(cur, b) - inAngle + 3 * Math.PI) % (2 * Math.PI));
        return da < db ? a : b;
      });
      prev = current;
      current = best;
    }
    visited.push(current);
    seen.add(current);
  }

  // Verify closure
  if (!(adj.get(current) || []).includes(startId)) return null;
  if (visited.length !== 6) return null;
  return visited;
}

/**
 * For an EAS rule with pattern = benzene + R, adjust the delta's added-atom bonds
 * to place the new group at the correct ring position based on the directing effect.
 *
 * Strategy: walk the PATTERN ring to find the rule's default offset for the new group,
 * then walk the MOLECULE ring the same way. If the substituent's directing effect
 * requires a different position, re-target the bond.
 */
function adjustEASDirecting(mapping, patternAtoms, patternBonds, delta, molAtoms, molBonds, rGroupCaptures) {
  // 1. Find the R pattern atom
  const rPatAtom = patternAtoms.find(a => {
    const l = (a.label || 'C').trim();
    return l === 'R' || l === "R'" || l === "R''";
  });
  if (!rPatAtom) return false;

  const rMolId = mapping.get(rPatAtom.id);
  if (rMolId === undefined) return false;

  // 2. Find R's attachment ring carbon in the pattern
  const rBond = patternBonds.find(b => b.from === rPatAtom.id || b.to === rPatAtom.id);
  if (!rBond) return false;
  const rAttachPatId = rBond.from === rPatAtom.id ? rBond.to : rBond.from;
  const rAttachMolId = mapping.get(rAttachPatId);
  if (rAttachMolId === undefined) return false;

  // 3. Find which ring carbon the NEW group bonds to in addedBonds
  const ringPatIds = new Set(
    patternAtoms.filter(a => {
      const l = (a.label || 'C').trim();
      return (l === 'C' || l === '') && a.id !== rPatAtom.id;
    }).map(a => a.id)
  );

  let newGroupAttachPatId = null;
  let newGroupBondIdx = null;
  for (let i = 0; i < (delta.addedBonds || []).length; i++) {
    const bond = delta.addedBonds[i];
    const keptEnd = ringPatIds.has(bond.from) ? bond.from : ringPatIds.has(bond.to) ? bond.to : null;
    if (keptEnd && (!ringPatIds.has(bond.from) || !ringPatIds.has(bond.to))) {
      newGroupAttachPatId = keptEnd;
      newGroupBondIdx = i;
      break;
    }
  }
  if (newGroupAttachPatId === null) return false;

  // 4. Walk the PATTERN ring CW from R-attach to determine the rule's default offset
  // Pass explicit ring IDs so non-ring carbons (like substituents) aren't followed.
  const patRingIds = new Set([...ringPatIds, rAttachPatId]);
  const patRing = walkRingCW(patternAtoms, patternBonds, rAttachPatId, patRingIds);
  if (!patRing || patRing.length !== 6) return false;
  const ruleOffset = patRing.indexOf(newGroupAttachPatId);
  if (ruleOffset < 0) return false;
  console.log(`[EAS] pattern ring walk:`, patRing, `R-attach=${rAttachPatId}, NO2-attach=${newGroupAttachPatId}, ruleOffset=${ruleOffset}`);

  // 5. Determine directing effect of the matched substituent
  const rMolAtom = molAtoms.find(a => a.id === rMolId);
  const rLabel = (rMolAtom?.label || 'C').trim();

  // Plain benzene (R=H or isolated C): no directing needed
  if (rLabel === 'H') return false;
  const rGroupSize = rGroupCaptures?.get(rPatAtom.id)?.size || 0;
  if (rLabel === 'C' && rGroupSize <= 1) return false;

  const isMeta = isMetaDirector(rLabel, rMolId, molAtoms, molBonds);

  // 6. Compute target offset
  // ruleOffset = where the rule places the new group (meta in our case)
  // For meta directors: keep ruleOffset (no change needed)
  // For ortho/para directors: shift by +1 to go from meta→para
  if (isMeta) return false; // already at correct position

  const targetOffset = ruleOffset + 1; // meta→para (one position further around ring)

  // 7. Walk the MOLECULE ring CW from R-attach
  // Map the pattern ring IDs to mol IDs so walkRingCW only follows actual ring carbons.
  const molRingIds = new Set([...patRingIds].map(pid => mapping.get(pid)).filter(id => id !== undefined));
  const molRing = walkRingCW(molAtoms, molBonds, rAttachMolId, molRingIds);
  if (!molRing || molRing.length !== 6) return false;
  console.log(`[EAS] mol ring walk:`, molRing, `R-attach=${rAttachMolId}, targetOffset=${targetOffset}`);

  const targetMolId = molRing[targetOffset % 6];

  // Find the pattern atom that maps to the target mol ring carbon
  let targetPatId = null;
  for (const [patId, molId] of mapping) {
    if (molId === targetMolId) { targetPatId = patId; break; }
  }
  if (targetPatId === null) return false;

  // 8. Re-target the addedBond
  const bond = delta.addedBonds[newGroupBondIdx];
  if (bond.from === newGroupAttachPatId) bond.from = targetPatId;
  else if (bond.to === newGroupAttachPatId) bond.to = targetPatId;

  // 9. Compute the rotation angle so added atom positions rotate with the bond.
  // The angle = difference in position of old vs new ring carbon around the ring center.
  const oldMolAtom = molAtoms.find(a => a.id === mapping.get(newGroupAttachPatId));
  const newMolAtom = molAtoms.find(a => a.id === targetMolId);
  if (oldMolAtom && newMolAtom) {
    // Ring centroid
    const cx = molRing.reduce((s, id) => s + (molAtoms.find(a => a.id === id)?.x || 0), 0) / 6;
    const cy = molRing.reduce((s, id) => s + (molAtoms.find(a => a.id === id)?.y || 0), 0) / 6;
    const oldAngle = Math.atan2(oldMolAtom.y - cy, oldMolAtom.x - cx);
    const newAngle = Math.atan2(newMolAtom.y - cy, newMolAtom.x - cx);
    const rotAngle = newAngle - oldAngle;
    // Store rotation info on delta so applyRule can rotate addedAtomPositions
    delta._easRotation = { cx, cy, angle: rotAngle };
  }

  console.log(`[EAS] rotated: offset ${ruleOffset}→${targetOffset}, patId ${newGroupAttachPatId}→${targetPatId}, molId ${mapping.get(newGroupAttachPatId)}→${targetMolId}`);
  return true;
}

/**
 * Extract what the user typed in place of R/R'/R'' and which variant was replaced.
 * e.g. stored "R'MgBr, ether", input "ClMgBr, ether" → { group: "Cl", variant: "R'" }
 */
function extractResolvedR(storedReagent, inputReagent) {
  const norm = s => normalizePrimes(s).replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => SUBSCRIPT_TO_NORMAL[c]);
  const storedTokens = norm(storedReagent).split(/[\s,/]+/).filter(Boolean);
  const inputTokens  = norm(inputReagent).split(/[\s,/]+/).filter(Boolean);

  for (const st of storedTokens) {
    const m = st.match(/^R[']*(?=[A-Z(])/);
    if (!m) continue;
    const variant = m[0]; // "R", "R'", or "R''"
    const suffix = st.slice(variant.length).toLowerCase();
    for (const it of inputTokens) {
      if (it.toLowerCase().endsWith(suffix) && it.toLowerCase() !== st.toLowerCase()) {
        return { group: it.slice(0, it.length - suffix.length), variant };
      }
    }
  }
  return null;
}

function rWildcardMatches(storedReagent, inputReagent) {
  const norm = s => normalizePrimes(s).replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => SUBSCRIPT_TO_NORMAL[c]);
  const storedTokens = norm(storedReagent).split(/[\s,/]+/).filter(Boolean);
  const inputTokens  = norm(inputReagent).split(/[\s,/]+/).filter(Boolean);

  function rSuffix(token) {
    const m = token.match(/^R[']*(?=[A-Z(])/);
    return m ? token.slice(m[0].length).toLowerCase() : null;
  }

  if (!storedTokens.some(t => rSuffix(t) !== null)) return false;
  if (storedTokens.length !== inputTokens.length) return false;

  const inputLower = inputTokens.map(t => t.toLowerCase());
  const used = new Set();

  for (const st of storedTokens) {
    const suffix = rSuffix(st);
    let matched = false;
    if (suffix !== null) {
      for (let i = 0; i < inputLower.length; i++) {
        if (!used.has(i) && inputLower[i].endsWith(suffix)) {
          used.add(i); matched = true; break;
        }
      }
    } else {
      const stLow = st.toLowerCase();
      for (let i = 0; i < inputLower.length; i++) {
        if (!used.has(i) && inputLower[i] === stLow) {
          used.add(i); matched = true; break;
        }
      }
    }
    if (!matched) return false;
  }
  return true;
}

// ─── BENZENE RING NORMALIZATION ───────────────────────────────────────────────
// Detects 6-membered all-carbon rings with strictly alternating single/double
// bonds and normalises all their intra-ring bonds to AROMATIC_ORDER (1.5).
// This makes benzene matching position-agnostic without touching any other bonds.

const AROMATIC_ORDER = 1.5;

function findAromaticRings(atoms, bonds) {
  const carbonIds = new Set(
    atoms
      .filter(a => { const l = (a.label || 'C').trim(); return l === 'C' || l === ''; })
      .map(a => a.id)
  );

  const adj = new Map(atoms.map(a => [a.id, []]));
  bonds.forEach(b => {
    adj.get(b.from)?.push({ neighbor: b.to, order: b.order || 1 });
    adj.get(b.to)?.push({ neighbor: b.from, order: b.order || 1 });
  });

  const rings = [];
  const seen  = new Set();

  for (const startId of carbonIds) {
    const dfs = (path) => {
      if (path.length === 7) return;
      const cur = path[path.length - 1];

      for (const { neighbor } of (adj.get(cur) || [])) {
        if (!carbonIds.has(neighbor)) continue;

        if (path.length === 6 && neighbor === startId) {
          const orders = [];
          for (let i = 0; i < 6; i++) {
            const edge = (adj.get(path[i]) || []).find(e => e.neighbor === path[(i + 1) % 6]);
            if (!edge) { orders.push(null); break; }
            orders.push(edge.order || 1);
          }
          // Detect aromatic: 6 carbons with 2+ double bonds. Lenient enough
          // to catch old rules with non-standard alternation, strict enough
          // to exclude cyclohexane (0 doubles) and cyclohexene (1 double).
          const isAromatic =
            orders.length === 6 &&
            orders.every(o => o === 1 || o === 2 || o === 1.5) &&
            orders.filter(o => o === 2 || o === 1.5).length >= 2;
          if (!isAromatic) continue;

          const key = [...path].sort((a, b) => a - b).join(',');
          if (!seen.has(key)) { seen.add(key); rings.push(new Set(path)); }
          continue;
        }

        if (path.includes(neighbor)) continue;
        if (neighbor === startId && path.length < 6) continue;
        path.push(neighbor);
        dfs(path);
        path.pop();
      }
    };
    dfs([startId]);
  }
  return rings;
}

function normalizeBenzeneRings(atoms, bonds, label) {
  const rings = findAromaticRings(atoms, bonds);
  console.log(`[normBenzene:${label || '?'}] ${atoms.length} atoms, ${bonds.length} bonds → ${rings.length} aromatic ring(s) found`);
  if (rings.length === 0) {
    // Log bond orders so we can see why no ring was detected
    const carbonIds = new Set(atoms.filter(a => { const l = (a.label||'C').trim(); return l==='C'||l===''; }).map(a=>a.id));
    const ringBonds = bonds.filter(b => carbonIds.has(b.from) && carbonIds.has(b.to));
    console.log(`[normBenzene:${label}] carbon-carbon bond orders:`, ringBonds.map(b => `${b.from}→${b.to}:${b.order||1}`));
    return bonds;
  }

  const aromaticBondIds = new Set();
  for (const ring of rings) {
    bonds.forEach(b => {
      if (ring.has(b.from) && ring.has(b.to)) aromaticBondIds.add(b.id);
    });
  }
  return bonds.map(b => aromaticBondIds.has(b.id) ? { ...b, order: AROMATIC_ORDER } : b);
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
function applyDelta(molAtoms, molBonds, delta, match, rGroupCaptures, addedAtomPositions = new Map(), posReplacementPairs = new Map()) {
  let newAtoms = molAtoms.map(a => ({ ...a }));
  let newBonds = molBonds.map(b => ({ ...b }));
  // Use the module-level counter so sequential calls never produce duplicate IDs.
  if (_idCounter <= Date.now()) _idCounter = Date.now() + 1;
  let idCounter = _idCounter;

  // Pre-scan: find atoms whose removal should be skipped ("rSkip").
  //
  // Case 1 — R wildcards: when R has different IDs on left vs right canvas
  // (rule built without Copy Left→Right), the delta shows R as "removed + new R added".
  // We keep the original matched atom (and its whole captured group) and remap the
  // replacement R's bonds to it.
  //
  // Case 2 — Position-matched atoms: when ANY pattern atom was drawn at the same canvas
  // position as a result atom (same-label, same grid point), treat it as "kept" too.
  // This means rules don't need Copy Left→Right to preserve outside connections —
  // any atom drawn at the same position on both canvases automatically stays in the
  // molecule with all its external bonds intact.
  //
  // Key: addedAtom.id of the replacement → molAtomId to use in its place
  const rSkip = new Map(); // replacementAtom.id → originalMolId
  const rSkipPids = new Set(); // pattern atom IDs whose removal should be skipped
  const coreIds = new Set(match.values());

  delta.removedAtomIds.forEach(pid => {
    const mid = match.get(pid);
    if (mid === undefined) return;

    // Case 1: R wildcard with captured group — only pair same label (R↔R, R'↔R', R''↔R'').
    const groupIds = rGroupCaptures?.get(pid);
    if (groupIds) {
      const pidLabel = (delta._removedLabels || {})[pid] || 'R';
      const replacementR = delta.addedAtoms.find(
        a => { const l = (a.label || 'C').trim(); return l === pidLabel && !rSkip.has(a.id); }
      );
      if (replacementR) {
        rSkip.set(replacementR.id, mid);
        rSkipPids.add(pid);
        return;
      }
    }

    // Case 2: position-matched atom that has bonds to atoms outside the pattern.
    // Only activate when the mol atom actually connects to something outside the
    // matched subgraph — otherwise the normal remove+add path is fine.
    const hasExternalBonds = newBonds.some(b =>
      (b.from === mid && !coreIds.has(b.to)) ||
      (b.to   === mid && !coreIds.has(b.from))
    );
    if (hasExternalBonds && posReplacementPairs.has(pid)) {
      const repId = posReplacementPairs.get(pid);
      if (!rSkip.has(repId)) {
        rSkip.set(repId, mid);
        rSkipPids.add(pid);
      }
    }
  });

  // Snapshot which atoms had bonds BEFORE the removal step, so we can distinguish
  // atoms that were already disconnected from atoms that became orphaned by the delta.
  const bondedBefore = new Set();
  newBonds.forEach(b => { bondedBefore.add(b.from); bondedBefore.add(b.to); });

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

  // 1b. Prune newly-orphaned atoms.
  // Removing a middle-chain atom (e.g. the alpha-CH2 of ethylbenzene) severs the
  // bond to the rest of the chain, leaving downstream atoms with zero bonds.
  // Only prune atoms that WERE bonded before the removal but now have zero bonds —
  // atoms that were already disconnected (e.g. user-placed free atoms) are left alone.
  {
    const coreMatchIds = new Set(match.values());
    const stillBonded = new Set();
    newBonds.forEach(b => { stillBonded.add(b.from); stillBonded.add(b.to); });
    const orphans = newAtoms.filter(a =>
      !stillBonded.has(a.id) && !coreMatchIds.has(a.id) && bondedBefore.has(a.id)
    );
    if (orphans.length > 0) {
      const orphanIds = new Set(orphans.map(a => a.id));
      newAtoms = newAtoms.filter(a => !orphanIds.has(a.id));
    }
  }

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
      // Remove any pre-existing bond between these endpoints before adding the new one.
      // Without this, the rSkip path leaves the original attachment bond in newBonds AND
      // adds a duplicate here (addedBonds still contains the core→R_new bond).
      newBonds = newBonds.filter(b =>
        !((b.from === fromId && b.to === toId) || (b.from === toId && b.to === fromId))
      );
      newBonds.push({ id: idCounter++, from: fromId, to: toId, order: bond.order || 1, style: bond.style || 'solid' });
    }
  });

  // Advance the module-level counter past what this call used.
  _idCounter = idCounter;

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
  const resolvedR = rule.resolvedR || null;
  const resolvedRVariant = rule.resolvedRVariant || null;
  const resolveLabel = lbl => {
    if (lbl === 'X' && resolvedX) return resolvedX;
    if (resolvedR && resolvedRVariant && normalizePrimes(lbl.trim()) === resolvedRVariant) return resolvedR;
    return lbl;
  };

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
  let patternAtoms = rule.patternAtoms.map(a => ({ ...a, label: resolveLabel(a.label || 'C') }));

  // Resolve labels in the delta's added atoms.
  // Also attach _removedLabels so applyDelta can pair R↔R, R'↔R' (not R↔R').
  const removedLabels = {};
  (rule.delta.removedAtomIds || []).forEach(pid => {
    const pa = rule.patternAtoms.find(a => a.id === pid);
    if (pa) removedLabels[pid] = (pa.label || 'C').trim();
  });
  const delta = {
    ...rule.delta,
    addedAtoms: (rule.delta.addedAtoms || []).map(a => ({ ...a, label: resolveLabel(a.label || 'C') })),
    // Deep-copy addedBonds so adjustEASDirecting mutations don't corrupt rule.delta
    addedBonds: (rule.delta.addedBonds || []).map(b => ({ ...b })),
    changedBonds: (rule.delta.changedBonds || []).map(b => ({ ...b })),
    removedBonds: (rule.delta.removedBonds || []).map(b => ({ ...b })),
    newKeptBonds: (rule.delta.newKeptBonds || []).map(b => ({ ...b })),
    _removedLabels: removedLabels,
  };

  // Strip stray (unbonded) atoms from the pattern — old rules may have accidental
  // floating atoms that inflate the pattern size and prevent matching.
  const patBondedIds = new Set();
  rule.patternBonds.forEach(b => { patBondedIds.add(b.from); patBondedIds.add(b.to); });
  if (patBondedIds.size > 0) {
    const strays = patternAtoms.filter(a => !patBondedIds.has(a.id));
    if (strays.length > 0) {
      console.warn(`[applyRule] stripped ${strays.length} stray pattern atom(s):`, strays.map(a => `${a.id}(${a.label||'C'})`));
      patternAtoms = patternAtoms.filter(a => patBondedIds.has(a.id));
    }
  }

  // Normalize benzene rings (alternating 1/2 → 1.5) in BOTH pattern and molecule
  // before matching so position-shifted benzene rings always match.
  // Original molBonds is preserved below for applyDelta.
  const patternBondsNorm = normalizeBenzeneRings(patternAtoms, rule.patternBonds, 'pattern');
  const molBondsNorm     = normalizeBenzeneRings(molAtoms, molBonds, 'molecule');

  // Find where the pattern appears in the student's molecule
  console.log(`[applyRule] PATTERN: ${patternAtoms.length} atoms, ${patternBondsNorm.length} bonds`);
  console.log(`[applyRule]   pattern labels:`, patternAtoms.map(a => `${a.id}(${(a.label||'C').trim()})`).join(', '));
  console.log(`[applyRule]   pattern bonds:`, patternBondsNorm.map(b => `${b.from}→${b.to}:ord${b.order}`).join(', '));
  console.log(`[applyRule] MOLECULE: ${molAtoms.length} atoms, ${molBondsNorm.length} bonds`);
  console.log(`[applyRule]   molecule labels:`, molAtoms.map(a => `${a.id}(${(a.label||'C').trim()})`).join(', '));
  console.log(`[applyRule]   molecule bonds:`, molBondsNorm.map(b => `${b.from}→${b.to}:ord${b.order}`).join(', '));
  if (patternAtoms.length > molAtoms.length) {
    console.warn(`[applyRule] ⚠️ PATTERN HAS MORE ATOMS (${patternAtoms.length}) THAN MOLECULE (${molAtoms.length}) — match is impossible!`);
  }
  const matches = findMatches(patternAtoms, patternBondsNorm, molAtoms, molBondsNorm);
  console.log(`[applyRule] findMatches returned ${matches.length} match(es)`);

  if (matches.length === 0) {
    // Pattern not found — fall back to stored example with a warning
    return {
      products: [{
        atoms: rule.resultAtoms.map(a => ({ ...a, label: resolveLabel(a.label || '') })),
        bonds: rule.resultBonds.map(b => ({ ...b })),
      }],
      explanation: rule.explanation || '',
      noMatch: true,
      _debug: null,
    };
  }

  // Deduplicate matches: a symmetric benzene ring produces CW + CCW variants
  // for each chain (same mol-atom set, different pattern assignment order).
  // Sorting all mapped mol-atom IDs gives the same key for both variants.
  // IMPORTANT: among the variants sharing a key, keep the one whose similarity
  // transform has the SMALLEST residual error.  A CW/CCW orientation mismatch
  // makes num_a and num_b both sum to ~0, collapsing the transform to a pure
  // translation that dumps all new atoms at the ring centroid.  The matching
  // orientation variant has large num_a → well-conditioned scale+rotation.
  function transformResidual(mapping) {
    const pairs = [];
    for (const [patId, molId] of mapping) {
      const p = patternAtoms.find(a => a.id === patId);
      const m = molAtoms.find(a => a.id === molId);
      if (p && m) pairs.push({ p, m });
    }
    if (pairs.length < 2) return 0;
    const n = pairs.length;
    const px_mean = pairs.reduce((s, { p }) => s + p.x, 0) / n;
    const py_mean = pairs.reduce((s, { p }) => s + p.y, 0) / n;
    const mx_mean = pairs.reduce((s, { m }) => s + m.x, 0) / n;
    const my_mean = pairs.reduce((s, { m }) => s + m.y, 0) / n;
    let num_a = 0, denom = 0;
    for (const { p, m } of pairs) {
      const cpx = p.x - px_mean, cpy = p.y - py_mean;
      const cmx = m.x - mx_mean, cmy = m.y - my_mean;
      num_a += cpx * cmx + cpy * cmy;
      denom += cpx * cpx + cpy * cpy;
    }
    // A well-conditioned transform has large |num_a/denom|; return the residual
    // so SMALLER = better.
    if (denom < 1e-6) return 0;
    const a = num_a / denom;
    // Residual: sum of squared distances after applying transform
    let res = 0;
    for (const { p, m } of pairs) {
      const cpx = p.x - px_mean, cpy = p.y - py_mean;
      const cmx = m.x - mx_mean, cmy = m.y - my_mean;
      const num_b_i = cpx * (m.y - my_mean) - cpy * (m.x - mx_mean);
      const b = num_b_i / denom; // per-pair approximation; good enough for ranking
      const ex = a * cpx - b * cpy - cmx;
      const ey = b * cpx + a * cpy - cmy;
      res += ex * ex + ey * ey;
    }
    return res;
  }

  const bestPerKey = new Map(); // key → { match, residual }
  for (const match of matches) {
    const key = [...match.mapping.values()].sort((a, b) => String(a).localeCompare(String(b))).join(',');
    const res = transformResidual(match.mapping);
    const existing = bestPerKey.get(key);
    if (!existing || res < existing.residual) {
      bestPerKey.set(key, { match, residual: res });
    }
  }
  const uniqueMatches = [...bestPerKey.values()].map(v => v.match);

  // posReplacementPairs is rule-derived — precompute once, reuse for all matches.
  // Only pair a removed pattern atom with an added result atom when they have the
  // same label, same canvas position, AND same degree (number of bonds).  The degree
  // check prevents a methyl C (degree 1) from pairing with a carboxyl C (degree 3)
  // in rules like KMnO4 oxidation — the methyl must be genuinely removed so chain
  // atoms downstream of it get orphan-pruned.
  const POSITION_THRESHOLD = 3;
  const posReplacementPairs = new Map();
  const usedResultIds = new Set();
  (rule.delta.removedAtomIds || []).forEach(pid => {
    const pa = rule.patternAtoms.find(a => a.id === pid);
    if (!pa) return;
    const patLabel = (pa.label || 'C').trim();
    const patDegree = rule.patternBonds.filter(b => b.from === pid || b.to === pid).length;
    const rep = (rule.delta.addedAtoms || []).find(ra => {
      if (usedResultIds.has(ra.id)) return false;
      if ((ra.label || 'C').trim() !== patLabel) return false;
      if (Math.hypot(ra.x - pa.x, ra.y - pa.y) >= POSITION_THRESHOLD) return false;
      // Degree check: a "kept-in-place" atom retains its bond count.
      // A chemically different replacement (e.g. CH3 → COOH) has a different degree.
      const resDegree = (rule.resultBonds || []).filter(b => b.from === ra.id || b.to === ra.id).length;
      return resDegree === patDegree;
    });
    if (rep) {
      posReplacementPairs.set(pid, rep.id);
      usedResultIds.add(rep.id);
    }
  });

  // Apply the delta at every unique reactive site sequentially.
  // molAtoms (original) anchors each similarity transform — ring atoms don't move.
  let currentAtoms = molAtoms;
  let currentBonds = molBonds;

  console.log(`[applyRule] matches: total=${matches.length}, unique=${uniqueMatches.length}, posReplacementPairs:`, [...posReplacementPairs.entries()]);

  for (const { mapping, rGroupCaptures } of uniqueMatches) {
    // For EAS rules (benzene + R pattern), adjust the new group's ring position
    // based on the matched substituent's directing effect.
    // This mutates delta.addedBonds in-place if a rotation is needed.
    adjustEASDirecting(mapping, patternAtoms, rule.patternBonds, delta, currentAtoms, currentBonds, rGroupCaptures);

    const xform = computePatternToMolTransform(patternAtoms, molAtoms, mapping);
    const addedAtomPositions = new Map();
    (rule.resultAtoms || []).forEach(ra => {
      if (delta.addedAtoms.some(a => a.id === ra.id)) {
        let { x, y } = xform(ra.x, ra.y);
        // If EAS directing rotated the bond, also rotate atom positions
        // so the added group appears at the new ring carbon with correct angles.
        if (delta._easRotation) {
          const { cx, cy, angle } = delta._easRotation;
          const dx = x - cx, dy = y - cy;
          x = cx + dx * Math.cos(angle) - dy * Math.sin(angle);
          y = cy + dx * Math.sin(angle) + dy * Math.cos(angle);
        }
        addedAtomPositions.set(ra.id, snapToGrid(x, y));
      }
    });
    // Clean up the rotation marker so it doesn't persist to next match
    delete delta._easRotation;

    const before = currentAtoms.length;
    const result = applyDelta(currentAtoms, currentBonds, delta, mapping, rGroupCaptures, addedAtomPositions, posReplacementPairs);
    currentAtoms = result.atoms;
    currentBonds = result.bonds;
    console.log(`[applyRule] match applied: ${before} → ${currentAtoms.length} atoms`);
  }

  console.log(`[applyRule] OUTPUT: ${currentAtoms.length} atoms, ${currentBonds.length} bonds`);
  return {
    products: [{ atoms: currentAtoms, bonds: currentBonds }],
    explanation: rule.explanation || '',
    noMatch: false,
    _debug: {
      mapping: matches[0].mapping,
      rGroupCaptures: matches[0].rGroupCaptures,
      patternAtoms: rule.patternAtoms,
    },
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

// Normalize all prime/quote variants to a plain apostrophe and strip superscript ⁺⁻
function normalizePrimes(s) {
  return s
    .replace(/[′'ʹʼ`]/g, "'")
    .replace(/[⁺]/g, '+')
    .replace(/[⁻]/g, '-');
}

// Canonical aliases so common abbreviations all resolve to one form.
const REAGENT_ALIASES = {
  pyr: 'pyridine',
  pyridine: 'pyridine',
};

function normalizeReagentForMatch(str) {
  const tokens = normalizePrimes(str)
    .toLowerCase()
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, c => SUBSCRIPT_TO_NORMAL[c])
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(t => REAGENT_ALIASES[t] || t);
  tokens.sort();
  return tokens.join('');
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

  function buildResult(rule) {
    const resolved = extractResolvedR(rule.reagent || '', reagentStr);
    return { ...rule, resolvedX: extractHalogen(reagentStr),
             resolvedR: resolved?.group || null, resolvedRVariant: resolved?.variant || null };
  }

  // 1. Exact equality (strictest — no false positives)
  const exactEqual = rules.find(r => normalizeReagentForMatch(r.reagent || '') === lower);
  if (exactEqual) return buildResult(exactEqual);

  // 2. R-wildcard (R/R'/R'' prefix — e.g. "ClMgBr" matches stored "R'MgBr")
  const rMatch = rules.find(r => rWildcardMatches(r.reagent || '', reagentStr));
  if (rMatch) return buildResult(rMatch);

  // 3. X-wildcard (halogen substitution — e.g. "HBr" matches stored "HX")
  const xMatch = rules.find(r => xWildcardMatches(r.reagent || '', reagentStr));
  if (xMatch) return buildResult(xMatch);

  // 4. Substring fallback (loosest — "KMnO4" matches "KMnO4, H2O")
  const substring = rules.find(r => {
    const rLower = normalizeReagentForMatch(r.reagent || '');
    return lower.includes(rLower) || rLower.includes(lower);
  });
  if (substring) return buildResult(substring);

  return null;
}
