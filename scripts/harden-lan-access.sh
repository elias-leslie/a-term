#!/usr/bin/env bash
# Harden LAN access: remove direct backend API routes from Caddy and restart services.
#
# What this does:
#   1. Removes *api reverse proxy blocks from Caddyfile (terminalapi, devapi, portapi, agentapi)
#   2. Reloads Caddy
#   3. Reloads systemd user daemon (picks up unit file changes for summitflow/portfolio backends)
#   4. Restarts affected backend services
#
# After this, all backend APIs are only reachable via localhost.
# LAN traffic flows: Caddy -> frontend (Next.js) -> localhost:backend
# Internet traffic flows: Cloudflare Tunnel -> localhost:backend (unchanged)
#
# Requires: sudo (for Caddyfile edit + Caddy reload)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo "================================"
echo "LAN Access Hardening"
echo "================================"
echo ""

# --- Step 1: Remove *api blocks from Caddyfile ---
echo -e "${YELLOW}Step 1: Removing *api routes from Caddyfile...${NC}"

CADDYFILE="/etc/caddy/Caddyfile"

# Verify the entries exist before modifying
for subdomain in terminalapi devapi portapi agentapi; do
    if ! grep -q "@${subdomain} host ${subdomain}.summitflow.dev" "$CADDYFILE"; then
        echo -e "  ${YELLOW}${subdomain} entry not found (already removed?)${NC}"
    fi
done

# Remove each *api block (matcher line + brace-delimited handle block).
# Uses awk to track brace depth so blocks with any line count are removed correctly.
remove_caddy_block() {
    local pattern="$1"
    local file="$2"
    sudo awk -v pat="$pattern" '
        found {
            for (i = 1; i <= length($0); i++) {
                c = substr($0, i, 1)
                if (c == "{") depth++
                else if (c == "}") {
                    depth--
                    if (depth == 0) { found = 0; next }
                }
            }
            next
        }
        index($0, pat) {
            found = 1
            depth = 0
            for (i = 1; i <= length($0); i++) {
                c = substr($0, i, 1)
                if (c == "{") depth++
                else if (c == "}") depth--
            }
            if (depth == 0) found = 0
            next
        }
        { print }
    ' "$file" | sudo tee "${file}.tmp" > /dev/null && sudo mv "${file}.tmp" "$file"
}

remove_caddy_block "@terminalapi host terminalapi.summitflow.dev" "$CADDYFILE"
remove_caddy_block "@devapi host devapi.summitflow.dev" "$CADDYFILE"
remove_caddy_block "@portapi host portapi.summitflow.dev" "$CADDYFILE"
remove_caddy_block "@agentapi host agentapi.summitflow.dev" "$CADDYFILE"

# Clean up any resulting double blank lines
sudo sed -i '/^$/N;/^\n$/d' "$CADDYFILE"

echo -e "  ${GREEN}Caddyfile updated${NC}"

# Verify removal
for subdomain in terminalapi devapi portapi agentapi; do
    if grep -q "${subdomain}.summitflow.dev" "$CADDYFILE"; then
        echo -e "  ${RED}WARNING: ${subdomain} still present in Caddyfile!${NC}"
    fi
done

# --- Step 2: Validate and reload Caddy ---
echo -e "${YELLOW}Step 2: Validating and reloading Caddy...${NC}"

if sudo caddy validate --config "$CADDYFILE" --adapter caddyfile 2>/dev/null; then
    sudo systemctl reload caddy
    echo -e "  ${GREEN}Caddy reloaded${NC}"
else
    echo -e "  ${RED}Caddy config validation failed! Check ${CADDYFILE}${NC}"
    exit 1
fi

# --- Step 3: Reload systemd user daemon ---
echo -e "${YELLOW}Step 3: Reloading systemd user daemon...${NC}"
systemctl --user daemon-reload
echo -e "  ${GREEN}Daemon reloaded${NC}"

# --- Step 4: Restart backend services ---
echo -e "${YELLOW}Step 4: Restarting backend services...${NC}"

for service in summitflow-backend portfolio-backend; do
    systemctl --user restart "$service"
    sleep 2
    if systemctl --user is-active --quiet "$service"; then
        echo -e "  ${GREEN}${service}: restarted${NC}"
    else
        echo -e "  ${RED}${service}: failed to restart!${NC}"
        journalctl --user -u "$service" --no-pager -n 5
    fi
done

# Agent Hub uses config.py (not systemd unit), so restart it too
for service in agent-hub-backend; do
    if systemctl --user is-active --quiet "$service"; then
        systemctl --user restart "$service"
        sleep 2
        if systemctl --user is-active --quiet "$service"; then
            echo -e "  ${GREEN}${service}: restarted${NC}"
        else
            echo -e "  ${RED}${service}: failed to restart!${NC}"
            journalctl --user -u "$service" --no-pager -n 5
        fi
    else
        echo -e "  ${YELLOW}${service}: not running (skipped)${NC}"
    fi
done

# --- Step 5: Verify backends are localhost-only ---
echo ""
echo -e "${YELLOW}Step 5: Verifying backend bindings...${NC}"

for port in 8000 8001 8002 8003; do
    binding=$(ss -tlnp "sport = :$port" 2>/dev/null | grep -oP '\S+:'"$port" | head -1)
    # Normalize: strip surrounding square brackets so [::1]:port becomes ::1:port
    normalized="${binding#[}"
    normalized="${normalized/\]:/:}"
    if [[ "$normalized" == "127.0.0.1:$port" ]] || [[ "$normalized" == "::1:$port" ]]; then
        echo -e "  ${GREEN}Port $port: localhost only${NC}"
    elif [[ -z "$binding" ]]; then
        echo -e "  ${YELLOW}Port $port: not listening (service may not be running)${NC}"
    else
        echo -e "  ${RED}Port $port: $binding (still exposed!)${NC}"
    fi
done

echo ""
echo -e "${GREEN}Done. All backend APIs now only accessible via localhost.${NC}"
echo "LAN access goes through: Caddy -> frontend -> localhost:backend"
echo "Internet access unchanged: Cloudflare Tunnel -> localhost:backend"
