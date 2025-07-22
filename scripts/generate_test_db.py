# scripts/generate_test_db.py
import sqlite3
import json

conn = sqlite3.connect("db/game_data.sqlite")
cur = conn.cursor()
cur.execute("""
    CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state TEXT,
        action TEXT,
        meta TEXT
    )
""")

sample = {
    "state": [0.0] * 288,
    "action": [0.0] * 54,
    "meta": {"winner": "self", "playerIndex": 0}
}
sample["action"][0] = 1.0

cur.execute("INSERT INTO game_records (state, action, meta) VALUES (?, ?, ?)", (
    json.dumps(sample["state"]),
    json.dumps(sample["action"]),
    json.dumps(sample["meta"]),
))
conn.commit()
conn.close()
print("✅ 插入测试数据成功")
