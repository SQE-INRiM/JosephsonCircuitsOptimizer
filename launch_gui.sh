#!/bin/bash
# ---------------------------------------------------------
# Josephson Circuits Optimizer - One-click GUI launcher
# ---------------------------------------------------------

# Optional: set Julia path here if not in PATH
JULIA_EXE="julia"

# Paths
REPO_DIR="$(pwd)"
VENV_DIR="$REPO_DIR/JCOvenv"
GUI_PY="$REPO_DIR/gui/pygui.py"

# --- Step 1: Create venv if it doesn't exist ---
if [ ! -f "$VENV_DIR/bin/python" ]; then
    echo "Creating Python virtual environment..."
    python3 setup_gui.py
else
    echo "Virtual environment already exists."
fi

# --- Step 2: Run GUI ---
echo "Launching GUI..."
"$VENV_DIR/bin/python" "$GUI_PY" "$JULIA_EXE"