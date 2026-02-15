import re
from pydantic import BaseModel, Field, field_validator
from typing import Optional


class TradeCreate(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD 형식")
    ticker: str = Field(..., description="예: $name")
    chain: str = Field(..., description="예: Solana, Ethereum")
    ca: Optional[str] = None
    pnl: float = Field(..., description="손익 (달러)")
    memo: Optional[str] = None

    @field_validator("date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("날짜는 YYYY-MM-DD 형식이어야 합니다")
        return v


class TradeUpdate(BaseModel):
    memo: Optional[str] = None
    pnl: Optional[float] = None


class TradeResponse(BaseModel):
    id: str
    date: str
    ticker: str
    chain: str
    ca: Optional[str] = None
    pnl: float
    memo: Optional[str] = None
    created_at: str
    updated_at: str


class DaySummary(BaseModel):
    date: Optional[str] = None
    pnl: float


class TopTrade(BaseModel):
    ticker: str
    date: str
    pnl: float


class StatsResponse(BaseModel):
    total_pnl: float
    win_rate: float
    total_trades: int
    wins: int
    losses: int
    best_day: Optional[DaySummary] = None
    worst_day: Optional[DaySummary] = None
    top_wins: list[TopTrade]
    top_losses: list[TopTrade]
