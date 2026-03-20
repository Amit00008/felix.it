import { useState, useRef, useEffect } from 'react';
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

function InlineInput({ onConfirm, onCancel, defaultValue }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (defaultValue) {
        const dotIdx = defaultValue.lastIndexOf('.');
        if (dotIdx > 0) {
          inputRef.current.setSelectionRange(0, dotIdx);
        } else {
          inputRef.current.select();
        }
      }
    }
  }, [defaultValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onConfirm(e.target.value.trim());
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      className="tree-rename-input"
      defaultValue={defaultValue || ''}
      onKeyDown={handleKeyDown}
      onBlur={(e) => onConfirm(e.target.value.trim())}
    />
  );
}

function FileTreeNode({ name, nodes, path, depth, newItemType, newItemParent, setNewItemType, setNewItemParent, onNewItemConfirm }) {
  const {
    openFile, activeTabPath, setContextMenu,
    renameItem, deleteItem, createFile, createFolder
  } = useIDE();

  const isDir = nodes !== null && typeof nodes === 'object';
  const [isOpen, setIsOpen] = useState(depth < 1);
  const [renaming, setRenaming] = useState(false);

  const isSelected = activeTabPath === path;
  const showNewInput = newItemType && newItemParent === path && isDir;

  const handleClick = (e) => {
    e.stopPropagation();
    if (renaming) return;
    if (isDir) {
      setIsOpen(!isOpen);
    } else {
      openFile(path);
    }
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const items = [];
    if (isDir) {
      items.push(
        { label: 'New File', icon: '✚', action: () => { setNewItemParent(path); setNewItemType('file'); setIsOpen(true); } },
        { label: 'New Folder', icon: '📁', action: () => { setNewItemParent(path); setNewItemType('folder'); setIsOpen(true); } },
        { separator: true }
      );
    }
    items.push(
      { label: 'Rename', icon: '✎', action: () => setRenaming(true) },
      { label: 'Delete', icon: '✕', danger: true, action: () => { if (confirm(`Delete "${name}"?`)) deleteItem(path); } }
    );
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  const handleRenameConfirm = (newName) => {
    setRenaming(false);
    if (newName && newName !== name) {
      const parentPath = path.substring(0, path.lastIndexOf('/'));
      const newPath = parentPath ? `${parentPath}/${newName}` : newName;
      renameItem(path, newPath);
    }
  };

  const handleNewItemConfirm = (itemName) => {
    if (itemName) {
      const fullPath = path ? `${path}/${itemName}` : itemName;
      if (newItemType === 'file') {
        createFile(fullPath);
      } else {
        createFolder(fullPath);
      }
    }
    setNewItemType(null);
  };

  const indent = depth * 12;

  return (
    <div className="file-explorer-node">
      <div
        className={`file-tree-node ${isSelected ? 'selected' : ''} ${renaming ? 'renaming' : ''}`}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        style={{ paddingLeft: indent }}
      >
        <div className={`tree-chevron ${isDir ? (isOpen ? 'open' : '') : 'hidden'}`}>
          ▸
        </div>
        <div className={`tree-icon ${isDir ? 'folder' : getFileIconClass(name)}`}>
          {isDir ? (isOpen ? '▾' : '▸') : getFileIconChar(name)}
        </div>
        {renaming ? (
          <InlineInput
            defaultValue={name}
            onConfirm={handleRenameConfirm}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span className="tree-name">{name}</span>
        )}
      </div>

      {isDir && isOpen && (
        <div className="file-tree-children">
          {showNewInput && (
            <div className="new-item-input-row" style={{ paddingLeft: (depth + 1) * 12 + 16 }}>
              <input
                className="new-item-input"
                autoFocus
                placeholder={newItemType === 'file' ? 'filename' : 'folder name'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNewItemConfirm(e.target.value.trim());
                  if (e.key === 'Escape') setNewItemType(null);
                }}
                onBlur={(e) => handleNewItemConfirm(e.target.value.trim())}
              />
            </div>
          )}
          {Object.keys(nodes)
            .sort((a, b) => {
              const aDir = nodes[a] !== null && typeof nodes[a] === 'object';
              const bDir = nodes[b] !== null && typeof nodes[b] === 'object';
              if (aDir && !bDir) return -1;
              if (!aDir && bDir) return 1;
              return a.localeCompare(b);
            })
            .map(childName => (
              <FileTreeNode
                key={childName}
                name={childName}
                nodes={nodes[childName]}
                path={path ? `${path}/${childName}` : childName}
                depth={depth + 1}
                newItemType={newItemType}
                newItemParent={newItemParent}
                setNewItemType={setNewItemType}
                setNewItemParent={setNewItemParent}
                onNewItemConfirm={onNewItemConfirm}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function FileExplorer({ newItemType, newItemParent, setNewItemType, setNewItemParent, onNewItemConfirm }) {
  const { fileTree, setContextMenu, createFile, createFolder } = useIDE();

  const handleRootContextMenu = (e) => {
    if (e.target.closest('.file-explorer-node')) return;
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: 'New File', icon: '✚', action: () => { setNewItemParent(''); setNewItemType('file'); } },
        { label: 'New Folder', icon: '📁', action: () => { setNewItemParent(''); setNewItemType('folder'); } }
      ]
    });
  };

  const handleNewRootItem = (name) => {
    if (name) {
      if (newItemType === 'file') createFile(name);
      else createFolder(name);
    }
    setNewItemType(null);
  };

  return (
    <div
      className="file-explorer"
      onContextMenu={handleRootContextMenu}
      style={{ minHeight: '100%' }}
    >
      {newItemType && newItemParent === '' && (
        <div className="new-item-input-row" style={{ paddingLeft: 16 }}>
          <input
            className="new-item-input"
            autoFocus
            placeholder={newItemType === 'file' ? 'filename' : 'folder name'}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNewRootItem(e.target.value.trim());
              if (e.key === 'Escape') setNewItemType(null);
            }}
            onBlur={(e) => handleNewRootItem(e.target.value.trim())}
          />
        </div>
      )}
      {Object.keys(fileTree)
        .sort((a, b) => {
          const aDir = fileTree[a] !== null && typeof fileTree[a] === 'object';
          const bDir = fileTree[b] !== null && typeof fileTree[b] === 'object';
          if (aDir && !bDir) return -1;
          if (!aDir && bDir) return 1;
          return a.localeCompare(b);
        })
        .map(name => (
          <FileTreeNode
            key={name}
            name={name}
            nodes={fileTree[name]}
            path={name}
            depth={0}
            newItemType={newItemType}
            newItemParent={newItemParent}
            setNewItemType={setNewItemType}
            setNewItemParent={setNewItemParent}
            onNewItemConfirm={onNewItemConfirm}
          />
        ))}
    </div>
  );
}

export default FileExplorer;
