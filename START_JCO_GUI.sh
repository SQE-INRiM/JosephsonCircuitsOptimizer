#!/usr/bin/env bash
set -u

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

echo "[JCO GUI] Starting..."

bash "$ROOT/gui/scripts/bootstrap-linux.sh"
status=$?

if [ $status -ne 0 ]; then
  echo
  echo "[JCO GUI] Startup failed. Review the message above."
fi

exit $status
