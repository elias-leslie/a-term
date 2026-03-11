#!/bin/bash
# Check Terminal service status

echo "================================"
echo "Terminal Service Status"
echo "================================"
echo ""

echo "Service Status (User Mode):"
echo "  Backend:  $(systemctl --user is-active summitflow-terminal.service 2>/dev/null && echo 'Running' || echo 'Stopped')"
echo "  Frontend: $(systemctl --user is-active summitflow-terminal-frontend.service 2>/dev/null && echo 'Running' || echo 'Stopped')"
echo ""

echo "Port Status:"
echo "  Backend:  $(ss -tlnp 2>/dev/null | grep -q ':8002' && echo 'Port 8002 bound' || echo 'Port 8002 not bound')"
echo "  Frontend: $(ss -tlnp 2>/dev/null | grep -q ':3002' && echo 'Port 3002 bound' || echo 'Port 3002 not bound')"
echo ""

echo "Health Check:"
HEALTH_JSON=$(curl -s http://localhost:8002/health 2>/dev/null || echo "")
BACKEND_HEALTH=$(printf '%s' "$HEALTH_JSON" | jq -r '.status' 2>/dev/null || echo "unreachable")
MAINTENANCE_STATE=$(printf '%s' "$HEALTH_JSON" | jq -r '.maintenance.state // "unknown"' 2>/dev/null || echo "unknown")
MAINTENANCE_LAST_SUCCESS=$(printf '%s' "$HEALTH_JSON" | jq -r '.maintenance.last_success_at // "never"' 2>/dev/null || echo "never")
echo "  Backend:  $BACKEND_HEALTH"
echo "  Maint:    $MAINTENANCE_STATE"
echo "  Last OK:  $MAINTENANCE_LAST_SUCCESS"
echo ""

echo "URLs:"
echo "  Local Backend:  http://localhost:8002"
echo "  Local Frontend: http://localhost:3002"
echo "  Production:     https://terminal.summitflow.dev"
echo ""
