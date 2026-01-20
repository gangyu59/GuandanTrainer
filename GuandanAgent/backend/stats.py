import json
import os
import time
from typing import List, Dict, Any

STATS_FILE = os.path.join(os.path.dirname(__file__), '../../output/training_stats.json')

def load_stats() -> List[Dict[str, Any]]:
    if not os.path.exists(STATS_FILE):
        return []
    try:
        with open(STATS_FILE, 'r') as f:
            return json.load(f)
    except:
        return []

def save_stat(win_rate: float, hand_score: int, iterations: int):
    stats = load_stats()
    
    # Limit stats to last 100 entries to prevent file bloat
    if len(stats) > 100:
        stats = stats[-99:]
        
    stats.append({
        "timestamp": time.time(),
        "win_rate": win_rate,
        "hand_score": hand_score,
        "iterations": iterations
    })
    
    os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
    with open(STATS_FILE, 'w') as f:
        json.dump(stats, f, indent=2)

def get_dashboard_data():
    stats = load_stats()
    # Process for frontend
    # Just return raw list for now
    return {
        "history": stats,
        "summary": {
            "total_games": len(stats),
            "avg_win_rate": sum(s['win_rate'] for s in stats) / len(stats) if stats else 0
        }
    }
