"""설정 - PostgreSQL 전환 시 DATABASE_URL 환경 변수로 변경"""
import os
from pathlib import Path

# SQLite 기본 경로 (PostgreSQL 전환 시 DATABASE_URL 사용)
DB_PATH = Path(__file__).parent.parent / "trades.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# SQLite 사용 여부 (PostgreSQL 전환 시 False)
USE_SQLITE = DATABASE_URL.startswith("sqlite")
