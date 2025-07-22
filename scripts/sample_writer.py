import sqlite3
import json
import os

db_path = os.path.join("db", "game_data.sqlite")
os.makedirs("db", exist_ok=True)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute('''
    CREATE TABLE IF NOT EXISTS game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        state TEXT,
        action TEXT,
        meta TEXT
    )
''')

sample = {
    "state": [0] * 288,
    "action": [0] * 54,
    "meta": {
        "playerIndex": 0,
        "winner": "self"
    }
}
sample["action"][10] = 1  # 随便给一个合法动作

cursor.execute('''
    INSERT INTO game_records (state, action, meta)
    VALUES (?, ?, ?)
''', (
    json.dumps(sample["state"]),
    json.dumps(sample["action"]),
    json.dumps(sample["meta"])
))

conn.commit()
conn.close()
print("✅ 已插入测试数据到本地 SQLite")
