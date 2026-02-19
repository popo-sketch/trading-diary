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
                entry_amount REAL,
                return_percent REAL,
                trade_type TEXT,
                avg_entry_mc REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_date ON trades(date)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_ticker ON trades(ticker)")
        await conn.execute("CREATE INDEX IF NOT EXISTS idx_trade_type ON trades(trade_type)")
        
        # 마이그레이션: 기존 테이블에 새 컬럼 추가 (없는 경우만)
        try:
            await conn.execute("ALTER TABLE trades ADD COLUMN entry_amount REAL")
        except:
            pass
        try:
            await conn.execute("ALTER TABLE trades ADD COLUMN return_percent REAL")
        except:
            pass
        try:
            await conn.execute("ALTER TABLE trades ADD COLUMN trade_type TEXT")
        except:
            pass
        try:
            await conn.execute("ALTER TABLE trades ADD COLUMN avg_entry_mc REAL")
        except:
            pass

        await conn.commit()
    finally:
        await conn.close()
