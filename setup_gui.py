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
    print("\n⚠ Julia executable not found in your system or in your PATH.")
    print("Please install Julia from https://julialang.org/downloads/")
    print("and add its 'bin' folder to your system PATH.")
    print("\nInstructions:")

    if os.name == "nt":  # Windows instructions
        print("1. Install Julia from the link above.")
        print("2. Find the folder where Julia was installed, e.g.,")
        print("   C:\\Users\\YourName\\AppData\\Local\\Programs\\Julia-1.x.x\\bin")
        print("3. Add this folder to your PATH:")
        print("   - Press Win + S → 'Environment Variables'")
        print("   - Edit 'Path' under User variables → New → paste the path")
        print("4. Open a new Command Prompt and test with: julia --version")
    else:  # Linux / macOS instructions
        print("1. Install Julia from the link above.")
        print("2. Add Julia to PATH by editing ~/.bashrc or ~/.zshrc:")
        print("   export PATH='/path/to/julia/bin:$PATH'")
        print("3. Run: source ~/.bashrc (or source ~/.zshrc)")
        print("4. Test with: julia --version")
        
    sys.exit("🚫 Julia is required. Setup aborted.")

else:
    print(f"✅ Julia found at: {julia_path}")
# --- 5. Instructions to start the GUI ---
print("\n✅ Setup complete. You can now start the GUI:")
if os.name == "nt":
    print("   start_gui.bat")
else:
    print("   ./start_gui.sh")
