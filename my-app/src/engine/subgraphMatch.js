/**
 * subgraphMatch.js
 *
 * Finds all occurrences of a small pattern graph inside a larger molecule graph.
 * Used by the rule engine to locate WHERE a reaction rule applies in a drawn molecule.
 *
 * Algorithm: backtracking search (VF2-style).
 * Practical for organic molecules (< 50 atoms) — runs in milliseconds.
 */

const HALOGENS = ['Br', 'Cl', 'F', 'I'];

/**
 * Check whether a pattern atom label is compatible with a molecule atom label.
 *   R  → matches anything (wildcard substituent)
 *   X  → matches any halogen (Br, Cl, F, I)
 *   C  → matches carbon (labeled 'C' or unlabeled)
 *  anything else → exact match
 */
function labelsMatch(patLabel, molLabel) {
  const pl = (patLabel || 'C').trim();
  const ml = (molLabel || 'C').trim();
  if (pl === 'R') return true;
  if (pl === 'X') return HALOGENS.includes(ml);
  if (pl === 'C') return ml === 'C' || ml === '';
  return pl === ml;
}

/** Build adjacency map: atomId → [{neighbor, order, style}] */
function buildAdj(atoms, bonds) {
  const adj = new Map(atoms.map(a => [a.id, []]));
  bonds.forEach(b => {
    adj.get(b.from)?.push({ neighbor: b.to,   order: b.order, style: b.style });
    adj.get(b.to)  ?.push({ neighbor: b.from,  order: b.order, style: b.style });
  });
  return adj;
}

/**
 * Find all subgraph matches of (patternAtoms, patternBonds) inside (molAtoms, molBonds).
 * Returns an array of Maps: patternAtomId → molAtomId.
 * Returns [] if no match found.
 */
export function findMatches(patternAtoms, patternBonds, molAtoms, molBonds) {
  if (patternAtoms.length === 0) return [new Map()];

  const patAdj = buildAdj(patternAtoms, patternBonds);
  const molAdj = buildAdj(molAtoms, molBonds);

  const matches = [];
  const p2m = new Map();    // patternId → molId
  const usedMol = new Set(); // mol atom IDs already mapped

  // Process most-connected pattern atoms first (prunes the search tree faster)
  const sorted = [...patternAtoms].sort(
    (a, b) => (patAdj.get(b.id)?.length || 0) - (patAdj.get(a.id)?.length || 0)
  );

  function backtrack(idx) {
    if (idx === sorted.length) {
      matches.push(new Map(p2m));
      return;
    }

    const patAtom = sorted[idx];

    for (const molAtom of molAtoms) {
      if (usedMol.has(molAtom.id)) continue;
      if (!labelsMatch(patAtom.label, molAtom.label)) continue;

      // All already-mapped neighbours of patAtom must have consistent edges in mol
      let ok = true;
      for (const edge of (patAdj.get(patAtom.id) || [])) {
        const mappedNeighbor = p2m.get(edge.neighbor);
        if (mappedNeighbor === undefined) continue; // not yet mapped — skip for now

        const norm = o => (!o || o === 0) ? 1 : o;
        const molEdge = (molAdj.get(molAtom.id) || []).find(
          e => e.neighbor === mappedNeighbor && norm(e.order) === norm(edge.order)
        );
        if (!molEdge) { ok = false; break; }
      }
      if (!ok) continue;

      p2m.set(patAtom.id, molAtom.id);
      usedMol.add(molAtom.id);
      backtrack(idx + 1);
      p2m.delete(patAtom.id);
      usedMol.delete(molAtom.id);
    }
  }

  backtrack(0);
  return matches;
}
