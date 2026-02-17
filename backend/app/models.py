import re
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional

TRADE_TYPES = ['Viral', 'Cult', 'KOL / Cabal', 'Political', 'Reversal', 'AI', 'Tech', 'Animal', 'ETC']


class TradeCreate(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD 형식")
    ticker: str = Field(..., description="예: $name")
    chain: str = Field(..., description="예: Solana, Ethereum")
    ca: Optional[str] = None
    pnl: float = Field(..., description="손익 (달러)")
    memo: Optional[str] = None
    entry_amount: Optional[float] = None  # 클라이언트에서 무시됨, 서버에서 자동 계산
    return_percent: float = Field(..., description="수익률 (%)")
    trade_type: Optional[str] = None

    @field_validator("date")
    @classmethod
    def validate_date_format(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Date must be in YYYY-MM-DD format")
        return v

    @field_validator("trade_type")
    @classmethod
    def validate_trade_type(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in TRADE_TYPES:
            raise ValueError(f"trade_type must be one of {TRADE_TYPES}")
        return v

    @field_validator("return_percent")
    @classmethod
    def validate_return_percent(cls, v: float) -> float:
        if v == 0:
            raise ValueError("return_percent cannot be 0")
        return v

    @model_validator(mode='after')
    def compute_entry_amount(self):
        """entry_amount 자동 계산: entry_amount = pnl / (return_percent / 100)"""
        # 클라이언트에서 보낸 entry_amount는 무시
        self.entry_amount = None
        
        # 부호 일치: pnl과 return_percent의 부호가 다르면 return_percent 부호를 pnl에 맞춤
        normalized_return = self.return_percent
        if (self.pnl > 0 and self.return_percent < 0) or (self.pnl < 0 and self.return_percent > 0):
            normalized_return = -abs(self.return_percent)
            self.return_percent = normalized_return
        
        # entry_amount 계산
        self.entry_amount = self.pnl / (normalized_return / 100)
        
        if self.entry_amount <= 0:
            raise ValueError("Calculated entry_amount is less than or equal to 0. Please check the signs of PnL and Return %.")
        
        return self


class TradeUpdate(BaseModel):
    memo: Optional[str] = None
    pnl: Optional[float] = None
    entry_amount: Optional[float] = None  # 클라이언트에서 무시됨, 서버에서 자동 계산
    return_percent: Optional[float] = None
    trade_type: Optional[str] = None

    @model_validator(mode='after')
    def compute_entry_amount_if_needed(self):
        """pnl과 return_percent가 모두 제공되면 entry_amount 자동 계산"""
        if self.pnl is not None and self.return_percent is not None:
            if self.return_percent == 0:
                raise ValueError("return_percent cannot be 0")
            
            # 부호 일치
            normalized_return = self.return_percent
            if (self.pnl > 0 and self.return_percent < 0) or (self.pnl < 0 and self.return_percent > 0):
                normalized_return = -abs(self.return_percent)
                self.return_percent = normalized_return
            
            # entry_amount 계산
            self.entry_amount = self.pnl / (normalized_return / 100)
            
            if self.entry_amount <= 0:
                raise ValueError("Calculated entry_amount is less than or equal to 0. Please check the signs of PnL and Return %.")
        return self


class TradeResponse(BaseModel):
    id: str
    date: str
    ticker: str
    chain: str
    ca: Optional[str] = None
    pnl: float
    memo: Optional[str] = None
    entry_amount: Optional[float] = None
    return_percent: Optional[float] = None
    trade_type: Optional[str] = None
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


class PositionSizeBucket(BaseModel):
    bucket: str
    trades: int
    win_rate: float
    avg_win_percent: float
    avg_loss_percent: float
    ev_percent: float
    total_pnl: float
    avg_win_dollar: float
    avg_loss_dollar: float
    ev_dollar: float


class TradeTypeStats(BaseModel):
    trade_type: str
    trades: int
    win_rate: float
    ev_percent: float
    total_pnl: float


class AnalyticsResponse(BaseModel):
    position_size_buckets: list[PositionSizeBucket]
    trade_type_stats: list[TradeTypeStats]
    equity_curve: list[dict]  # [{date: str, cumulative_pnl: float}]
