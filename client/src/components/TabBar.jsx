import { useIDE } from '../context/IDEContext';

function getFileIconClass(name) {
  const ext = name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js': return 'file-js';
    case 'jsx': return 'file-jsx';
    case 'ts': return 'file-ts';
    case 'tsx': return 'file-tsx';
    case 'css': return 'file-css';
    case 'html': return 'file-html';
    case 'json': return 'file-json';
    case 'md': return 'file-md';
    default: return 'file-default';
  }
}

function getFileIconChar(name) {
  const ext = name.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js': case 'jsx': return 'JS';
    case 'ts': case 'tsx': return 'TS';
    case 'css': return '#';
    case 'html': return '<>';
    case 'json': return '{}';
    case 'md': return 'M';
    default: return '·';
  }
}

function Tab({ tab, isDirty, isActive, onContextMenu }) {
  const { openFile, closeTab, openPreview, closePreview } = useIDE();

  const handleClick = () => {
    if (tab.isPreview) {
      openPreview(tab.port);
    } else {
      openFile(tab.path);
    }
  };

  const handleClose = (e) => {
    e.stopPropagation();
    if (tab.isPreview) {
      closePreview(tab.port);
    } else {
      closeTab(tab.path);
    }
  };

  return (
    <div
      className={`tab ${isActive ? 'active' : ''} ${isDirty ? 'dirty' : ''}`}
      onClick={handleClick}
      onContextMenu={(e) => onContextMenu(e, tab)}
    >
      {tab.isPreview ? (
        <span className="tab-icon" style={{ color: '#4fc3f7' }}>🌐</span>
      ) : (
        <span className={`tab-icon ${getFileIconClass(tab.name)}`}>
          {getFileIconChar(tab.name)}
        </span>
      )}
      <span className="tab-name">{tab.name}</span>
      <span className="tab-dirty" />
      <span className="tab-close" onClick={handleClose}>×</span>
    </div>
  );
}

function TabBar() {
  const {
    openTabs, activeTabPath, setContextMenu,
    closeTab, closeOtherTabs, closeAllTabs
  } = useIDE();

  const handleContextMenu = (e, tab) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'Close', icon: '✕', action: () => closeTab(tab.path) },
        { label: 'Close Others', icon: '⊘', action: () => closeOtherTabs(tab.path) },
        { label: 'Close All', icon: '✕', action: () => closeAllTabs() },
      ]
    });
  };

  if (openTabs.length === 0) return <div className="tab-bar" />;

  return (
    <div className="tab-bar">
      {openTabs.map(tab => {
        const isDirty = tab.isPreview ? false : tab.content !== tab.savedContent;
        const isActive = tab.path === activeTabPath;
        return (
          <Tab
            key={tab.path}
            tab={tab}
            isDirty={isDirty}
            isActive={isActive}
            onContextMenu={handleContextMenu}
          />
        );
      })}
    </div>
  );
}

export default TabBar;
