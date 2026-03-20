import { useIDE } from '../context/IDEContext';

function getLanguageLabel(filePath) {
  if (!filePath) return '';
  const ext = filePath.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js': return 'JavaScript';
    case 'jsx': return 'JavaScript React';
    case 'ts': return 'TypeScript';
    case 'tsx': return 'TypeScript React';
    case 'json': return 'JSON';
    case 'html': return 'HTML';
    case 'css': return 'CSS';
    case 'md': return 'Markdown';
    case 'py': return 'Python';
    default: return 'Plain Text';
  }
}

function StatusBar() {
  const { activeTab, openTabs, terminalVisible, setTerminalVisible, containerStatus, projectName } = useIDE();

  const dirtyCount = openTabs.filter(t => t.content !== t.savedContent).length;

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        <span className="status-item docker-status">
          {containerStatus.status === 'ready' ? '🐳' : '⏳'} {containerStatus.status === 'ready' ? 'Container' : containerStatus.message}
        </span>
        <span className="status-item">
          📁 {projectName}
        </span>
        {activeTab && (
          <span className="status-item">
            📄 {activeTab.path}
          </span>
        )}
        {dirtyCount > 0 && (
          <span className="status-item">
            ● {dirtyCount} unsaved
          </span>
        )}
      </div>
      <div className="status-bar-right">
        {activeTab && (
          <>
            <span className="status-item">UTF-8</span>
            <span className="status-item">{getLanguageLabel(activeTab.path)}</span>
          </>
        )}
        <span
          className="status-item clickable"
          onClick={() => setTerminalVisible(v => !v)}
        >
          {terminalVisible ? '⬇ Terminal' : '⬆ Terminal'}
        </span>
      </div>
    </div>
  );
}

export default StatusBar;
