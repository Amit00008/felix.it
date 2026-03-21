const http = require('http');
const express = require('express');
const { Server: socketServer } = require('socket.io');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const cors = require('cors');
const chokidar = require('chokidar');
const mongoose = require('mongoose');
const { PassThrough } = require('stream');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Project = require('./models/Project');

const docker = process.env.DOCKER_HOST
  ? new Docker({ host: process.env.DOCKER_HOST })
  : new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/dockerDesktopLinuxEngine' : '/var/run/docker.sock' });
const DOCKER_IMAGE = 'ubuntu:22.04';
const USER_DATA_DIR = path.join(__dirname, 'user-data');
const CONTAINER_STOP_GRACE_MS = Math.max(0, parseInt(process.env.CONTAINER_STOP_GRACE_MS || '10000', 10));

const socatPromises = new Map();
const containerStopTimers = new Map();

function previewAuthMiddleware(req, res, next) {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).send('Unauthorized');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).send('Invalid token');
  }
}

async function ensureSocat(container, userId) {
  if (socatPromises.has(userId)) return socatPromises.get(userId);
  const promise = _doEnsureSocat(container, userId);
  socatPromises.set(userId, promise);
  try {
    await promise;
  } catch (err) {
    socatPromises.delete(userId);
    throw err;
  }
}

async function _doEnsureSocat(container, userId) {
  const checkExec = await container.exec({
    Cmd: ['/bin/bash', '-c', 'which socat'],
    AttachStdout: true,
    AttachStderr: true,
    Tty: false
  });
  const checkStream = await checkExec.start({ Tty: false });
  await new Promise(resolve => { checkStream.on('end', resolve); checkStream.resume(); });
  const checkResult = await checkExec.inspect();
  if (checkResult.ExitCode === 0) return;
  console.log(`📦 Installing socat in container felix-${userId}...`);
  const installExec = await container.exec({
    Cmd: ['/bin/bash', '-c', 'apt-get update -qq && apt-get install -y -qq socat > /dev/null 2>&1'],
    AttachStdout: true,
    AttachStderr: true,
    Tty: false
  });
  const installStream = await installExec.start({ Tty: false });
  await new Promise(resolve => { installStream.on('end', resolve); installStream.resume(); });
  const installResult = await installExec.inspect();
  if (installResult.ExitCode !== 0) {
    throw new Error('Failed to install socat in container. Check internet connectivity.');
  }
  console.log(`✅ socat installed in container felix-${userId}`);
}

const PREVIEW_ERROR_HTML = `
<!DOCTYPE html>
<html>
<head><title>Preview Unavailable</title>
<style>
  body { margin: 0; height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #1e1e1e; color: #ccc; font-family: 'Segoe UI', sans-serif; text-align: center; }
  .box { max-width: 400px; padding: 40px; }
  h2 { color: #e4e4e7; margin-bottom: 12px; }
  p { color: #858585; font-size: 14px; line-height: 1.6; }
  code { background: #333; padding: 2px 8px; border-radius: 4px; color: #89d185; }
</style></head>
<body><div class="box">
  <h2>⚠️ Preview Unavailable</h2>
  <p>No server is running on this port, or it hasn't started yet.</p>
  <p>Start a server in the terminal, e.g.<br><code>npx serve -p 3000</code></p>
</div></body>
</html>`;

if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('MongoDB connected 🎀'))
  .catch((error) => console.error('MongoDB connection error:', error));

const app = express();
const server = http.createServer(app);
const io = new socketServer({
  cors: { origin: '*' }
});

app.use(express.json());
app.use(cors());

// --- Per-user session tracking ---
const userSessions = new Map();

function hasActiveSession(userId) {
  for (const session of userSessions.values()) {
    if (session.userId === userId) return true;
  }
  return false;
}

function clearContainerStopTimer(userId) {
  const timer = containerStopTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    containerStopTimers.delete(userId);
  }
}

async function stopContainerIfRunning(userId, reason) {
  const name = `felix-${userId}`;
  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();
    if (!info.State.Running) return;
    await container.stop({ t: 10 });
    console.log(`Stopped container ${name} (${reason})`);
  } catch (err) {
    if (err.statusCode !== 404) {
      console.error(`Failed to stop container ${name}:`, err.message);
    }
  }
}

function scheduleContainerStop(userId, reason) {
  clearContainerStopTimer(userId);
  const timer = setTimeout(async () => {
    containerStopTimers.delete(userId);
    if (hasActiveSession(userId)) return;
    await stopContainerIfRunning(userId, reason);
  }, CONTAINER_STOP_GRACE_MS);
  containerStopTimers.set(userId, timer);
}

// --- Docker container management ---
function getUserWorkspacePath(userId) {
  return path.join(USER_DATA_DIR, userId, 'workspace');
}

async function ensureContainer(userId) {
  const name = `felix-${userId}`;
  const hostDir = getUserWorkspacePath(userId);
  await fsPromises.mkdir(hostDir, { recursive: true });

  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();
    if (!info.State.Running) {
      await container.start();
      console.log(`▶ Started existing container ${name}`);
    }
    return container;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
    const bindPath = hostDir.replace(/\\/g, '/');
    console.log(`🐳 Creating container ${name} with bind ${bindPath}:/workspace`);
    const container = await docker.createContainer({
      name,
      Image: DOCKER_IMAGE,
      Cmd: ['sleep', 'infinity'],
      WorkingDir: '/workspace',
      Tty: true,
      HostConfig: {
        Binds: [`${bindPath}:/workspace:rw`],
      }
    });
    await container.start();
    console.log(`✅ Container ${name} created and started`);
    return container;
  }
}

async function createExecSession(container, project) {
  const cmd = project
    ? ['/bin/bash', '-c', `cd /workspace/${project} 2>/dev/null || cd /workspace; exec /bin/bash`]
    : ['/bin/bash'];
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true
  });
  const stream = await exec.start({ hijack: true, stdin: true, Tty: true });
  return { exec, stream };
}

// --- Utility: resolve and validate path within a user's workspace ---
function resolveSafePath(relativePath, workspaceDir) {
  const resolved = path.resolve(workspaceDir, relativePath || '');
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// --- Auth middleware for REST routes ---
function authMiddleware(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) return res.status(401).json({ message: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    req.userWorkspace = getUserWorkspacePath(decoded.id);
    if (!fs.existsSync(req.userWorkspace)) {
      fs.mkdirSync(req.userWorkspace, { recursive: true });
    }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// --- Socket.io ---
io.attach(server);

io.on('connection', (socket) => {
  console.log('🚀 Client connected:', socket.id);

  socket.on('authenticate', async (data) => {
    try {
      const token = typeof data === 'string' ? data : data.token;
      const project = typeof data === 'string' ? null : data.project;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.id;
      socket.userId = userId;
      clearContainerStopTimer(userId);

      // Clean up existing session if re-authenticating on same socket
      const existing = userSessions.get(socket.id);
      if (existing) {
        for (const [, terminal] of existing.terminals) {
          try { terminal.stream.end(); } catch (e) { /* ignore */ }
        }
        if (existing.watcher) existing.watcher.close();
        userSessions.delete(socket.id);
      }

      socket.emit('container:status', { status: 'starting', message: 'Starting your workspace...' });

      const container = await ensureContainer(userId);

      const userWorkspace = getUserWorkspacePath(userId);
      const watchDir = project ? path.join(userWorkspace, project) : userWorkspace;
      if (!fs.existsSync(watchDir)) {
        fs.mkdirSync(watchDir, { recursive: true });
      }
      const watcher = chokidar.watch(watchDir, {
        ignored: /(^|[\/\\])\.|node_modules/,
        persistent: true,
        usePolling: true,
        interval: 300
      });
      watcher.on('all', () => socket.emit('file:refresh'));
      watcher.on('error', error => console.error(`Watcher error: ${error}`));

      userSessions.set(socket.id, { userId, container, watcher, project, terminals: new Map(), nextTerminalId: 1 });

      // Sync filesystem projects to MongoDB (migration for pre-existing projects)
      try {
        const entries = await fsPromises.readdir(userWorkspace, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await Project.updateOne(
              { userId, name: entry.name },
              { $setOnInsert: { userId, name: entry.name } },
              { upsert: true }
            );
          }
        }
      } catch (e) { /* ignore sync errors */ }

      socket.emit('authenticated', { success: true, containerReady: true });
      socket.emit('container:status', { status: 'ready', message: 'Workspace ready' });
      console.log(`✅ User ${userId} authenticated, container & terminal ready`);
    } catch (error) {
      console.error('Auth/container error:', error.message);
      socket.emit('authenticated', { success: false, message: error.message });
      socket.emit('container:status', { status: 'error', message: 'Failed to start workspace: ' + error.message });
    }
  });

  socket.on('terminal:create', async () => {
    const session = userSessions.get(socket.id);
    if (!session) return;
    try {
      const id = session.nextTerminalId++;
      const { exec, stream } = await createExecSession(session.container, session.project);
      session.terminals.set(id, { exec, stream });

      stream.on('data', (chunk) => {
        socket.emit('terminal:data', { id, data: chunk.toString('utf8') });
      });
      stream.on('end', () => {
        socket.emit('terminal:exited', { id });
      });

      socket.emit('terminal:created', { id });
    } catch (error) {
      console.error('Error creating terminal:', error.message);
    }
  });

  socket.on('terminal:write', ({ id, data }) => {
    const session = userSessions.get(socket.id);
    const terminal = session?.terminals.get(id);
    if (terminal?.stream?.writable) {
      terminal.stream.write(data);
    }
  });

  socket.on('terminal:resize', async ({ id, cols, rows }) => {
    const session = userSessions.get(socket.id);
    const terminal = session?.terminals.get(id);
    if (terminal?.exec) {
      try {
        await terminal.exec.resize({ h: rows, w: cols });
      } catch (e) { /* ignore resize errors */ }
    }
  });

  socket.on('terminal:restart', async ({ id }) => {
    const session = userSessions.get(socket.id);
    if (!session || !session.terminals.has(id)) return;
    try {
      const { exec, stream } = await createExecSession(session.container, session.project);
      session.terminals.set(id, { exec, stream });

      stream.on('data', (chunk) => {
        socket.emit('terminal:data', { id, data: chunk.toString('utf8') });
      });
      stream.on('end', () => {
        socket.emit('terminal:exited', { id });
      });

      socket.emit('terminal:restarted', { id });
    } catch (error) {
      console.error('Error restarting terminal:', error.message);
    }
  });

  socket.on('terminal:close', ({ id }) => {
    const session = userSessions.get(socket.id);
    const terminal = session?.terminals.get(id);
    if (terminal) {
      try { terminal.stream.end(); } catch (e) { /* ignore */ }
      session.terminals.delete(id);
    }
  });

  socket.on('file:write', async ({ path: filePath, content }) => {
    const session = userSessions.get(socket.id);
    if (!session) return;
    try {
      const fullPath = resolveSafePath(filePath, getUserWorkspacePath(session.userId));
      await fsPromises.writeFile(fullPath, content);
      const projectName = filePath.split('/')[0];
      if (projectName) {
        Project.updateOne({ userId: session.userId, name: projectName }, { updatedAt: new Date() }).catch(() => {});
      }
    } catch (error) {
      console.error(`Error writing file: ${error}`);
    }
  });

  socket.on('disconnect', () => {
    const session = userSessions.get(socket.id);
    if (session) {
      for (const [, terminal] of session.terminals) {
        try { terminal.stream.end(); } catch (e) { /* ignore */ }
      }
      session.terminals.clear();
      if (session.watcher) {
        session.watcher.close();
      }
      userSessions.delete(socket.id);
      if (!hasActiveSession(session.userId)) {
        scheduleContainerStop(session.userId, 'user disconnected or inactive');
      }
      console.log(`🔌 User ${session.userId} disconnected, session cleaned up`);
    } else {
      console.log('Client disconnected (no session)');
    }
  });
});

// --- Auth Routes ---
app.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });
    const user = new User({ email, password });
    await user.save();
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    if (password !== user.password) return res.status(400).json({ message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

app.get('/user/email', async (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ email: user.email });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user email' });
  }
});

// --- Container status endpoint ---
app.get('/container/status', authMiddleware, async (req, res) => {
  try {
    const name = `felix-${req.userId}`;
    const container = docker.getContainer(name);
    const info = await container.inspect();
    res.json({
      exists: true,
      running: info.State.Running,
      name: info.Name,
      created: info.Created
    });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.json({ exists: false, running: false });
    }
    res.status(500).json({ message: 'Error checking container', error: err.message });
  }
});

// --- Project API Routes ---

app.get('/projects', authMiddleware, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.userId })
      .sort({ updatedAt: -1 })
      .select('name createdAt updatedAt');
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ message: 'Error listing projects', error: error.message });
  }
});

app.post('/projects', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || /[/\\:*?"<>|]/.test(name)) {
      return res.status(400).json({ message: 'Invalid project name' });
    }
    const existing = await Project.findOne({ userId: req.userId, name });
    if (existing) {
      return res.status(400).json({ message: 'Project already exists' });
    }
    const project = new Project({ name, userId: req.userId });
    await project.save();
    const projectPath = path.join(req.userWorkspace, name);
    await fsPromises.mkdir(projectPath, { recursive: true });
    res.json({ success: true, name });
  } catch (error) {
    res.status(500).json({ message: 'Error creating project', error: error.message });
  }
});

app.delete('/projects/:name', authMiddleware, async (req, res) => {
  try {
    const result = await Project.findOneAndDelete({ userId: req.userId, name: req.params.name });
    if (!result) {
      return res.status(404).json({ message: 'Project not found' });
    }
    const projectPath = resolveSafePath(req.params.name, req.userWorkspace);
    await fsPromises.rm(projectPath, { recursive: true, force: true }).catch(() => {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
});

// --- File API Routes (all require auth) ---

app.get('/files', authMiddleware, async (req, res) => {
  try {
    let dir = req.userWorkspace;
    if (req.query.project) {
      dir = resolveSafePath(req.query.project, req.userWorkspace);
      if (!fs.existsSync(dir)) {
        await fsPromises.mkdir(dir, { recursive: true });
      }
    }
    const tree = await generateFileTree(dir);
    res.json({ tree });
  } catch (error) {
    res.status(500).json({ message: 'Error reading file tree' });
  }
});

app.get('/files/content', authMiddleware, async (req, res) => {
  try {
    const fullPath = resolveSafePath(req.query.path, req.userWorkspace);
    const content = await fsPromises.readFile(fullPath, 'utf-8');
    res.json({ content });
  } catch (error) {
    res.status(500).json({ message: 'Error reading file', error: error.message });
  }
});

app.post('/files/create-file', authMiddleware, async (req, res) => {
  try {
    const fullPath = resolveSafePath(req.body.path, req.userWorkspace);
    const dir = path.dirname(fullPath);
    await fsPromises.mkdir(dir, { recursive: true });
    await fsPromises.writeFile(fullPath, req.body.content || '');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error creating file', error: error.message });
  }
});

app.post('/files/create-folder', authMiddleware, async (req, res) => {
  try {
    const fullPath = resolveSafePath(req.body.path, req.userWorkspace);
    await fsPromises.mkdir(fullPath, { recursive: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error creating folder', error: error.message });
  }
});

app.put('/files/rename', authMiddleware, async (req, res) => {
  try {
    const oldPath = resolveSafePath(req.body.oldPath, req.userWorkspace);
    const newPath = resolveSafePath(req.body.newPath, req.userWorkspace);
    await fsPromises.rename(oldPath, newPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error renaming', error: error.message });
  }
});

app.delete('/files/delete', authMiddleware, async (req, res) => {
  try {
    const fullPath = resolveSafePath(req.body.path, req.userWorkspace);
    const stat = await fsPromises.stat(fullPath);
    if (stat.isDirectory()) {
      await fsPromises.rm(fullPath, { recursive: true, force: true });
    } else {
      await fsPromises.unlink(fullPath);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting', error: error.message });
  }
});

app.get('/files/search', authMiddleware, async (req, res) => {
  try {
    const { query, project } = req.query;
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }
    const dir = project
      ? resolveSafePath(project, req.userWorkspace)
      : req.userWorkspace;
    if (!fs.existsSync(dir)) {
      return res.json({ results: [] });
    }
    const results = [];
    const MAX_RESULTS = 50;
    const queryLower = query.toLowerCase();

    async function searchDir(currentDir, relativePath) {
      if (results.length >= MAX_RESULTS) return;
      let entries;
      try {
        entries = await fsPromises.readdir(currentDir, { withFileTypes: true });
      } catch { return; }
      for (const entry of entries) {
        if (results.length >= MAX_RESULTS) break;
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          if (entry.name.toLowerCase().includes(queryLower)) {
            results.push({ path: entryRelPath, name: entry.name, type: 'folder', match: 'name' });
          }
          await searchDir(path.join(currentDir, entry.name), entryRelPath);
        } else {
          if (entry.name.toLowerCase().includes(queryLower)) {
            results.push({ path: entryRelPath, name: entry.name, type: 'file', match: 'name' });
          }
          try {
            const filePath = path.join(currentDir, entry.name);
            const stat = await fsPromises.stat(filePath);
            if (stat.size > 512 * 1024) continue;
            const content = await fsPromises.readFile(filePath, 'utf-8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length && results.length < MAX_RESULTS; i++) {
              if (lines[i].toLowerCase().includes(queryLower)) {
                results.push({
                  path: entryRelPath,
                  name: entry.name,
                  type: 'file',
                  match: 'content',
                  line: i + 1,
                  lineContent: lines[i].trim().substring(0, 200)
                });
                break;
              }
            }
          } catch { /* skip unreadable files */ }
        }
      }
    }

    await searchDir(dir, '');
    res.json({ results });
  } catch (error) {
    res.status(500).json({ message: 'Search error', error: error.message });
  }
});

app.post('/container/exec', authMiddleware, async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ message: 'No command provided' });

    const name = `felix-${req.userId}`;
    let container;
    try {
      container = docker.getContainer(name);
      const info = await container.inspect();
      if (!info.State.Running) {
        await container.start();
      }
    } catch (err) {
      if (err.statusCode === 404) {
        container = await ensureContainer(req.userId);
      } else {
        throw err;
      }
    }

    const exec = await container.exec({
      Cmd: ['/bin/bash', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      Tty: true
    });

    const stream = await exec.start({ hijack: true, stdin: false, Tty: true });

    let output = '';
    await new Promise((resolve) => {
      stream.on('data', (chunk) => {
        output += chunk.toString('utf8');
      });
      stream.on('end', resolve);
      const timeout = setTimeout(() => {
        try { stream.destroy(); } catch (e) { /* ignore */ }
        resolve();
      }, 120000);
      stream.on('end', () => clearTimeout(timeout));
    });

    const inspectResult = await exec.inspect();
    res.json({
      success: inspectResult.ExitCode === 0,
      exitCode: inspectResult.ExitCode,
      output: output.substring(0, 5000)
    });
  } catch (error) {
    res.status(500).json({ message: 'Exec error', error: error.message });
  }
});

app.put('/files/save', authMiddleware, async (req, res) => {
  try {
    const fullPath = resolveSafePath(req.body.path, req.userWorkspace);
    await fsPromises.writeFile(fullPath, req.body.content);
    const projectName = req.body.path.split('/')[0];
    if (projectName) {
      Project.updateOne({ userId: req.userId, name: projectName }, { updatedAt: new Date() }).catch(() => {});
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: 'Error saving file', error: error.message });
  }
});

// --- Preview Proxy (exec-based, works on all platforms including Docker Desktop) ---
async function proxyHandler(req, res) {
  try {
    const port = parseInt(req.params.port, 10);
    if (!port || port < 1 || port > 65535) {
      return res.status(400).send('Invalid port number');
    }

    const container = docker.getContainer(`felix-${req.userId}`);
    await ensureSocat(container, req.userId);

    const exec = await container.exec({
      Cmd: ['socat', '-', `TCP:localhost:${port}`],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: false,
      Tty: false
    });

    const stream = await exec.start({ hijack: true, stdin: true, Tty: false });

    const stdout = new PassThrough();
    docker.modem.demuxStream(stream, stdout, null);

    const remainder = req.params[0] || '';
    const url = new URL(req.originalUrl, 'http://localhost');
    url.searchParams.delete('token');
    const reqPath = '/' + remainder + (url.search || '');

    let rawRequest = `${req.method} ${reqPath} HTTP/1.0\r\n`;
    rawRequest += `Host: localhost:${port}\r\n`;
    for (const [key, value] of Object.entries(req.headers)) {
      const lower = key.toLowerCase();
      if (['host', 'connection', 'transfer-encoding', 'accept-encoding'].includes(lower)) continue;
      rawRequest += `${key}: ${value}\r\n`;
    }
    rawRequest += `Connection: close\r\n\r\n`;

    stream.write(rawRequest);

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.readable) {
      req.pipe(stream, { end: false });
    }

    let headersDone = false;
    let buffer = Buffer.alloc(0);

    stdout.on('data', (chunk) => {
      if (headersDone) {
        res.write(chunk);
        return;
      }

      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
      const idx = buffer.indexOf('\r\n\r\n');
      if (idx === -1) return;

      const headerStr = buffer.slice(0, idx).toString('utf8');
      const lines = headerStr.split('\r\n');
      const statusMatch = lines[0].match(/HTTP\/[\d.]+ (\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : 200;

      for (let i = 1; i < lines.length; i++) {
        const colon = lines[i].indexOf(':');
        if (colon > 0) {
          const k = lines[i].slice(0, colon).trim();
          const v = lines[i].slice(colon + 1).trim();
          if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
            try { res.setHeader(k, v); } catch (e) { /* ignore duplicate headers */ }
          }
        }
      }

      res.writeHead(statusCode);
      headersDone = true;

      const body = buffer.slice(idx + 4);
      if (body.length > 0) res.write(body);
    });

    const timeout = setTimeout(() => {
      if (!headersDone && !res.headersSent) {
        try { stream.destroy(); } catch (e) { /* ignore */ }
        res.writeHead(504, { 'Content-Type': 'text/html' });
        res.end(PREVIEW_ERROR_HTML.replace('Preview Unavailable', 'Preview Timeout').replace('No server is running', 'The server took too long to respond'));
      }
    }, 15000);

    stdout.on('end', () => {
      clearTimeout(timeout);
      try { stream.destroy(); } catch (e) { /* ignore */ }
      if (!headersDone && !res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/html' });
        res.end(PREVIEW_ERROR_HTML);
      } else {
        res.end();
      }
    });

    stdout.on('error', () => {
      clearTimeout(timeout);
      try { stream.destroy(); } catch (e) { /* ignore */ }
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/html' });
        res.end(PREVIEW_ERROR_HTML);
      } else {
        try { res.end(); } catch (e) { /* ignore */ }
      }
    });

  } catch (err) {
    if (!res.headersSent) {
      res.status(502).send(`<html><body style="background:#1e1e1e;color:#ccc;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif"><div style="text-align:center"><h2>⚠️ Preview Error</h2><p>${err.message}</p></div></body></html>`);
    }
  }
}

app.all('/preview/:port', previewAuthMiddleware, proxyHandler);
app.all('/preview/:port/*', previewAuthMiddleware, proxyHandler);

server.listen(process.env.PORT || 4001, () => {
  console.log('🐋 Server listening on port', process.env.PORT || 4001);
});

async function generateFileTree(directory) {
  const tree = {};
  async function buildTree(currDir, currTree) {
    const files = await fsPromises.readdir(currDir);
    for (const file of files) {
      if (file === 'node_modules' || file.startsWith('.')) continue;
      const filepath = path.join(currDir, file);
      const stat = await fsPromises.stat(filepath);
      if (stat.isDirectory()) {
        currTree[file] = {};
        await buildTree(filepath, currTree[file]);
      } else {
        currTree[file] = null;
      }
    }
  }
  await buildTree(directory, tree);
  return tree;
}
