import './App.css';
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

const ADMIN_EMAILS = ['oriny1@gmail.com'];

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || target === 0) { setValue(target); return; }
    started.current = true;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "students", user.uid)).then(snap => {
      if (snap.exists()) setStats(snap.data());
    }).catch(() => {});
  }, [user]);

  const firstName = (user?.displayName || '').split(' ')[0] || 'Student';
  const questionsAnswered = stats?.questionCount || 0;
  const correctCount = stats?.correctCount || 0;
  const accuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : 0;

  const animQuestions = useCountUp(questionsAnswered);
  const animCorrect = useCountUp(correctCount);
  const animAccuracy = useCountUp(accuracy);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="header" id="header">
      <link rel="stylesheet" href="https://unpkg.com/boxicons@2.0.7/css/boxicons.min.css" />

      {/*<!-- Top Nav -->*/}

      <div className="navigation">
        <div className="nav-center container d-flex">

          <ul className="nav-list d-flex">
            <li className="nav-item">
              <Link to="/about" className="nav-link">About</Link>
            </li>
          </ul>

          <h1>CHEMEBRATION</h1>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'white', fontSize: '1.4rem', paddingRight: '1rem' }}>
              <span>{user.displayName || user.email}</span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  border: '1px solid white',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '1.3rem'
                }}
              >
                Logout
              </button>
            </div>
          ) : (
            <li className="icons d-flex">
              <div className="group-icon">
                <div className="icon">
                  <a href="https://instagram.com/chemebration" target="_blank" rel="noreferrer">
                    <i className="bx bxl-instagram"></i>
                  </a>
                </div>
                <div className="icon">
                  <i className="bx bxl-tiktok"></i>
                </div>
<div className="icon">
                  <a href="mailto:Chemebration@gmail.com">
                    <i className="bx bx-envelope"></i>
                  </a>
                </div>
              </div>
            </li>
          )}

          <div className="hamburger">
            <i className="bx bx-menu-alt-left"></i>
          </div>
        </div>
      </div>

      <div className="hero-section">
        {/* Floating hexagons */}
        <div className="floating-hexagons" aria-hidden="true">
          <div className="float-hex float-hex-1"><svg viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="currentColor" strokeWidth="3"/></svg></div>
          <div className="float-hex float-hex-2"><svg viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="currentColor" strokeWidth="3"/></svg></div>
          <div className="float-hex float-hex-3"><svg viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="currentColor" strokeWidth="3"/></svg></div>
          <div className="float-hex float-hex-4"><svg viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="currentColor" strokeWidth="3"/></svg></div>
          <div className="float-hex float-hex-5"><svg viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="currentColor" strokeWidth="3"/></svg></div>
          <div className="float-hex float-hex-6"><svg viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="currentColor" strokeWidth="3"/></svg></div>
        </div>
        <img
          src="/images/Screenshot 2024-12-26 232145.png"
          alt="Chemebration hexagon pattern"
          className="hero-image"
        />
        <div className="hero-overlay">
          <h2 className="hero-tagline">Celebrate Organic Chemistry</h2>
          <p className="hero-subtitle">Welcome back, {firstName}</p>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-number">{animQuestions}</span>
              <span className="hero-stat-label">Questions</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-number">{animCorrect}</span>
              <span className="hero-stat-label">Correct</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-number">{animAccuracy}%</span>
              <span className="hero-stat-label">Accuracy</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="nav-cards">
        <Link to="/oneStepReaction" className="nav-card">
          <svg className="nav-card-hex" width="40" height="24" viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="#2d7d9a" strokeWidth="5"/></svg>
          <div className="nav-card-text">
            <span className="nav-card-title">One-step Reaction</span>
            <span className="nav-card-desc">Predict products, reactants & reagents</span>
          </div>
        </Link>
        <Link to="/Synthesis" className="nav-card">
          <svg className="nav-card-hex" width="40" height="24" viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="#2d7d9a" strokeWidth="5"/></svg>
          <div className="nav-card-text">
            <span className="nav-card-title">Synthesis</span>
            <span className="nav-card-desc">Plan multi-step reaction pathways</span>
          </div>
        </Link>
        <Link to="/ReactionExplorer" className="nav-card">
          <svg className="nav-card-hex" width="40" height="24" viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="#2d7d9a" strokeWidth="5"/></svg>
          <div className="nav-card-text">
            <span className="nav-card-title">Explorer</span>
            <span className="nav-card-desc">See how reactions transform molecules</span>
          </div>
        </Link>
        <Link to="/ReactionLibrary" className="nav-card">
          <svg className="nav-card-hex" width="40" height="24" viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="#2d7d9a" strokeWidth="5"/></svg>
          <div className="nav-card-text">
            <span className="nav-card-title">Reaction Library</span>
            <span className="nav-card-desc">Browse all reactions by category</span>
          </div>
        </Link>
        {ADMIN_EMAILS.includes(user?.email) && (
        <Link to="/rule-builder" className="nav-card">
          <svg className="nav-card-hex" width="40" height="24" viewBox="0 0 120 104"><polygon points="35,0 85,0 120,52 85,104 35,104 0,52" fill="none" stroke="#2d7d9a" strokeWidth="5"/></svg>
          <div className="nav-card-text">
            <span className="nav-card-title">Rule Builder</span>
            <span className="nav-card-desc">Create and manage reaction rules</span>
          </div>
        </Link>
        )}
      </div>

    </header>
  );
}
export default Header;
