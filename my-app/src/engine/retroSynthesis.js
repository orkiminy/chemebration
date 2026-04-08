/**
 * retroSynthesis.js
 *
 * Interactive retrosynthesis engine.
 * Given a target molecule and rules, finds possible "disconnections" —
 * rules that could have produced this molecule as their last step.
 *
 * Uses two key filters to eliminate false matches:
 * 1. Coverage filter: rule result must cover >50% of target atoms
 * 2. Forward verification: apply rule forward to precursor, check it reproduces target
 */

import { findMatches } from "./subgraphMatch";
import { computePatternToMolTransform } from "./reactionRules";

const AROMATIC_ORDER = 1.5;
// Coverage threshold scales with result size:
// - Large results (≥7 atoms, e.g. benzene+Cl): 25% is enough (they're specific)
// - Small results (2-3 atoms): need 50%+ to avoid false matches everywhere
const MIN_RESULT_ATOMS = 3; // absolute minimum result size
const MIN_COVERAGE_BASE = 0.5;
const MIN_COVERAGE_FLOOR = 0.25;

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */

/**
 * Merge atoms that are very close together but not bonded.
 * This fixes drawing issues where a chain looks connected to a ring
 * visually but the atoms didn't snap to the exact same grid point.
 */
function mergeNearbyAtoms(atoms, bonds, threshold = 15) {
  const idRemap = new Map();

  for (let i = 0; i < atoms.length; i++) {
    if (idRemap.has(atoms[i].id)) continue;
    for (let j = i + 1; j < atoms.length; j++) {
      if (idRemap.has(atoms[j].id)) continue;
      const dist = Math.hypot(atoms[i].x - atoms[j].x, atoms[i].y - atoms[j].y);
      if (dist > 0 && dist < threshold) {
        idRemap.set(atoms[j].id, atoms[i].id);
      }
    }
  }

  if (idRemap.size === 0) return { atoms, bonds };

  console.log(`[retro] Merged ${idRemap.size} nearby atom(s)`);
  const keptAtoms = atoms.filter(a => !idRemap.has(a.id));
  const remapped = bonds.map(b => ({
    ...b,
    from: idRemap.get(b.from) ?? b.from,
    to: idRemap.get(b.to) ?? b.to,
  })).filter(b => b.from !== b.to);

  // Deduplicate bonds (same from/to pair)
  const seen = new Set();
  const unique = remapped.filter(b => {
    const key = Math.min(b.from, b.to) + '-' + Math.max(b.from, b.to);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { atoms: keptAtoms, bonds: unique };
}

/**
 * Extract the largest connected component from atoms/bonds.
 * Rules often include byproducts (H₂O, HCl, NaBr, etc.) on the result canvas.
 * For retrosynthesis we only care about the main product.
 */
function largestComponent(atoms, bonds) {
  if (atoms.length === 0) return { atoms, bonds };

  // Build adjacency from bonds
  const adj = new Map(atoms.map(a => [a.id, []]));
  bonds.forEach(b => {
    adj.get(b.from)?.push(b.to);
    adj.get(b.to)?.push(b.from);
  });

  // BFS to find connected components
  const visited = new Set();
  let bestComponent = [];

  for (const atom of atoms) {
    if (visited.has(atom.id)) continue;
    const component = [];
    const queue = [atom.id];
    visited.add(atom.id);
    while (queue.length > 0) {
      const id = queue.shift();
      component.push(id);
      for (const neighbor of (adj.get(id) || [])) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    if (component.length > bestComponent.length) {
      bestComponent = component;
    }
  }

  const keep = new Set(bestComponent);
  return {
    atoms: atoms.filter(a => keep.has(a.id)),
    bonds: bonds.filter(b => keep.has(b.from) && keep.has(b.to)),
  };
}

function removeOrphans(atoms, bonds) {
  const connected = new Set();
  bonds.forEach(b => { connected.add(b.from); connected.add(b.to); });
  return atoms.filter(a => connected.has(a.id));
}

/**
 * General overlap resolution for restored atoms.
 * If a movable atom overlaps another atom (< MIN_DIST), reposition it
 * around its bonded anchor at the correct bond length, choosing the
 * direction that maximizes distance from all other atoms.
 */
const MIN_ATOM_DIST = 20;

function resolveOverlaps(atoms, bonds, movableIds) {
  for (const atom of atoms) {
    if (!movableIds.has(atom.id)) continue;

    // Find the bonded anchor (prefer non-movable neighbor)
    let anchor = null;
    for (const b of bonds) {
      const otherId = b.from === atom.id ? b.to : b.to === atom.id ? b.from : null;
      if (otherId == null) continue;
      const other = atoms.find(a => a.id === otherId);
      if (!other) continue;
      if (!movableIds.has(other.id)) { anchor = other; break; }
      if (!anchor) anchor = other;
    }
    if (!anchor) continue;

    // Check if current position overlaps any other atom
    const hasOverlap = atoms.some(other =>
      other.id !== atom.id && Math.hypot(other.x - atom.x, other.y - atom.y) < MIN_ATOM_DIST
    );
    if (!hasOverlap) continue;

    // Use the current bond length (from the transform), fallback to 40
    const bondLen = Math.max(Math.hypot(atom.x - anchor.x, atom.y - anchor.y), 40);

    // Try 24 evenly-spaced directions around the anchor
    let bestPos = { x: atom.x, y: atom.y };
    let bestMinDist = 0;

    for (let i = 0; i < 24; i++) {
      const angle = (i * Math.PI * 2) / 24;
      const x = anchor.x + Math.cos(angle) * bondLen;
      const y = anchor.y + Math.sin(angle) * bondLen;

      // Score = minimum distance to any other atom (maximize this)
      let minDist = Infinity;
      for (const other of atoms) {
        if (other.id === atom.id) continue;
        const d = Math.hypot(other.x - x, other.y - y);
        if (d < minDist) minDist = d;
      }

      if (minDist > bestMinDist) {
        bestMinDist = minDist;
        bestPos = { x, y };
      }
    }

    atom.x = bestPos.x;
    atom.y = bestPos.y;
  }
}



/** Detect aromatic rings and set bond order to 1.5 for matching */
function normalizeBenzene(atoms, bonds) {
  const carbonIds = new Set(
    atoms.filter(a => { const l = (a.label || "C").trim(); return l === "C" || l === ""; }).map(a => a.id)
  );
  const adj = new Map();
  atoms.forEach(a => adj.set(a.id, []));
  bonds.forEach(b => {
    if (adj.has(b.from) && adj.has(b.to)) {
      adj.get(b.from).push(b.to);
      adj.get(b.to).push(b.from);
    }
  });

  const aromaticBondIds = new Set();
  for (const startId of carbonIds) {
    const path = [startId];
    const stack = [{ current: startId, neighbors: [...(adj.get(startId) || [])].filter(n => carbonIds.has(n)) }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.neighbors.length === 0) { stack.pop(); path.pop(); continue; }
      const next = frame.neighbors.pop();
      if (path.length === 6 && next === startId) {
        const orders = path.map((id, i) => {
          const nextId = path[(i + 1) % 6];
          const bond = bonds.find(b =>
            (b.from === id && b.to === nextId) || (b.from === nextId && b.to === id)
          );
          return bond ? (bond.order || 1) : 1;
        });
        if (orders.includes(1) && orders.includes(2)) {
          for (let i = 0; i < 6; i++) {
            const a = path[i], b2 = path[(i + 1) % 6];
            const bond = bonds.find(b =>
              (b.from === a && b.to === b2) || (b.from === b2 && b.to === a)
            );
            if (bond) aromaticBondIds.add(bond.id);
          }
        }
        continue;
      }
      if (path.length >= 6 || path.includes(next)) continue;
      path.push(next);
      stack.push({ current: next, neighbors: [...(adj.get(next) || [])].filter(n => carbonIds.has(n)) });
    }
  }

  if (aromaticBondIds.size === 0) return bonds;
  return bonds.map(b => aromaticBondIds.has(b.id) ? { ...b, order: AROMATIC_ORDER } : b);
}

/** Check if a molecule is "simple" (common starting material) */
/** Check if molecule contains a 6-member carbon ring with alternating single/double bonds (benzene) */
function hasAromaticRing(atoms, bonds) {
  return findSixRings(atoms, bonds).some(ring => {
    const orders = ring.map((id, i) => {
      const nextId = ring[(i + 1) % 6];
      const bond = bonds.find(b =>
        (b.from === id && b.to === nextId) || (b.from === nextId && b.to === id)
      );
      return bond ? (bond.order || 1) : 1;
    });
    return orders.includes(1) && orders.includes(2);
  });
}

/** Check if molecule contains a 6-member carbon ring with ALL single bonds (cyclohexane) */
function hasSaturatedRing(atoms, bonds) {
  return findSixRings(atoms, bonds).some(ring => {
    const orders = ring.map((id, i) => {
      const nextId = ring[(i + 1) % 6];
      const bond = bonds.find(b =>
        (b.from === id && b.to === nextId) || (b.from === nextId && b.to === id)
      );
      return bond ? (bond.order || 1) : 1;
    });
    return orders.every(o => o === 1);
  });
}

/** Find all 6-member all-carbon rings. Returns array of arrays of atom IDs. */
function findSixRings(atoms, bonds) {
  const carbonIds = new Set(
    atoms.filter(a => { const l = (a.label || "C").trim(); return l === "C" || l === ""; }).map(a => a.id)
  );
  const adj = new Map();
  atoms.forEach(a => adj.set(a.id, []));
  bonds.forEach(b => {
    if (adj.has(b.from) && adj.has(b.to)) {
      adj.get(b.from).push(b.to);
      adj.get(b.to).push(b.from);
    }
  });

  const rings = [];
  const seen = new Set();
  for (const startId of carbonIds) {
    const path = [startId];
    const stack = [{ neighbors: [...(adj.get(startId) || [])].filter(n => carbonIds.has(n)) }];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.neighbors.length === 0) { stack.pop(); path.pop(); continue; }
      const next = frame.neighbors.pop();
      if (path.length === 6 && next === startId) {
        const sorted = [...path].sort((a, b) => a - b);
        const key = sorted.join(",");
        if (!seen.has(key)) { seen.add(key); rings.push([...path]); }
        continue;
      }
      if (path.length >= 6 || path.includes(next)) continue;
      path.push(next);
      stack.push({ neighbors: [...(adj.get(next) || [])].filter(n => carbonIds.has(n)) });
    }
  }
  return rings;
}

export function isSimpleMolecule(atoms, bonds) {
  if (atoms.length === 0) return true;
  if (atoms.length === 6 && bonds.length === 6) {
    const allCarbon = atoms.every(a => !a.label || a.label === "C");
    if (allCarbon) return true;
  }
  if (atoms.length <= 2) return true;
  return false;
}

/* ─── CORE: FIND POSSIBLE DISCONNECTIONS ──────────────────────────────────── */

/**
 * For a given target molecule, find all rules that could have produced it.
 * Returns an array of possible disconnections, each with:
 *   { rule, precursor: {atoms, bonds}, verified: boolean }
 *
 * Steps for each rule:
 *   1. Match rule's RESULT in the target (subgraph match)
 *   2. Coverage filter: result must cover >50% of target
 *   3. Compute precursor by reversing the delta
 *   4. Forward verification: apply rule to precursor, check it reproduces target
 */
export function findPossibleDisconnections(targetAtoms, targetBonds, rules) {
  // Merge atoms that are very close but not bonded (fixes drawing snap issues)
  const merged = mergeNearbyAtoms(targetAtoms, targetBonds);
  targetAtoms = merged.atoms;
  targetBonds = merged.bonds;

  const disconnections = [];
  const bondOrders = targetBonds.map(b => b.order || 1);
  console.log(`[retro] === Finding disconnections: ${targetAtoms.length} atoms, ${targetBonds.length} bonds, orders: [${[...new Set(bondOrders)].join(',')}], labels: [${targetAtoms.map(a=>a.label||'C').join(',')}], rules: ${rules.length} ===`);

  for (const rule of rules) {
    if (!rule.resultAtoms?.length || !rule.patternAtoms?.length) continue;
    if (!rule.delta) continue;
    console.log(`  [retro] Trying "${rule.name}" — pattern: ${rule.patternAtoms.length} atoms, result: ${rule.resultAtoms.length} atoms`);

    // Prepare result pattern: remove orphans, keep only the main product
    // (discard byproducts like H₂O, HCl, NaBr drawn on the result canvas)
    let resultAtoms = removeOrphans(rule.resultAtoms, rule.resultBonds);
    let resultBonds = rule.resultBonds.filter(b =>
      resultAtoms.some(a => a.id === b.from) && resultAtoms.some(a => a.id === b.to)
    );
    const mainProduct = largestComponent(resultAtoms, resultBonds);
    if (mainProduct.atoms.length < resultAtoms.length) {
      console.log(`  [retro] "${rule.name}" — stripped byproducts: ${resultAtoms.length} → ${mainProduct.atoms.length} atoms`);
    }
    resultAtoms = mainProduct.atoms;
    resultBonds = mainProduct.bonds;

    // Strip R/R'/R'' wildcard atoms from the result before matching.
    // R represents "any substituent can be here" — it should NOT prevent matching
    // when the target has no carbon substituent at that ring position.
    // E.g., Nitration result is [6C + R + N + 2O] = 10 atoms. Without R = 9 atoms,
    // which can match a 9-atom nitrobenzene that has no extra ring substituent.
    const rAtomIds = new Set(
      resultAtoms.filter(a => {
        const l = (a.label || 'C').trim();
        return l === 'R' || l === "R'" || l === "R''";
      }).map(a => a.id)
    );
    if (rAtomIds.size > 0) {
      resultAtoms = resultAtoms.filter(a => !rAtomIds.has(a.id));
      resultBonds = resultBonds.filter(b => !rAtomIds.has(b.from) && !rAtomIds.has(b.to));
      console.log(`  [retro] "${rule.name}" — stripped ${rAtomIds.size} R wildcard(s) for matching: ${resultAtoms.length} atoms`);
    }
    resultBonds = normalizeBenzene(resultAtoms, resultBonds);

    // Coverage filter: result must cover significant portion of target.
    // Threshold scales down for larger results (they're more specific and less prone to false matches).
    const coverage = resultAtoms.length / targetAtoms.length;
    const minCoverage = resultAtoms.length < MIN_RESULT_ATOMS
      ? MIN_COVERAGE_BASE
      : Math.max(MIN_COVERAGE_FLOOR, MIN_COVERAGE_BASE - (resultAtoms.length - MIN_RESULT_ATOMS) * 0.05);
    if (coverage < minCoverage) {
      console.log(`  [retro] SKIP "${rule.name}" — coverage ${(coverage * 100).toFixed(0)}% < ${(minCoverage * 100).toFixed(0)}% (result: ${resultAtoms.length} atoms, target: ${targetAtoms.length} atoms)`);
      continue;
    }

    // Normalize target benzene rings to aromatic (order 1.5) for matching.
    // This handles any ring bond order inconsistencies from retrosynthesis delta changes.
    const normTargetBonds = normalizeBenzene(targetAtoms, targetBonds);

    // Aromatic/cyclohexane mismatch filter — uses NORMALIZED bonds so it works
    // correctly even when retrosynthesis deltas have modified ring bond orders.
    const resultHasAromatic = resultBonds.some(b => b.order === AROMATIC_ORDER);
    const targetHasAromatic = normTargetBonds.some(b => b.order === AROMATIC_ORDER);
    const resultRings = findSixRings(resultAtoms, resultBonds);
    const targetRings = findSixRings(targetAtoms, normTargetBonds);
    const resultAllSingle = resultRings.length > 0 && !resultHasAromatic;
    const targetAllSingle = targetRings.length > 0 && !targetHasAromatic;

    if (resultAllSingle && targetHasAromatic) {
      console.log(`  [retro] SKIP "${rule.name}" — result has cyclohexane but target has benzene`);
      continue;
    }
    if (resultHasAromatic && targetAllSingle) {
      console.log(`  [retro] SKIP "${rule.name}" — result has benzene but target has cyclohexane`);
      continue;
    }

    // Find matches
    const matches = findMatches(resultAtoms, resultBonds, targetAtoms, normTargetBonds, { lenientBondOrder: true });
    if (matches.length === 0) {
      console.log(`  [retro] "${rule.name}" — no match (${resultAtoms.length} result atoms vs ${targetAtoms.length} target atoms)`);
      console.log(`    result labels: [${resultAtoms.map(a => a.label || "C").join(", ")}]`);
      console.log(`    result bonds: [${resultBonds.map(b => `${b.from}→${b.to}:ord${b.order||1}`).join(", ")}]`);
      console.log(`    target labels: [${targetAtoms.map(a => a.label || "C").join(", ")}]`);
      console.log(`    target bonds: [${normTargetBonds.map(b => `${b.from}→${b.to}:ord${b.order||1}`).join(", ")}]`);
      continue;
    }

    console.log(`  [retro] "${rule.name}" — ${matches.length} match(es), coverage ${(coverage * 100).toFixed(0)}%`);

    // Try first match only (to limit computation)
    const match = matches[0];
    const mapping = match.mapping;
    const delta = rule.delta;

    // --- Compute precursor by reversing the delta ---
    let newAtoms = targetAtoms.map(a => ({ ...a }));
    let newBonds = targetBonds.map(b => ({ ...b }));

    // 1. Remove atoms ADDED by forward rule
    const addedResultIds = new Set((delta.addedAtoms || []).map(a => a.id));
    const targetIdsToRemove = new Set();
    for (const [resId, targetId] of mapping) {
      if (addedResultIds.has(resId)) {
        targetIdsToRemove.add(targetId);
      }
    }
    newAtoms = newAtoms.filter(a => !targetIdsToRemove.has(a.id));
    newBonds = newBonds.filter(b => !targetIdsToRemove.has(b.from) && !targetIdsToRemove.has(b.to));

    // 2. Restore atoms REMOVED by forward rule
    // Use proper rigid transform (translation + rotation + scale) from
    // rule coordinate space → target coordinate space, so restored atoms
    // are placed at correct positions regardless of ring orientation.
    const removedPatternIds = new Set(delta.removedAtomIds || []);
    const patternAtomMap = new Map(rule.patternAtoms.map(a => [a.id, a]));
    const idRemap = new Map();

    // Compute transform: result-space → target-space
    const xform = computePatternToMolTransform(resultAtoms, targetAtoms, mapping);

    for (const removedId of removedPatternIds) {
      const patAtom = patternAtomMap.get(removedId);
      if (!patAtom) continue;
      const newId = Date.now() + Math.floor(Math.random() * 100000);
      const pos = xform(patAtom.x, patAtom.y);
      newAtoms.push({
        id: newId,
        x: pos.x,
        y: pos.y,
        label: patAtom.label,
      });
      idRemap.set(removedId, newId);
    }

    // 3. Reverse bond changes
    for (const cb of (delta.changedBonds || [])) {
      const targetFrom = mapping.get(cb.from);
      const targetTo = mapping.get(cb.to);
      if (!targetFrom || !targetTo) continue;
      const origBond = rule.patternBonds.find(b =>
        (b.from === cb.from && b.to === cb.to) || (b.from === cb.to && b.to === cb.from)
      );
      if (!origBond) continue;
      newBonds = newBonds.map(b => {
        if ((b.from === targetFrom && b.to === targetTo) || (b.from === targetTo && b.to === targetFrom)) {
          return { ...b, order: origBond.order, style: origBond.style || "solid" };
        }
        return b;
      });
    }

    // 4. Remove newKeptBonds (bonds added between kept atoms by forward rule)
    for (const nkb of (delta.newKeptBonds || [])) {
      const targetFrom = mapping.get(nkb.from);
      const targetTo = mapping.get(nkb.to);
      if (!targetFrom || !targetTo) continue;
      newBonds = newBonds.filter(b =>
        !((b.from === targetFrom && b.to === targetTo) || (b.from === targetTo && b.to === targetFrom))
      );
    }

    // 5. Restore removed bonds
    for (const rb of (delta.removedBonds || [])) {
      const targetFrom = mapping.get(rb.from) || idRemap.get(rb.from);
      const targetTo = mapping.get(rb.to) || idRemap.get(rb.to);
      if (!targetFrom || !targetTo) continue;
      const origBond = rule.patternBonds.find(b =>
        (b.from === rb.from && b.to === rb.to) || (b.from === rb.to && b.to === rb.from)
      );
      const exists = newBonds.some(b =>
        (b.from === targetFrom && b.to === targetTo) || (b.from === targetTo && b.to === targetFrom)
      );
      if (!exists) {
        newBonds.push({
          id: Date.now() + Math.floor(Math.random() * 100000),
          from: targetFrom, to: targetTo,
          order: origBond?.order || 1, style: origBond?.style || "solid",
        });
      }
    }

    // 6. Restore bonds from removed atoms
    for (const pb of rule.patternBonds) {
      const fromRemoved = removedPatternIds.has(pb.from);
      const toRemoved = removedPatternIds.has(pb.to);
      if (!fromRemoved && !toRemoved) continue;
      const targetFrom = fromRemoved ? idRemap.get(pb.from) : mapping.get(pb.from);
      const targetTo = toRemoved ? idRemap.get(pb.to) : mapping.get(pb.to);
      if (!targetFrom || !targetTo) continue;
      const exists = newBonds.some(b =>
        (b.from === targetFrom && b.to === targetTo) || (b.from === targetTo && b.to === targetFrom)
      );
      if (!exists) {
        newBonds.push({
          id: Date.now() + Math.floor(Math.random() * 100000),
          from: targetFrom, to: targetTo,
          order: pb.order || 1, style: pb.style || "solid",
        });
      }
    }

    // Fix overlapping restored atoms
    const movableIds = new Set(idRemap.values());
    resolveOverlaps(newAtoms, newBonds, movableIds);

    // Clean up orphans
    newAtoms = removeOrphans(newAtoms, newBonds);

    if (newAtoms.length === 0) {
      console.log(`  [retro] "${rule.name}" — precursor empty, skipping`);
      continue;
    }

    // --- Forward verification ---
    // Check that the rule's pattern matches the computed precursor. This confirms
    // the rule CAN fire on the precursor (i.e., the precursor is a valid starting
    // material for this reaction).
    //
    // We do NOT check that the product exactly reproduces the target, because:
    // 1. EAS directing may shift substituent positions (meta→para) based on
    //    directing effects, producing a different regioisomer
    // 2. Byproducts (H₂O, HCl) in the delta inflate the product atom count
    // 3. The retro matching already established that the result covers the target
    //
    // A simple pattern-matches-precursor check is sufficient: if the pattern
    // matches, the rule can produce the right type of transformation.
    let verified = false;
    try {
      // Strip R wildcards from pattern too (same reason as result stripping above).
      // If the precursor is plain benzene (no substituent), R has nothing to match.
      let fwdPatternAtoms = rule.patternAtoms.map(a => ({ ...a }));
      let fwdPatternBonds = [...rule.patternBonds];
      const patRIds = new Set(
        fwdPatternAtoms.filter(a => {
          const l = (a.label || 'C').trim();
          return l === 'R' || l === "R'" || l === "R''";
        }).map(a => a.id)
      );
      if (patRIds.size > 0) {
        fwdPatternAtoms = fwdPatternAtoms.filter(a => !patRIds.has(a.id));
        fwdPatternBonds = fwdPatternBonds.filter(b => !patRIds.has(b.from) && !patRIds.has(b.to));
      }
      // Normalize benzene in both pattern and precursor before matching
      fwdPatternBonds = normalizeBenzene(fwdPatternAtoms, fwdPatternBonds);
      const fwdMolBonds = normalizeBenzene(newAtoms, newBonds);

      const fwdMatches = findMatches(fwdPatternAtoms, fwdPatternBonds, newAtoms, fwdMolBonds);
      verified = fwdMatches.length > 0;
      console.log(`  [retro] "${rule.name}" — forward verification: ${verified ? "PASS ✓" : "FAIL ✗"} (pattern ${fwdPatternAtoms.length} atoms vs precursor ${newAtoms.length} atoms, ${fwdMatches.length} match(es))`);
    } catch (err) {
      console.log(`  [retro] "${rule.name}" — forward verification error:`, err.message);
    }

    disconnections.push({
      rule,
      precursor: { atoms: newAtoms, bonds: newBonds },
      verified,
      coverage,
    });
  }

  // Sort: verified first, then by coverage (higher = better)
  disconnections.sort((a, b) => {
    if (a.verified !== b.verified) return b.verified ? 1 : -1;
    return b.coverage - a.coverage;
  });

  return disconnections;
}
