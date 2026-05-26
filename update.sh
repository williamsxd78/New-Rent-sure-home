#!/usr/bin/env bash
# ============================================================================
# RentSure Homes — Update existing deployment to the latest code
# ============================================================================
# Run this AFTER `git pull` to apply backend + frontend changes safely.
# Usage:  sudo bash update.sh
# ============================================================================
set -euo pipefail

APP_USER="rentsure"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="${APP_DIR}/backend"
FRONTEND_DIR="${APP_DIR}/frontend"
SERVICE_NAME="rentsure-backend"

if [[ "$EUID" -ne 0 ]]; then
  echo "Please run as root: sudo bash update.sh" >&2
  exit 1
fi

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$*"; }

# Make sure git trusts the repo even if ownership has been touched (e.g. files
# pulled by root at some point). Also re-assert ownership in case anything
# slipped under root after manual fixes.
step "Ensuring repo ownership & git trust…"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" || true
sudo -u "$APP_USER" -H git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true
git config --global --add safe.directory "$APP_DIR" >/dev/null 2>&1 || true

step "Pulling latest code…"
sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && git pull --ff-only"

step "Installing/updating backend deps…"
sudo -u "$APP_USER" "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"

step "Restarting backend service…"
systemctl restart "$SERVICE_NAME"
sleep 2
systemctl is-active "$SERVICE_NAME" >/dev/null && ok "${SERVICE_NAME} healthy" || {
  echo "Service failed — check: journalctl -u ${SERVICE_NAME} --no-pager -n 80"; exit 1; }

step "Rebuilding frontend…"
sudo -u "$APP_USER" -H bash -lc "cd '$FRONTEND_DIR' && yarn install --frozen-lockfile && yarn build"

step "Reloading nginx…"
systemctl reload nginx
ok "Update complete. https://$(grep -E '^FRONTEND_URL=' "$BACKEND_DIR/.env" | cut -d= -f2-)"
