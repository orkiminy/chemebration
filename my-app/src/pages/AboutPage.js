import React from 'react';
import { Link } from 'react-router-dom';
import '../App.css';

export default function AboutPage() {
  return (
    <div className="exercise-page">
      <nav className="exercise-nav">
        <Link to="/" className="exercise-nav-back">&larr; Back to Home</Link>
        <span className="exercise-nav-title">About Chemebration</span>
        <span className="exercise-nav-spacer"></span>
      </nav>

      {/* Hero banner */}
      <div style={{
        position: 'relative',
        borderRadius: '10px',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #1a3a4a, #234e5e, #2d6070, #234e5e, #1a3a4a)',
        padding: '4rem 2rem',
        textAlign: 'center',
        marginBottom: '2rem',
      }}>
        <h2 style={{ color: '#fff', fontSize: '3rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
          About Chemebration
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.5rem', margin: 0 }}>
          Making organic chemistry intuitive, structured, and accessible
        </p>
      </div>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem 3rem' }}>
        {/* Mission */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          padding: '2.5rem',
          marginBottom: '1.5rem',
          border: '1.5px solid #e2e5e9',
        }}>
          <h3 style={{ color: '#1a3a4a', fontSize: '2rem', fontWeight: 600, marginTop: 0, marginBottom: '1rem' }}>
            Our Mission
          </h3>
          <p style={{ fontSize: '1.5rem', lineHeight: '1.8', color: '#444', margin: 0 }}>
            Chemebration is an interactive platform designed to help students learn organic chemistry through practice, pattern recognition, and problem-solving. It predicts products, reactants, and reagents, while also guiding students through step-by-step synthesis.
          </p>
        </div>

        {/* Features grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '2rem', border: '1.5px solid #e2e5e9' }}>
            <h4 style={{ color: '#2d7d9a', fontSize: '1.6rem', fontWeight: 600, marginTop: 0, marginBottom: '0.5rem' }}>
              Interactive Drawing
            </h4>
            <p style={{ fontSize: '1.3rem', lineHeight: '1.7', color: '#666', margin: 0 }}>
              Practice by drawing molecules on a canvas with real-time feedback on your answers.
            </p>
          </div>
          <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '2rem', border: '1.5px solid #e2e5e9' }}>
            <h4 style={{ color: '#2d7d9a', fontSize: '1.6rem', fontWeight: 600, marginTop: 0, marginBottom: '0.5rem' }}>
              80+ Reactions
            </h4>
            <p style={{ fontSize: '1.3rem', lineHeight: '1.7', color: '#666', margin: 0 }}>
              Covering alkenes, aromatics, alcohols, carbonyls, and more across 12 chapters.
            </p>
          </div>
          <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '2rem', border: '1.5px solid #e2e5e9' }}>
            <h4 style={{ color: '#2d7d9a', fontSize: '1.6rem', fontWeight: 600, marginTop: 0, marginBottom: '0.5rem' }}>
              Multiple Modes
            </h4>
            <p style={{ fontSize: '1.3rem', lineHeight: '1.7', color: '#666', margin: 0 }}>
              Predict products, identify reactants, name reagents, or plan full synthesis pathways.
            </p>
          </div>
          <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '2rem', border: '1.5px solid #e2e5e9' }}>
            <h4 style={{ color: '#2d7d9a', fontSize: '1.6rem', fontWeight: 600, marginTop: 0, marginBottom: '0.5rem' }}>
              Progress Tracking
            </h4>
            <p style={{ fontSize: '1.3rem', lineHeight: '1.7', color: '#666', margin: 0 }}>
              Track your attempts, accuracy, and improvement over time.
            </p>
          </div>
        </div>

        {/* Contact */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '10px',
          padding: '2.5rem',
          marginTop: '1.5rem',
          border: '1.5px solid #e2e5e9',
          textAlign: 'center',
        }}>
          <h3 style={{ color: '#1a3a4a', fontSize: '2rem', fontWeight: 600, marginTop: 0, marginBottom: '0.5rem' }}>
            Get in Touch
          </h3>
          <p style={{ fontSize: '1.4rem', color: '#666', margin: 0 }}>
            Questions or feedback? Reach us at{' '}
            <a href="mailto:Chemebration@gmail.com" style={{ color: '#2d7d9a', textDecoration: 'none' }}>
              Chemebration@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
