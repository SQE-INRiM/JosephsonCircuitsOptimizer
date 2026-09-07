#!/usr/bin/env bash
set -u

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT/.jco-runtime"
NODE_VERSION="22.22.0"

step() {
  printf '[JCO GUI] %s\n' "$1"
}

fail() {
  printf '\n[JCO GUI] ERROR: %s\n' "$1" >&2
  exit 1
}

case "$(uname -m)" in
  x86_64|amd64)
    NODE_ARCH="x64"
    ;;
  aarch64|arm64)
    NODE_ARCH="arm64"
    ;;
  *)
    fail "Unsupported Linux architecture: $(uname -m). Supported architectures are x86_64 and arm64/aarch64."
    ;;
esac

NODE_DIR_NAME="node-v${NODE_VERSION}-linux-${NODE_ARCH}"
NODE_DIR="$RUNTIME_DIR/$NODE_DIR_NAME"
NODE_BIN="$NODE_DIR/bin/node"
NPM_BIN="$NODE_DIR/bin/npm"
NODE_ARCHIVE="$RUNTIME_DIR/${NODE_DIR_NAME}.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_DIR_NAME}.tar.xz"

cd "$ROOT" || fail "Could not enter the GUI directory."
mkdir -p "$RUNTIME_DIR" || fail "Could not create .jco-runtime."

if [ ! -x "$NODE_BIN" ]; then
  step "Preparing the local runtime (first launch only)..."
  step "Downloading portable Node.js ${NODE_VERSION} for Linux ${NODE_ARCH}..."

  if command -v curl >/dev/null 2>&1; then
    curl -fL "$NODE_URL" -o "$NODE_ARCHIVE" || fail "Could not download Node.js. Check the internet connection."
  elif command -v wget >/dev/null 2>&1; then
    wget -O "$NODE_ARCHIVE" "$NODE_URL" || fail "Could not download Node.js. Check the internet connection."
  else
    fail "Neither curl nor wget is available. Install one of them and launch again."
  fi

  step "Extracting local runtime..."
  tar -xJf "$NODE_ARCHIVE" -C "$RUNTIME_DIR" || fail "Could not extract the local Node.js runtime. Ensure tar with xz support is available."
  rm -f "$NODE_ARCHIVE"
fi

if [ ! -x "$NPM_BIN" ]; then
  fail "The local Node.js runtime is incomplete. Delete .jco-runtime and launch again."
fi

export PATH="$NODE_DIR/bin:$PATH"

if [ ! -d "$ROOT/node_modules" ]; then
  step "Installing GUI dependencies locally (first launch only)..."
  "$NPM_BIN" ci || fail "npm dependency installation failed."
fi

step "Building the GUI..."
"$NPM_BIN" run build || fail "GUI build failed."

if [ ! -f "$ROOT/dist/index.html" ]; then
  fail "The GUI build did not create dist/index.html."
fi

step "Opening JCO GUI..."
step "Julia is only needed when you start a JCO simulation."

"$NPM_BIN" exec --yes --package=electron@43.4.1 -- electron . \
  || fail "Electron failed to start the application. On Linux, missing system libraries may need to be installed by your distribution package manager."
