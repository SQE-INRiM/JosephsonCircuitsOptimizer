import os
import subprocess
import sys

venv_dir = "JCOvenv"

def run(cmd):
    print(">>>", " ".join(cmd))
    subprocess.check_call(cmd)

# 1. Create venv
if not os.path.exists(venv_dir):
    print("Creating virtual environment...")
    run([sys.executable, "-m", "venv", venv_dir])
else:
    print("Virtual environment already exists.")

# 2. Select correct pip path depending on OS
if os.name == "nt":  # Windows
    pip = os.path.join(venv_dir, "Scripts", "pip.exe")
    python = os.path.join(venv_dir, "Scripts", "python.exe")
else:  # Linux / Mac
    pip = os.path.join(venv_dir, "bin", "pip")
    python = os.path.join(venv_dir, "bin", "python")

# 3. Install Python dependencies
print("Installing Python dependencies...")
run([pip, "install", "-r", "requirements.txt"])

print("\n✅ Setup complete. Now you can start the GUI with:")
if os.name == "nt":
    print("   start_gui.bat")
else:
    print("   ./start_gui.sh")
