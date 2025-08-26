import tkinter as tk
import subprocess
import threading
import os
from PIL import Image, ImageTk
import shutil

process = None
current_plot_index = 0
plot_files = []

# paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_path = os.path.abspath(os.path.join(current_dir, '..')).replace('\\', '/')
src_path = os.path.join(project_path, 'src').replace('\\', '/')
plot_path = os.path.join(project_path, 'plot_saved').replace('\\', '/')


def get_julia_exe():
    # Try to find Julia in PATH
    julia = shutil.which("julia")
    if julia:
        return julia
    # Fallback: hardcode your Julia installation path here if PATH is not set
    return print("Va che mica hai Julia pistola") # Change this if needed


def clear_plots():
    if os.path.exists(plot_path):
        for f in os.listdir(plot_path):
            if f.endswith(".png"):
                os.remove(os.path.join(plot_path, f))
        output_box.insert(tk.END, "✓ Cleared old plots.\n")
        output_box.see(tk.END)

def refresh_plot_list():
    global plot_files
    if os.path.exists(plot_path):
        plot_files = sorted(
            [os.path.join(plot_path, f) for f in os.listdir(plot_path) if f.endswith(".png")]
        )

def show_plot(index):
    if 0 <= index < len(plot_files):
        img = Image.open(plot_files[index]).copy()
        img = img.resize((500, 400))
        photo = ImageTk.PhotoImage(img)
        plot_label.config(image=photo)
        plot_label.image = photo
        status_label.config(text=f"{index+1}/{len(plot_files)}: {os.path.basename(plot_files[index])}")

def next_plot():
    global current_plot_index
    if current_plot_index < len(plot_files) - 1:
        current_plot_index += 1
        show_plot(current_plot_index)

def prev_plot():
    global current_plot_index
    if current_plot_index > 0:
        current_plot_index -= 1
        show_plot(current_plot_index)

def update_plot():
    refresh_plot_list()
    if plot_files:
        show_plot(current_plot_index)
    root.after(200, update_plot)  # check every 0.2 seconds

def start_simulation():
    global process
    if process is not None:
        print("Simulation already running!")
        return

    clear_plots()
    refresh_plot_list()
    show_plot(0) if plot_files else plot_label.config(image="", text="No plots yet")

    julia_code = f'''
    using Pkg
    Pkg.activate("{project_path}")
    push!(LOAD_PATH, "{src_path}")
    using JosephsonCircuitsOptimizer
    JosephsonCircuitsOptimizer.run()
    '''

    def run_in_thread():
        global process
        process = subprocess.Popen(
            [get_julia_exe(), '--project=' + project_path, '-e', julia_code],
            cwd=project_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        for line in process.stdout:
            output_box.insert(tk.END, line)
            output_box.see(tk.END)
        process.wait()
        process = None

    threading.Thread(target=run_in_thread, daemon=True).start()


def stop_simulation():
    global process
    if process is not None:
        process.terminate()
        process = None
        output_box.insert(tk.END, "\n✗ Simulation stopped by user.\n")
        output_box.see(tk.END)
    else:
        output_box.insert(tk.END, "\nNo simulation running.\n")
        output_box.see(tk.END)


def run_function(func_name="run"):
    global process
    if process is not None:
        output_box.insert(tk.END, "Simulation already running!\n")
        return

    julia_code = f'''
    using Pkg
    Pkg.activate("{project_path}")
    push!(LOAD_PATH, "{src_path}")
    using JosephsonCircuitsOptimizer
    JosephsonCircuitsOptimizer.{func_name}()
    '''

    def run_in_thread():
        global process
        process = subprocess.Popen(
            [get_julia_exe(), '--project=' + project_path, '-e', julia_code],
            cwd=project_path,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        for line in process.stdout:
            output_box.insert(tk.END, line)
            output_box.see(tk.END)
        process.wait()
        process = None

    threading.Thread(target=run_in_thread, daemon=True).start()



# --- GUI ---
root = tk.Tk()
root.title("Josephson Simulation GUI")


start_button = tk.Button(root, text="Start Simulation", command=start_simulation)
start_button.pack(pady=5)

stop_button = tk.Button(root, text="Stop Simulation", command=stop_simulation)
stop_button.pack(pady=5)

"""
stop_button = tk.Button(root, text="Run test function", command=lambda: run_function("test_modification"))
stop_button.pack(pady=5)
"""

output_box = tk.Text(root, height=10, width=80)
output_box.pack()

plot_label = tk.Label(root)
plot_label.pack()

nav_frame = tk.Frame(root)
nav_frame.pack(pady=5)
prev_button = tk.Button(nav_frame, text="<< Prev", command=prev_plot)
prev_button.pack(side=tk.LEFT, padx=5)
next_button = tk.Button(nav_frame, text="Next >>", command=next_plot)
next_button.pack(side=tk.LEFT, padx=5)

status_label = tk.Label(root, text="")
status_label.pack()

update_plot()
root.mainloop()