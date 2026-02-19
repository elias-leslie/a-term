#!/usr/bin/env bash
# =============================================================================
# LAN-Local Reverse Proxy Setup for *.summitflow.dev
#
# Run with: sudo bash ~/terminal/scripts/setup-caddy-lan-proxy.sh
#
# What this does:
#   1. Installs Go (if needed)
#   2. Builds Caddy with Cloudflare DNS plugin (via xcaddy)
#   3. Creates /etc/caddy/Caddyfile mirroring cloudflared ingress rules
#   4. Creates systemd service for Caddy
#   5. Prompts for Cloudflare API token
#   6. Starts Caddy
#
# After running this script, you still need to:
#   - Configure router DNS override (see setup-router-dns.sh)
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Must run as root
[[ $EUID -eq 0 ]] || error "This script must be run as root (sudo)"

REAL_USER="${SUDO_USER:-kasadis}"
REAL_HOME=$(eval echo "~$REAL_USER")

# ─── Step 1: Install Go ─────────────────────────────────────────────────────

if command -v go &>/dev/null; then
    info "Go already installed: $(go version)"
else
    info "Installing Go..."
    apt-get update -qq
    apt-get install -y -qq golang-go
    info "Go installed: $(go version)"
fi

# ─── Step 2: Build Caddy with Cloudflare DNS plugin ─────────────────────────

if [[ -f /usr/local/bin/caddy ]] && /usr/local/bin/caddy list-modules 2>/dev/null | grep -q cloudflare; then
    info "Caddy with Cloudflare plugin already installed"
else
    info "Installing xcaddy..."
    sudo -u "$REAL_USER" bash -c 'export GOPATH=$HOME/go && export PATH=$PATH:$GOPATH/bin && go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest'

    info "Building Caddy with Cloudflare DNS plugin (this takes ~1-2 minutes)..."
    BUILD_DIR=$(sudo -u "$REAL_USER" mktemp -d)
    sudo -u "$REAL_USER" bash -c "export GOPATH=$REAL_HOME/go && export PATH=\$PATH:\$GOPATH/bin && cd $BUILD_DIR && xcaddy build --with github.com/caddy-dns/cloudflare"

    mv "$BUILD_DIR/caddy" /usr/local/bin/caddy
    chmod 755 /usr/local/bin/caddy
    setcap cap_net_bind_service=+ep /usr/local/bin/caddy
    rm -rf "$BUILD_DIR"

    info "Caddy built and installed to /usr/local/bin/caddy"
    /usr/local/bin/caddy version
fi

# ─── Step 3: Create Caddyfile ────────────────────────────────────────────────

info "Writing /etc/caddy/Caddyfile..."
mkdir -p /etc/caddy

cat > /etc/caddy/Caddyfile << 'CADDYFILE'
{
    email kasadis@summitflow.dev
}

*.summitflow.dev {
    tls {
        dns cloudflare {env.CLOUDFLARE_API_TOKEN}
    }

    @terminal host terminal.summitflow.dev
    handle @terminal {
        reverse_proxy localhost:3002
    }

    @terminalapi host terminalapi.summitflow.dev
    handle @terminalapi {
        reverse_proxy localhost:8002
    }

    @dev host dev.summitflow.dev
    handle @dev {
        reverse_proxy localhost:3001
    }

    @devapi host devapi.summitflow.dev
    handle @devapi {
        reverse_proxy localhost:8001
    }

    @port host port.summitflow.dev
    handle @port {
        reverse_proxy localhost:3000
    }

    @portapi host portapi.summitflow.dev
    handle @portapi {
        reverse_proxy localhost:8000
    }

    @agent host agent.summitflow.dev
    handle @agent {
        reverse_proxy localhost:3003
    }

    @agentapi host agentapi.summitflow.dev
    handle @agentapi {
        reverse_proxy localhost:8003
    }

    @ntfy host ntfy.summitflow.dev
    handle @ntfy {
        reverse_proxy localhost:2586
    }

    @test1 host test1.summitflow.dev
    handle @test1 {
        reverse_proxy localhost:4001
    }

    @test1api host test1api.summitflow.dev
    handle @test1api {
        reverse_proxy localhost:9001
    }

    @test2 host test2.summitflow.dev
    handle @test2 {
        reverse_proxy localhost:4002
    }

    @test2api host test2api.summitflow.dev
    handle @test2api {
        reverse_proxy localhost:9002
    }

    @test3 host test3.summitflow.dev
    handle @test3 {
        reverse_proxy localhost:4003
    }

    @test3api host test3api.summitflow.dev
    handle @test3api {
        reverse_proxy localhost:9003
    }

    handle {
        respond "Not Found" 404
    }
}
CADDYFILE

info "Caddyfile written"

# ─── Step 4: Set up Cloudflare API token ─────────────────────────────────────

if [[ -f /etc/caddy/env ]] && grep -q 'CLOUDFLARE_API_TOKEN=' /etc/caddy/env; then
    info "Cloudflare API token already configured in /etc/caddy/env"
else
    echo ""
    echo "═══════════════════════════════════════════════════════════════════"
    echo "  Cloudflare API Token Required"
    echo "═══════════════════════════════════════════════════════════════════"
    echo ""
    echo "  Create a token at: https://dash.cloudflare.com/profile/api-tokens"
    echo "  Permissions: Zone > DNS > Edit"
    echo "  Zone: summitflow.dev only"
    echo ""
    read -rp "  Enter your Cloudflare API token: " CF_TOKEN

    if [[ -z "$CF_TOKEN" ]]; then
        error "No token provided. You can add it later to /etc/caddy/env"
    fi

    echo "CLOUDFLARE_API_TOKEN=$CF_TOKEN" > /etc/caddy/env
    chmod 600 /etc/caddy/env
    info "Token saved to /etc/caddy/env (mode 600)"
fi

# ─── Step 5: Create systemd service ─────────────────────────────────────────

info "Writing /etc/systemd/system/caddy.service..."

cat > /etc/systemd/system/caddy.service << 'SYSTEMD'
[Unit]
Description=Caddy LAN reverse proxy (summitflow.dev)
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
EnvironmentFile=/etc/caddy/env
Environment=XDG_DATA_HOME=/var/lib/caddy
ExecStart=/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --environ
ExecReload=/usr/local/bin/caddy reload --config /etc/caddy/Caddyfile --force
TimeoutStopSec=5s
Restart=on-failure
RestartSec=5s
AmbientCapabilities=CAP_NET_BIND_SERVICE
ProtectSystem=full

[Install]
WantedBy=multi-user.target
SYSTEMD

mkdir -p /var/lib/caddy
systemctl daemon-reload

info "Systemd service created"

# ─── Step 6: Start Caddy ────────────────────────────────────────────────────

info "Enabling and starting Caddy..."
systemctl enable caddy
systemctl restart caddy

sleep 2

if systemctl is-active --quiet caddy; then
    info "Caddy is running!"
    systemctl status caddy --no-pager -l | head -15
else
    error "Caddy failed to start. Check: journalctl -u caddy -n 50"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Caddy LAN proxy is running!"
echo ""
echo "  Next steps:"
echo "    1. Configure router DNS: bash ~/terminal/scripts/setup-router-dns.sh"
echo "    2. Verify: dig terminal.summitflow.dev +short"
echo "═══════════════════════════════════════════════════════════════════"
