@echo off
REM ---------------------------------------------------------
REM Josephson Circuits Optimizer - One-click GUI launcher
REM ---------------------------------------------------------

REM Optional: set Julia path here if not in PATH
SET JULIA_EXE=julia

REM Paths
SET REPO_DIR=%CD%
SET VENV_DIR=%REPO_DIR%\JCOvenv
SET GUI_PY=%REPO_DIR%\gui\pygui.py

REM --- Step 1: Create venv if it doesn't exist ---
IF NOT EXIST "%VENV_DIR%\Scripts\python.exe" (
    echo Creating Python virtual environment...
    python setup_gui.py
) ELSE (
    echo Virtual environment already exists.
)

REM --- Step 2: Run GUI ---
echo Launching GUI...
"%VENV_DIR%\Scripts\python.exe" "%GUI_PY%" "%JULIA_EXE%"

pause
