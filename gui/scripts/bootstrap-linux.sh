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
LOCK_FILE="$ROOT/package-lock.json"
DEPENDENCY_STAMP="$RUNTIME_DIR/package-lock.sha256"
ELECTRON_BIN="$ROOT/node_modules/.bin/electron"

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

if [ ! -f "$LOCK_FILE" ]; then
  fail "package-lock.json is missing. Restore it from the repository and launch again."
fi

export PATH="$NODE_DIR/bin:$PATH"

if command -v sha256sum >/dev/null 2>&1; then
  CURRENT_LOCK_HASH="$(sha256sum "$LOCK_FILE" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  CURRENT_LOCK_HASH="$(shasum -a 256 "$LOCK_FILE" | awk '{print $1}')"
else
  fail "A SHA-256 utility (sha256sum or shasum) is required to verify GUI dependencies."
fi

INSTALLED_LOCK_HASH=""
if [ -f "$DEPENDENCY_STAMP" ]; then
  INSTALLED_LOCK_HASH="$(cat "$DEPENDENCY_STAMP")"
fi

if [ ! -d "$ROOT/node_modules" ] || [ ! -x "$ELECTRON_BIN" ] || [ "$INSTALLED_LOCK_HASH" != "$CURRENT_LOCK_HASH" ]; then
  if [ -d "$ROOT/node_modules" ]; then
    step "GUI dependencies changed or are incomplete. Refreshing local dependencies..."
  else
    step "Installing GUI dependencies locally (first launch only)..."
  fi
  "$NPM_BIN" ci || fail "npm dependency installation failed."
  printf '%s' "$CURRENT_LOCK_HASH" > "$DEPENDENCY_STAMP"
fi

if [ ! -x "$ELECTRON_BIN" ]; then
  fail "Electron is missing after npm dependency installation."
fi

step "Building the GUI..."
"$NPM_BIN" run build || fail "GUI build failed."

if [ ! -f "$ROOT/dist/index.html" ]; then
  fail "The GUI build did not create dist/index.html."
fi

step "Opening JCO GUI..."
step "Julia is only needed when you start a JCO simulation."

"$ELECTRON_BIN" . \
  || fail "Electron failed to start the application. On Linux, missing system libraries may need to be installed by your distribution package manager."
