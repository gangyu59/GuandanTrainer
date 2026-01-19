from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers.health import router as health_router
from backend.routers.deal import router as deal_router
from backend.routers.ai import router as ai_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router, prefix="/api")
    app.include_router(deal_router, prefix="/api")
    app.include_router(ai_router, prefix="/api")
    return app


app = create_app()
