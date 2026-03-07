# SummitFlow Terminal

Web-based terminal service with tmux-backed persistent sessions, multi-pane layouts, and Claude Code integration.

## Overview

SummitFlow Terminal provides browser-accessible terminal sessions backed by tmux for persistence. It supports multiple panes with split layouts, project-scoped working directories, and dual-mode operation (shell and Claude Code). Sessions survive browser disconnects and are reconciled with tmux state on startup.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python 3.13+, Uvicorn |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Terminal | xterm.js 6 (rendering), tmux (session persistence) |
| Database | PostgreSQL (shared with SummitFlow) |
| Quality | Ruff, Mypy, pytest, Vitest, Biome |

## Architecture

```
terminal/
├── terminal/              # FastAPI backend
│   ├── api/               # REST + WebSocket endpoints
│   │   ├── terminal.py    # WebSocket terminal I/O
│   │   ├── sessions.py    # Session CRUD
│   │   ├── panes.py       # Pane management
│   │   ├── projects.py    # Project settings
│   │   └── claude.py      # Claude Code integration
│   ├── services/          # Business logic
│   │   ├── lifecycle.py       # Session lifecycle facade
│   │   ├── lifecycle_core.py  # Single-session operations
│   │   ├── lifecycle_batch.py # Multi-session batch ops
│   │   ├── lifecycle_reconcile.py  # DB/tmux sync on startup
│   │   ├── pty_manager.py     # Low-level PTY operations
│   │   └── pane_service.py    # Pane business logic
│   ├── storage/           # Database layer
│   └── utils/             # tmux utilities
├── frontend/
│   ├── app/               # Pages (App Router)
│   ├── components/        # React components
│   │   ├── Terminal.tsx       # xterm.js wrapper + WebSocket
│   │   ├── TerminalTabs.tsx   # Tab management
│   │   ├── pane-layouts/      # Split/grid layout components
│   │   └── keyboard/          # Mobile on-screen keyboard
│   └── lib/
│       ├── hooks/         # Custom React hooks
│       └── api/           # API client functions
├── alembic/               # Database migrations
└── scripts/               # Service management
```

## Key Features

- **Persistent sessions** - tmux-backed terminals survive browser disconnects and server restarts
- **Multi-pane layouts** - Up to 6 panes with resizable split views on wide desktops
- **Dual mode** - Switch between shell and Claude Code mode per pane
- **Project context** - Open terminals in project-specific working directories
- **Mobile keyboard** - On-screen keyboard for touch devices (simple-keyboard)
- **Session reconciliation** - Syncs database state with tmux on startup
- **Scrollback capture** - Retrieves terminal history when reconnecting
- **Real-time resize** - Terminal dimensions sync between browser and tmux

## Ports

| Service | Port |
|---------|------|
| Frontend (Next.js) | 3002 |
| Backend (FastAPI) | 8002 |

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 20+
- PostgreSQL
- tmux

### Backend

```bash
cd terminal
python -m venv .venv
source .venv/bin/activate
pip install -e .

# Run migrations
alembic upgrade head

# Start server
python -m terminal
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment

Database URL is read from `~/.env.local`:

```
DATABASE_URL=postgresql://user:pass@localhost/summitflow
```

## API

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/terminal/sessions` | List sessions |
| POST | `/api/terminal/sessions` | Create session |
| GET | `/api/terminal/sessions/{id}` | Get session |
| PATCH | `/api/terminal/sessions/{id}` | Update session |
| DELETE | `/api/terminal/sessions/{id}` | Delete session |
| GET | `/api/terminal/panes` | List panes |
| POST | `/api/terminal/panes` | Create pane (max 6) |
| PATCH | `/api/terminal/panes/{id}` | Update pane |
| DELETE | `/api/terminal/panes/{id}` | Delete pane |
| GET | `/api/terminal/projects/{id}` | Get project settings |
| PUT | `/api/terminal/projects/{id}` | Update project settings |
| PUT | `/api/terminal/projects/{id}/mode` | Set shell/claude mode |
| POST | `/api/terminal/projects/{id}/reset` | Reset project sessions |
| POST | `/api/terminal/projects/{id}/disable` | Disable terminal for project |

### WebSocket

`/ws/terminal/{session_id}` - Terminal I/O stream

| Message Type | Direction | Description |
|-------------|-----------|-------------|
| Text | Client → Server | Terminal input |
| JSON `{"resize": {cols, rows}}` | Client → Server | Resize terminal |
| JSON `{"refresh": true}` | Client → Server | Redraw terminal |
| Binary | Server → Client | Terminal output |

## Database

Three tables: `terminal_sessions` (session state, mode, alive tracking), `terminal_panes` (pane layout and ordering), `terminal_project_settings` (per-project mode and enabled state). Schema managed via Alembic migrations.

## Services

Managed via systemd user services:

```bash
scripts/start.sh      # Start services
scripts/restart.sh    # Restart services
scripts/status.sh     # Check status
scripts/shutdown.sh   # Stop services
```

## License

MIT
