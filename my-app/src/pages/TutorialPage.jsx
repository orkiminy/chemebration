import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const STEPS = [
  {
    title: "Welcome to Chemebration!",
    description:
      "This quick tour will show you how to use the drawing tools so you can solve organic chemistry reactions. You can skip at any time.",
    illustration: <WelcomeIllustration />,
  },
  {
    title: "Picking Atom Types",
    description:
      "Use the atom toolbar to choose which atom to place. Click a button or press the matching keyboard shortcut (C, H, O, N, F, Br, Cl…). The selected atom is highlighted.",
    illustration: <AtomToolbarIllustration />,
  },
  {
    title: "Drawing Atoms on the Canvas",
    description:
      "Click anywhere on the grid to place an atom. Atoms snap to a triangular lattice so bonds line up neatly. Click an existing atom to select it, or drag it to move.",
    illustration: <CanvasIllustration />,
  },
  {
    title: "Bond Styles",
    description:
      "Choose a bond style before you draw: Single (solid line), Double, Wedge (coming forward), or Dash (going back). Click between two atoms to create a bond.",
    illustration: <BondStyleIllustration />,
  },
  {
    title: "Pencil & Eraser",
    description:
      "Switch between the Pencil tool (draw/edit) and the Eraser tool (delete atoms or bonds). You can also press Delete or Backspace to remove a selected atom.",
    illustration: <ToolIllustration />,
  },
  {
    title: "Undo & Redo",
    description:
      "Made a mistake? Press Ctrl+Z to undo or Ctrl+Y to redo. You can undo as many steps as you need.",
    illustration: <UndoIllustration />,
  },
  {
    title: "Ready to React!",
    description:
      "Each question shows you a starting material and reagents. Draw the product on the canvas, then hit Submit to check your answer. Good luck!",
    illustration: <SubmitIllustration />,
  },
];

export default function TutorialPage() {
  const [step, setStep] = useState(0);
  const { markTutorialSeen } = useAuth();
  const navigate = useNavigate();

  const finish = async () => {
    await markTutorialSeen();
    navigate('/');
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div style={styles.backdrop}>
      {/* Skip button — always top-right */}
      <button style={styles.skipBtn} onClick={finish}>
        Skip Tutorial ×
      </button>

      <div style={styles.card}>
        {/* Progress dots */}
        <div style={styles.dots}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{ ...styles.dot, background: i === step ? '#1a3a4a' : '#ddd' }}
            />
          ))}
        </div>

        {/* Step counter */}
        <p style={styles.counter}>Step {step + 1} of {STEPS.length}</p>

        {/* Illustration */}
        <div style={styles.illustration}>{current.illustration}</div>

        {/* Text */}
        <h2 style={styles.title}>{current.title}</h2>
        <p style={styles.description}>{current.description}</p>

        {/* Navigation */}
        <div style={styles.nav}>
          <button
            style={{ ...styles.navBtn, visibility: step === 0 ? 'hidden' : 'visible' }}
            onClick={() => setStep(s => s - 1)}
          >
            ← Back
          </button>

          <button
            style={{ ...styles.navBtn, ...styles.primaryBtn }}
            onClick={isLast ? finish : () => setStep(s => s + 1)}
          >
            {isLast ? 'Start Drawing!' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Illustration Components ─────────────────────────────────────── */

function WelcomeIllustration() {
  return (
    <svg viewBox="0 0 200 120" width="200" height="120">
      <circle cx="100" cy="55" r="38" fill="#e8eef1" stroke="#1a3a4a" strokeWidth="2.5" />
      <text x="100" y="62" textAnchor="middle" fontSize="28" fill="#1a3a4a" fontWeight="bold">⚗️</text>
      <text x="100" y="108" textAnchor="middle" fontSize="13" fill="#1a3a4a" fontWeight="bold">CHEMEBRATION</text>
    </svg>
  );
}

function AtomToolbarIllustration() {
  const atoms = ['C', 'H', 'O', 'N', 'Br'];
  return (
    <svg viewBox="0 0 220 60" width="220" height="60">
      {atoms.map((a, i) => (
        <g key={a}>
          <rect
            x={4 + i * 43} y="8" width="38" height="38" rx="6"
            fill={i === 0 ? '#1a3a4a' : '#e8eef1'}
            stroke="#1a3a4a" strokeWidth="1.5"
          />
          <text
            x={23 + i * 43} y="33"
            textAnchor="middle" fontSize="14"
            fill={i === 0 ? 'white' : '#1a3a4a'}
            fontWeight="bold"
          >{a}</text>
        </g>
      ))}
      {/* Selected indicator */}
      <text x="23" y="56" textAnchor="middle" fontSize="9" fill="#1a3a4a">selected</text>
    </svg>
  );
}

function CanvasIllustration() {
  return (
    <svg viewBox="0 0 200 120" width="200" height="120">
      {/* Grid dots */}
      {[40,80,120,160].map(x =>
        [30,70,110].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill="#ccc" />
        ))
      )}
      {/* A simple molecule: C-C=C */}
      <line x1="40" y1="70" x2="80" y2="70" stroke="#1a3a4a" strokeWidth="2.5" />
      <line x1="80" y1="68" x2="120" y2="68" stroke="#1a3a4a" strokeWidth="2.5" />
      <line x1="80" y1="72" x2="120" y2="72" stroke="#1a3a4a" strokeWidth="2.5" />
      <circle cx="40" cy="70" r="12" fill="#e8eef1" stroke="#1a3a4a" strokeWidth="2" />
      <circle cx="80" cy="70" r="12" fill="#e8eef1" stroke="#1a3a4a" strokeWidth="2" />
      <circle cx="120" cy="70" r="12" fill="#1a3a4a" />
      <text x="40" y="75" textAnchor="middle" fontSize="11" fill="#1a3a4a" fontWeight="bold">C</text>
      <text x="80" y="75" textAnchor="middle" fontSize="11" fill="#1a3a4a" fontWeight="bold">C</text>
      <text x="120" y="75" textAnchor="middle" fontSize="11" fill="white" fontWeight="bold">C</text>
      {/* Click cursor */}
      <text x="132" y="50" fontSize="18">👆</text>
    </svg>
  );
}

function BondStyleIllustration() {
  return (
    <svg viewBox="0 0 240 100" width="240" height="100">
      {/* Single */}
      <line x1="10" y1="30" x2="50" y2="30" stroke="#1a3a4a" strokeWidth="2.5" />
      <text x="30" y="50" textAnchor="middle" fontSize="10" fill="#1a3a4a">Single</text>
      {/* Double */}
      <line x1="70" y1="28" x2="110" y2="28" stroke="#1a3a4a" strokeWidth="2.5" />
      <line x1="70" y1="34" x2="110" y2="34" stroke="#1a3a4a" strokeWidth="2.5" />
      <text x="90" y="50" textAnchor="middle" fontSize="10" fill="#1a3a4a">Double</text>
      {/* Wedge */}
      <polygon points="130,34 155,26 155,34" fill="#1a3a4a" />
      <text x="145" y="50" textAnchor="middle" fontSize="10" fill="#1a3a4a">Wedge</text>
      {/* Dash */}
      <line x1="170" y1="30" x2="210" y2="30" stroke="#1a3a4a" strokeWidth="2.5" strokeDasharray="4,4" />
      <text x="190" y="50" textAnchor="middle" fontSize="10" fill="#1a3a4a">Dash</text>
    </svg>
  );
}

function ToolIllustration() {
  return (
    <svg viewBox="0 0 160 80" width="160" height="80">
      {/* Pencil button */}
      <rect x="10" y="20" width="60" height="38" rx="8" fill="#1a3a4a" stroke="#1a3a4a" strokeWidth="1.5" />
      <text x="40" y="45" textAnchor="middle" fontSize="22" fill="white">✏️</text>
      <text x="40" y="70" textAnchor="middle" fontSize="10" fill="#1a3a4a">Pencil</text>
      {/* Eraser button */}
      <rect x="90" y="20" width="60" height="38" rx="8" fill="#e8eef1" stroke="#1a3a4a" strokeWidth="1.5" />
      <text x="120" y="45" textAnchor="middle" fontSize="22" fill="white">🧹</text>
      <text x="120" y="70" textAnchor="middle" fontSize="10" fill="#1a3a4a">Eraser</text>
    </svg>
  );
}

function UndoIllustration() {
  return (
    <svg viewBox="0 0 200 80" width="200" height="80">
      {/* Undo */}
      <rect x="10" y="15" width="80" height="36" rx="8" fill="#e8eef1" stroke="#1a3a4a" strokeWidth="1.5" />
      <text x="50" y="38" textAnchor="middle" fontSize="13" fill="#1a3a4a" fontWeight="bold">↩ Undo</text>
      <text x="50" y="62" textAnchor="middle" fontSize="10" fill="#888">Ctrl + Z</text>
      {/* Redo */}
      <rect x="110" y="15" width="80" height="36" rx="8" fill="#e8eef1" stroke="#1a3a4a" strokeWidth="1.5" />
      <text x="150" y="38" textAnchor="middle" fontSize="13" fill="#1a3a4a" fontWeight="bold">Redo ↪</text>
      <text x="150" y="62" textAnchor="middle" fontSize="10" fill="#888">Ctrl + Y</text>
    </svg>
  );
}

function SubmitIllustration() {
  return (
    <svg viewBox="0 0 220 100" width="220" height="100">
      {/* Reagents label */}
      <rect x="10" y="10" width="90" height="30" rx="6" fill="#e8eef1" stroke="#1a3a4a" strokeWidth="1.5" />
      <text x="55" y="30" textAnchor="middle" fontSize="11" fill="#1a3a4a" fontWeight="bold">H₂ / Pt</text>
      {/* Arrow */}
      <text x="115" y="30" textAnchor="middle" fontSize="18" fill="#1a3a4a">→</text>
      {/* Submit button */}
      <rect x="120" y="55" width="90" height="32" rx="8" fill="#1a3a4a" />
      <text x="165" y="76" textAnchor="middle" fontSize="13" fill="white" fontWeight="bold">Submit ✓</text>
    </svg>
  );
}

/* ─── Styles ───────────────────────────────────────────────────────── */

const styles = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(26, 58, 74, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
    fontFamily: 'Arial, sans-serif',
  },
  skipBtn: {
    position: 'fixed', top: '20px', right: '24px',
    background: 'rgba(255,255,255,0.15)',
    color: 'white', border: '1px solid rgba(255,255,255,0.4)',
    borderRadius: '20px', padding: '8px 18px',
    cursor: 'pointer', fontSize: '14px',
    zIndex: 10000,
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '480px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
  },
  dots: { display: 'flex', gap: '8px' },
  dot: { width: '10px', height: '10px', borderRadius: '50%', transition: 'background 0.2s' },
  counter: { fontSize: '12px', color: '#999', margin: 0 },
  illustration: {
    margin: '8px 0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minHeight: '80px',
  },
  title: { fontSize: '20px', color: '#1a3a4a', margin: '4px 0 0', textAlign: 'center' },
  description: {
    fontSize: '15px', color: '#444', lineHeight: '1.6',
    textAlign: 'center', margin: '0 0 8px',
  },
  nav: { display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px' },
  navBtn: {
    padding: '10px 24px', borderRadius: '8px',
    border: '1.5px solid #1a3a4a', cursor: 'pointer',
    fontSize: '15px', background: 'white', color: '#1a3a4a',
  },
  primaryBtn: {
    background: '#1a3a4a', color: 'white', border: 'none',
  },
};
