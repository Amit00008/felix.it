import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { IDEProvider, useIDE } from '../context/IDEContext';
import ActivityBar from './ActivityBar';
import Sidebar from './Sidebar';
import TabBar from './TabBar';
import EditorPanel from './EditorPanel';
import TerminalPanel from './TerminalPanel';
import StatusBar from './StatusBar';
import ContextMenu from './ContextMenu';
import './IDE.css';

function ContainerLoading() {
  const { containerStatus } = useIDE();
  const isError = containerStatus.status === 'error';

  return (
    <div className="container-loading">
      <div className="container-loading-content">
        <div className={`container-loading-icon ${isError ? 'error' : ''}`}>
          {isError ? '!' : '🐳'}
        </div>
        <h2 className="container-loading-title">
          {isError ? 'Workspace Error' : 'Starting Workspace'}
        </h2>
        <p className="container-loading-message">{containerStatus.message}</p>
        {!isError && (
          <div className="container-loading-bar">
            <div className="container-loading-bar-fill" />
          </div>
        )}
        {isError && (
          <button
            className="container-loading-retry"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

function IDELayout() {
  const {
    sidebarVisible, setSidebarVisible,
    sidebarWidth,
    terminalVisible, setTerminalVisible,
    activeTabPath, saveFile, contextMenu,
    containerReady,
    terminals, createTerminal
  } = useIDE();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === '`') {
        e.preventDefault();
        createTerminal();
        return;
      }
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        if (!terminalVisible) {
          setTerminalVisible(true);
          if (terminals.length === 0) {
            createTerminal();
          }
        } else {
          setTerminalVisible(false);
        }
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setSidebarVisible(v => !v);
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (activeTabPath) saveFile(activeTabPath);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabPath, saveFile, setSidebarVisible, setTerminalVisible, terminals, createTerminal, terminalVisible]);

  if (!containerReady) {
    return <ContainerLoading />;
  }

  return (
    <div
      className={`ide ${sidebarVisible ? '' : 'sidebar-hidden'}`}
      style={sidebarVisible ? { '--current-sidebar-width': sidebarWidth + 'px' } : undefined}
    >
      <ActivityBar />
      <Sidebar />
      <div className="main-content">
        <TabBar />
        <EditorPanel />
        <TerminalPanel />
      </div>
      <StatusBar />
      {contextMenu && <ContextMenu />}
    </div>
  );
}

export default function IDE({ token }) {
  const { projectName } = useParams();

  return (
    <IDEProvider token={token} projectName={decodeURIComponent(projectName)}>
      <IDELayout />
    </IDEProvider>
  );
}
