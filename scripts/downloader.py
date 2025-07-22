# === scripts/downloader.py ===
import json
import sqlite3
import requests
from .firebase_config import FIREBASE_URL


def load_data(source='firebase'):
    if source == 'firebase':
        return download_from_firebase()
    elif source == 'local':
        return load_from_sqlite()
    else:
        raise ValueError(f"未知数据源: {source}")


def download_from_firebase():
    try:
        print(f"🚀 正在从 Firebase 请求数据: {FIREBASE_URL}")
        response = requests.get(FIREBASE_URL, timeout=10)
        response.raise_for_status()
        raw = response.json() or {}
        all_entries = []
        for key, round_data in raw.items():
            if isinstance(round_data, list):
                all_entries.extend(round_data)
        print(f"✅ Firebase 下载完成，共 {len(all_entries)} 条记录")
        return all_entries
    except Exception as e:
        print(f"❌ Firebase 下载出错: {e}")
        return []


def load_from_sqlite(db_path='db/game_data.sqlite'):
    try:
        conn = sqlite3.connect(db_path)
        cur = conn.cursor()
        cur.execute("SELECT state, action, meta FROM game_records")
        rows = cur.fetchall()
        conn.close()

        parsed = []
        for row in rows:
            state = json.loads(row[0])
            action = json.loads(row[1])
            meta = json.loads(row[2]) if row[2] else {}
            parsed.append({"state": state, "action": action, "meta": meta})

        print(f"✅ SQLite 加载完成，共 {len(parsed)} 条记录")
        return parsed
    except Exception as e:
        print(f"❌ SQLite 加载出错: {e}")
        return []
