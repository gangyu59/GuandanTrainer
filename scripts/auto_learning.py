from fastapi import APIRouter
import sqlite3
import subprocess

router = APIRouter()


@router.post("/auto-train")
async def auto_train():
    conn = sqlite3.connect('../db/game_data.sqlite')
    count = conn.execute("SELECT COUNT(*) FROM game_logs").fetchone()[0]
    conn.close()

    if count < 1000:
        return {"status": "skip", "reason": "Insufficient data"}

    try:
        subprocess.run(["python", "scripts/train.py", "--auto"], check=True)
        return {"status": "success"}
    except subprocess.CalledProcessError as e:
        return {"status": "error", "error": str(e)}