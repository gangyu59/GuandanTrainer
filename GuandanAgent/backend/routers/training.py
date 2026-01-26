
from fastapi import APIRouter, BackgroundTasks
import json
import os
import subprocess
import sys

router = APIRouter()

STATS_FILE = os.path.join(os.path.dirname(__file__), "../data/training_stats.json")
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))

import psutil
import time

# Global variable to track the running process
current_training_process = None
should_stop = False

def run_training_task(mode: str):
    """
    Run training in a subprocess (Infinite Loop).
    mode: 'heuristic' (Stage 1) or 'self_play' (Stage 2)
    """
    global current_training_process, should_stop
    should_stop = False

    python_exe = sys.executable
    script_path = os.path.join(PROJECT_ROOT, "GuandanAgent", "train.py")
    
    # Infinite loop arguments (no --games limit)
    if mode == 'heuristic':
        cmd = [python_exe, script_path, "--opponent", "heuristic"]
    else:
        cmd = [python_exe, script_path, "--opponent", "mcts"]
        
    try:
        print(f"Starting Infinite Training Task: {mode}...")
        # Use Popen to control the process
        current_training_process = subprocess.Popen(cmd, cwd=PROJECT_ROOT)
        
        # Wait for process or stop signal
        while current_training_process.poll() is None:
            if should_stop:
                print("Stopping training task...")
                current_training_process.terminate()
                try:
                    current_training_process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    current_training_process.kill()
                break
            time.sleep(1)
            
        print(f"Training Task {mode} Stopped/Completed.")
    except Exception as e:
        print(f"Training Task Failed: {e}")
    finally:
        current_training_process = None
        should_stop = False

@router.get("/status")
async def get_training_status():
    global current_training_process
    is_running = current_training_process is not None and current_training_process.poll() is None
    return {"running": is_running}

@router.post("/stop")
async def stop_training():
    global should_stop, current_training_process
    if current_training_process is not None:
        should_stop = True
        return {"status": "stopping"}
    return {"status": "not_running"}


@router.get("/stats")
async def get_training_stats():
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r") as f:
                return json.load(f)
        except:
            pass
    
    # Default initial stats
    return {
        "games_played": 0,
        "current_win_rate": 0.5,
        "model_version": "v0.1 (Initializing)",
        "history": []
    }

@router.post("/start")
async def start_training(background_tasks: BackgroundTasks, mode: str = "self_play"):
    """
    Start a training session in the background.
    """
    background_tasks.add_task(run_training_task, mode)
    return {"status": "started", "mode": mode}
