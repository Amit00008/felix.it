import { useNavigate } from 'react-router-dom';
import { useIDE } from '../context/IDEContext';

function ActivityBar() {
  const {
    activeSidebarPanel, setActiveSidebarPanel,
    sidebarVisible, setSidebarVisible
  } = useIDE();
  const navigate = useNavigate();

  const handleClick = (panel) => {
    if (activeSidebarPanel === panel && sidebarVisible) {
      setSidebarVisible(false);
    } else {
      setActiveSidebarPanel(panel);
      setSidebarVisible(true);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        <div
          className="activity-icon"
          onClick={() => navigate('/')}
          title="Back to Projects"
        >
          <svg viewBox="0 0 24 24">
            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
          </svg>
        </div>
        <div
          className={`activity-icon ${activeSidebarPanel === 'explorer' && sidebarVisible ? 'active' : ''}`}
          onClick={() => handleClick('explorer')}
          title="Explorer (Ctrl+B)"
        >
          <svg viewBox="0 0 24 24">
            <path d="M17.5 0h-9L7 1.5V6H2.5L1 7.5v15.07L2.5 24h12.07L16 22.57V18h4.7l1.3-1.43V4.5L17.5 0zm0 2.12l2.38 2.38H17.5V2.12zm-3 20.38h-12v-15H7v9.07L8.5 18h6v4.5zm6-6h-12v-15H16V6h4.5v10.5z"/>
          </svg>
        </div>
        <div
          className={`activity-icon ${activeSidebarPanel === 'search' && sidebarVisible ? 'active' : ''}`}
          onClick={() => handleClick('search')}
          title="Search"
        >
          <svg viewBox="0 0 24 24">
            <path d="M15.25 0a8.25 8.25 0 00-6.18 13.72L1 21.79l1.42 1.42 8.07-8.07A8.25 8.25 0 1015.25 0zm0 14.5a6.25 6.25 0 110-12.5 6.25 6.25 0 010 12.5z"/>
          </svg>
        </div>
        <div
          className={`activity-icon ${activeSidebarPanel === 'ports' && sidebarVisible ? 'active' : ''}`}
          onClick={() => handleClick('ports')}
          title="Ports & Preview"
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
          </svg>
        </div>
      </div>
      <div className="activity-bar-bottom">
        <div
          className="activity-icon"
          onClick={handleLogout}
          title="Logout"
        >
          <svg viewBox="0 0 24 24">
            <path d="M11.2 3a1 1 0 110 2H4v14h7.2a1 1 0 110 2H3a1 1 0 01-1-1V4a1 1 0 011-1h8.2zm5.3 4.3l3.7 3.7a1 1 0 010 1.4l-3.7 3.7-1.4-1.4L17.8 12H8v-2h9.8l-2.7-2.7 1.4-1.4z"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

export default ActivityBar;
