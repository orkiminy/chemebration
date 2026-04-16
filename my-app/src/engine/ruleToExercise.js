/**
 * Converts a Firestore rule (from RuleBuilder) into an exercise
 * compatible with ExerciseCanvas.
 *
 * RuleBuilder canvas is 400x400, ExerciseCanvas is 480x480.
 * We offset atoms by +40px in both x and y to center them.
 *
 * Also re-orients old flat-top hexagonal rings to pointy-top to match
 * the current ring templates.
 */

const CANVAS_OFFSET = 40;
const GRID_SPACING = 40;
const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);

// New pointy-top offsets (relative to centroid = 0,0)
const POINTY_TOP_OFFSETS = [
  { dx: 0,   dy: -2 * ROW_H },
  { dx: -60, dy: -ROW_H },
  { dx: -60, dy: ROW_H },
  { dx: 0,   dy: 2 * ROW_H },
  { dx: 60,  dy: ROW_H },
  { dx: 60,  dy: -ROW_H },
];

function offsetAtoms(atoms) {
  return atoms.map(a => ({ ...a, x: a.x + CANVAS_OFFSET, y: a.y + CANVAS_OFFSET }));
}

/**
 * Remove orphan atoms (atoms that have no bonds connecting to them).
 * These are stray artifacts from the Rule Builder canvas.
 */
function removeOrphanAtoms(atoms, bonds) {
  const connectedIds = new Set();
  bonds.forEach(b => { connectedIds.add(b.from); connectedIds.add(b.to); });
  return atoms.filter(a => connectedIds.has(a.id));
}

/**
 * Detect 6-member rings in the molecule graph.
 * Returns arrays of atom IDs forming each ring.
 */
function findSixMemberRings(atoms, bonds) {
  // Build adjacency list
  const adj = new Map();
  atoms.forEach(a => adj.set(a.id, []));
  bonds.forEach(b => {
    if (adj.has(b.from) && adj.has(b.to)) {
      adj.get(b.from).push(b.to);
      adj.get(b.to).push(b.from);
    }
  });

  const rings = [];
  const atomIds = atoms.map(a => a.id);

  // DFS to find cycles of length 6
  for (const startId of atomIds) {
    const path = [startId];
    const stack = [{ current: startId, neighbors: [...(adj.get(startId) || [])], depth: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.neighbors.length === 0) {
        stack.pop();
        path.pop();
        continue;
      }
      const next = frame.neighbors.pop();
      if (path.length === 6 && next === startId) {
        // Found a 6-ring; store sorted to deduplicate
        const sorted = [...path].sort((a, b) => a - b);
        const key = sorted.join(",");
        if (!rings.some(r => r.key === key)) {
          rings.push({ key, ids: [...path] });
        }
        continue;
      }
      if (path.length >= 6) continue;
      if (path.includes(next)) continue;

      path.push(next);
      stack.push({ current: next, neighbors: [...(adj.get(next) || [])], depth: frame.depth + 1 });
    }
  }

  return rings.map(r => r.ids);
}

/**
 * Check if a ring is flat-top (old orientation) by looking at its geometry.
 * Flat-top rings have 2+ atoms sharing the same minimum Y (top edge is flat).
 * Pointy-top rings have a single atom at the top.
 */
function isFlatTop(ringAtoms) {
  const ys = ringAtoms.map(a => a.y);
  const minY = Math.min(...ys);
  const topAtoms = ys.filter(y => Math.abs(y - minY) < 5);
  return topAtoms.length >= 2;
}

/**
 * Re-orient flat-top rings to pointy-top.
 * Moves ring atoms to new positions and adjusts substituent positions accordingly.
 */
function reorientRings(atoms, bonds) {
  const rings = findSixMemberRings(atoms, bonds);
  if (rings.length === 0) return atoms;

  let newAtoms = atoms.map(a => ({ ...a }));
  const atomMap = new Map(newAtoms.map(a => [a.id, a]));

  // Build adjacency for finding substituents
  const adj = new Map();
  atoms.forEach(a => adj.set(a.id, []));
  bonds.forEach(b => {
    if (adj.has(b.from) && adj.has(b.to)) {
      adj.get(b.from).push(b.to);
      adj.get(b.to).push(b.from);
    }
  });

  for (const ringIds of rings) {
    const ringAtoms = ringIds.map(id => atomMap.get(id)).filter(Boolean);
    if (ringAtoms.length !== 6) continue;
    if (!isFlatTop(ringAtoms)) continue;

    // Compute centroid of old ring
    const cx = ringAtoms.reduce((s, a) => s + a.x, 0) / 6;
    const cy = ringAtoms.reduce((s, a) => s + a.y, 0) / 6;

    // Sort ring atoms by angle from centroid to assign consistent positions
    const withAngle = ringAtoms.map(a => ({
      atom: a,
      angle: Math.atan2(a.y - cy, a.x - cx),
    }));
    withAngle.sort((a, b) => a.angle - b.angle);

    // Find the atom closest to the top (most negative y relative to centroid)
    // to anchor the rotation
    let topIdx = 0;
    let minY = Infinity;
    withAngle.forEach((w, i) => {
      if (w.atom.y < minY) { minY = w.atom.y; topIdx = i; }
    });

    // Map old ring atoms to new pointy-top positions
    for (let i = 0; i < 6; i++) {
      const srcIdx = (topIdx + i) % 6;
      const oldAtom = withAngle[srcIdx].atom;
      const oldX = oldAtom.x;
      const oldY = oldAtom.y;
      const newX = cx + POINTY_TOP_OFFSETS[i].dx;
      const newY = cy + POINTY_TOP_OFFSETS[i].dy;

      // Move substituents (non-ring neighbors) by the same delta
      const deltaX = newX - oldX;
      const deltaY = newY - oldY;
      const neighbors = adj.get(oldAtom.id) || [];
      for (const nId of neighbors) {
        if (!ringIds.includes(nId)) {
          const sub = atomMap.get(nId);
          if (sub) {
            sub.x += deltaX;
            sub.y += deltaY;
          }
        }
      }

      oldAtom.x = newX;
      oldAtom.y = newY;
    }
  }

  return newAtoms;
}

export function ruleToExercise(rule) {
  let questionAtoms = removeOrphanAtoms(rule.patternAtoms, rule.patternBonds);
  let solutionAtoms = removeOrphanAtoms(rule.resultAtoms, rule.resultBonds);

  // Re-orient any old flat-top rings to pointy-top
  questionAtoms = reorientRings(questionAtoms, rule.patternBonds);
  solutionAtoms = reorientRings(solutionAtoms, rule.resultBonds);

  return {
    id: `rule-${rule.id}`,
    chapter: rule.reactionType || "",
    title: rule.name || rule.reagent,
    reagents: rule.reagent,
    reversible: !!rule.reversible,
    backwardReagent: rule.backwardReagent || "",
    description: rule.explanation || "",
    question: {
      atoms: offsetAtoms(questionAtoms),
      bonds: rule.patternBonds,
    },
    solutions: [{
      atoms: offsetAtoms(solutionAtoms),
      bonds: rule.resultBonds,
    }],
    sourceType: "rule",
  };
}

/**
 * Convert an array of Firestore rules into exercises.
 * Filters out rules that have no pattern/result, no chapter, or wildcard atoms.
 */
export function rulesToExercises(rules) {
  const withAtoms = rules.filter(r => r.patternAtoms?.length > 0 && r.resultAtoms?.length > 0);
  const withChapter = withAtoms.filter(r => r.reactionType);
  console.log(`[rulesToExercises] ${rules.length} total rules → ${withAtoms.length} with atoms → ${withChapter.length} with chapter`);
  withChapter.forEach(r => console.log(`  - "${r.name}" (chapter: ${r.reactionType})`));
  return withChapter
    .map(ruleToExercise);
}
