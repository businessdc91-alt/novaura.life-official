#!/usr/bin/env bash
# NovAura Sovereign server: mesh relay + TURN server for calls, on Ubuntu 22.04/24.04
# (Oracle Cloud Always Free, or any Linux VPS with a public IP).
#
#   sudo bash deploy/setup-server.sh [--public-ip X.X.X.X] [--relay-port 43889]
#
# Run it from the uploaded relay folder. Safe to re-run after updating the relay
# source: it rebuilds, restarts, and keeps the existing TURN secret.
set -euo pipefail

RELAY_PORT=43889
TURN_PORT=3478
MEDIA_MIN_PORT=49152
MEDIA_MAX_PORT=50151
PUBLIC_IP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --public-ip) PUBLIC_IP="$2"; shift 2 ;;
    --relay-port) RELAY_PORT="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo." >&2; exit 1; }
SRC="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$SRC/Cargo.toml" ] || { echo "Run this from the relay folder: sudo bash deploy/setup-server.sh" >&2; exit 1; }

step() { printf '\n==> %s\n' "$*"; }

# ---- Addresses -------------------------------------------------------------
PRIVATE_IP="$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="$(curl -4 -fsS --max-time 8 https://ifconfig.me || curl -4 -fsS --max-time 8 https://api.ipify.org || true)"
fi
[[ "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Could not detect the public IP. Pass --public-ip X.X.X.X" >&2; exit 1; }
echo "Public IP:  $PUBLIC_IP"
echo "Private IP: $PRIVATE_IP"

# ---- Packages --------------------------------------------------------------
step "Installing packages"
export DEBIAN_FRONTEND=noninteractive
echo "iptables-persistent iptables-persistent/autosave_v4 boolean true" | debconf-set-selections
echo "iptables-persistent iptables-persistent/autosave_v6 boolean true" | debconf-set-selections
apt-get update -q
apt-get install -y -q build-essential pkg-config curl openssl coturn
# iptables-persistent keeps the firewall rules across reboots. It conflicts with
# ufw, so it is only installed when ufw is not in charge.
if ! (command -v ufw >/dev/null && ufw status | grep -q 'Status: active'); then
  apt-get install -y -q iptables-persistent
fi

# Building with LTO needs more memory than the 1 GB machines have.
MEM_MB="$(awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo)"
if [ "$MEM_MB" -lt 2000 ] && [ -z "$(swapon --show --noheadings)" ]; then
  step "Adding 2 GB swap (only ${MEM_MB} MB RAM)"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---- Build the relay -------------------------------------------------------
step "Building the relay"
export RUSTUP_HOME=/opt/rust/rustup CARGO_HOME=/opt/rust/cargo
export PATH="$CARGO_HOME/bin:$PATH"
if ! command -v cargo >/dev/null; then
  curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --no-modify-path
fi
cargo build --release --manifest-path "$SRC/Cargo.toml" --target-dir /opt/novaura/build
install -m 755 /opt/novaura/build/release/novaura_relay /usr/local/bin/novaura_relay

id novaura >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin novaura

# ---- Shared TURN secret ----------------------------------------------------
# The relay signs short-lived TURN logins with this secret; coturn checks them
# with the same secret. Kept on re-runs so existing logins stay valid.
step "Writing /etc/novaura/relay.env"
mkdir -p /etc/novaura
ENV_FILE=/etc/novaura/relay.env
SECRET=""
if [ -f "$ENV_FILE" ]; then
  SECRET="$(sed -n 's/^NOVAURA_TURN_SECRET=//p' "$ENV_FILE" | head -n 1)"
fi
[ -n "$SECRET" ] || SECRET="$(openssl rand -hex 32)"
TURN_URLS="turn:${PUBLIC_IP}:${TURN_PORT}?transport=udp,turn:${PUBLIC_IP}:${TURN_PORT}?transport=tcp"
{
  # Keep any settings added by hand; only the two managed keys are rewritten.
  [ -f "$ENV_FILE" ] && grep -v -E '^(NOVAURA_TURN_SECRET|NOVAURA_TURN_URLS)=' "$ENV_FILE" || true
  echo "NOVAURA_TURN_SECRET=${SECRET}"
  echo "NOVAURA_TURN_URLS=${TURN_URLS}"
} > "$ENV_FILE.new"
mv "$ENV_FILE.new" "$ENV_FILE"
chown root:novaura "$ENV_FILE"
chmod 640 "$ENV_FILE"

# ---- coturn ----------------------------------------------------------------
step "Configuring the TURN server (coturn)"
if [ -f /etc/turnserver.conf ] && ! grep -q 'Managed by NovAura' /etc/turnserver.conf; then
  cp /etc/turnserver.conf /etc/turnserver.conf.orig
fi
cat > /etc/turnserver.conf <<EOF
# Managed by NovAura deploy/setup-server.sh (re-running it rewrites this file).
listening-port=${TURN_PORT}
# Cloud machines sit behind 1:1 NAT: advertise the public IP, bind the private one.
external-ip=${PUBLIC_IP}/${PRIVATE_IP}
min-port=${MEDIA_MIN_PORT}
max-port=${MEDIA_MAX_PORT}
fingerprint
use-auth-secret
static-auth-secret=${SECRET}
realm=novaura.sovereign
no-tls
no-dtls
no-cli
no-multicast-peers
syslog
user-quota=12
total-quota=1200
stale-nonce=600
# Media may only flow to public addresses, never into this machine's private
# network or the cloud metadata service...
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=224.0.0.0-255.255.255.255
denied-peer-ip=::1
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
# ...except this server itself, so two callers who both need TURN can meet here.
allowed-peer-ip=${PRIVATE_IP}
EOF
if getent group turnserver >/dev/null; then
  chown root:turnserver /etc/turnserver.conf
  chmod 640 /etc/turnserver.conf
fi
[ -f /etc/default/coturn ] && sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn

# ---- Relay service ---------------------------------------------------------
step "Installing the novaura-relay service"
cat > /etc/systemd/system/novaura-relay.service <<EOF
[Unit]
Description=NovAura Sovereign mesh relay
After=network-online.target
Wants=network-online.target

[Service]
User=novaura
Group=novaura
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/local/bin/novaura_relay --port ${RELAY_PORT}
Restart=always
RestartSec=3
LimitNOFILE=8192
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
EOF

# ---- Firewall --------------------------------------------------------------
# Oracle's Ubuntu images ship iptables rules that reject everything except SSH,
# on top of the cloud security list. Both must allow these ports.
step "Opening firewall ports"
open_port() { # proto port-or-range(a:b)
  if command -v ufw >/dev/null && ufw status | grep -q 'Status: active'; then
    ufw allow "$2/$1"
  elif ! iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null; then
    iptables -I INPUT -p "$1" --dport "$2" -j ACCEPT
  fi
}
open_port tcp "$RELAY_PORT"
open_port tcp "$TURN_PORT"
open_port udp "$TURN_PORT"
open_port udp "${MEDIA_MIN_PORT}:${MEDIA_MAX_PORT}"
command -v netfilter-persistent >/dev/null && netfilter-persistent save >/dev/null

# ---- Start -----------------------------------------------------------------
step "Starting services"
systemctl daemon-reload
systemctl enable novaura-relay coturn >/dev/null
systemctl restart novaura-relay coturn
sleep 2

fail=0
check() { if eval "$2" >/dev/null 2>&1; then echo "  ok    $1"; else echo "  FAIL  $1"; fail=1; fi; }
check "relay service running"     "systemctl is-active --quiet novaura-relay"
check "TURN service running"      "systemctl is-active --quiet coturn"
check "relay listening on TCP ${RELAY_PORT}" "ss -ltn | grep -q ':${RELAY_PORT} '"
check "TURN listening on UDP ${TURN_PORT}"   "ss -lun | grep -q ':${TURN_PORT} '"
check "relay issuing TURN logins" "journalctl -u novaura-relay -n 50 --no-pager | grep -q 'TURN credentials: turn:'"

cat <<EOF

────────────────────────────────────────────────────────────────────
 Relay address for Sovereign (Peering window → Relay tab):

     ${PUBLIC_IP}:${RELAY_PORT}

 Oracle Cloud only: also add these Ingress Rules (source 0.0.0.0/0) to the
 VCN security list (Networking → Virtual cloud networks → your VCN →
 Security Lists → Default Security List):
     TCP  ${RELAY_PORT}              mesh relay
     TCP  ${TURN_PORT}               TURN
     UDP  ${TURN_PORT}               TURN
     UDP  ${MEDIA_MIN_PORT}-${MEDIA_MAX_PORT}       call media

 Logs:  journalctl -u novaura-relay -f      journalctl -u coturn -f
────────────────────────────────────────────────────────────────────
EOF
exit "$fail"
