#!/usr/bin/env bash
# =============================================================================
# Router DNS Override for *.summitflow.dev → LAN
#
# Run with: bash ~/terminal/scripts/setup-router-dns.sh
#
# Prerequisites:
#   - SSH access to router (root@$ROUTER_IP)
#   - Run setup-caddy-lan-proxy.sh first
#
# Environment variables (with defaults):
#   LAN_IP      — LAN address of this machine (default: 192.168.1.100)
#   ROUTER_IP   — Router address (default: 192.168.1.1)
# =============================================================================

set -euo pipefail

LAN_IP="${LAN_IP:-192.168.1.100}"
ROUTER_IP="${ROUTER_IP:-192.168.1.1}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

ROUTER="router"

# ─── Step 1: Ensure SSH config for router ────────────────────────────────────

if ! grep -q 'Host router' ~/.ssh/config 2>/dev/null; then
    info "Adding router to ~/.ssh/config..."
    cat >> ~/.ssh/config << SSH

Host router glinet
  HostName $ROUTER_IP
  User root
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
SSH
    info "SSH config updated"
else
    info "Router already in SSH config"
fi

# ─── Step 2: Test SSH access ────────────────────────────────────────────────

info "Testing SSH access to router..."
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$ROUTER" 'echo ok' &>/dev/null; then
    echo ""
    warn "Cannot connect to router with key-based auth."
    echo "  Run: ssh-copy-id -i ~/.ssh/id_ed25519.pub root@$ROUTER_IP"
    echo "  Then re-run this script."
    echo ""
    read -rp "Try ssh-copy-id now? [y/N] " COPY
    if [[ "$COPY" =~ ^[Yy] ]]; then
        ssh-copy-id -i ~/.ssh/id_ed25519.pub root@"$ROUTER_IP"
    else
        error "SSH access required. Set up key auth first."
    fi
fi

info "SSH access confirmed"

# ─── Step 3: Add dnsmasq override ───────────────────────────────────────────

info "Configuring dnsmasq on router..."

ssh "$ROUTER" sh -s "$LAN_IP" << 'REMOTE'
LAN_IP="$1"
CONF="/etc/dnsmasq.d/summitflow-lan.conf"

mkdir -p /etc/dnsmasq.d

# Check if dnsmasq.d is included in main config
if ! grep -q 'conf-dir=/etc/dnsmasq.d' /etc/dnsmasq.conf 2>/dev/null; then
    # OpenWrt uses /tmp/dnsmasq.d by default, check UCI
    if uci get dhcp.@dnsmasq[0].confdir 2>/dev/null | grep -q dnsmasq.d; then
        echo "dnsmasq.d already configured via UCI"
    else
        echo "Adding conf-dir to dnsmasq..."
        uci set dhcp.@dnsmasq[0].confdir='/etc/dnsmasq.d'
        uci commit dhcp
    fi
fi

echo "address=/summitflow.dev/$LAN_IP" > "$CONF"
echo "Written: $(cat $CONF)"
REMOTE

info "dnsmasq override added: *.summitflow.dev → $LAN_IP"

# ─── Step 4: Check DHCP DNS configuration ───────────────────────────────────

info "Checking DHCP DNS configuration..."

DHCP_DNS=$(ssh "$ROUTER" "uci get 'dhcp.@dnsmasq[0].server' 2>/dev/null || echo 'not set'")
LAN_DNS=$(ssh "$ROUTER" "uci get network.lan.dns 2>/dev/null || echo 'not set'")
DHCP_OPTION=$(ssh "$ROUTER" "uci show dhcp.lan.dhcp_option 2>/dev/null || echo 'not set'")

echo "  Current upstream DNS: $DHCP_DNS"
echo "  LAN DNS setting:     $LAN_DNS"
echo "  DHCP options:        $DHCP_OPTION"

# Check if DHCP is pushing external DNS directly to clients
if echo "$DHCP_OPTION" | grep -qE '6,.*208\.67|6,.*1\.1\.1|6,.*8\.8\.8'; then
    warn "DHCP is pushing external DNS directly to clients!"
    warn "This bypasses dnsmasq. Clients won't see our override."
    echo ""
    echo "  Fix: Remove dhcp_option 6 so router ($ROUTER_IP) is the DNS server."
    echo "  The router's dnsmasq will forward to upstream DNS for non-overridden domains."
    echo ""
    read -rp "  Fix DHCP DNS config now? [y/N] " FIX
    if [[ "$FIX" =~ ^[Yy] ]]; then
        ssh "$ROUTER" sh << 'FIXDNS'
# Remove DHCP option that pushes external DNS to clients
uci delete dhcp.lan.dhcp_option 2>/dev/null || true
uci commit dhcp
echo "DHCP option removed. Router dnsmasq will be the DNS server."
FIXDNS
        info "DHCP DNS config fixed"
    fi
fi

# ─── Step 5: Restart dnsmasq ────────────────────────────────────────────────

info "Restarting dnsmasq on router..."
ssh "$ROUTER" '/etc/init.d/dnsmasq restart'
sleep 2

# ─── Step 6: Verify DNS on router ───────────────────────────────────────────

info "Verifying DNS resolution on router..."
RESOLVED=$(ssh "$ROUTER" "nslookup terminal.summitflow.dev 127.0.0.1 2>/dev/null | grep -A1 'Name:' | grep 'Address' | head -1" || true)

if echo "$RESOLVED" | grep -q "$LAN_IP"; then
    info "Router resolves terminal.summitflow.dev → $LAN_IP"
else
    warn "Router DNS resolution check:"
    ssh "$ROUTER" "nslookup terminal.summitflow.dev 127.0.0.1" || true
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  Router DNS configured!"
echo ""
echo "  If DHCP was changed, renew your lease:"
echo "    sudo dhclient -r eno1 && sudo dhclient eno1"
echo ""
echo "  Verify from this machine:"
echo "    dig terminal.summitflow.dev +short    # expect: $LAN_IP"
echo "    curl -v https://terminal.summitflow.dev 2>&1 | grep issuer"
echo "═══════════════════════════════════════════════════════════════════"
