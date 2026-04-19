import { useMemo } from "react";
import { atomFill, atomTextColor, atomRadius } from "./engine/atomColors";

// Auto-detect ring bonds and compute ring centers for proper rendering
function computeRingCenters(atoms, bonds) {
  const adj = new Map();
  atoms.forEach(a => adj.set(a.id, []));
  bonds.forEach(b => {
    if (adj.has(b.from) && adj.has(b.to)) {
      adj.get(b.from).push({ to: b.to, bondId: b.id });
      adj.get(b.to).push({ to: b.from, bondId: b.id });
    }
  });

  const centers = new Map();
  bonds.forEach(bond => {
    if (bond.ringCenter) { centers.set(bond.id, bond.ringCenter); return; }

    const queue = [[bond.from, [bond.from]]];
    const visited = new Set([bond.from]);
    let ringPath = null;

    while (queue.length > 0) {
      const [current, path] = queue.shift();
      if (path.length > 7) continue;
      for (const nb of (adj.get(current) || [])) {
        if (nb.bondId === bond.id) continue;
        if (nb.to === bond.to && path.length >= 3) { ringPath = [...path, bond.to]; break; }
        if (!visited.has(nb.to) && path.length < 7) {
          visited.add(nb.to);
          queue.push([nb.to, [...path, nb.to]]);
        }
      }
      if (ringPath) break;
    }

    if (ringPath && ringPath.length <= 7) {
      const ringAtoms = ringPath.map(id => atoms.find(a => a.id === id)).filter(Boolean);
      const cx = ringAtoms.reduce((s, a) => s + a.x, 0) / ringAtoms.length;
      const cy = ringAtoms.reduce((s, a) => s + a.y, 0) / ringAtoms.length;
      centers.set(bond.id, { x: cx, y: cy });
    }
  });
  return centers;
}

export default function SetCanvas({ atoms = [], bonds = [], hideGrid = false, size = null }) {
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;

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

  /* ---------- GRID SNAP HELPER ---------- */
  const ROW_H = GRID_SPACING * Math.sin(Math.PI / 3);
  function snapToGrid(x, y) {
    const nearRow = Math.round(y / ROW_H);
    let best = null, bestDist = Infinity;
    for (let r = nearRow - 1; r <= nearRow + 1; r++) {
      const gy = r * ROW_H;
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

  /* ---------- AUTO-CENTER ATOMS ---------- */
  const centeredAtoms = useMemo(() => {
    if (atoms.length === 0) return atoms;

    const xs = atoms.map(a => a.x);
    const ys = atoms.map(a => a.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    const dx_raw = WIDTH / 2 - cx;
    const dy_raw = HEIGHT / 2 - cy;

    // Snap the centering offset to the nearest grid-preserving translation.
    // All atoms share the same triangular lattice, so snapping via one reference
    // atom keeps every atom on a grid point after the shift.
    const ref = atoms[0];
    const snapped = snapToGrid(ref.x + dx_raw, ref.y + dy_raw);
    const dx = snapped.x - ref.x;
    const dy = snapped.y - ref.y;

    return atoms.map(a => ({ ...a, x: a.x + dx, y: a.y + dy }));
  }, [atoms]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect ring centers for proper double/triple bond rendering
  const ringCenters = useMemo(() => computeRingCenters(centeredAtoms, bonds), [centeredAtoms, bonds]);

  // Compute tight viewBox when in compact mode (hideGrid + size)
  const viewBox = useMemo(() => {
    if (!hideGrid || !size || centeredAtoms.length === 0) {
      return `0 0 ${WIDTH} ${HEIGHT}`;
    }
    const xs = centeredAtoms.map(a => a.x);
    const ys = centeredAtoms.map(a => a.y);
    const pad = 30;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const maxX = Math.max(...xs) + pad;
    const maxY = Math.max(...ys) + pad;
    const w = maxX - minX;
    const h = maxY - minY;
    // Keep it square so molecules don't stretch
    // Minimum side of 200 so small molecules (2-3 atoms) don't get blown up huge
    const side = Math.max(w, h, 200);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;
  }, [centeredAtoms, hideGrid, size]);

  return (
    <div style={{ fontFamily: "Arial" }}>
      <svg
        width={size || WIDTH}
        height={size || HEIGHT}
        viewBox={viewBox}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      >
        {/* GRID */}
        {!hideGrid && gridPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
        ))}

        {/* BONDS */}
        {bonds.map(bond => {
          const a1 = centeredAtoms.find(a => a.id === bond.from);
          const a2 = centeredAtoms.find(a => a.id === bond.to);
          if (!a1 || !a2) return null;

          const bpDx = a2.y - a1.y;
          const bpDy = a2.x - a1.x;
          const len = Math.sqrt(bpDx * bpDx + bpDy * bpDy) || 1;
          let offsetX = (bpDx / len) * 4;
          let offsetY = (bpDy / len) * 4;

          // For ring bonds with order > 1, flip the offset so the inner line faces the ring center
          const rc = bond.ringCenter || ringCenters.get(bond.id);
          if (rc && (bond.order || 1) > 1) {
            const midX = (a1.x + a2.x) / 2;
            const midY = (a1.y + a2.y) / 2;
            const dot = offsetX * (rc.x - midX) + (-offsetY) * (rc.y - midY);
            if (dot < 0) { offsetX = -offsetX; offsetY = -offsetY; }
          }

          const order = bond.order || 1;
          const dx = a2.x - a1.x, dy = a2.y - a1.y;
          const isRing = !!rc;
          return [...Array(order)].map((_, i) => {
            // Ring bonds: hex edge full length, inner lines shortened
            // Ring triple: center line full, both sides shortened
            // Non-ring bonds: center all lines, same length
            const shift = isRing
              ? (order === 3 ? i - 1 : i)
              : i - (order - 1) / 2;
            const shrink = isRing
              ? (order === 3 ? (i !== 1 ? 0.08 : 0) : (i > 0 ? 0.08 : 0))
              : 0;
            return (
            <line
              key={bond.id + "-" + i}
              x1={a1.x + offsetX * shift + dx * shrink}
              y1={a1.y - offsetY * shift + dy * shrink}
              x2={a2.x + offsetX * shift - dx * shrink}
              y2={a2.y - offsetY * shift - dy * shrink}
              stroke="#000"
              strokeWidth="3"
              strokeDasharray={bond.style === "striped" ? "6,4" : "0"}
            />
            );
          });
        })}

        {/* ATOMS */}
        {centeredAtoms.map(atom => {
          const isC = !atom.label || atom.label === 'C';
          return (
            <g key={atom.id}>
              {!isC && (
                <circle
                  cx={atom.x}
                  cy={atom.y}
                  r={atomRadius(atom.label)}
                  fill={atomFill(atom.label)}
                  stroke="#222"
                  strokeWidth="1"
                />
              )}
              {!isC && (
                <text
                  x={atom.x}
                  y={atom.y + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fill={atomTextColor(atom.label)}
                >
                  {atom.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
