import './App.css';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
        <img
          src="/images/Screenshot 2024-12-26 232145.png"
          alt="Chemebration hexagon pattern"
          className="hero-image"
        />
        <div className="hero-overlay">
          <h2 className="hero-tagline">Celebrate Organic Chemistry</h2>
          <p className="hero-subtitle">Practice reactions, build intuition, and learn by drawing</p>
        </div>
      </div>

      <div className="subcategories">
        <ul>
          <li className='subcategories-org'>
            <svg className="hexagon" width="50" height="30" viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg">
              <polygon points="35,0 85,0 120,52 85,104 35,104 0,52"
                      fill="transparent"
                      stroke="#1a3a4a"
                      strokeWidth="4"/>
            </svg>
            <Link to="/oneStepReaction">
              One-step reaction
            </Link>
          </li>
          <li className='subcategories-org'>
            <svg className="hexagon" width="50" height="30" viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg">
              <polygon points="35,0 85,0 120,52 85,104 35,104 0,52"
                      fill="transparent"
                      stroke="#1a3a4a"
                      strokeWidth="4"/>
            </svg>
            <Link to="/Synthesis">
              Synthesis
            </Link>
          </li>
          <li className='subcategories-org'>
            <svg className="hexagon" width="50" height="30" viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg">
              <polygon points="35,0 85,0 120,52 85,104 35,104 0,52"
                      fill="transparent"
                      stroke="#1a3a4a"
                      strokeWidth="4"/>
            </svg>
            <Link to="/ReactionExplorer">
              Explorer
            </Link>
          </li>
          <li className='subcategories-org'>
            <svg className="hexagon" width="50" height="30" viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg">
              <polygon points="35,0 85,0 120,52 85,104 35,104 0,52"
                      fill="transparent"
                      stroke="#1a3a4a"
                      strokeWidth="4"/>
            </svg>
            <Link to="/ReactionLibrary">
              Reaction Library
            </Link>
          </li>
          <li className='subcategories-org'>
            <svg className="hexagon" width="50" height="30" viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg">
              <polygon points="35,0 85,0 120,52 85,104 35,104 0,52"
                      fill="transparent"
                      stroke="#1a3a4a"
                      strokeWidth="4"/>
            </svg>
            <Link to="/rule-builder">
              Rule Builder
            </Link>
          </li>
        </ul>
      </div>

    </header>
  );
}
export default Header;
