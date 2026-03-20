import { useState } from 'react';
import { useIDE } from '../context/IDEContext';

function PortsPanel() {
  const { previewPorts, openPreview, closePreview } = useIDE();
  const [portInput, setPortInput] = useState('');
  const [error, setError] = useState('');

  const handleOpen = () => {
    const port = parseInt(portInput, 10);
    if (!port || port < 1 || port > 65535) {
      setError('Enter a valid port (1–65535)');
      return;
    }
    if (previewPorts.includes(port)) {
      openPreview(port);
      setPortInput('');
      setError('');
      return;
    }
    setError('');
    openPreview(port);
    setPortInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleOpen();
    if (e.key === 'Escape') {
      setPortInput('');
      setError('');
    }
  };

  return (
    <div className="ports-panel">
      <div className="ports-input-section">
        <div className="ports-input-row">
          <input
            type="number"
            className="ports-input"
            placeholder="Enter port (e.g. 3000)"
            value={portInput}
            onChange={(e) => { setPortInput(e.target.value); setError(''); }}
            onKeyDown={handleKeyDown}
            min={1}
            max={65535}
          />
          <button className="ports-open-btn" onClick={handleOpen} title="Open Preview">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l4-4 4 4M12 16V8" />
            </svg>
          </button>
        </div>
        {error && <div className="ports-error">{error}</div>}
      </div>

      {previewPorts.length > 0 && (
        <div className="ports-list">
          <div className="ports-list-header">Open Ports</div>
          {previewPorts.map(port => (
            <div key={port} className="ports-item">
              <span className="ports-item-icon">🌐</span>
              <span className="ports-item-label">localhost:{port}</span>
              <button
                className="ports-item-btn"
                onClick={() => openPreview(port)}
                title="Focus preview"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </button>
              <button
                className="ports-item-btn danger"
                onClick={() => closePreview(port)}
                title="Close preview"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {previewPorts.length === 0 && (
        <div className="ports-hint">
          <p>Enter a port number to preview a web server running in your container.</p>
          <p className="ports-hint-example">
            Start a server in the terminal:<br />
            <code>npx serve -p 3000</code><br />
            <code>python3 -m http.server 8080</code>
          </p>
        </div>
      )}
    </div>
  );
}

export default PortsPanel;
