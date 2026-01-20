
from fastapi import APIRouter
import json
import os

router = APIRouter()

STATS_FILE = os.path.join(os.path.dirname(__file__), "../data/training_stats.json")

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
