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
import { applyRule } from "./reactionRules";
import { checkIsomorphism } from "../chemistryUtils";

const AROMATIC_ORDER = 1.5;
const MIN_COVERAGE = 0.5; // Result must cover at least 50% of target atoms

/* ─── HELPERS ─────────────────────────────────────────────────────────────── */

function removeOrphans(atoms, bonds) {
  const connected = new Set();
  bonds.forEach(b => { connected.add(b.from); connected.add(b.to); });
  return atoms.filter(a => connected.has(a.id));
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
  const disconnections = [];

  for (const rule of rules) {
    if (!rule.resultAtoms?.length || !rule.patternAtoms?.length) continue;
    if (!rule.delta) continue;

    // Prepare result pattern
    let resultAtoms = removeOrphans(rule.resultAtoms, rule.resultBonds);
    let resultBonds = [...rule.resultBonds];
    resultBonds = normalizeBenzene(resultAtoms, resultBonds);

    // Coverage filter: result must cover significant portion of target
    const coverage = resultAtoms.length / targetAtoms.length;
    if (coverage < MIN_COVERAGE) {
      console.log(`  [retro] SKIP "${rule.name}" — coverage ${(coverage * 100).toFixed(0)}% < ${MIN_COVERAGE * 100}%`);
      continue;
    }

    // Check for aromatic mismatch: skip if result has cyclohexane but target has benzene (or vice versa)
    const resultHasBenzene = hasAromaticRing(resultAtoms, rule.resultBonds);
    const resultHasCyclohexane = hasSaturatedRing(resultAtoms, rule.resultBonds);
    const targetHasBenzene = hasAromaticRing(targetAtoms, targetBonds);
    const targetHasCyclohexane = hasSaturatedRing(targetAtoms, targetBonds);

    if (resultHasCyclohexane && !resultHasBenzene && targetHasBenzene && !targetHasCyclohexane) {
      console.log(`  [retro] SKIP "${rule.name}" — result has cyclohexane but target has benzene`);
      continue;
    }
    if (resultHasBenzene && !resultHasCyclohexane && targetHasCyclohexane && !targetHasBenzene) {
      console.log(`  [retro] SKIP "${rule.name}" — result has benzene but target has cyclohexane`);
      continue;
    }

    // Normalize target for matching
    const normTargetBonds = normalizeBenzene(targetAtoms, targetBonds);

    // Find matches
    const matches = findMatches(resultAtoms, resultBonds, targetAtoms, normTargetBonds);
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
    const removedPatternIds = new Set(delta.removedAtomIds || []);
    const patternAtomMap = new Map(rule.patternAtoms.map(a => [a.id, a]));
    const idRemap = new Map();

    for (const removedId of removedPatternIds) {
      const patAtom = patternAtomMap.get(removedId);
      if (!patAtom) continue;
      const newId = Date.now() + Math.floor(Math.random() * 100000);
      const matchedTargetIds = [...mapping.values()];
      const refAtom = newAtoms.find(a => matchedTargetIds.includes(a.id)) || newAtoms[0];
      const offsetX = patAtom.x - (rule.resultAtoms[0]?.x || 0);
      const offsetY = patAtom.y - (rule.resultAtoms[0]?.y || 0);
      newAtoms.push({
        id: newId,
        x: (refAtom?.x || 200) + offsetX,
        y: (refAtom?.y || 200) + offsetY,
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

    // Clean up orphans
    newAtoms = removeOrphans(newAtoms, newBonds);

    if (newAtoms.length === 0) {
      console.log(`  [retro] "${rule.name}" — precursor empty, skipping`);
      continue;
    }

    // --- Forward verification ---
    // Apply rule FORWARD to the precursor and check it matches the target
    let verified = false;
    try {
      const forwardResult = applyRule(newAtoms, newBonds, rule);
      if (forwardResult && !forwardResult.noMatch && forwardResult.products?.length > 0) {
        const product = forwardResult.products[0];
        verified = checkIsomorphism(product.atoms, product.bonds, targetAtoms, targetBonds);
        console.log(`  [retro] "${rule.name}" — forward verification: ${verified ? "PASS ✓" : "FAIL ✗"}`);
      } else {
        console.log(`  [retro] "${rule.name}" — forward rule didn't match precursor`);
      }
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
