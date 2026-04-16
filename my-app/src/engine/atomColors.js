/**
 * atomColors.js
 *
 * CPK-inspired color scheme for atom labels drawn on molecule canvases.
 * Returns { fill, textColor } for a given atom label.
 */

// Atoms that are noticeably larger than C/N/O in real molecules
const LARGE_ATOMS = new Set(['S', 'P', 'Cl', 'Br', 'I']);
const SMALL_RADIUS = 12;
const LARGE_RADIUS = 16;

/**
 * Returns the circle radius for an atom label.
 * Large atoms (S, P, Cl, Br, I) get a bigger circle; everything else is standard.
 */
export function atomRadius(label) {
  const l = (label || 'C').trim();
  return LARGE_ATOMS.has(l) ? LARGE_RADIUS : SMALL_RADIUS;
}

const ATOM_FILL = {
  H:  '#FFFFFF',
  O:  '#E8221A',
  N:  '#3050F8',
  S:  '#DCBE00',
  F:  '#90EE90',
  Cl: '#1DC01D',
  Br: '#8B2500',
  I:  '#6600CC',
  R:  '#FFFFFF',
  "R'":  '#FFFFFF',
  "R''": '#FFFFFF',
};

/**
 * Returns the background fill color for an atom circle.
 * Falls back to the default dark-red for any atom not in the table (e.g. P, Si…).
 */
export function atomFill(label) {
  const l = (label || 'C').trim();
  return ATOM_FILL[l] ?? '#1a3a4a';
}

/**
 * Returns the text color to use on top of the atom circle.
 * White atoms (H) need dark text; all others use white.
 */
export function atomTextColor(label) {
  const l = (label || 'C').trim();
  if (l === 'H' || l === 'R' || l === "R'" || l === "R''") return '#222222';
  return '#ffffff';
}
