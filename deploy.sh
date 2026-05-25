#!/usr/bin/env bash
# ============================================================================
# RentSure Homes — One-shot self-host deployment for Ubuntu 22.04 / 24.04 VPS
# ============================================================================
#
# Usage (run as root or with sudo):
#   sudo bash deploy.sh yourdomain.com [admin-email]
#
# The script is idempotent — safe to re-run.
# Re-running will re-install deps, rebuild the frontend, and reload services
# without losing data.
#
# What it does:
#   1.  Apt update + install system packages (nginx, python3.11, node 20, mongo, certbot)
#   2.  Install & start MongoDB 7
#   3.  Create the rentsure system user
#   4.  Set up Python venv + install backend requirements
#   5.  Generate backend/.env (prompts for missing secrets the first time)
#   6.  Generate frontend/.env with REACT_APP_BACKEND_URL=https://<domain>
#   7.  Build the React frontend (yarn build)
#   8.  Install + start systemd service: rentsure-backend
#   9.  Configure nginx reverse proxy (HTTP → HTTPS, /api → 127.0.0.1:8001)
#   10. Issue Let's Encrypt cert (HTTPS) via certbot
#   11. Install daily Mongo + uploads backup cron
# ============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Args & basics
# ---------------------------------------------------------------------------
DOMAIN="${1:-}"
ADMIN_EMAIL="${2:-admin@${DOMAIN}}"
APP_USER="rentsure"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
UPLOADS_DIR="${APP_DIR}/uploads"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
SERVICE_NAME="rentsure-backend"
DB_NAME="rentsure_prod"
ADMIN_LOGIN_PATH="/be729e-728geke/admin/login"   # private admin URL (matches frontend code)

if [[ -z "$DOMAIN" ]]; then
  echo "Usage: sudo bash deploy.sh yourdomain.com [admin-email]" >&2
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "Please run as root: sudo bash deploy.sh ${DOMAIN}" >&2
  exit 1
fi

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
ask()  { local var="$1" prompt="$2" default="${3:-}"; local cur; cur="${!var:-}"
         if [[ -n "$cur" ]]; then return; fi
         if [[ -n "$default" ]]; then
           read -rp "$prompt [$default]: " v; v="${v:-$default}"
         else
           read -rp "$prompt: " v
         fi
         printf -v "$var" '%s' "$v"; }

# ---------------------------------------------------------------------------
# 1. System packages
# ---------------------------------------------------------------------------
step "1/11 Installing system packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ufw build-essential ca-certificates gnupg lsb-release \
                   nginx python3.11 python3.11-venv python3-pip
ok "Base packages installed"

if ! command -v node >/dev/null || [[ "$(node --version 2>/dev/null | cut -c2-3)" -lt 18 ]]; then
  step "Installing Node.js 20 LTS + yarn…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  npm install -g yarn
fi
ok "Node $(node --version) / yarn $(yarn --version)"

ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true
ok "Firewall configured"

# ---------------------------------------------------------------------------
# 2. MongoDB 7
# ---------------------------------------------------------------------------
if ! command -v mongod >/dev/null; then
  step "2/11 Installing MongoDB 7…"
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor --yes
  echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] \
https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-7.0.list
  apt-get update -y
  apt-get install -y mongodb-org
fi
systemctl enable --now mongod
ok "MongoDB running: $(systemctl is-active mongod)"

# ---------------------------------------------------------------------------
# 3. App user + directories
# ---------------------------------------------------------------------------
step "3/11 Setting up user & directories…"
id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --shell /usr/sbin/nologin --home "$APP_DIR" "$APP_USER"
mkdir -p "$UPLOADS_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 750 "$UPLOADS_DIR"
ok "Owner: $APP_USER, uploads: $UPLOADS_DIR"

# ---------------------------------------------------------------------------
# 4. Python venv & backend deps
# ---------------------------------------------------------------------------
step "4/11 Installing backend Python deps…"
sudo -u "$APP_USER" python3.11 -m venv "$BACKEND_DIR/.venv"
sudo -u "$APP_USER" "$BACKEND_DIR/.venv/bin/pip" install --upgrade pip wheel
sudo -u "$APP_USER" "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
ok "Backend deps installed"

# ---------------------------------------------------------------------------
# 5. backend/.env
# ---------------------------------------------------------------------------
ENV_FILE="$BACKEND_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  step "5/11 First-time setup: generating backend/.env…"
  JWT_SECRET=$(openssl rand -hex 48)
  JWT_REFRESH_SECRET=$(openssl rand -hex 48)
  ask ADMIN_DEFAULT_PASSWORD "Choose an initial admin password (you can change later in the UI)"
  ask GOOGLE_MAPS_API_KEY "Google Maps Places API key (optional, press enter to skip)" ""
  cat > "$ENV_FILE" <<EOF
# --- Core ---
MONGO_URL=mongodb://localhost:27017
DB_NAME=${DB_NAME}
FRONTEND_URL=https://${DOMAIN}

# --- Auth ---
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ADMIN_DEFAULT_EMAIL=${ADMIN_EMAIL}
ADMIN_DEFAULT_PASSWORD=${ADMIN_DEFAULT_PASSWORD}

# --- Storage (local disk on this VPS) ---
STORAGE_BACKEND=local
STORAGE_LOCAL_DIR=${UPLOADS_DIR}

# --- Google Maps (optional) ---
GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY:-}

# --- SMTP / PayPal / Bank — leave blank, configure in Admin → Settings UI ---
SMTP_HOST=
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM=
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_MODE=demo
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "Created $ENV_FILE (secrets generated)"
else
  ok "backend/.env exists — not overwriting"
fi

# ---------------------------------------------------------------------------
# 6. frontend/.env
# ---------------------------------------------------------------------------
FE_ENV="$FRONTEND_DIR/.env"
GMK=$(grep -E '^GOOGLE_MAPS_API_KEY=' "$ENV_FILE" | cut -d= -f2-)
step "6/11 Writing frontend/.env…"
cat > "$FE_ENV" <<EOF
REACT_APP_BACKEND_URL=https://${DOMAIN}
REACT_APP_GOOGLE_MAPS_API_KEY=${GMK}
EOF
chown "$APP_USER:$APP_USER" "$FE_ENV"
ok "REACT_APP_BACKEND_URL=https://${DOMAIN}"

# ---------------------------------------------------------------------------
# 7. Build the frontend
# ---------------------------------------------------------------------------
step "7/11 Building the React frontend (this takes 1-3 minutes)…"
sudo -u "$APP_USER" -H bash -lc "cd '$FRONTEND_DIR' && yarn install --frozen-lockfile && yarn build"
ok "Frontend built → $FRONTEND_DIR/build"

# ---------------------------------------------------------------------------
# 8. systemd service
# ---------------------------------------------------------------------------
step "8/11 Installing systemd service…"
cat > /etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=RentSure FastAPI Backend
After=network.target mongod.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${BACKEND_DIR}
EnvironmentFile=${BACKEND_DIR}/.env
ExecStart=${BACKEND_DIR}/.venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}
sleep 2
systemctl is-active ${SERVICE_NAME} >/dev/null && ok "${SERVICE_NAME} running" || {
  echo "Service failed to start — check: journalctl -u ${SERVICE_NAME} --no-pager -n 50"; exit 1; }

# ---------------------------------------------------------------------------
# 9. nginx reverse proxy
# ---------------------------------------------------------------------------
step "9/11 Configuring nginx…"
NGINX_CONF=/etc/nginx/sites-available/rentsure
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    client_max_body_size 25M;

    location /api/ {
        proxy_pass         http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Origin            \$scheme://\$host;
        proxy_read_timeout 120s;
    }

    root ${FRONTEND_DIR}/build;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:js|css|woff2?|ttf|svg|png|jpg|jpeg|webp|ico)\$ {
        expires 30d;
        access_log off;
        add_header Cache-Control "public";
    }
}
EOF
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/rentsure
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ok "nginx reloaded"

# ---------------------------------------------------------------------------
# 10. HTTPS via Let's Encrypt
# ---------------------------------------------------------------------------
step "10/11 Requesting Let's Encrypt certificate…"
if ! command -v certbot >/dev/null; then
  apt-get install -y certbot python3-certbot-nginx
fi
if certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
  ok "Certificate for $DOMAIN already exists — skipping issuance"
else
  certbot --nginx \
    -d "$DOMAIN" -d "www.$DOMAIN" \
    --redirect --agree-tos --non-interactive -m "$ADMIN_EMAIL" || {
      echo "⚠️  certbot failed — make sure $DOMAIN A record points to this server, then re-run."
    }
fi

# ---------------------------------------------------------------------------
# 11. Daily backup cron
# ---------------------------------------------------------------------------
step "11/11 Installing daily backup cron…"
cat > /etc/cron.daily/rentsure-backup <<EOF
#!/bin/bash
DATE=\$(date +%F)
mkdir -p /var/backups/rentsure
mongodump --db ${DB_NAME} --archive=/var/backups/rentsure/db-\$DATE.gz --gzip
tar czf /var/backups/rentsure/uploads-\$DATE.tgz -C ${APP_DIR} uploads
find /var/backups/rentsure -mtime +30 -delete
EOF
chmod +x /etc/cron.daily/rentsure-backup
ok "Daily backup at /etc/cron.daily/rentsure-backup"

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
cat <<EOF

╔════════════════════════════════════════════════════════════════════╗
║                  ✅  RentSure Homes deployed                       ║
╠════════════════════════════════════════════════════════════════════╣
  Public site     :  https://${DOMAIN}
  Admin login URL :  https://${DOMAIN}${ADMIN_LOGIN_PATH}
  Admin email     :  ${ADMIN_EMAIL}
  Admin password  :  (the value you entered, stored in backend/.env)

  Logs            :  journalctl -u ${SERVICE_NAME} -f
  Restart backend :  systemctl restart ${SERVICE_NAME}
  Reload nginx    :  systemctl reload nginx
  Update later    :  bash ${APP_DIR}/update.sh

  Backups daily   :  /var/backups/rentsure/  (db + uploads, 30-day retention)
╚════════════════════════════════════════════════════════════════════╝

Next: sign in, then configure SMTP / PayPal / Bank Transfer in Admin → Settings.

EOF
