import tkinter as tk
from tkinter import ttk
import subprocess
import threading
import os
from PIL import Image, ImageTk, UnidentifiedImageError
import shutil
import sys

process = None
current_plot_index = 0
plot_files = []

# paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_path = os.path.abspath(os.path.join(current_dir, '..')).replace('\\', '/')
src_path = os.path.join(project_path, 'src').replace('\\', '/')
plot_path = os.path.join(project_path, 'plot_saved').replace('\\', '/')

# Color scheme
COLORS = {
    'primary': '#2C3E50',
    'secondary': '#3498DB', 
    'success': '#27AE60',
    'danger': '#E74C3C',
    'warning': '#F39C12',
    'light': '#ECF0F1',
    'dark': '#34495E',
    'text': '#2C3E50',
    'bg': '#F8F9FA'
}

# Get Julia executable from command line or fallback
if len(sys.argv) > 1:
    JULIA_EXE = sys.argv[1]
else:
    JULIA_EXE = shutil.which("julia") or "julia"

print(f"Using Julia executable: {JULIA_EXE}")


def clear_plots():
    if os.path.exists(plot_path):
        for f in os.listdir(plot_path):
            if f.endswith(".png"):
                os.remove(os.path.join(plot_path, f))
        log_message("✓ Cleared old plots.", 'success')

def log_message(message, msg_type='info'):
    """Add colored message to output with timestamp"""
    import datetime
    timestamp = datetime.datetime.now().strftime("%H:%M:%S")
    
    # Configure text tags for colors
    output_box.tag_configure("success", foreground=COLORS['success'])
    output_box.tag_configure("error", foreground=COLORS['danger'])
    output_box.tag_configure("warning", foreground=COLORS['warning'])
    output_box.tag_configure("info", foreground=COLORS['text'])
    output_box.tag_configure("timestamp", foreground=COLORS['dark'], font=('Consolas', 8))
    
    output_box.insert(tk.END, f"[{timestamp}] ", "timestamp")
    output_box.insert(tk.END, f"{message}\n", msg_type)
    output_box.see(tk.END)

def refresh_plot_list():
    global plot_files
    if os.path.exists(plot_path):
        plot_files = sorted(
            [os.path.join(plot_path, f) for f in os.listdir(plot_path) if f.endswith(".png")]
        )

def show_plot(index):
    if 0 <= index < len(plot_files):
        try:
            # Try to open the image safely
            with Image.open(plot_files[index]) as img:
                img = img.copy()  # force load into memory

            # Calculate aspect ratio for better fitting
            img_width, img_height = img.size
            max_width, max_height = 600, 450
            ratio = min(max_width / img_width, max_height / img_height)
            new_width = int(img_width * ratio)
            new_height = int(img_height * ratio)

            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)

            # Clear canvas and draw new image centered
            plot_canvas.delete("all")
            canvas_width = plot_canvas.winfo_width() or 600
            canvas_height = plot_canvas.winfo_height() or 450
            x = (canvas_width - new_width) // 2
            y = (canvas_height - new_height) // 2
            plot_canvas.create_image(x + new_width // 2, y + new_height // 2, image=photo)
            plot_canvas.image = photo  # Keep a reference

            status_label.config(
                text=f"Plot {index+1} of {len(plot_files)}: {os.path.basename(plot_files[index])}"
            )

            # Update navigation buttons
            prev_button.config(state='normal' if index > 0 else 'disabled')
            next_button.config(state='normal' if index < len(plot_files) - 1 else 'disabled')

        except UnidentifiedImageError:
            #log_message(f"Skipping incomplete plot: {os.path.basename(plot_files[index])}", 'warning')
            pass
        except Exception as e:
            log_message(f"Error loading plot {os.path.basename(plot_files[index])}: {e}", 'error')
    else:
        # No valid plots
        plot_canvas.delete("all")
        plot_canvas.create_text(300, 225, text="No plots available",
                                font=('Arial', 14), fill=COLORS['dark'])
        status_label.config(text="No plots to display")
        prev_button.config(state='disabled')
        next_button.config(state='disabled')


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
    global current_plot_index
    refresh_plot_list()
    if plot_files:
        current_plot_index = len(plot_files) - 1  # always newest
        show_plot(current_plot_index)
    else:
        show_plot(-1)
    root.after(500, update_plot)


def toggle_simulation():
    """Toggle between start and stop simulation"""
    global process
    if process is None:
        start_simulation()
    else:
        stop_simulation()

def start_simulation():
    global process, current_plot_index
    if process is not None:
        log_message("Simulation already running!", 'warning')
        return

    # Update UI state
    main_button.config(text="Stop Simulation", style="Danger.TButton")
    progress_bar.config(mode='indeterminate')
    progress_bar.start()
    current_plot_index = 0

    clear_plots()
    refresh_plot_list()
    log_message("Starting Josephson simulation...", 'info')

    julia_code = f'''
    using Pkg
    Pkg.activate("{project_path}")
    push!(LOAD_PATH, "{src_path}")
    using JosephsonCircuitsOptimizer
    JosephsonCircuitsOptimizer.run()
    '''

    def run_in_thread():
        global process
        try:
            process = subprocess.Popen(
                [JULIA_EXE, '--project=' + project_path, '-e', julia_code],
                cwd=project_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            for line in process.stdout:
                if process is None:  # Check if stopped
                    break
                root.after(0, lambda: log_message(line.strip(), 'info'))
            
            process.wait()
            root.after(0, simulation_finished)
        except Exception as e:
            root.after(0, lambda: log_message(f"Error running simulation: {e}", 'error'))
            root.after(0, simulation_finished)

    threading.Thread(target=run_in_thread, daemon=True).start()

def stop_simulation():
    global process
    if process is not None:
        process.terminate()
        process = None
        log_message("✗ Simulation stopped by user.", 'warning')
        simulation_finished()
    else:
        log_message("No simulation running.", 'info')

def simulation_finished():
    """Called when simulation completes or stops"""
    global process
    process = None
    main_button.config(text="Start Simulation", style="Success.TButton")
    progress_bar.stop()
    progress_bar.config(mode='determinate', value=0)
    log_message("Simulation finished.", 'success')

def run_function(func_name="run"):
    global process
    if process is not None:
        log_message("Simulation already running!", 'warning')
        return

    log_message(f"Running function: {func_name}", 'info')

    julia_code = f'''
    using Pkg
    Pkg.activate("{project_path}")
    push!(LOAD_PATH, "{src_path}")
    using JosephsonCircuitsOptimizer
    JosephsonCircuitsOptimizer.{func_name}()
    '''

    def run_in_thread():
        global process
        try:
            process = subprocess.Popen(
                [JULIA_EXE, '--project=' + project_path, '-e', julia_code],
                cwd=project_path,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            for line in process.stdout:
                if process is None:
                    break
                root.after(0, lambda: log_message(line.strip(), 'info'))
            process.wait()
            process = None
        except Exception as e:
            root.after(0, lambda: log_message(f"Error: {e}", 'error'))

    threading.Thread(target=run_in_thread, daemon=True).start()

def clear_output():
    """Clear the output console"""
    output_box.delete(1.0, tk.END)
    log_message("Output cleared.", 'info')

# --- Enhanced GUI ---
root = tk.Tk()
root.title("Josephson Circuits Optimizer")
root.geometry("1000x800")
root.configure(bg=COLORS['bg'])

# Configure ttk styles
style = ttk.Style()
style.theme_use('clam')

# Configure custom styles
style.configure("Success.TButton",
                background=COLORS['success'],
                foreground='white',
                font=('Arial', 10, 'bold'),
                padding=(20, 10))

style.configure("Danger.TButton",
                background=COLORS['danger'],
                foreground='white',
                font=('Arial', 10, 'bold'),
                padding=(20, 10))

style.configure("Primary.TButton",
                background=COLORS['primary'],
                foreground='white',
                font=('Arial', 9),
                padding=(10, 5))

style.map("Success.TButton",
          background=[('active', '#229954')])
style.map("Danger.TButton",
          background=[('active', '#C0392B')])
style.map("Primary.TButton",
          background=[('active', COLORS['dark'])])

# Main container
main_frame = tk.Frame(root, bg=COLORS['bg'], padx=20, pady=20)
main_frame.pack(fill='both', expand=True)

# Header
header_frame = tk.Frame(main_frame, bg=COLORS['bg'])
header_frame.pack(fill='x', pady=(0, 20))

title_label = tk.Label(header_frame, 
                      text="🔬 Josephson Circuits Optimizer", 
                      font=('Arial', 18, 'bold'),
                      fg=COLORS['primary'],
                      bg=COLORS['bg'])
title_label.pack(side='left')

# Control Panel
control_frame = tk.LabelFrame(main_frame, text="Controls", 
                             font=('Arial', 12, 'bold'),
                             fg=COLORS['primary'],
                             bg=COLORS['bg'],
                             padx=15, pady=15)
control_frame.pack(fill='x', pady=(0, 10))

# Buttons row
button_frame = tk.Frame(control_frame, bg=COLORS['bg'])
button_frame.pack(fill='x')

main_button = ttk.Button(button_frame, text="Start Simulation", 
                        command=toggle_simulation,
                        style="Success.TButton")
main_button.pack(side='left', padx=(0, 10))

clear_btn = ttk.Button(button_frame, text="Clear Output", 
                      command=clear_output,
                      style="Primary.TButton")
clear_btn.pack(side='left', padx=(0, 10))

# Progress bar
progress_frame = tk.Frame(control_frame, bg=COLORS['bg'])
progress_frame.pack(fill='x', pady=(10, 0))

tk.Label(progress_frame, text="Status:", font=('Arial', 9), 
         bg=COLORS['bg'], fg=COLORS['text']).pack(side='left')

progress_bar = ttk.Progressbar(progress_frame, mode='determinate', length=200)
progress_bar.pack(side='left', padx=(10, 0), fill='x', expand=True)

# Main content area
content_frame = tk.Frame(main_frame, bg=COLORS['bg'])
content_frame.pack(fill='both', expand=True)

# Left panel - Output
left_panel = tk.LabelFrame(content_frame, text="Simulation Output", 
                          font=('Arial', 12, 'bold'),
                          fg=COLORS['primary'],
                          bg=COLORS['bg'],
                          padx=10, pady=10)
left_panel.pack(side='left', fill='both', expand=True, padx=(0, 10))

# Output text with scrollbar
output_frame = tk.Frame(left_panel, bg=COLORS['bg'])
output_frame.pack(fill='both', expand=True)

output_box = tk.Text(output_frame, height=15, width=50,
                    font=('Consolas', 9),
                    bg='#1e1e1e', fg='#ffffff',
                    insertbackground='white',
                    selectbackground=COLORS['secondary'],
                    wrap=tk.WORD)

output_scrollbar = ttk.Scrollbar(output_frame, orient='vertical', command=output_box.yview)
output_box.configure(yscrollcommand=output_scrollbar.set)

output_box.pack(side='left', fill='both', expand=True)
output_scrollbar.pack(side='right', fill='y')

# Right panel - Plots
right_panel = tk.LabelFrame(content_frame, text="Plot Viewer", 
                           font=('Arial', 12, 'bold'),
                           fg=COLORS['primary'],
                           bg=COLORS['bg'],
                           padx=10, pady=10)
right_panel.pack(side='right', fill='both', expand=True)

# Plot canvas
plot_canvas = tk.Canvas(right_panel, width=600, height=450,
                       bg='white', highlightthickness=1,
                       highlightbackground=COLORS['dark'])
plot_canvas.pack(pady=(0, 10))

# Navigation
nav_frame = tk.Frame(right_panel, bg=COLORS['bg'])
nav_frame.pack(fill='x')

prev_button = ttk.Button(nav_frame, text="◀ Previous", 
                        command=prev_plot,
                        style="Primary.TButton",
                        state='disabled')
prev_button.pack(side='left', padx=(0, 5))

next_button = ttk.Button(nav_frame, text="Next ▶", 
                        command=next_plot,
                        style="Primary.TButton",
                        state='disabled')
next_button.pack(side='left', padx=(5, 0))

# Plot status
status_label = tk.Label(nav_frame, text="No plots to display",
                       font=('Arial', 10),
                       fg=COLORS['dark'],
                       bg=COLORS['bg'])
status_label.pack(side='right')

# Footer
footer_frame = tk.Frame(main_frame, bg=COLORS['bg'])
footer_frame.pack(fill='x', pady=(20, 0))

footer_label = tk.Label(footer_frame, 
                       text=f"Project: {os.path.basename(project_path)}",
                       font=('Arial', 8),
                       fg=COLORS['dark'],
                       bg=COLORS['bg'])
footer_label.pack()

# Initialize
log_message("GUI initialized. Ready to run simulations.", 'success')
update_plot()

# Handle window closing
def on_closing():
    if process is not None:
        stop_simulation()
    root.destroy()

root.protocol("WM_DELETE_WINDOW", on_closing)
root.mainloop()