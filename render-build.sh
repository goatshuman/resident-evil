#!/usr/bin/env bash
set -e

echo "==> Installing pnpm 10.26.1 to writable temp dir..."
npm install --prefix /tmp/pnpm-bin pnpm@10.26.1 --silent

export PATH="/tmp/pnpm-bin/node_modules/.bin:$PATH"

echo "==> pnpm version: $(pnpm --version)"

echo "==> Installing workspace dependencies..."
pnpm install --no-frozen-lockfile

echo "==> Building api-server..."
pnpm --filter @workspace/api-server run build

echo "==> Build complete."
