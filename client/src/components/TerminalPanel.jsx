import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import '@xterm/xterm/css/xterm.css';
import socket from '../socket';
import { useIDE } from '../context/IDEContext';

const TERM_OPTIONS = {
  fontFamily: "'JetBrains Mono', Consolas, 'Courier New', monospace",
  fontSize: 13,
  lineHeight: 1.4,
  theme: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#aeafad',
    cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
  },
  cursorBlink: true,
  allowProposedApi: true,
};

function TerminalPanel() {
  const {
    terminals, activeTerminalId, setActiveTerminalId,
    createTerminal, closeTerminal, renameTerminal,
    terminalVisible, setTerminalVisible,
    terminalHeight, setTerminalHeight,
    splitMode, splitTerminalId, splitRatio,
    toggleSplit, setSplitRatio, setSplitTerminalId
  } = useIDE();

  const instancesRef = useRef(new Map());
  const bufferRef = useRef(new Map());
  const exitedRef = useRef(new Set());
  const restartingRef = useRef(new Set());
  const bodiesRef = useRef(null);
  const activeIdRef = useRef(activeTerminalId);
  activeIdRef.current = activeTerminalId;
  const splitIdRef = useRef(splitTerminalId);
  splitIdRef.current = splitTerminalId;
  const [dragging, setDragging] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  useEffect(() => {
    const handleTerminalData = ({ id, data }) => {
      const instance = instancesRef.current.get(id);
      if (instance) {
        instance.term.write(data);
      } else {
        if (!bufferRef.current.has(id)) bufferRef.current.set(id, []);
        bufferRef.current.get(id).push(data);
      }
    };

    const handleTerminalExited = ({ id }) => {
      exitedRef.current.add(id);
      restartingRef.current.delete(id);
      const instance = instancesRef.current.get(id);
      if (instance) {
        instance.term.write('\r\n\x1b[90m[Process exited — press any key to restart]\x1b[0m\r\n');
      }
    };

    const handleTerminalRestarted = ({ id }) => {
      exitedRef.current.delete(id);
      restartingRef.current.delete(id);
    };

    socket.on('terminal:data', handleTerminalData);
    socket.on('terminal:exited', handleTerminalExited);
    socket.on('terminal:restarted', handleTerminalRestarted);
    return () => {
      socket.off('terminal:data', handleTerminalData);
      socket.off('terminal:exited', handleTerminalExited);
      socket.off('terminal:restarted', handleTerminalRestarted);
    };
  }, []);

  const initTerminal = useCallback((id, el) => {
    if (!el || instancesRef.current.has(id)) return;

    const term = new XTerm(TERM_OPTIONS);
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(el);
    try { fitAddon.fit(); } catch (e) { /* ignore */ }

    term.onData((data) => {
      if (exitedRef.current.has(id) || restartingRef.current.has(id)) {
        if (!restartingRef.current.has(id)) {
          restartingRef.current.add(id);
          socket.emit('terminal:restart', { id });
        }
        return;
      }
      socket.emit('terminal:write', { id, data });
    });

    instancesRef.current.set(id, { term, fitAddon });

    const buffered = bufferRef.current.get(id);
    if (buffered) {
      buffered.forEach(d => term.write(d));
      bufferRef.current.delete(id);
    }

    socket.emit('terminal:resize', { id, cols: term.cols, rows: term.rows });

    if (activeIdRef.current === id) {
      term.focus();
    }
  }, []);

  useEffect(() => {
    const activeIds = new Set(terminals.map(t => t.id));
    for (const [id, instance] of instancesRef.current) {
      if (!activeIds.has(id)) {
        instance.term.dispose();
        instancesRef.current.delete(id);
        bufferRef.current.delete(id);
        exitedRef.current.delete(id);
        restartingRef.current.delete(id);
      }
    }
  }, [terminals]);

  const fitTerminalById = useCallback((id) => {
    if (!id) return;
    const inst = instancesRef.current.get(id);
    if (!inst) return;
    try {
      inst.fitAddon.fit();
      socket.emit('terminal:resize', { id, cols: inst.term.cols, rows: inst.term.rows });
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!terminalVisible || !activeTerminalId) return;
    const timer = setTimeout(() => {
      fitTerminalById(activeTerminalId);
      if (splitMode && splitTerminalId && splitTerminalId !== activeTerminalId) {
        fitTerminalById(splitTerminalId);
      }
      const activeInst = instancesRef.current.get(activeTerminalId);
      if (activeInst) activeInst.term.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [activeTerminalId, terminalVisible, terminalHeight, splitMode, splitTerminalId, splitRatio, fitTerminalById]);

  useEffect(() => {
    const container = bodiesRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      fitTerminalById(activeIdRef.current);
      if (splitIdRef.current && splitIdRef.current !== activeIdRef.current) {
        fitTerminalById(splitIdRef.current);
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fitTerminalById]);

  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    const startY = e.clientY;
    const startHeight = terminalHeight;

    const handleMouseMove = (e) => {
      const delta = startY - e.clientY;
      setTerminalHeight(Math.max(100, Math.min(600, startHeight + delta)));
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [terminalHeight, setTerminalHeight]);

  const handleSplitDrag = useCallback((e) => {
    e.preventDefault();
    const container = bodiesRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const ratio = Math.max(0.2, Math.min(0.8, (e.clientX - rect.left) / rect.width));
      setSplitRatio(ratio);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [setSplitRatio]);

  const startRename = (id, currentName) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = () => {
    if (renamingId !== null && renameValue.trim()) {
      renameTerminal(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue('');
  };

  useEffect(() => {
    if (renamingId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleTabClick = (id) => {
    if (splitMode && id === splitTerminalId) {
      setSplitTerminalId(activeTerminalId);
    }
    setActiveTerminalId(id);
  };

  return (
    <div
      className={`terminal-panel ${!terminalVisible ? 'terminal-hidden' : ''}`}
      style={{ height: terminalHeight }}
    >
      <div
        className={`terminal-resize-handle ${dragging ? 'dragging' : ''}`}
        onMouseDown={handleResizeStart}
      />
      <div className="terminal-header">
        <div className="terminal-header-tabs">
          {terminals.map((t) => (
            <div
              key={t.id}
              className={`terminal-tab ${t.id === activeTerminalId ? 'active' : ''} ${splitMode && t.id === splitTerminalId ? 'split-tab' : ''}`}
              onClick={() => handleTabClick(t.id)}
            >
              <span className="terminal-tab-icon">›_</span>
              {renamingId === t.id ? (
                <input
                  ref={renameInputRef}
                  className="terminal-tab-rename"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') cancelRename();
                    e.stopPropagation();
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span
                  className="terminal-tab-name"
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(t.id, t.name); }}
                >
                  {t.name}
                </span>
              )}
              {splitMode && t.id === splitTerminalId && (
                <span className="terminal-tab-pane-dot split" title="Right pane" />
              )}
              <button
                className="terminal-tab-close"
                onClick={(e) => { e.stopPropagation(); closeTerminal(t.id); }}
                title="Close Terminal"
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="terminal-new-btn"
            onClick={createTerminal}
            title="New Terminal (Ctrl+Shift+`)"
          >
            +
          </button>
          <button
            className={`terminal-split-btn ${splitMode ? 'active' : ''}`}
            onClick={toggleSplit}
            title={splitMode ? 'Unsplit Terminal' : 'Split Terminal'}
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              {splitMode ? (
                <path d="M2 2h12v12H2V2zm1 1v10h10V3H3z" />
              ) : (
                <path d="M2 2h12v12H2V2zm1 1v10h4V3H3zm5 0v10h4V3H8z" />
              )}
            </svg>
          </button>
        </div>
        <div className="terminal-header-actions">
          <button
            className="terminal-action-btn"
            onClick={() => setTerminalVisible(false)}
            title="Hide Terminal (Ctrl+`)"
          >
            ×
          </button>
        </div>
      </div>
      <div
        className={`terminal-bodies ${splitMode ? 'split' : ''}`}
        ref={bodiesRef}
        style={splitMode ? { '--split-left': `${splitRatio * 100}%` } : undefined}
      >
        {terminals.map((t) => (
          <div
            key={t.id}
            className={`terminal-body ${t.id === activeTerminalId ? 'active' : ''} ${splitMode && t.id === splitTerminalId ? 'split-right' : ''}`}
            ref={(el) => initTerminal(t.id, el)}
          />
        ))}
        {splitMode && (
          <div className="terminal-split-gutter" onMouseDown={handleSplitDrag} />
        )}
      </div>
    </div>
  );
}

export default TerminalPanel;
