import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIDE } from '../context/IDEContext';
import FileExplorer from './FileExplorer';
import SearchPanel from './SearchPanel';
import PortsPanel from './PortsPanel';

function Sidebar() {
  const {
    sidebarVisible, sidebarWidth, setSidebarWidth,
    activeSidebarPanel, createFile, createFolder, projectName
  } = useIDE();
  const navigate = useNavigate();

  const [dragging, setDragging] = useState(false);
  const [newItemType, setNewItemType] = useState(null);
  const [newItemParent, setNewItemParent] = useState('');
  const dragRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e) => {
      const delta = e.clientX - startX;
      const newWidth = Math.max(160, Math.min(600, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth, setSidebarWidth]);

  const handleNewFile = () => {
    setNewItemType('file');
    setNewItemParent('');
  };

  const handleNewFolder = () => {
    setNewItemType('folder');
    setNewItemParent('');
  };

  const handleNewItemConfirm = async (name) => {
    if (!name) {
      setNewItemType(null);
      return;
    }
    const fullPath = newItemParent ? `${newItemParent}/${name}` : name;
    if (newItemType === 'file') {
      await createFile(fullPath);
    } else {
      await createFolder(fullPath);
    }
    setNewItemType(null);
  };

  if (!sidebarVisible) return null;

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        {activeSidebarPanel === 'explorer' ? (
          <div className="sidebar-project-label">
            <button
              className="sidebar-back-btn"
              onClick={() => navigate('/')}
              title="Back to projects"
            >
              ←
            </button>
            <h2>{projectName}</h2>
          </div>
        ) : activeSidebarPanel === 'search' ? (
          <h2>Search</h2>
        ) : (
          <h2>Ports & Preview</h2>
        )}
        {activeSidebarPanel === 'explorer' && (
          <div className="sidebar-actions">
            <button className="sidebar-action-btn" onClick={handleNewFile} title="New File">
              ✚
            </button>
            <button className="sidebar-action-btn" onClick={handleNewFolder} title="New Folder">
              📁
            </button>
          </div>
        )}
      </div>
      <div className="sidebar-content">
        {activeSidebarPanel === 'explorer' && (
          <FileExplorer
            newItemType={newItemType}
            newItemParent={newItemParent}
            setNewItemType={setNewItemType}
            setNewItemParent={setNewItemParent}
            onNewItemConfirm={handleNewItemConfirm}
          />
        )}
        {activeSidebarPanel === 'search' && (
          <SearchPanel />
        )}
        {activeSidebarPanel === 'ports' && (
          <PortsPanel />
        )}
      </div>
      <div
        ref={dragRef}
        className={`sidebar-resize-handle ${dragging ? 'dragging' : ''}`}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

export default Sidebar;
