from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routes import trades as trades_router
from app.routes import stats as stats_router
from app.routes import analytics as analytics_router

app = FastAPI(title="PNL Calendar API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await init_db()


app.include_router(trades_router.router, prefix="/api/trades", tags=["trades"])
app.include_router(stats_router.router, prefix="/api/stats", tags=["stats"])
app.include_router(analytics_router.router, prefix="/api/analytics", tags=["analytics"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
