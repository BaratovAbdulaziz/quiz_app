#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-app.example.com}"
APP_DIR="/opt/quiz-app"

echo "=== Deploying QuizFlow to $DOMAIN ==="

cd "$APP_DIR"

git pull origin main

echo "--- Installing dependencies ---"
npm ci

echo "--- Building Next.js app ---"
npm run build --workspace=@quiz-app/web

echo "--- Running database migrations ---"
npm run migrate --workspace=@quiz-app/shared

echo "--- Restarting apps ---"
pm2 startOrRestart deploy/ecosystem.config.json

echo "--- Setting up SSL ---"
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m admin@"$DOMAIN" || true

echo "=== Done ==="
