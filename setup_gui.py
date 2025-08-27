import os
import subprocess
import sys
import shutil

# --- Configuration ---
venv_dir = "JCOvenv"
requirements_file = "requirements.txt"

def run(cmd):
    """Run a system command and print it."""
    print(">>>", " ".join(cmd))
    subprocess.check_call(cmd)

# --- 1. Create virtual environment ---
if not os.path.exists(venv_dir):
    print("Creating virtual environment...")
    run([sys.executable, "-m", "venv", venv_dir])
else:
    print("Virtual environment already exists.")

# --- 2. Select correct pip and python paths ---
if os.name == "nt":  # Windows
    pip = os.path.join(venv_dir, "Scripts", "pip.exe")
    python = os.path.join(venv_dir, "Scripts", "python.exe")
else:  # Linux / Mac
    pip = os.path.join(venv_dir, "bin", "pip")
    python = os.path.join(venv_dir, "bin", "python")

# --- 3. Install Python dependencies ---
print("Installing Python dependencies...")
if not os.path.exists(requirements_file):
    print(f"⚠ Requirements file not found: {requirements_file}")
else:
    run([pip, "install", "-r", requirements_file])

# --- 4. Check for Julia ---
julia_path = shutil.which("julia")
if julia_path is None:
    print("\n⚠ Julia not found on your system!")
    print("Please install Julia from https://julialang.org/downloads/")
    print("and make sure it is added to your PATH before running the GUI.")
else:
    print(f"✅ Julia found at: {julia_path}")

# --- 5. Instructions to start the GUI ---
print("\n✅ Setup complete. You can now start the GUI:")
if os.name == "nt":
    print("   start_gui.bat")
else:
    print("   ./start_gui.sh")
