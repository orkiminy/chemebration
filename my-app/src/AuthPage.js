import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useAuth } from './contexts/AuthContext';

export default function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  // Redirect if already logged in
  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const u = userCredential.user;
        // Set display name so Header can show it
        await updateProfile(u, { displayName: name });
        // Create the student profile in Firestore
        await setDoc(doc(db, "students", u.uid), {
          fullName: name,
          email: email,
          questionCount: 0,
          correctCount: 0,
          lastActive: new Date(),
          hasSeenTutorial: false,
        });
      }
      navigate('/');
    } catch (error) {
      alert(error.message);
    }
  };

  const containerStyle = {
    backgroundColor: "#f8f9fa",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "'Inter', sans-serif"
  };

  const headerStyle = {
    backgroundColor: "#1a3a4a",
    color: "white",
    width: "100%",
    textAlign: "center",
    padding: "20px 0",
    fontSize: "24px",
    fontWeight: "bold",
    letterSpacing: "2px"
  };

  const formStyle = {
    backgroundColor: "white",
    padding: "40px",
    borderRadius: "15px",
    boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
    marginTop: "50px",
    width: "350px",
    display: "flex",
    flexDirection: "column",
    gap: "15px"
  };

  const buttonStyle = {
    backgroundColor: "#1a3a4a",
    color: "white",
    border: "none",
    padding: "12px",
    borderRadius: "5px",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold"
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>CHEMEBRATION</div>

      {/* Hero tagline */}
      <div style={{ textAlign: "center", padding: "3rem 1rem 1rem" }}>
        <h2 style={{ fontSize: "2.8rem", fontWeight: 700, color: "#1a3a4a", margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>
          Celebrate Organic Chemistry
        </h2>
        <p style={{ fontSize: "1.2rem", color: "#6b7280", margin: 0 }}>
          Practice reactions, build intuition, and learn by drawing
        </p>
      </div>

      {isForgotPassword ? (
        <div style={formStyle}>
          <h2 style={{ color: "#1a3a4a", textAlign: "center", margin: 0 }}>
            Reset Password
          </h2>
          <p style={{ textAlign: "center", color: "#6b7280", fontSize: "14px", margin: 0 }}>
            Enter your email and we'll send you a reset link
          </p>

          <input
            type="email" placeholder="Email Address" required
            value={email}
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e5e9", fontSize: "14px" }}
            onChange={(e) => { setEmail(e.target.value); setResetMessage(''); }}
          />

          {resetMessage && (
            <p style={{
              textAlign: "center",
              fontSize: "13px",
              margin: 0,
              color: resetMessage.startsWith("Error") ? "#c62828" : "#2e7d32",
            }}>
              {resetMessage}
            </p>
          )}

          <button
            type="button"
            style={buttonStyle}
            onClick={async () => {
              if (!email.trim()) { setResetMessage("Please enter your email address."); return; }
              try {
                await sendPasswordResetEmail(auth, email.trim());
                setResetMessage("Reset link sent! Check your email inbox.");
              } catch (error) {
                setResetMessage("Error: " + error.message);
              }
            }}
          >
            Send Reset Email
          </button>

          <p
            style={{ textAlign: "center", color: "#2d7d9a", fontSize: "14px", cursor: "pointer" }}
            onClick={() => { setIsForgotPassword(false); setResetMessage(''); }}
          >
            Back to Log In
          </p>
        </div>
      ) : (
      <form style={formStyle} onSubmit={handleSubmit}>
        <h2 style={{ color: "#1a3a4a", textAlign: "center", margin: 0 }}>
          {isLogin ? "Welcome Back" : "Join the Celebration"}
        </h2>

        {!isLogin && (
          <input
            type="text" placeholder="Full Name" required
            style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e5e9", fontSize: "14px" }} onChange={(e) => setName(e.target.value)}
          />
        )}

        <input
          type="email" placeholder="Email Address" required
          style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e5e9", fontSize: "14px" }} onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password" placeholder="Password" required
          style={{ padding: "10px", borderRadius: "6px", border: "1px solid #e2e5e9", fontSize: "14px" }} onChange={(e) => setPassword(e.target.value)}
        />

        <button type="submit" style={buttonStyle}>
          {isLogin ? "Log In" : "Create Account"}
        </button>

        {isLogin && (
          <p
            style={{ textAlign: "center", color: "#6b7280", fontSize: "13px", cursor: "pointer", margin: 0 }}
            onClick={() => setIsForgotPassword(true)}
          >
            Forgot your password?
          </p>
        )}

        <p
          style={{ textAlign: "center", color: "#2d7d9a", fontSize: "14px", cursor: "pointer" }}
          onClick={() => setIsLogin(!isLogin)}
        >
          {isLogin ? "New here? Create an account" : "Already have an account? Log in"}
        </p>
      </form>
      )}

      {/* Feature cards */}
      <div className="features-section" style={{ marginTop: "3rem" }}>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="36" height="36" viewBox="0 0 36 36"><path d="M8 28L18 8L28 28" stroke="#2d7d9a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><circle cx="18" cy="8" r="3" fill="#2d7d9a"/><circle cx="8" cy="28" r="3" fill="#2d7d9a"/><circle cx="28" cy="28" r="3" fill="#2d7d9a"/></svg>
          </div>
          <h3 className="feature-title">Draw & Learn</h3>
          <p className="feature-desc">Practice by drawing molecules on an interactive canvas, not just reading about them</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="14" stroke="#2d7d9a" strokeWidth="2.5" fill="none"/><path d="M12 18L16 22L24 14" stroke="#2d7d9a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <h3 className="feature-title">Instant Feedback</h3>
          <p className="feature-desc">Know immediately if your answer is correct with structure-aware checking</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">
            <svg width="36" height="36" viewBox="0 0 36 36"><rect x="6" y="20" width="6" height="10" rx="1" fill="#2d7d9a" opacity="0.5"/><rect x="15" y="14" width="6" height="16" rx="1" fill="#2d7d9a" opacity="0.7"/><rect x="24" y="6" width="6" height="24" rx="1" fill="#2d7d9a"/></svg>
          </div>
          <h3 className="feature-title">Track Progress</h3>
          <p className="feature-desc">See your improvement over time with detailed attempt tracking</p>
        </div>
      </div>

      {/* Stats line */}
      <p className="stats-line" style={{ marginBottom: "3rem" }}>80+ reactions across 12 chapters — built for organic chemistry students</p>
    </div>
  );
}
