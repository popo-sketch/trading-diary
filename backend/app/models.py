import re
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional

TRADE_TYPES = ['Viral', 'Cult', 'AI', 'Tech', 'Animals', 'Elon', 'CZ', 'Heyi', 'Trump', 'BNB', 'Meta', 'Meme']


class TradeCreate(BaseModel):
    date: str = Field(..., description="YYYY-MM-DD 형식")
    ticker: str = Field(..., description="예: $name")
    chain: str = Field(..., description="예: Solana, Ethereum")
    ca: Optional[str] = None
    pnl: float = Field(..., description="손익 (달러)")
    memo: Optional[str] = None
    entry_amount: Optional[float] = None  # 수동 입력 우선, 없으면 자동 계산
    return_percent: float = Field(..., description="수익률 (%)")
    trade_type: Optional[str] = None
    avg_entry_mc: Optional[float] = None  # 평균 진입 시총 ($)
    is_mine: Optional[bool] = False  # 지뢰플레이 여부
    trade_style: Optional[str] = None  # '계획매매' 또는 '뇌동매매'

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

    @field_validator("trade_style")
    @classmethod
    def validate_trade_style(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ('계획매매', '뇌동매매'):
            raise ValueError("trade_style must be '계획매매' or '뇌동매매'")
        return v

    @field_validator("return_percent")
    @classmethod
    def validate_return_percent(cls, v: float) -> float:
        if v == 0:
            raise ValueError("return_percent cannot be 0")
        return v

    @model_validator(mode='after')
    def compute_entry_amount(self):
        """수동 입력값이 있으면 그대로 사용, 없으면 자동 계산"""
        # 부호 일치: pnl과 return_percent의 부호가 다르면 return_percent 부호를 pnl에 맞춤
        normalized_return = self.return_percent
        if (self.pnl > 0 and self.return_percent < 0) or (self.pnl < 0 and self.return_percent > 0):
            normalized_return = -abs(self.return_percent)
            self.return_percent = normalized_return

        # 수동 입력값이 있으면 그대로 사용
        manual = self.entry_amount
        if manual is not None and manual > 0:
            return self

        # 자동 계산 fallback
        self.entry_amount = self.pnl / (normalized_return / 100)

        if self.entry_amount <= 0:
            raise ValueError("Calculated entry_amount is less than or equal to 0. Please check the signs of PnL and Return %.")

        return self


class TradeUpdate(BaseModel):
    memo: Optional[str] = None
    pnl: Optional[float] = None
    entry_amount: Optional[float] = None  # 수동 입력 우선, 없으면 자동 계산
    return_percent: Optional[float] = None
    trade_type: Optional[str] = None
    avg_entry_mc: Optional[float] = None
    is_mine: Optional[bool] = None
    trade_style: Optional[str] = None

    @model_validator(mode='after')
    def compute_entry_amount_if_needed(self):
        """수동 입력값이 있으면 그대로 사용, 없으면 pnl+return_percent로 자동 계산"""
        pnl_val = self.pnl
        ret_val = self.return_percent
        # 부호 일치
        if pnl_val is not None and ret_val is not None:
            if ret_val == 0:
                raise ValueError("return_percent cannot be 0")
            normalized_return: float = ret_val
            if (pnl_val > 0 and ret_val < 0) or (pnl_val < 0 and ret_val > 0):
                normalized_return = -abs(ret_val)
                self.return_percent = normalized_return

            # 수동 입력값이 있으면 그대로 사용
            manual = self.entry_amount
            if manual is not None and manual > 0:
                return self

            # 자동 계산 fallback
            self.entry_amount = pnl_val / (normalized_return / 100)
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
    avg_entry_mc: Optional[float] = None
    is_mine: Optional[bool] = False
    trade_style: Optional[str] = None
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
    avg_win_percent: float
    avg_loss_percent: float
    ev_percent: float
    total_pnl: float


class AnalyticsResponse(BaseModel):
    position_size_buckets: list[PositionSizeBucket]
    trade_type_stats: list[TradeTypeStats]
    equity_curve: list[dict]  # [{date: str, cumulative_pnl: float}]
    ev_curve: list[dict]  # [{date: str, ev_percent: float}] 월 시작~해당 날짜 누적 평균 EV%
    kelly_percent: float | None = None  # 월 전체 (Win%×AvgWin% - Loss%×AvgLoss%) / AvgWin%, 양수만
