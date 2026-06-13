#!/usr/bin/env bash
set -e

echo "==> Installing pnpm to writable temp dir..."
npm install --prefix /tmp/pnpm-bin pnpm@latest --silent

export PATH="/tmp/pnpm-bin/node_modules/.bin:$PATH"

echo "==> pnpm version: $(pnpm --version)"

echo "==> Installing workspace dependencies..."
pnpm install --frozen-lockfile

echo "==> Building api-server..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete."
