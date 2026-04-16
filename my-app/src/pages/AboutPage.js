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

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 'calc(100vh - 56px)',
        padding: '3rem 2rem',
        backgroundColor: '#f9f0f3',
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(95, 2, 31, 0.12)',
          maxWidth: '720px',
          width: '100%',
          padding: '4rem',
          borderTop: '5px solid #1a3a4a',
        }}>
          <h2 style={{
            color: '#1a3a4a',
            fontSize: '2.4rem',
            fontWeight: '700',
            marginBottom: '2rem',
          }}>
            About Us
          </h2>
          <p style={{
            fontSize: '1.7rem',
            lineHeight: '1.85',
            color: '#444',
            fontWeight: '400',
          }}>
            Chemebration is an interactive platform designed to help students learn organic chemistry through practice, pattern recognition, and problem-solving. It predicts products, reactants, and reagents, while also guiding students through step-by-step synthesis. Chemebration helps make organic chemistry more intuitive, structured, and accessible.
          </p>
        </div>
      </div>
    </div>
  );
}
