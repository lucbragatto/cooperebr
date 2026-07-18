#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/cooperebr/app}"
BRANCH="${BRANCH:-deploy/clube-cooperebr}"

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

cd "$APP_DIR/backend"
npm ci --ignore-scripts
npx prisma generate
npx prisma db push --accept-data-loss
npm run build
npx ts-node -r dotenv/config --project tsconfig.seed.json scripts/seed-dev-local-auth.ts

cd "$APP_DIR/web"
npm ci
npm run build

cd "$APP_DIR/whatsapp-service"
npm ci

pm2 startOrReload "$APP_DIR/ecosystem.azure.config.cjs" --update-env
pm2 save
