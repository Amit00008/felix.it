import React from 'react';
import './Welcome.css';
import logo from '../assets/felixlogo.png';
import Tree from './tree';

const WelcomeScreen = ({ user }) => {

    const handleLogoutClick = () => {
        
        console.log("User logged out");
        
        localStorage.clear();
      
        sessionStorage.clear();
        
        window.location.href = "/login";
    };
const handleDeveloperClick = () => {
    window.open("https://amitfr.tech", "_blank");
};

return (
    <div className="welcome-screen">
        <div className="left-section">
            <div className="logo">
                <img src={logo} alt="Logo" className="logo-img" />
            </div>
            <h1>Welcome {user} to Felix.it</h1>
            <p>Editing evolved</p>
            <p>ctrl+` : to open terminal</p>
            <p>ctrl+h : to hide sidebar</p>

            <div className="start">
                <button className="start-btn">Github Repo</button>
                <button onClick={handleDeveloperClick} className="start-btn">Developer</button>          
                <button onClick={handleLogoutClick} className="start-btn">LogOut</button>          
        

            </div>
            
            <h3>Recents</h3>
            <ul className="recent-list">
            <Tree />
            </ul>
        </div>

        <div className="right-section">
            <h3>Walkthroughs</h3>
            <div className="walkthrough">
                <button className="walkthrough-btn">Get Started with Felix.it</button>
                <button className="walkthrough-btn">Coming soon still on dev</button>
                <button className="walkthrough-btn"></button>
                <button className="walkthrough-btn"></button>
                <button className="walkthrough-btn"></button>
            </div>
        </div>
    </div>
);
}



export default WelcomeScreen;
