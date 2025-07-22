from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from scripts.api import router as api_router
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 添加CORS支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# === 1. Mount 静态资源 ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Mount /static/ → TrainerUI/static/
app.mount(
    "/static",
    StaticFiles(directory=os.path.join(BASE_DIR, "TrainerUI", "static")),
    name="static"
)

# Mount /HappyGuandan/ → HappyGuandan/
app.mount(
    "/HappyGuandan",
    StaticFiles(directory=os.path.join(BASE_DIR, "HappyGuandan"), html=True),
    name="HappyGuandan"
)

# === 2. 首页路由：返回 TrainerUI/index.html ===
@app.get("/")
async def root():
    index_path = os.path.join(BASE_DIR, "TrainerUI", "index.html")
    return FileResponse(index_path)

# === 3. 注册 API 路由 ===
app.include_router(api_router, prefix="/api")