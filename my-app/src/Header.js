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
              <a href="#about" className="nav-link">About</a>
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
                  <i className="bx bxl-instagram"></i>
                </div>
                <div className="icon">
                  <i className="bx bxl-tiktok"></i>
                </div>
                <div className="icon">
                  <i className="bx bxl-facebook"></i>
                </div>
              </div>
            </li>
          )}

          <div className="hamburger">
            <i className="bx bx-menu-alt-left"></i>
          </div>
        </div>
      </div>

      <div className="screenshot-container">
        <img
          src="/images/Screenshot 2026-01-13 at 3.35.26 PM.png"
          alt="Screenshot of the app"
        />
      </div>

      <div className="subcategories">
        <ul>
          <li className='subcategories-org'>
            <svg className="hexagon" width="50" height="30" viewBox="0 0 120 104" xmlns="http://www.w3.org/2000/svg">
              <polygon points="35,0 85,0 120,52 85,104 35,104 0,52"
                      fill="transparent"
                      stroke="#5f021f"
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
                      stroke="#5f021f"
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
                      stroke="#5f021f"
                      strokeWidth="4"/>
            </svg>
            <Link to="/Mechanism">
              Mechanism
            </Link>
          </li>
        </ul>
      </div>

    </header>
  );
}
export default Header;
