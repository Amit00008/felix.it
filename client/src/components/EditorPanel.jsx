import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useIDE } from '../context/IDEContext';

const API = import.meta.env.VITE_API_URL;

function getLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': return 'javascript';
    case 'ts': case 'tsx': return 'typescript';
    case 'json': return 'json';
    case 'html': return 'html';
    case 'css': return 'css';
    case 'md': return 'markdown';
    case 'py': return 'python';
    case 'yaml': case 'yml': return 'yaml';
    default: return 'plaintext';
  }
}

function WelcomeTab() {
  const { createFile, setTerminalVisible, setSidebarVisible, projectName } = useIDE();

  const handleNewFile = () => {
    const name = prompt('File name:');
    if (name) createFile(name);
  };

  return (
    <div className="welcome-tab">
      <div className="welcome-content">
        <div className="welcome-logo">F</div>
        <h1 className="welcome-title">Felix<span className="dot">.</span>it</h1>
        <p className="welcome-subtitle">{projectName}</p>

        <div className="welcome-shortcuts">
          <div className="welcome-shortcut" onClick={handleNewFile}>
            <span className="welcome-shortcut-label">New File</span>
            <span className="welcome-shortcut-key">Ctrl+N</span>
          </div>
          <div className="welcome-shortcut" onClick={() => setTerminalVisible(v => !v)}>
            <span className="welcome-shortcut-label">Toggle Terminal</span>
            <span className="welcome-shortcut-key">Ctrl+`</span>
          </div>
          <div className="welcome-shortcut" onClick={() => setSidebarVisible(v => !v)}>
            <span className="welcome-shortcut-label">Toggle Sidebar</span>
            <span className="welcome-shortcut-key">Ctrl+B</span>
          </div>
        </div>

        <div className="welcome-actions">
          <button className="welcome-action-btn primary" onClick={handleNewFile}>
            Create a File
          </button>
        </div>
      </div>
    </div>
  );
}

function WebView({ port }) {
  const { token } = useIDE();
  const iframeRef = useRef(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const iframeSrc = `${API}/preview/${port}/?token=${token}`;
  const urlDisplay = `localhost:${port}`;

  const handleRefresh = () => {
    setLoading(true);
    setIframeKey(k => k + 1);
  };

  const handleOpenExternal = () => {
    window.open(iframeSrc, '_blank');
  };

  return (
    <div className="webview-container">
      <div className="webview-toolbar">
        <button className="webview-toolbar-btn" onClick={handleRefresh} title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
          </svg>
        </button>
        <div className="webview-url-bar">
          <span className="webview-url-icon">🌐</span>
          <span className="webview-url-input">{urlDisplay}</span>
        </div>
        <button className="webview-toolbar-btn" onClick={handleOpenExternal} title="Open in new tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </button>
      </div>
      <div className="webview-body">
        {loading && (
          <div className="webview-loading">
            <div className="webview-loading-spinner" />
            <p className="webview-loading-text">Loading preview…</p>
            <p className="webview-loading-port">localhost:{port}</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          key={iframeKey}
          className="webview-iframe"
          src={iframeSrc}
          title={`Preview port ${port}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setLoading(false)}
        />
      </div>
    </div>
  );
}

function EditorPanel() {
  const { activeTab, updateTabContent, activeTabPath } = useIDE();

  if (!activeTab) return <div className="editor-panel"><WelcomeTab /></div>;

  if (activeTab.isPreview) {
    return (
      <div className="editor-panel">
        <WebView port={activeTab.port} />
      </div>
    );
  }

  return (
    <div className="editor-panel">
      <div className="monaco-wrapper">
        <Editor
          key={activeTabPath}
          language={getLanguage(activeTab.path)}
          theme="vs-dark"
          value={activeTab.content}
          onChange={(value) => updateTabContent(activeTab.path, value || '')}
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
            minimap: { enabled: true, scale: 1 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 8 },
            formatOnPaste: true,
            formatOnType: true,
            autoClosingBrackets: 'always',
            autoClosingQuotes: 'always',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
            renderLineHighlight: 'all',
            lineNumbers: 'on',
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}

export default EditorPanel;
