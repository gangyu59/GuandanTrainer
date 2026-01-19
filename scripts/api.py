import datetime
import json  # 用于JSON序列化
import os  # 用于路径操作
import sqlite3
import traceback  # 用于打印完整错误堆栈

import torch
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .downloader import load_data
from .export import export_weights
from .processor import clean_dataset, parse_dataset
from .trainer import train_model

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



status = {
    "status": "idle",  # idle / training / done / error
    "epoch": 0,
    "total": 0,
    "metrics": {},
    "last_updated": None
}

training_logs = []

def append_log(msg):
    training_logs.append(msg)
    if len(training_logs) > 100:
        training_logs.pop(0)


# @router.post("/train")
# async def train_model_api(request: Request):
#     try:
#         config = await request.json()
#         source = config.get("source", "local")
#         epochs = int(config.get("epochs", 50))
#
#         status.update({
#             "status": "training",
#             "epoch": 0,
#             "total": epochs,
#             "metrics": {},
#             "last_updated": datetime.datetime.now().isoformat()
#         })
#
#         raw_data = load_data(source)
#         cleaned_data = clean_dataset(raw_data)
#         X, y, meta = parse_dataset(cleaned_data)
#
#         # 获取胜率和动作分布
#         stats = analyze_meta(meta, y)  # 返回 winrate + action_dist
#
#         from scripts.simple_mlp import SimpleMLP
#         model = train_model(X, y, epochs, status=status, log_callback=append_log)
#
#         # export_weights(model)
#         export_weights(
#             model,
#             filepath='HappyGuandan/assets/ai/model_weights.json'  # 完整相对路径
#         )
#
#         # 更新状态，包含样本数、胜率、动作分布
#         action_dist = stats.get("action_dist")
#         if action_dist:
#             action_dist = {int(k): float(v) for k, v in action_dist.items()}  # 转换为可序列化格式
#
#         status.update({
#             "status": "done",
#             "metrics": {
#                 "samples": len(X),
#                 "winrate": float(stats.get("winrate", 0)),
#                 "action_dist": action_dist,
#                 "accuracy": float(stats.get("accuracy", 0)),
#                 "entropy": float(stats.get("entropy", 0)),
#             },
#             "last_updated": datetime.datetime.now().isoformat()
#         })
#
#         return {"status": "done"}
#
#     except Exception as e:
#         status.update({
#             "status": "error",
#             "error": str(e),
#             "last_updated": datetime.datetime.now().isoformat()
#         })
#         return {"error": str(e)}


@router.post("/train")
async def train_model_api(request: Request):
    try:
        print("\n=== 调试开始 ===")

        # 1. 基础检查
        print("[1] 基本验证:")
        print(f"- PyTorch版本: {torch.__version__}")
        print(f"- CUDA可用: {torch.cuda.is_available()}")

        # 2. 加载配置和数据
        config = await request.json()
        print(f"[2] 配置: {config}")

        raw_data = load_data(config.get("source", "local"))
        print(f"[3] 数据加载完成: 样本数={len(raw_data)}")

        # 3. 模型训练
        from scripts.simple_mlp import SimpleMLP
        print("[4] 初始化模型...")
        model = SimpleMLP(input_dim=340, output_dim=54)  # 硬编码维度仅用于测试

        # [关键检查点] 训练前验证
        print(f"[5] 模型验证:")
        print(f"- 类型: {type(model)}")
        print(f"- 参数键: {list(model.state_dict().keys())}")
        print(f"- 设备: {next(model.parameters()).device}")

        # 4. 导出测试（跳过训练）
        print("[6] 直接导出测试模型...")
        export_weights(
            model,
            filepath='HappyGuandan/assets/ai/TEST_weights.json'  # 测试用路径
        )

        return {"status": "测试导出成功"}

    except Exception as e:
        print(f"❌ 错误类型: {type(e).__name__}")
        print(f"错误详情: {str(e)}")
        print("堆栈跟踪:")
        traceback.print_exc()
        raise



@router.get("/status")
def get_status():
    # 深度复制状态以避免修改原始数据
    metrics = status.get("metrics", {})

    # 显式转换所有 NumPy 类型为 Python 原生类型
    safe_metrics = {
        "samples": int(metrics.get("samples", 0)),
        "winrate": float(metrics.get("winrate", 0)),
        "action_dist": {int(k): float(v) for k, v in metrics.get("action_dist", {}).items()},
        "accuracy": float(metrics.get("accuracy", 0)),  # 强制转换 np.float64
        "entropy": float(metrics.get("entropy", 0))  # 强制转换 np.float32
    }

    current_status = {
        "status": status.get("status"),
        "epoch": int(status.get("epoch", 0)),
        "total": int(status.get("total", 0)),
        "metrics": safe_metrics,  # 使用转换后的安全数据
        "last_updated": status.get("last_updated"),
        "server_time": datetime.datetime.now().isoformat(),
        "logs": training_logs,
        "error": status.get("error")
    }

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