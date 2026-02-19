from fastapi import APIRouter, Query
from app.database import get_db
from app.models import AnalyticsResponse, PositionSizeBucket, TradeTypeStats
from typing import Optional

router = APIRouter()


def get_bucket(entry_amount: Optional[float]) -> str:
    """포지션 크기에 따라 버킷 반환"""
    if entry_amount is None or entry_amount < 1000:
        return "< $1K"
    elif entry_amount < 5000:
        return "$1K-$5K"
    elif entry_amount < 10000:
        return "$5K-$10K"
    else:
        return "> $10K"


@router.get("", response_model=AnalyticsResponse)
async def get_analytics(
    year: Optional[int] = Query(None, ge=2000, le=2100),
    month: Optional[int] = Query(None, ge=1, le=12),
    bucket_filter: Optional[str] = Query(None, alias="bucket_filter", description="Position size bucket filter"),
):
    """고급 분석 데이터 반환"""
    conn = await get_db()
    try:
        # 날짜 필터 조건
        date_filter = ""
        params = []
        if year and month:
            date_filter = "WHERE date LIKE ?"
            params.append(f"{year}-{month:02d}%")
        elif year:
            date_filter = "WHERE date LIKE ?"
            params.append(f"{year}%")

        # 모든 거래 가져오기 (entry_amount, return_percent, trade_type 필요)
        query = f"""
            SELECT date, entry_amount, return_percent, trade_type, pnl
            FROM trades
            {date_filter}
            ORDER BY date
        """
        cursor = await conn.execute(query, tuple(params))
        rows = await cursor.fetchall()

        # 포지션 크기 버킷 분석
        buckets = {
            "< $1K": [],
            "$1K-$5K": [],
            "$5K-$10K": [],
            "> $10K": []
        }

        # 거래 타입별 데이터
        trade_type_data = {}

        cumulative_pnl = 0
        equity_curve = []
        ev_curve = []
        bucket_trades_for_ev = []  # bucket 포함 + return_percent 있는 거래만 (누적)

        for row in rows:
            row = dict(row)
            entry_amount = row.get("entry_amount")
            return_percent = row.get("return_percent")
            trade_type = row.get("trade_type") or "Unknown"
            pnl = row["pnl"]
            date = row["date"]
            
            # entry_amount나 return_percent가 None이면 버킷 분석에서 제외
            if entry_amount is None or return_percent is None:
                # 거래 타입별 데이터에는 포함 (trade_type만 있으면)
                if trade_type and trade_type != "Unknown":
                    if trade_type not in trade_type_data:
                        trade_type_data[trade_type] = []
                    trade_type_data[trade_type].append({
                        "pnl": pnl,
                        "return_percent": return_percent
                    })
                # Equity curve에도 포함 (bucket filter 무관)
                if bucket_filter is None:
                    cumulative_pnl += pnl
                    equity_curve.append({"date": date, "cumulative_pnl": cumulative_pnl})
                continue

            # 버킷 분류
            bucket = get_bucket(entry_amount)
            
            # 버킷 필터 적용 여부 확인
            include_in_bucket = bucket_filter is None or bucket == bucket_filter
            
            if include_in_bucket:
                buckets[bucket].append({
                    "pnl": pnl,
                    "return_percent": return_percent,
                    "entry_amount": entry_amount
                })

            # 거래 타입별 데이터 (모든 거래 포함, 필터 무관)
            if trade_type:
                if trade_type not in trade_type_data:
                    trade_type_data[trade_type] = []
                trade_type_data[trade_type].append({
                    "pnl": pnl,
                    "return_percent": return_percent
                })

            # Equity curve (bucket filter 적용)
            if include_in_bucket:
                cumulative_pnl += pnl
                equity_curve.append({"date": date, "cumulative_pnl": cumulative_pnl})
                # EV curve: 해당 시점까지 누적 거래로 EV% 계산 (Win Rate × Avg Win% - Loss Rate × Avg Loss%)
                bucket_trades_for_ev.append({"pnl": pnl, "return_percent": return_percent})
                wins_ev = [t for t in bucket_trades_for_ev if t["pnl"] > 0]
                losses_ev = [t for t in bucket_trades_for_ev if t["pnl"] <= 0]
                n = len(bucket_trades_for_ev)
                if n > 0:
                    win_rate = len(wins_ev) / n
                    loss_rate = 1 - win_rate
                    avg_win_pct = sum(t["return_percent"] for t in wins_ev) / len(wins_ev) if wins_ev else 0
                    avg_loss_pct = sum(t["return_percent"] for t in losses_ev) / len(losses_ev) if losses_ev else 0
                    ev_percent = (win_rate * avg_win_pct) - (loss_rate * abs(avg_loss_pct))
                else:
                    ev_percent = 0.0
                ev_curve.append({"date": date, "ev_percent": round(ev_percent, 2)})

        # Kelly%: 월 전체 (Win%×AvgWin% - Loss%×AvgLoss%) / AvgWin%, 양수만
        kelly_percent = None
        if bucket_trades_for_ev:
            wins_k = [t for t in bucket_trades_for_ev if t["pnl"] > 0]
            losses_k = [t for t in bucket_trades_for_ev if t["pnl"] <= 0]
            n_k = len(bucket_trades_for_ev)
            win_rate_k = len(wins_k) / n_k if n_k else 0
            loss_rate_k = 1 - win_rate_k
            avg_win_pct_k = sum(t["return_percent"] for t in wins_k) / len(wins_k) if wins_k else 0
            avg_loss_pct_k = sum(t["return_percent"] for t in losses_k) / len(losses_k) if losses_k else 0
            if avg_win_pct_k > 0:
                kelly_raw = (win_rate_k * avg_win_pct_k - loss_rate_k * abs(avg_loss_pct_k)) / avg_win_pct_k
                kelly_percent = round(max(0.0, kelly_raw * 100), 1)

        # 포지션 크기 버킷 통계 계산
        position_buckets = []
        for bucket_name, trades in buckets.items():
            if len(trades) == 0:
                continue

            wins = [t for t in trades if t["pnl"] > 0]
            losses = [t for t in trades if t["pnl"] < 0]
            total_trades = len(trades)
            win_count = len(wins)
            win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0

            # Avg Win % (positive return_percent의 평균)
            win_percents = [t["return_percent"] for t in wins if t.get("return_percent") is not None and t["return_percent"] is not None]
            avg_win_percent = sum(win_percents) / len(win_percents) if win_percents and len(win_percents) > 0 else 0

            # Avg Loss % (negative return_percent의 평균)
            loss_percents = [t["return_percent"] for t in losses if t.get("return_percent") is not None and t["return_percent"] is not None]
            avg_loss_percent = sum(loss_percents) / len(loss_percents) if loss_percents and len(loss_percents) > 0 else 0

            # Avg Win $, Avg Loss $
            avg_win_dollar = sum(t["pnl"] for t in wins) / len(wins) if wins and len(wins) > 0 else 0
            avg_loss_dollar = sum(t["pnl"] for t in losses) / len(losses) if losses and len(losses) > 0 else 0

            # Total PnL
            total_pnl = sum(t["pnl"] for t in trades)

            # EV% = (Avg Win % * Win%) - (abs(Avg Loss %) * (1 - Win%))
            ev_percent = (avg_win_percent * (win_rate / 100)) - (abs(avg_loss_percent) * (1 - win_rate / 100))

            # EV$ = (Avg Win $ * Win%) - (abs(Avg Loss $) * (1 - Win%))
            ev_dollar = (avg_win_dollar * (win_rate / 100)) - (abs(avg_loss_dollar) * (1 - win_rate / 100))

            position_buckets.append(PositionSizeBucket(
                bucket=bucket_name,
                trades=total_trades,
                win_rate=win_rate,
                avg_win_percent=avg_win_percent,
                avg_loss_percent=avg_loss_percent,
                ev_percent=ev_percent,
                total_pnl=total_pnl,
                avg_win_dollar=avg_win_dollar,
                avg_loss_dollar=avg_loss_dollar,
                ev_dollar=ev_dollar
            ))

        # 거래 타입별 통계 계산
        trade_type_stats_list = []
        for trade_type, trades in trade_type_data.items():
            wins = [t for t in trades if t["pnl"] > 0]
            losses = [t for t in trades if t["pnl"] < 0]
            total_trades = len(trades)
            win_count = len(wins)
            win_rate = (win_count / total_trades * 100) if total_trades > 0 else 0

            # Avg Win %, Avg Loss % (내부 계산용)
            win_percents = [t["return_percent"] for t in wins if t.get("return_percent") is not None and t["return_percent"] is not None]
            avg_win_percent = sum(win_percents) / len(win_percents) if win_percents and len(win_percents) > 0 else 0

            loss_percents = [t["return_percent"] for t in losses if t.get("return_percent") is not None and t["return_percent"] is not None]
            avg_loss_percent = sum(loss_percents) / len(loss_percents) if loss_percents and len(loss_percents) > 0 else 0

            # EV% = (Avg Win % * Win%) - (abs(Avg Loss %) * (1 - Win%))
            ev_percent = (avg_win_percent * (win_rate / 100)) - (abs(avg_loss_percent) * (1 - win_rate / 100))

            # Total PnL
            total_pnl = sum(t["pnl"] for t in trades)

            trade_type_stats_list.append(TradeTypeStats(
                trade_type=trade_type,
                trades=total_trades,
                win_rate=win_rate,
                avg_win_percent=avg_win_percent,
                avg_loss_percent=avg_loss_percent,
                ev_percent=ev_percent,
                total_pnl=total_pnl
            ))

        return AnalyticsResponse(
            position_size_buckets=position_buckets,
            trade_type_stats=trade_type_stats_list,
            equity_curve=equity_curve,
            ev_curve=ev_curve,
            kelly_percent=kelly_percent
        )
    finally:
        await conn.close()
