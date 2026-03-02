import './App.css';
function Footer() {
            return (
                <footer className="footer">
                    <div className="row">
                        <div className="col d-flex">
                            <h4>INFORMATION</h4>
                            <a href="#about">About Us</a>
                            <a href="#contact">Contact Us</a>
                            <a href="#terms">Terms & Conditions</a>
                            </div>
                            <div className="col d-flex">
                            <h4>USEFUL LINKS</h4>
                            </div>
                            <div className="col d-flex">
                            <span><i className='bx bxl-facebook-square'></i></span>
                            <span><i className='bx bxl-instagram-alt' ></i></span>
                            <span><i className='bx bxl-tiktok-alt' ></i></span>
                        </div>
                    </div>
                </footer>
            ); 
        }

export default Footer;
