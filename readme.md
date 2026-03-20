# Felix.it

**A cloud-based IDE powered by Docker** — every user gets their own isolated Ubuntu workspace with a VS Code-like editor, multi-terminal support, and project management.

🌐 **Live Demo → [felix.amitdey.tech](https://felix.amitdey.tech)**

---

## ✨ Features

### Editor
- **Monaco Editor** — Syntax highlighting, IntelliSense, bracket matching, and JetBrains Mono font
- **Multi-tab editing** — Open, close, and switch between files with dirty indicators
- **Auto-save** — Changes are written to disk after 2 seconds of inactivity
- **Keyboard shortcuts** — `Ctrl+S` save, `Ctrl+B` toggle sidebar, `` Ctrl+` `` toggle terminal

### Terminal
- **Multi-terminal tabs** — Spawn and manage multiple terminal sessions (like VS Code)
- **Split terminal** — View two terminals side by side with a draggable divider
- **Rename terminals** — Double-click a tab to rename it
- **Persistent processes** — Hiding the terminal panel keeps all processes running
- **Full shell access** — Each terminal runs bash inside your Docker container via xterm.js

### Workspace
- **Per-user Docker containers** — Each user gets an isolated Ubuntu 22.04 workspace
- **Project management** — Create, switch, and delete multiple projects from the dashboard
- **Container tools** — One-click install of Node.js, Python, Git, and build tools
- **File explorer** — Recursive tree with context menus, rename, delete, new file/folder
- **File search** — Search by file name and content across your project
- **Real-time sync** — File changes on disk are reflected instantly via chokidar watchers

### Auth & Security
- **JWT authentication** — Signup/login with per-user workspace isolation
- **Path traversal protection** — Server validates all file paths
- **Per-user containers** — Complete isolation between users

---

## 🏗 Architecture

```
┌─────────────┐         WebSocket + REST         ┌──────────────────┐
│   Client     │  ◄──────────────────────────►    │   Express Server  │
│  (React +    │     socket.io / fetch            │   (Node.js)       │
│   Vite)      │                                  │                   │
│              │                                  │  ┌──────────────┐ │
│  Monaco      │    terminal:write/data           │  │  dockerode    │ │
│  xterm.js    │  ◄────────────────────────►      │  │  ┌─────────┐ │ │
│  socket.io   │                                  │  │  │ Ubuntu   │ │ │
│              │                                  │  │  │ 22.04    │ │ │
└─────────────┘                                   │  │  │/workspace│ │ │
                                                  │  │  └─────────┘ │ │
                                                  │  └──────────────┘ │
                                                  │                   │
                                                  │  MongoDB (users   │
                                                  │   + projects)     │
                                                  └──────────────────┘
```

Each user's container has `/workspace` bind-mounted to `server/user-data/<userId>/workspace/` on the host, so files persist across sessions. Project metadata is stored in MongoDB.

---

## 📋 Prerequisites

- **Node.js** v18+
- **Docker Desktop** (running)
- **MongoDB** (local or Atlas)
- **Ubuntu 22.04 image** — `docker pull ubuntu:22.04`

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/Amit00008/felix.it
cd felix.it

# Configure environment
cp server/.env.example server/.env
cp client/.env.example client/.env
# Edit server/.env with your MONGO_URI and JWT_SECRET

# Pull Docker image
docker pull ubuntu:22.04

# Start server
cd server && npm install && node index.js

# Start client (new terminal)
cd client && npm install && npm run dev
```

Open `http://localhost:5173` in your browser.

### Environment Variables

**Server** (`server/.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/felix` |
| `JWT_SECRET` | Secret key for JWT tokens | *(required)* |
| `PORT` | Server port | `4001` |
| `DOCKER_HOST` | Docker API endpoint (optional) | Auto-detected |

**Client** (`client/.env`):

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Server API URL | `http://localhost:4001` |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Monaco Editor, xterm.js, Socket.io Client |
| Backend | Node.js, Express, Socket.io, dockerode |
| Containers | Docker — Ubuntu 22.04 per user |
| Database | MongoDB + Mongoose (users, projects) |
| Auth | JWT (jsonwebtoken) |
| File Watching | chokidar |

---

## 📁 Project Structure

```
felix.it/
├── client/                    # React frontend (Vite)
│   ├── .env.example
│   └── src/
│       ├── components/
│       │   ├── IDE.jsx        # Main VS Code-like layout
│       │   ├── Dashboard.jsx  # Project selector + tool installer
│       │   ├── FileExplorer.jsx
│       │   ├── EditorPanel.jsx
│       │   ├── TerminalPanel.jsx  # Multi-tab + split terminals
│       │   ├── SearchPanel.jsx
│       │   ├── Sidebar.jsx
│       │   ├── ActivityBar.jsx
│       │   ├── TabBar.jsx
│       │   ├── StatusBar.jsx
│       │   ├── ContextMenu.jsx
│       │   ├── Login.jsx
│       │   └── Signup.jsx
│       └── context/
│           └── IDEContext.jsx  # Global IDE state
├── server/
│   ├── index.js               # Express + Socket.io + Docker
│   ├── models/
│   │   ├── User.js            # Mongoose user model
│   │   └── Project.js         # Mongoose project model
│   ├── .env.example
│   └── user-data/             # Per-user workspace storage (auto-created)
└── readme.md
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'Add my feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Open a pull request

## 📄 License

This project is licensed under the MIT License.
