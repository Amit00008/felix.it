import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './IDE.css';
import './Dashboard.css';

const API = import.meta.env.VITE_API_URL;

const TOOLS = [
  {
    id: 'nodejs',
    name: 'Node.js + npm',
    description: 'JavaScript runtime & package manager',
    icon: '⬢',
    iconColor: '#68a063',
    checkCmd: 'node --version && npm --version',
    installCmd: 'apt-get update -qq && apt-get install -y -qq curl > /dev/null 2>&1 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1 && apt-get install -y -qq nodejs > /dev/null 2>&1 && node --version && npm --version',
  },
  {
    id: 'python',
    name: 'Python 3 + pip',
    description: 'Python interpreter & package manager',
    icon: '🐍',
    iconColor: '#3776ab',
    checkCmd: 'python3 --version && pip3 --version',
    installCmd: 'apt-get update -qq && apt-get install -y -qq python3 python3-pip > /dev/null 2>&1 && ln -sf /usr/bin/python3 /usr/bin/python && ln -sf /usr/bin/pip3 /usr/bin/pip && python3 --version && pip3 --version',
  },
  {
    id: 'git',
    name: 'Git',
    description: 'Version control system',
    icon: '⎇',
    iconColor: '#f05032',
    checkCmd: 'git --version',
    installCmd: 'apt-get update -qq && apt-get install -y -qq git > /dev/null 2>&1 && git --version',
  },
  {
    id: 'build-essential',
    name: 'Build Tools',
    description: 'gcc, g++, make — compile native code',
    icon: '⚙',
    iconColor: '#cca700',
    checkCmd: 'gcc --version',
    installCmd: 'apt-get update -qq && apt-get install -y -qq build-essential > /dev/null 2>&1 && gcc --version',
  },
];

function Dashboard({ token }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [toolStatus, setToolStatus] = useState({});
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [dragging, setDragging] = useState(false);
  const [containerInfo, setContainerInfo] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API}/projects`, { headers });
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchContainerStatus = async () => {
    try {
      const res = await fetch(`${API}/container/status`, { headers });
      const data = await res.json();
      setContainerInfo(data);
    } catch { /* ignore */ }
  };

  const fetchUserEmail = async () => {
    try {
      const res = await fetch(`${API}/user/email?token=${token}`);
      const data = await res.json();
      if (data.email) setUserEmail(data.email);
    } catch { /* ignore */ }
  };

  const checkTools = async () => {
    for (const tool of TOOLS) {
      try {
        const res = await fetch(`${API}/container/exec`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ command: tool.checkCmd })
        });
        const data = await res.json();
        if (data.success) {
          setToolStatus(prev => ({ ...prev, [tool.id]: { status: 'installed', output: data.output.trim() } }));
        } else {
          setToolStatus(prev => ({ ...prev, [tool.id]: { status: 'not-installed' } }));
        }
      } catch {
        setToolStatus(prev => ({ ...prev, [tool.id]: { status: 'unknown' } }));
      }
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchContainerStatus();
    fetchUserEmail();
    checkTools();
  }, []);

  useEffect(() => {
    if (creating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [creating]);

  const handleInstall = async (tool) => {
    setToolStatus(prev => ({ ...prev, [tool.id]: { status: 'installing' } }));
    try {
      const res = await fetch(`${API}/container/exec`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ command: tool.installCmd })
      });
      const data = await res.json();
      if (data.success) {
        setToolStatus(prev => ({ ...prev, [tool.id]: { status: 'installed', output: data.output.trim() } }));
      } else {
        setToolStatus(prev => ({ ...prev, [tool.id]: { status: 'error', output: data.output || 'Install failed' } }));
      }
    } catch (err) {
      setToolStatus(prev => ({ ...prev, [tool.id]: { status: 'error', output: err.message } }));
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setCreating(false);
      setNewName('');
      return;
    }
    setError('');
    try {
      const res = await fetch(`${API}/projects`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || 'Failed to create project');
        return;
      }
      setCreating(false);
      setNewName('');
      navigate(`/${name}`);
    } catch {
      setError('Failed to create project');
    }
  };

  const handleDelete = async (e, name) => {
    e.stopPropagation();
    if (!confirm(`Delete project "${name}"? This cannot be undone.`)) return;
    try {
      await fetch(`${API}/projects/${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers
      });
      fetchProjects();
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') {
      setCreating(false);
      setNewName('');
    }
  };

  const handleSidebarResize = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e) => {
      const delta = e.clientX - startX;
      setSidebarWidth(Math.max(160, Math.min(600, startWidth + delta)));
    };

    const handleMouseUp = () => {
      setDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  const timeAgo = (date) => {
    const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString();
  };

  const installedCount = Object.values(toolStatus).filter(t => t.status === 'installed').length;

  return (
    <div className="ide" style={{ '--current-sidebar-width': sidebarWidth + 'px' }}>
      {/* Activity Bar */}
      <div className="activity-bar">
        <div className="activity-bar-top">
          <div className="activity-icon active" title="Dashboard">
            <svg viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
        </div>
        <div className="activity-bar-bottom">
          <div className="activity-icon" onClick={handleLogout} title="Sign Out">
            <svg viewBox="0 0 24 24">
              <path d="M11.2 3a1 1 0 110 2H4v14h7.2a1 1 0 110 2H3a1 1 0 01-1-1V4a1 1 0 011-1h8.2zm5.3 4.3l3.7 3.7a1 1 0 010 1.4l-3.7 3.7-1.4-1.4L17.8 12H8v-2h9.8l-2.7-2.7 1.4-1.4z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Sidebar — Project List */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Projects</h2>
          <div className="sidebar-actions">
            <button
              className="sidebar-action-btn"
              onClick={() => setCreating(true)}
              title="New Project"
            >
              ✚
            </button>
          </div>
        </div>
        <div className="sidebar-content">
          {creating && (
            <div className="new-item-input-row" style={{ paddingLeft: '12px' }}>
              <span className="tree-icon folder">📁</span>
              <input
                ref={inputRef}
                className="new-item-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleCreate}
                placeholder="project-name"
                maxLength={64}
              />
            </div>
          )}
          {loading ? (
            <div className="dash-sidebar-loading">
              <div className="dash-sidebar-spinner" />
              <span>Loading...</span>
            </div>
          ) : projects.length === 0 && !creating ? (
            <div className="dash-sidebar-empty">
              <p>No projects yet</p>
              <button className="dash-sidebar-create-btn" onClick={() => setCreating(true)}>
                + Create Project
              </button>
            </div>
          ) : (
            <div className="dash-project-list">
              <p className="dash-sidebar-hint">Select a project to continue</p>
              {projects.map((p) => (
                <div
                  key={p.name}
                  className="dash-project-item"
                  onClick={() => navigate(`/${encodeURIComponent(p.name)}`)}
                >
                  <span className="tree-icon folder">📁</span>
                  <span className="tree-name">{p.name}</span>
                  <span className="dash-project-time">{timeAgo(p.updatedAt)}</span>
                  <button
                    className="dash-project-delete"
                    onClick={(e) => handleDelete(e, p.name)}
                    title="Delete project"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div
          className={`sidebar-resize-handle ${dragging ? 'dragging' : ''}`}
          onMouseDown={handleSidebarResize}
        />
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="tab-bar">
          <div className="tab active">
            <span className="tab-icon" style={{ color: 'var(--accent)' }}>⌂</span>
            <span className="tab-name">Dashboard</span>
          </div>
        </div>

        <div className="dash-content">
          {error && (
            <div className="dash-error">
              <span className="dash-error-badge">!</span>
              {error}
              <button className="dash-error-close" onClick={() => setError('')}>×</button>
            </div>
          )}

          {/* Hero Section */}
          <div className="dash-hero">
            <div className="dash-hero-left">
              <div className="dash-hero-logo">F</div>
              <div className="dash-hero-text">
                <h1 className="dash-hero-title">
                  Felix<span className="dash-hero-dot">.</span>it
                </h1>
                <p className="dash-hero-subtitle">
                  {userEmail && <>{userEmail} · </>}
                  {loading ? 'Loading...' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
                  {containerInfo && (
                    <> · Container {containerInfo.running ? 'running' : containerInfo.exists ? 'stopped' : 'not created'}</>
                  )}
                </p>
              </div>
            </div>
            <button className="dash-hero-btn" onClick={() => setCreating(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
              New Project
            </button>
          </div>

          {/* Projects Section */}
          <div className="dash-section">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Projects</h2>
              <span className="dash-section-count">{projects.length}</span>
            </div>

            {loading ? (
              <div className="dash-loading">
                <div className="dash-loading-spinner" />
                <p>Loading projects...</p>
              </div>
            ) : (
              <div className="dash-project-grid">
                {projects.map((project) => (
                  <div
                    key={project.name}
                    className="dash-card"
                    onClick={() => navigate(`/${encodeURIComponent(project.name)}`)}
                  >
                    <button
                      className="dash-card-delete"
                      onClick={(e) => handleDelete(e, project.name)}
                      title="Delete project"
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                      </svg>
                    </button>
                    <div className="dash-card-icon">
                      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                        <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                      </svg>
                    </div>
                    <h3 className="dash-card-name">{project.name}</h3>
                    <span className="dash-card-time">{timeAgo(project.updatedAt)}</span>
                  </div>
                ))}
                <div
                  className="dash-card dash-card-new"
                  onClick={() => setCreating(true)}
                >
                  <div className="dash-card-icon dash-card-icon-new">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                      <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
                    </svg>
                  </div>
                  <h3 className="dash-card-name">New Project</h3>
                  <span className="dash-card-time">Create workspace</span>
                </div>
              </div>
            )}
          </div>

          {/* Container Tools Section */}
          <div className="dash-section">
            <div className="dash-section-header">
              <h2 className="dash-section-title">Container Tools</h2>
              <span className="dash-section-count">{installedCount}/{TOOLS.length}</span>
            </div>
            <p className="dash-section-desc">Install development tools into your Ubuntu workspace</p>
            <div className="dash-tools-grid">
              {TOOLS.map((tool) => {
                const status = toolStatus[tool.id] || { status: 'checking' };
                return (
                  <div key={tool.id} className={`dash-tool ${status.status}`}>
                    <div className="dash-tool-icon" style={{ color: tool.iconColor }}>
                      {tool.icon}
                    </div>
                    <div className="dash-tool-info">
                      <h3 className="dash-tool-name">{tool.name}</h3>
                      <p className="dash-tool-desc">{tool.description}</p>
                      {status.status === 'installed' && status.output && (
                        <span className="dash-tool-version">{status.output.split('\n')[0]}</span>
                      )}
                      {status.status === 'error' && (
                        <span className="dash-tool-error">Install failed</span>
                      )}
                    </div>
                    <div className="dash-tool-action">
                      {status.status === 'checking' && (
                        <div className="dash-tool-spinner" />
                      )}
                      {status.status === 'installed' && (
                        <span className="dash-tool-badge installed">✓ Installed</span>
                      )}
                      {(status.status === 'not-installed' || status.status === 'unknown' || status.status === 'error') && (
                        <button className="dash-tool-install" onClick={() => handleInstall(tool)}>
                          Install
                        </button>
                      )}
                      {status.status === 'installing' && (
                        <div className="dash-tool-installing">
                          <div className="dash-tool-spinner" />
                          <span>Installing...</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Container Info Section */}
          {containerInfo && (
            <div className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">Workspace</h2>
              </div>
              <div className="dash-info-grid">
                <div className="dash-info-item">
                  <span className="dash-info-label">Container</span>
                  <span className={`dash-info-value ${containerInfo.running ? 'running' : ''}`}>
                    {containerInfo.running ? '● Running' : containerInfo.exists ? '○ Stopped' : '○ Not created'}
                  </span>
                </div>
                <div className="dash-info-item">
                  <span className="dash-info-label">Image</span>
                  <span className="dash-info-value">Ubuntu 22.04</span>
                </div>
                <div className="dash-info-item">
                  <span className="dash-info-label">Tools</span>
                  <span className="dash-info-value">{installedCount} of {TOOLS.length} installed</span>
                </div>
                {containerInfo.created && (
                  <div className="dash-info-item">
                    <span className="dash-info-label">Created</span>
                    <span className="dash-info-value">{new Date(containerInfo.created).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="status-bar">
        <div className="status-bar-left">
          <span className="status-item docker-status">
            {containerInfo?.running ? '🐳' : '⏳'} {containerInfo?.running ? 'Container' : 'Workspace'}
          </span>
          <span className="status-item">
            📁 {projects.length} project{projects.length !== 1 ? 's' : ''}
          </span>
          {userEmail && (
            <span className="status-item">
              👤 {userEmail}
            </span>
          )}
        </div>
        <div className="status-bar-right">
          <span className="status-item">Felix.it</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
