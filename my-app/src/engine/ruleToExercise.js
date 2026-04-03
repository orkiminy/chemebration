/**
 * Converts a Firestore rule (from RuleBuilder) into an exercise
 * compatible with ExerciseCanvas.
 *
 * RuleBuilder canvas is 400x400, ExerciseCanvas is 480x480.
 * We offset atoms by +40px in both x and y to center them.
 */

const CANVAS_OFFSET = 40;

const WILDCARD_LABELS = new Set(["R", "R'", "R''", "X"]);

function offsetAtoms(atoms) {
  return atoms.map(a => ({ ...a, x: a.x + CANVAS_OFFSET, y: a.y + CANVAS_OFFSET }));
}

function hasWildcards(atoms) {
  return atoms.some(a => WILDCARD_LABELS.has(a.label));
}

/**
 * Remove orphan atoms (atoms that have no bonds connecting to them).
 * These are stray artifacts from the Rule Builder canvas.
 */
function removeOrphanAtoms(atoms, bonds) {
  const connectedIds = new Set();
  bonds.forEach(b => { connectedIds.add(b.from); connectedIds.add(b.to); });
  const cleanedAtoms = atoms.filter(a => connectedIds.has(a.id));
  return cleanedAtoms;
}

export function ruleToExercise(rule) {
  const questionAtoms = removeOrphanAtoms(rule.patternAtoms, rule.patternBonds);
  const solutionAtoms = removeOrphanAtoms(rule.resultAtoms, rule.resultBonds);

  return {
    id: `rule-${rule.id}`,
    chapter: rule.reactionType || "",
    title: rule.name || rule.reagent,
    reagents: rule.reagent,
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
  return rules
    .filter(r => r.patternAtoms?.length > 0 && r.resultAtoms?.length > 0)
    .filter(r => r.reactionType)
    .filter(r => !hasWildcards(r.patternAtoms))
    .map(ruleToExercise);
}
