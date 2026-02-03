import tkinter as tk
from tkinter import ttk
from tkinter import filedialog
import subprocess
import threading
import os
from PIL import Image, ImageTk, UnidentifiedImageError
import shutil
import sys
import json

process = None
plot_files = []
current_plot_index = 0
corr_files = []
current_corr_index = 0

# paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_path = os.path.abspath(os.path.join(current_dir, '..')).replace('\\', '/')
src_path = os.path.join(project_path, 'src').replace('\\', '/')
workspace_path = os.path.join(project_path, "working_space").replace("\\", "/")
plot_path = os.path.join(workspace_path, "plots").replace("\\", "/")
corr_path = os.path.join(workspace_path, "correlation_matrix").replace("\\", "/")

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


def update_workspace_paths():
    global plot_path, corr_path
    ws = workspace_var.get()
    plot_path = os.path.join(ws, "plots").replace("\\", "/")
    corr_path = os.path.join(ws, "correlation_matrix").replace("\\", "/")


def ensure_workspace_structure(ws: str):
    """Create the expected subfolders inside a workspace if they don't exist."""
    os.makedirs(os.path.join(ws, "plots"), exist_ok=True)
    os.makedirs(os.path.join(ws, "correlation_matrix"), exist_ok=True)
    os.makedirs(os.path.join(ws, "outputs"), exist_ok=True)
    os.makedirs(os.path.join(ws, "user_inputs"), exist_ok=True)


def open_path(path: str):
    """Open a file/folder with the OS default application."""
    abs_path = os.path.abspath(path)
    try:
        if sys.platform.startswith("win"):
            os.startfile(abs_path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.run(["open", abs_path], check=False)
        else:
            subprocess.run(["xdg-open", abs_path], check=False)
    except Exception as e:
        # output_box might not exist yet; keep it silent and print to console
        print(f"Could not open path: {abs_path} ({e})")


def refresh_file_tree():
    """Refresh the embedded file browser tree (requires the GUI widgets to exist)."""
    global tree
    if "tree" not in globals():
        return

    # Clear existing
    for item in tree.get_children():
        tree.delete(item)

    root_path = workspace_var.get()
    if not os.path.isdir(root_path):
        return

    root_node = tree.insert("", "end",
                            text=os.path.basename(root_path) or root_path,
                            open=True,
                            values=(root_path,))

    preferred = ["user_inputs", "outputs", "plots", "correlation_matrix"]
    for name in preferred:
        p = os.path.join(root_path, name)
        if os.path.isdir(p):
            node = tree.insert(root_node, "end", text=name, open=False, values=(p,))
            add_tree_children(node, p, max_items=300)


def add_tree_children(parent_node, folder_path: str, max_items: int = 300):
    try:
        entries = sorted(os.listdir(folder_path))
    except Exception:
        return

    count = 0
    for entry in entries:
        if count >= max_items:
            tree.insert(parent_node, "end", text="… (more)", values=("",))
            break

        full = os.path.join(folder_path, entry)
        if os.path.isdir(full):
            tree.insert(parent_node, "end", text=entry, open=False, values=(full,))
        else:
            tree.insert(parent_node, "end", text=entry, values=(full,))
        count += 1


def on_tree_double_click(event):
    item = tree.selection()
    if not item:
        return
    vals = tree.item(item[0], "values")
    if not vals:
        return
    p = vals[0]
    if p and os.path.exists(p):
        open_path(p)


def browse_workspace():
    folder = filedialog.askdirectory(title="Select experiment folder (workspace)")
    if folder:
        workspace_var.set(folder.replace("\\", "/"))
        ensure_workspace_structure(workspace_var.get())
        update_workspace_paths()
        refresh_file_tree()
        log_message(f"Workspace set to: {workspace_var.get()}", "success")


def clear_plots():
    if os.path.exists(plot_path):
        for f in os.listdir(plot_path):
            if f.endswith(".png"):
                os.remove(os.path.join(plot_path, f))
        log_message("✓ Cleared old plots.", 'success')




def load_sidecar_json(image_path):
    if not image_path or not image_path.endswith(".png"):
        return None
    json_path = image_path[:-4] + ".json"
    if not os.path.exists(json_path):
        return None
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None

def format_metadata(meta):
    if not meta:
        return "No metadata available for this image."

    lines = []
    # Put key fields first (if present)
    for k in ["plot_type", "timestamp", "metric", "png"]:
        if k in meta:
            lines.append(f"{k}: {meta[k]}")

    # Params
    params = meta.get("params", None)
    if isinstance(params, dict) and params:
        lines.append("")
        lines.append("params:")
        for key in sorted(params.keys()):
            lines.append(f"  {key}: {params[key]}")

    # Any extra
    extra = meta.get("extra", None)
    if isinstance(extra, dict) and extra:
        lines.append("")
        lines.append("extra:")
        for key in sorted(extra.keys()):
            lines.append(f"  {key}: {extra[key]}")

    return "\n".join(lines)


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

            update_plot_metadata(plot_files[index])

            # Update navigation buttons
            prev_button.config(state='normal' if index > 0 else 'disabled')
            next_button.config(state='normal' if index < len(plot_files) - 1 else 'disabled')

        except UnidentifiedImageError:
            #log_message(f"Skipping incomplete plot: {os.path.basename(plot_files[index])}", 'warning')
            pass
        except Exception as e:
            #log_message(f"Error loading plot {os.path.basename(plot_files[index])}: {e}", 'error')
            pass
    else:
        # No valid plots
        plot_canvas.delete("all")
        plot_canvas.create_text(300, 225, text="No plots available",
                                font=('Arial', 14), fill=COLORS['dark'])
        status_label.config(text="No plots to display")
        update_plot_metadata(None)
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
        if current_plot_index >= len(plot_files):
            current_plot_index = len(plot_files) - 1
        show_plot(current_plot_index)
    else:
        show_plot(-1)
    root.after(500, update_plot)




def clear_corr():
    removed = 0
    if os.path.exists(corr_path):
        for f in os.listdir(corr_path):
            if f.endswith(".png") or f.endswith(".json"):
                try:
                    os.remove(os.path.join(corr_path, f))
                    removed += 1
                except Exception:
                    pass
    log_message(f"✓ Cleared matrices + metadata ({removed} files).", 'success')
    refresh_corr_list()
    show_corr(-1)
    update_corr_metadata(None)


def refresh_corr_list():
    global corr_files
    if os.path.exists(corr_path):
        corr_files = sorted(
            [os.path.join(corr_path, f) for f in os.listdir(corr_path) if f.endswith(".png")]
        )


def show_corr(index):
    if 0 <= index < len(corr_files):
        try:
            with Image.open(corr_files[index]) as img:
                img = img.copy()
            img_width, img_height = img.size
            max_width, max_height = 600, 450
            ratio = min(max_width / img_width, max_height / img_height)
            new_width, new_height = int(img_width * ratio), int(img_height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)

            corr_canvas.delete("all")
            canvas_width = corr_canvas.winfo_width() or 600
            canvas_height = corr_canvas.winfo_height() or 450
            x = (canvas_width - new_width) // 2
            y = (canvas_height - new_height) // 2
            corr_canvas.create_image(x + new_width // 2, y + new_height // 2, image=photo)
            corr_canvas.image = photo

            corr_status_label.config(
                text=f"Matrix {index+1} of {len(corr_files)}: {os.path.basename(corr_files[index])}"
            )
            update_corr_metadata(corr_files[index])

            corr_prev_button.config(state='normal' if index > 0 else 'disabled')
            corr_next_button.config(state='normal' if index < len(corr_files) - 1 else 'disabled')

        except Exception as e:
            #log_message(f"Error loading correlation matrix: {e}", 'error')
            pass
    else:
        corr_canvas.delete("all")
        corr_canvas.create_text(300, 225, text="No correlation matrices available",
                                font=('Arial', 14), fill=COLORS['dark'])
        corr_status_label.config(text="No correlation matrices to display")
        update_corr_metadata(None)
        corr_prev_button.config(state='disabled')
        corr_next_button.config(state='disabled')


def next_corr():
    global current_corr_index
    if current_corr_index < len(corr_files) - 1:
        current_corr_index += 1
        show_corr(current_corr_index)


def prev_corr():
    global current_corr_index
    if current_corr_index > 0:
        current_corr_index -= 1
        show_corr(current_corr_index)


def update_corr():
    global current_corr_index
    refresh_corr_list()
    if corr_files:
        if current_corr_index >= len(corr_files):
            current_corr_index = len(corr_files) - 1
        show_corr(current_corr_index)
    else:
        show_corr(-1)
    root.after(10000, update_corr)




def toggle_simulation():
    """Toggle between start and stop simulation"""
    global process
    if process is None:
        start_simulation()
    else:
        stop_simulation()



def clear_plots():
    removed = 0
    if os.path.exists(plot_path):
        for f in os.listdir(plot_path):
            if f.endswith(".png") or f.endswith(".json"):
                try:
                    os.remove(os.path.join(plot_path, f))
                    removed += 1
                except Exception:
                    pass
    log_message(f"✓ Cleared plots + metadata ({removed} files).", 'success')
    refresh_plot_list()
    show_plot(-1)
    update_plot_metadata(None)


def clear_corr():
    removed = 0
    if os.path.exists(corr_path):
        for f in os.listdir(corr_path):
            if f.endswith(".png") or f.endswith(".json"):
                os.remove(os.path.join(corr_path, f))
                removed += 1
    log_message(f"✓ Cleared matrices + metadata ({removed} files).", 'success')
    refresh_corr_list()
    show_corr(-1)
    update_corr_metadata(None)


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

    # Ensure workspace folders exist
    ensure_workspace_structure(workspace_var.get())
    update_workspace_paths()

    #clear_plots()
    refresh_plot_list()
    #clear_corr()
    refresh_corr_list()
    log_message("Starting Josephson simulation...", 'info')

    julia_code = f'''
    using Pkg
    Pkg.activate("{project_path}")
    push!(LOAD_PATH, "{src_path}")
    using JosephsonCircuitsOptimizer
    JosephsonCircuitsOptimizer.run(workspace=raw"{workspace_var.get()}", create_workspace=true)
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

# Workspace selector variable (must be created after root exists)
workspace_var = tk.StringVar(
    master=root,
    value=os.path.join(project_path, "working_space").replace("\\", "/")
)

# Initialize dynamic paths based on workspace_var
update_workspace_paths()

root.title("Josephson Circuits Optimizer")
root.geometry("1900x1000")
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
                      text="💻 Josephson Circuits Optimizer", 
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

clear_plots_btn = ttk.Button(button_frame, text="Clear Plots", 
                             command=clear_plots,
                             style="Primary.TButton")
clear_plots_btn.pack(side='left', padx=(0, 10))

clear_corr_btn = ttk.Button(button_frame, text="Clear Matrices", 
                            command=clear_corr,
                            style="Primary.TButton")
clear_corr_btn.pack(side='left', padx=(0, 10))


# Workspace row
ws_frame = tk.Frame(control_frame, bg=COLORS['bg'])
ws_frame.pack(fill='x', pady=(10, 0))

tk.Label(ws_frame, text="Experiment folder:", bg=COLORS['bg'], fg=COLORS['text']).pack(side='left')

ws_entry = ttk.Entry(ws_frame, textvariable=workspace_var, width=80)
ws_entry.pack(side='left', padx=(10, 10), fill='x', expand=True)

ws_browse = ttk.Button(ws_frame, text="Browse...", command=browse_workspace, style="Primary.TButton")
ws_browse.pack(side='left')

ws_open = ttk.Button(ws_frame, text="Open Folder", command=lambda: open_path(workspace_var.get()), style="Primary.TButton")
ws_open.pack(side='left', padx=(10, 0))

# Progress bar
progress_frame = tk.Frame(control_frame, bg=COLORS['bg'])
progress_frame.pack(fill='x', pady=(10, 0))

tk.Label(progress_frame, text="Status:", font=('Arial', 9), 
         bg=COLORS['bg'], fg=COLORS['text']).pack(side='left')

progress_bar = ttk.Progressbar(progress_frame, mode='determinate', length=200)
progress_bar.pack(side='left', padx=(10, 0), fill='x', expand=True)


def update_plot_metadata(image_path):
    meta = load_sidecar_json(image_path)
    plot_metadata_box.delete(1.0, tk.END)
    plot_metadata_box.insert(tk.END, format_metadata(meta))


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

# File browser under output (open files/folders externally on double-click)
files_frame = tk.LabelFrame(left_panel, text="Experiment Files",
                            font=('Arial', 10, 'bold'),
                            fg=COLORS['primary'],
                            bg=COLORS['bg'],
                            padx=8, pady=8)
files_frame.pack(fill='both', expand=False, pady=(10, 0))

tree = ttk.Treeview(files_frame, columns=("fullpath",), show="tree")
tree.pack(side='left', fill='both', expand=True)

tree_scroll = ttk.Scrollbar(files_frame, orient='vertical', command=tree.yview)
tree.configure(yscrollcommand=tree_scroll.set)
tree_scroll.pack(side='right', fill='y')

tree.bind("<Double-1>", on_tree_double_click)

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


# Plot metadata viewer
plot_meta_label = tk.Label(right_panel, text="Plot metadata",
                           font=('Arial', 10, 'bold'),
                           fg=COLORS['primary'],
                           bg=COLORS['bg'])
plot_meta_label.pack(anchor='w', pady=(10, 0))

plot_metadata_box = tk.Text(right_panel, height=10,
                            font=('Consolas', 9),
                            bg='#f5f5f5',
                            fg=COLORS['text'],
                            wrap=tk.WORD)
plot_metadata_box.pack(fill='x', pady=(5, 0))


# Footer
footer_frame = tk.Frame(main_frame, bg=COLORS['bg'])
footer_frame.pack(fill='x', pady=(20, 0))

footer_label = tk.Label(footer_frame, 
                       text=f"Project: {os.path.basename(project_path)}",
                       font=('Arial', 8),
                       fg=COLORS['dark'],
                       bg=COLORS['bg'])
footer_label.pack()

# Right panel - Correlation Viewer
corr_panel = tk.LabelFrame(content_frame, text="Correlation Viewer", 
                           font=('Arial', 12, 'bold'),
                           fg=COLORS['primary'],
                           bg=COLORS['bg'],
                           padx=10, pady=10)
corr_panel.pack(side='right', fill='both', expand=True)


def update_corr_metadata(image_path):
    meta = load_sidecar_json(image_path)
    corr_metadata_box.delete(1.0, tk.END)
    corr_metadata_box.insert(tk.END, format_metadata(meta))


# Correlation canvas
corr_canvas = tk.Canvas(corr_panel, width=600, height=450,
                        bg='white', highlightthickness=1,
                        highlightbackground=COLORS['dark'])
corr_canvas.pack(pady=(0, 10))

# Navigation
corr_nav_frame = tk.Frame(corr_panel, bg=COLORS['bg'])
corr_nav_frame.pack(fill='x')

corr_prev_button = ttk.Button(corr_nav_frame, text="◀ Previous",
                              command=prev_corr,
                              style="Primary.TButton",
                              state='disabled')
corr_prev_button.pack(side='left', padx=(0, 5))

corr_next_button = ttk.Button(corr_nav_frame, text="Next ▶",
                              command=next_corr,
                              style="Primary.TButton",
                              state='disabled')
corr_next_button.pack(side='left', padx=(5, 0))

# Correlation status
corr_status_label = tk.Label(corr_nav_frame, text="No correlation matrices to display",
                             font=('Arial', 10),
                             fg=COLORS['dark'],
                             bg=COLORS['bg'])
corr_status_label.pack(side='right')


# Correlation metadata viewer
corr_meta_label = tk.Label(corr_panel, text="Matrix metadata",
                           font=('Arial', 10, 'bold'),
                           fg=COLORS['primary'],
                           bg=COLORS['bg'])
corr_meta_label.pack(anchor='w', pady=(10, 0))

corr_metadata_box = tk.Text(corr_panel, height=10,
                            font=('Consolas', 9),
                            bg='#f5f5f5',
                            fg=COLORS['text'],
                            wrap=tk.WORD)
corr_metadata_box.pack(fill='x', pady=(5, 0))



# Initialize
log_message("GUI initialized. Ready to run simulations.", 'success')
ensure_workspace_structure(workspace_var.get())
refresh_file_tree()
update_corr()
update_plot()

# Handle window closing
def on_closing():
    if process is not None:
        stop_simulation()
    root.destroy()

root.protocol("WM_DELETE_WINDOW", on_closing)
root.mainloop()