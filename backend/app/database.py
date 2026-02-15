import aiosqlite
from pathlib import Path

from app.config import DB_PATH


async def get_db():
    """DB 연결 반환"""
    conn = await aiosqlite.connect(DB_PATH)
    conn.row_factory = aiosqlite.Row
    return conn


async def init_db():
    """테이블 및 인덱스 생성"""
    conn = await get_db()
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                date TEXT NOT NULL,
                ticker TEXT NOT NULL,
                chain TEXT NOT NULL,
                ca TEXT,
                pnl REAL NOT NULL,
                memo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_date ON trades(date)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_ticker ON trades(ticker)")
        await conn.commit()
    finally:
        await conn.close()
