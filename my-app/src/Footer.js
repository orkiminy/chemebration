import './App.css';
import { Link } from 'react-router-dom';
function Footer() {
            return (
                <footer className="footer">
                    <div className="row">
                        <div className="col d-flex">
                            <h4>INFORMATION</h4>
                            <Link to="/about">About Us</Link>
                            </div>
                            <div className="col d-flex">
                            </div>
                            <div className="col d-flex">
<span><a href="https://instagram.com/chemebration" target="_blank" rel="noreferrer"><i className='bx bxl-instagram-alt' style={{ fontSize: '2.2rem' }}></i></a></span>
                            <span><i className='bx bxl-tiktok-alt' style={{ fontSize: '2.2rem' }}></i></span>
                            <span><a href="mailto:Chemebration@gmail.com"><i className='bx bx-envelope' style={{ fontSize: '2.2rem' }}></i></a></span>
                        </div>
                    </div>
                </footer>
            ); 
        }

export default Footer;
