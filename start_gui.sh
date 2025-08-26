#!/bin/bash
echo "Starting Josephson Simulation GUI..."
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    echo "Virtual environment not found. Run setup_gui.py first."
    exit 1
fi

python3 gui/pygui.py
