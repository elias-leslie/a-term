# SummitFlow Terminal

Web-based terminal service with tmux-backed persistent sessions, multi-pane layouts, configurable CLI agent integrations, and a built-in maintenance loop.

**Terminal is a standalone product.** It starts and runs independently — no other SummitFlow service is required. SummitFlow and Agent Hub integrations are optional and degrade gracefully when unavailable.

## Overview

SummitFlow Terminal provides browser-accessible terminal sessions backed by tmux for persistence. It supports multiple panes with split layouts, project-scoped working directories, and dual-mode operation (shell plus the configured default agent tool). Sessions survive browser disconnects, are reconciled with tmux state on startup and on a recurring maintenance interval, and expose maintenance status through `/health`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI, Python 3.13+, Uvicorn |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Terminal | xterm.js 6 (rendering), tmux (session persistence) |
| Database | PostgreSQL (own schema; can be a dedicated database) |
| Quality | Ruff, Ty, pytest, Vitest, Biome |

## Architecture

```
terminal/
├── terminal/              # FastAPI backend
│   ├── api/               # REST + WebSocket endpoints
│   │   ├── terminal.py    # WebSocket terminal I/O
│   │   ├── sessions.py    # Session CRUD
│   │   ├── panes.py       # Pane management
│   │   ├── projects.py    # Project settings
│   │   └── agent.py       # Agent startup + state endpoints
│   ├── services/          # Business logic
│   │   ├── lifecycle.py       # Session lifecycle facade
│   │   ├── lifecycle_core.py  # Single-session operations
│   │   ├── lifecycle_batch.py # Multi-session batch ops
│   │   ├── lifecycle_reconcile.py  # DB/tmux sync + dead-session retention
│   │   ├── maintenance.py     # Periodic maintenance loop + status tracking
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
- **Dual mode** - Switch between shell and your configured agent tool per pane
- **Project context** - Open terminals in project-specific working directories
- **Project deep links** - Open `/?project=<id>&dir=<path>` to focus or create a project pane directly
- **Mobile keyboard** - On-screen keyboard for touch devices (simple-keyboard)
- **Periodic maintenance** - Reconciles tmux state, prunes stale uploads, repairs default agent-tool state, and deletes orphaned project settings
- **Maintenance observability** - `/health`, `/api/internal/maintenance/runs`, and `scripts/status.sh` report maintenance state and recent persisted runs
- **Scrollback capture** - Retrieves terminal history when reconnecting
- **Real-time resize** - Terminal dimensions sync between browser and tmux

## Standalone Usage and Optional Integrations

Terminal requires only PostgreSQL and tmux. It has no hard dependency on any other service.

### Standalone (default)

All core features work without SummitFlow or Agent Hub: persistent tmux sessions, multi-pane layouts, shell/agent mode switching, project settings, maintenance, and the full REST/WebSocket API. When no external service is reachable, the project list is populated from local `terminal_project_settings` only.

### Optional: SummitFlow API (`SUMMITFLOW_API_BASE`)

When the SummitFlow backend is available at `SUMMITFLOW_API_BASE` (default `http://localhost:8001/api`), Terminal fetches project metadata (name, root path) and merges it with local terminal settings. This enriches the project list and enables features like opening terminals in project-specific working directories by name. If the SummitFlow API is unreachable, the client returns an empty list and Terminal continues with local data only (`summitflow_client.py` catches all connection/timeout errors).

### Optional: Agent Hub (`NEXT_PUBLIC_AGENT_HUB_URL`)

When `NEXT_PUBLIC_AGENT_HUB_URL` is set (default port 8003), the frontend gains:

- **Model catalog** — fetches available Claude models from Agent Hub's `/api/models` endpoint for the model-switcher control bar. Falls back to a built-in Haiku/Sonnet/Opus list when unavailable.
- **Voice transcription** — connects to Agent Hub's voice WebSocket (`/api/voice/ws`) for speech-to-text input via `@agent-hub/passport-client`. Disabled when Agent Hub is unreachable.
- **Prompt cleaning** — uses the model catalog to select a model for cleaning voice-transcribed prompts before sending to the terminal.

All Agent Hub features are guarded by the environment variable and fail gracefully.

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
db migrate upgrade

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

Runtime settings are read from `~/.env.local` by default. Use
[`.env.example`](.env.example) as the placeholder reference for local setup.
Only `DATABASE_URL` is required; the rest are optional overrides.

```bash
# Required
DATABASE_URL=postgresql://user:pass@localhost/terminal

# Optional integrations (Terminal works without these)
SUMMITFLOW_API_BASE=http://localhost:8001/api       # SummitFlow project metadata
NEXT_PUBLIC_AGENT_HUB_URL=http://localhost:8003     # Agent Hub models + voice

# Optional tuning
LOG_LEVEL=INFO
MAINTENANCE_INTERVAL_SECONDS=900
MAINTENANCE_SESSION_PURGE_DAYS=7
UPLOAD_MAX_AGE_SECONDS=86400
```

## API

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check plus maintenance status payload |
| GET | `/api/internal/maintenance` | Internal maintenance status (requires internal bearer token) |
| GET | `/api/internal/maintenance/runs` | Recent persisted maintenance runs (requires internal bearer token) |
| POST | `/api/internal/maintenance/run` | Trigger one maintenance cycle (requires internal bearer token) |
| GET | `/api/terminal/sessions` | List sessions |
| GET | `/api/terminal/sessions/{id}` | Get session |
| PATCH | `/api/terminal/sessions/{id}` | Update session |
| DELETE | `/api/terminal/sessions/{id}` | Delete session |
| GET | `/api/terminal/panes` | List panes |
| POST | `/api/terminal/panes` | Create pane (max 6) |
| PATCH | `/api/terminal/panes/{id}` | Update pane |
| DELETE | `/api/terminal/panes/{id}` | Delete pane |
| GET | `/api/terminal/projects` | List project settings (merged with SummitFlow projects when available) |
| PUT | `/api/terminal/project-settings/{id}` | Update project settings |
| PUT | `/api/terminal/projects/{id}/mode` | Set shell/agent mode |
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

Primary service tables: `terminal_sessions` (session state, mode, alive tracking), `terminal_panes` (pane layout and ordering), `terminal_project_settings` (per-project mode and enabled state), `agent_tools` (configured CLI agent integrations), and `terminal_maintenance_runs` (append-only maintenance audit trail). Schema is managed via Alembic migrations, with maintenance-focused indexes for session retention and project/mode lookups.

## Services

Managed via systemd user services:

```bash
scripts/start.sh      # Start services
scripts/restart.sh    # Restart services
scripts/status.sh     # Check status
scripts/shutdown.sh   # Stop services
```

`scripts/status.sh` now shows backend health plus maintenance state, last successful maintenance run, and the persisted run ID.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Security

Please report suspected vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).

## Commercial

Commercial use is permitted under the Apache 2.0 license.

For commercial support, custom work, partnership discussions, or private
licensing for future versions, start a thread in
[GitHub Discussions](https://github.com/summitflow-solutions/terminal/discussions).
