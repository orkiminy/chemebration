import { useMemo } from "react";

export default function SetCanvas({ atoms = [], bonds = [] }) {
  const WIDTH = 480;
  const HEIGHT = 480;
  const GRID_SPACING = 40;
  const ATOM_RADIUS = 12;

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

  /* ---------- AUTO-CENTER ATOMS ---------- */
  const centeredAtoms = useMemo(() => {
    if (atoms.length === 0) return atoms;

    const xs = atoms.map(a => a.x);
    const ys = atoms.map(a => a.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

    const dx = WIDTH / 2 - cx;
    const dy = HEIGHT / 2 - cy;

    // Translate all atoms by the same offset — preserves relative positions
    return atoms.map(a => ({ ...a, x: a.x + dx, y: a.y + dy }));
  }, [atoms]);

  return (
    <div style={{ fontFamily: "Arial" }}>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
      >
        {/* GRID */}
        {gridPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#ccc" />
        ))}

        {/* BONDS */}
        {bonds.map(bond => {
          const a1 = centeredAtoms.find(a => a.id === bond.from);
          const a2 = centeredAtoms.find(a => a.id === bond.to);
          if (!a1 || !a2) return null;

          const dx = a2.y - a1.y;
          const dy = a2.x - a1.x;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const offsetX = (dx / len) * 4;
          const offsetY = (dy / len) * 4;

          return [...Array(bond.order || 1)].map((_, i) => (
            <line
              key={bond.id + "-" + i}
              x1={a1.x + offsetX * i}
              y1={a1.y - offsetY * i}
              x2={a2.x + offsetX * i}
              y2={a2.y - offsetY * i}
              stroke="#000"
              strokeWidth="3"
              strokeDasharray={bond.style === "striped" ? "6,4" : "0"}
            />
          ));
        })}

        {/* ATOMS */}
        {centeredAtoms.map(atom => (
          <g key={atom.id}>
            <circle
              cx={atom.x}
              cy={atom.y}
              r={ATOM_RADIUS}
              fill="#5f021f"
            />
            <text
              x={atom.x}
              y={atom.y + 4}
              textAnchor="middle"
              fontSize="12"
              fill="#fff"
            >
              {atom.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
