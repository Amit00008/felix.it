import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import socket from '../socket';

const IDEContext = createContext(null);

const API = import.meta.env.VITE_API_URL;

export function IDEProvider({ children, token, projectName }) {
  const [fileTree, setFileTree] = useState({});
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabPath, setActiveTabPath] = useState(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [terminalVisible, setTerminalVisible] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [activeSidebarPanel, setActiveSidebarPanel] = useState('explorer');
  const [contextMenu, setContextMenu] = useState(null);
  const [containerReady, setContainerReady] = useState(false);
  const [containerStatus, setContainerStatus] = useState({ status: 'connecting', message: 'Connecting...' });
  const [terminals, setTerminals] = useState([]);
  const [activeTerminalId, setActiveTerminalId] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [splitTerminalId, setSplitTerminalId] = useState(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [previewPorts, setPreviewPorts] = useState([]);
  const saveTimerRef = useRef({});
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const projectRef = useRef(projectName);
  projectRef.current = projectName;
  const terminalCountRef = useRef(0);
  const pendingSplitRef = useRef(false);

  const getHeaders = useCallback(() => ({
    'Authorization': `Bearer ${tokenRef.current}`,
    'Content-Type': 'application/json'
  }), []);

  const fetchFileTree = useCallback(async () => {
    try {
      const res = await fetch(
        `${API}/files?project=${encodeURIComponent(projectRef.current)}`,
        { headers: getHeaders() }
      );
      if (!res.ok) return;
      const data = await res.json();
      setFileTree(data.tree);
    } catch (err) {
      console.error('Failed to fetch file tree:', err);
    }
  }, [getHeaders]);

  const createTerminal = useCallback(() => {
    socket.emit('terminal:create');
    setTerminalVisible(true);
  }, []);

  const closeTerminal = useCallback((id) => {
    socket.emit('terminal:close', { id });
    setTerminals(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        setTerminalVisible(false);
        setSplitMode(false);
        setSplitTerminalId(null);
      }
      return next;
    });
    setSplitTerminalId(prev => {
      if (prev === id) {
        setSplitMode(false);
        return null;
      }
      return prev;
    });
  }, []);

  const renameTerminal = useCallback((id, newName) => {
    if (!newName.trim()) return;
    setTerminals(prev => prev.map(t =>
      t.id === id ? { ...t, name: newName.trim() } : t
    ));
  }, []);

  const toggleSplit = useCallback(() => {
    if (!splitMode) {
      pendingSplitRef.current = true;
      socket.emit('terminal:create');
      setTerminalVisible(true);
    } else {
      setSplitMode(false);
      setSplitTerminalId(null);
    }
  }, [splitMode]);

  const openPreview = useCallback((port) => {
    const p = parseInt(port, 10);
    if (!p || p < 1 || p > 65535) return;
    setPreviewPorts(prev => {
      if (prev.includes(p)) return prev;
      return [...prev, p];
    });
    const tabPath = `__preview__:${p}`;
    setOpenTabs(prev => {
      if (prev.find(t => t.path === tabPath)) return prev;
      return [...prev, { path: tabPath, name: `Port ${p}`, isPreview: true, port: p }];
    });
    setActiveTabPath(tabPath);
  }, []);

  const closePreview = useCallback((port) => {
    const p = parseInt(port, 10);
    setPreviewPorts(prev => prev.filter(pp => pp !== p));
    const tabPath = `__preview__:${p}`;
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === tabPath);
      const next = prev.filter(t => t.path !== tabPath);
      if (activeTabPath === tabPath) {
        if (next.length === 0) {
          setActiveTabPath(null);
        } else if (idx >= next.length) {
          setActiveTabPath(next[next.length - 1].path);
        } else {
          setActiveTabPath(next[idx].path);
        }
      }
      return next;
    });
  }, [activeTabPath]);

  // Normalize activeTerminalId when terminals change
  useEffect(() => {
    if (terminals.length === 0) {
      setActiveTerminalId(null);
      return;
    }
    setActiveTerminalId(prev => {
      if (prev === null || !terminals.find(t => t.id === prev)) {
        const newActive = terminals[terminals.length - 1].id;
        if (newActive === splitTerminalId) {
          setSplitMode(false);
          setSplitTerminalId(null);
        }
        return newActive;
      }
      return prev;
    });
  }, [terminals, splitTerminalId]);

  // Terminal socket event listeners
  useEffect(() => {
    const handleTerminalCreated = ({ id }) => {
      terminalCountRef.current++;
      const count = terminalCountRef.current;
      const name = count === 1 ? 'bash' : `bash (${count})`;
      setTerminals(prev => [...prev, { id, name }]);
      if (pendingSplitRef.current) {
        pendingSplitRef.current = false;
        setSplitTerminalId(id);
        setSplitMode(true);
      } else {
        setActiveTerminalId(id);
      }
    };

    socket.on('terminal:created', handleTerminalCreated);
    return () => {
      socket.off('terminal:created', handleTerminalCreated);
    };
  }, []);

  // Authenticate socket with project info on mount
  useEffect(() => {
    socket.emit('authenticate', { token, project: projectName });

    const handleReconnect = () => {
      setTerminals([]);
      setActiveTerminalId(null);
      terminalCountRef.current = 0;
      setContainerReady(false);
      socket.emit('authenticate', { token: tokenRef.current, project: projectRef.current });
    };
    socket.on('connect', handleReconnect);
    return () => socket.off('connect', handleReconnect);
  }, [token, projectName]);

  useEffect(() => {
    const handleContainerStatus = (data) => {
      setContainerStatus(data);
      if (data.status === 'ready') {
        setContainerReady(true);
      } else if (data.status === 'error') {
        setContainerReady(false);
      }
    };

    const handleAuthenticated = (data) => {
      if (data.success && data.containerReady) {
        setContainerReady(true);
        setContainerStatus({ status: 'ready', message: 'Workspace ready' });
        fetchFileTree();
        socket.emit('terminal:create');
      } else if (!data.success) {
        setContainerStatus({ status: 'error', message: data.message || 'Authentication failed' });
      }
    };

    socket.on('container:status', handleContainerStatus);
    socket.on('authenticated', handleAuthenticated);

    return () => {
      socket.off('container:status', handleContainerStatus);
      socket.off('authenticated', handleAuthenticated);
    };
  }, [fetchFileTree]);

  useEffect(() => {
    if (containerReady) fetchFileTree();
  }, [containerReady, fetchFileTree]);

  useEffect(() => {
    socket.on('file:refresh', fetchFileTree);
    return () => socket.off('file:refresh', fetchFileTree);
  }, [fetchFileTree]);

  const openFile = useCallback(async (filePath) => {
    let alreadyOpen = false;
    setOpenTabs(prev => {
      if (prev.find(t => t.path === filePath)) {
        alreadyOpen = true;
        return prev;
      }
      return prev;
    });
    if (alreadyOpen) {
      setActiveTabPath(filePath);
      return;
    }
    const fullPath = `${projectRef.current}/${filePath}`;
    const res = await fetch(`${API}/files/content?path=${encodeURIComponent(fullPath)}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    const name = filePath.split('/').pop();
    setOpenTabs(prev => {
      if (prev.find(t => t.path === filePath)) return prev;
      return [...prev, { path: filePath, name, content: data.content, savedContent: data.content }];
    });
    setActiveTabPath(filePath);
  }, [getHeaders]);

  const closeTab = useCallback((filePath) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.path === filePath);
      const next = prev.filter(t => t.path !== filePath);
      if (activeTabPath === filePath) {
        if (next.length === 0) {
          setActiveTabPath(null);
        } else if (idx >= next.length) {
          setActiveTabPath(next[next.length - 1].path);
        } else {
          setActiveTabPath(next[idx].path);
        }
      }
      return next;
    });
    if (saveTimerRef.current[filePath]) {
      clearTimeout(saveTimerRef.current[filePath]);
      delete saveTimerRef.current[filePath];
    }
  }, [activeTabPath]);

  const closeOtherTabs = useCallback((filePath) => {
    setOpenTabs(prev => prev.filter(t => t.path === filePath));
    setActiveTabPath(filePath);
  }, []);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
    setActiveTabPath(null);
  }, []);

  const updateTabContent = useCallback((filePath, newContent) => {
    setOpenTabs(prev => prev.map(t =>
      t.path === filePath ? { ...t, content: newContent } : t
    ));
    if (saveTimerRef.current[filePath]) {
      clearTimeout(saveTimerRef.current[filePath]);
    }
    saveTimerRef.current[filePath] = setTimeout(() => {
      socket.emit('file:write', { path: `${projectRef.current}/${filePath}`, content: newContent });
      setOpenTabs(prev => prev.map(t =>
        t.path === filePath ? { ...t, savedContent: newContent } : t
      ));
      delete saveTimerRef.current[filePath];
    }, 2000);
  }, []);

  const saveFile = useCallback((filePath) => {
    if (saveTimerRef.current[filePath]) {
      clearTimeout(saveTimerRef.current[filePath]);
      delete saveTimerRef.current[filePath];
    }
    setOpenTabs(prev => {
      const tab = prev.find(t => t.path === filePath);
      if (!tab || tab.content === tab.savedContent) return prev;
      socket.emit('file:write', { path: `${projectRef.current}/${filePath}`, content: tab.content });
      return prev.map(t =>
        t.path === filePath ? { ...t, savedContent: t.content } : t
      );
    });
  }, []);

  const createFile = useCallback(async (filePath) => {
    await fetch(`${API}/files/create-file`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path: `${projectRef.current}/${filePath}` })
    });
    await fetchFileTree();
    await openFile(filePath);
  }, [fetchFileTree, openFile, getHeaders]);

  const createFolder = useCallback(async (folderPath) => {
    await fetch(`${API}/files/create-folder`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ path: `${projectRef.current}/${folderPath}` })
    });
    await fetchFileTree();
  }, [fetchFileTree, getHeaders]);

  const renameItem = useCallback(async (oldPath, newPath) => {
    await fetch(`${API}/files/rename`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        oldPath: `${projectRef.current}/${oldPath}`,
        newPath: `${projectRef.current}/${newPath}`
      })
    });
    setOpenTabs(prev => prev.map(t =>
      t.path === oldPath
        ? { ...t, path: newPath, name: newPath.split('/').pop() }
        : t.path.startsWith(oldPath + '/')
          ? { ...t, path: t.path.replace(oldPath, newPath), name: t.path.replace(oldPath, newPath).split('/').pop() }
          : t
    ));
    if (activeTabPath === oldPath) setActiveTabPath(newPath);
    else if (activeTabPath && activeTabPath.startsWith(oldPath + '/')) {
      setActiveTabPath(activeTabPath.replace(oldPath, newPath));
    }
    await fetchFileTree();
  }, [activeTabPath, fetchFileTree, getHeaders]);

  const deleteItem = useCallback(async (itemPath) => {
    await fetch(`${API}/files/delete`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ path: `${projectRef.current}/${itemPath}` })
    });
    setOpenTabs(prev => prev.filter(t => t.path !== itemPath && !t.path.startsWith(itemPath + '/')));
    if (activeTabPath === itemPath || (activeTabPath && activeTabPath.startsWith(itemPath + '/'))) {
      setActiveTabPath(null);
    }
    await fetchFileTree();
  }, [activeTabPath, fetchFileTree, getHeaders]);

  const activeTab = openTabs.find(t => t.path === activeTabPath) || null;

  const value = {
    projectName,
    fileTree, fetchFileTree,
    openTabs, activeTabPath, activeTab,
    openFile, closeTab, closeOtherTabs, closeAllTabs,
    updateTabContent, saveFile,
    createFile, createFolder, renameItem, deleteItem,
    sidebarVisible, setSidebarVisible,
    terminalVisible, setTerminalVisible,
    sidebarWidth, setSidebarWidth,
    terminalHeight, setTerminalHeight,
    activeSidebarPanel, setActiveSidebarPanel,
    contextMenu, setContextMenu,
    containerReady, containerStatus,
    terminals, activeTerminalId, setActiveTerminalId,
    createTerminal, closeTerminal, renameTerminal,
    splitMode, splitTerminalId, splitRatio,
    toggleSplit, setSplitRatio, setSplitTerminalId,
    previewPorts, openPreview, closePreview,
    token
  };

  return <IDEContext.Provider value={value}>{children}</IDEContext.Provider>;
}

export function useIDE() {
  const ctx = useContext(IDEContext);
  if (!ctx) throw new Error('useIDE must be used within IDEProvider');
  return ctx;
}
