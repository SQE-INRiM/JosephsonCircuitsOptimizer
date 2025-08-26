@echo off
echo Starting Josephson Simulation GUI...
if exist JCOvenv\Scripts\activate (
    call JCOvenv\Scripts\activate
) else (
    echo Virtual environment not found. Run setup_gui.py first.
    pause
    exit
)
python gui\pygui.py
pause