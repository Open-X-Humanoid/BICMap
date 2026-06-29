#!/bin/sh

rm -rf node_modules
pnpm install --store-dir /tmp/pnpm-store
pnpm build:web
