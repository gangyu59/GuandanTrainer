import asyncio
import datetime

from fastapi import APIRouter, Request
import sqlite3, json, os, subprocess
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from .downloader import load_data
from .processor import clean_dataset, parse_dataset, analyze_meta
from .trainer import train_model
from .export import export_weights
from .simple_mlp import SimpleMLP

router = APIRouter()

# 计算绝对路径：项目根目录下的 db/game_data.sqlite
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "db", "game_data.sqlite")
print("📦 当前 DB 路径为:", DB_PATH)


# ============ 路由定义 ============
@router.post("/save_sqlite")
async def save_sqlite(request: Request):
    try:
        data = await request.json()
        if not isinstance(data, list):
            return JSONResponse(
                content={"error": "数据格式必须为数组"},
                headers={"Access-Control-Allow-Origin": "*"}
            )

        os.makedirs("db", exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS game_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                state TEXT,
                action TEXT,
                meta TEXT,
                timestamp INTEGER
            )
        """)

        for row in data:
            cur.execute(
                "INSERT INTO game_records (state, action, meta, timestamp) VALUES (?, ?, ?, ?)",
                (
                    json.dumps(row.get("state")),
                    json.dumps(row.get("action")),
                    json.dumps(row.get("meta", {})),
                    row.get("timestamp", 0)
                )
            )

        conn.commit()
        conn.close()
        return JSONResponse(
            content={"message": f"成功写入 {len(data)} 条记录"},
            headers={"Access-Control-Allow-Origin": "*"}
        )
    except Exception as e:
        return JSONResponse(
            content={"error": str(e)},
            headers={"Access-Control-Allow-Origin": "*"}
        )


# ... (其他路由保持相同结构，只是添加headers参数) ...

status = {
    "status": "idle",  # idle / training / done / error
    "epoch": 0,
    "total": 0,
    "metrics": {},
    "last_updated": None
}


@router.post("/train")
async def train_model_api(request: Request):
    print("✅ 收到训练请求")
    try:
        config = await request.json()
        print(f"⚙️ 配置参数: {config}")

        status.update({
            "status": "training",
            "epoch": 0,
            "total": int(config.get("epochs", 10)),
            "metrics": {},
            "last_updated": datetime.datetime.now().isoformat()
        })

        # 模拟训练过程
        for epoch in range(status["total"]):
            status["epoch"] = epoch + 1
            status["last_updated"] = datetime.datetime.now().isoformat()
            print(f"⏳ 训练进度: {epoch + 1}/{status['total']}")
            await asyncio.sleep(1)  # 非阻塞等待

        status.update({
            "status": "done",
            "metrics": {"accuracy": 0.95},
            "last_updated": datetime.datetime.now().isoformat()
        })

        return JSONResponse(
            content={"status": "success"},
            headers={"Access-Control-Allow-Origin": "*"}
        )
    except Exception as e:
        status.update({
            "status": "error",
            "error": str(e),
            "last_updated": datetime.datetime.now().isoformat()
        })
        return JSONResponse(
            content={"error": str(e)},
            headers={"Access-Control-Allow-Origin": "*"}
        )


@router.get("/status")
def get_status():
    current_status = {
        "status": status["status"],
        "epoch": status["epoch"],
        "total": status["total"],
        "metrics": status["metrics"],
        "last_updated": status["last_updated"],
        "server_time": datetime.datetime.now().isoformat()  # 新增服务器时间
    }
    print(f"🔍 详细状态查询: {current_status}")
    return JSONResponse(
        content=current_status,
        headers={"Access-Control-Allow-Origin": "*"}
    )



@router.get("/count")
def get_record_count():
    if not os.path.exists(DB_PATH):
        return {"count": 0}
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM game_records")
        count = cur.fetchone()[0]
        conn.close()
        return {"count": count}
    except Exception as e:
        return {"error": str(e)}