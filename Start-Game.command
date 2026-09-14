#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js was not found. Open Terminal in this folder and run: node server.cjs'
  read -r -p 'Press Enter to close.'
  exit 1
fi
node server.cjs
read -r -p 'Server stopped. Press Enter to close.'
