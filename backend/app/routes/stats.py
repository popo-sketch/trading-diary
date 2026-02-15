from fastapi import APIRouter, Query
from app.database import get_db
from app.models import StatsResponse, DaySummary, TopTrade

router = APIRouter()


@router.get("", response_model=StatsResponse)
async def get_monthly_stats(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
):
    """월간 통계 반환"""
    date_prefix = f"{year}-{month:02d}"
    conn = await get_db()
    try:
        # total_pnl, total_trades, wins, losses
        cursor = await conn.execute(
            """
            SELECT
                COALESCE(SUM(pnl), 0) as total_pnl,
                COUNT(*) as total_trades,
                SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as wins,
                SUM(CASE WHEN pnl < 0 THEN 1 ELSE 0 END) as losses
            FROM trades
            WHERE date LIKE ?
            """,
            (f"{date_prefix}%",)
        )
        row = await cursor.fetchone()
        total_pnl = row["total_pnl"] or 0
        total_trades = row["total_trades"] or 0
        wins = row["wins"] or 0
        losses = row["losses"] or 0
        win_rate = wins / total_trades if total_trades > 0 else 0

        # best_day, worst_day (일별 PNL 기준)
        cursor = await conn.execute(
            """
            SELECT date, SUM(pnl) as daily_pnl
            FROM trades
            WHERE date LIKE ?
            GROUP BY date
            ORDER BY daily_pnl DESC
            LIMIT 1
            """,
            (f"{date_prefix}%",)
        )
        best_row = await cursor.fetchone()
        best_day = DaySummary(date=best_row["date"], pnl=best_row["daily_pnl"]) if best_row else None

        cursor = await conn.execute(
            """
            SELECT date, SUM(pnl) as daily_pnl
            FROM trades
            WHERE date LIKE ?
            GROUP BY date
            ORDER BY daily_pnl ASC
            LIMIT 1
            """,
            (f"{date_prefix}%",)
        )
        worst_row = await cursor.fetchone()
        worst_day = DaySummary(date=worst_row["date"], pnl=worst_row["daily_pnl"]) if worst_row else None

        # top_wins (상위 3개)
        cursor = await conn.execute(
            """
            SELECT ticker, date, pnl
            FROM trades
            WHERE date LIKE ? AND pnl > 0
            ORDER BY pnl DESC
            LIMIT 3
            """,
            (f"{date_prefix}%",)
        )
        top_wins_rows = await cursor.fetchall()
        top_wins = [TopTrade(ticker=r["ticker"], date=r["date"], pnl=r["pnl"]) for r in top_wins_rows]

        # top_losses (하위 3개)
        cursor = await conn.execute(
            """
            SELECT ticker, date, pnl
            FROM trades
            WHERE date LIKE ? AND pnl < 0
            ORDER BY pnl ASC
            LIMIT 3
            """,
            (f"{date_prefix}%",)
        )
        top_losses_rows = await cursor.fetchall()
        top_losses = [TopTrade(ticker=r["ticker"], date=r["date"], pnl=r["pnl"]) for r in top_losses_rows]

        return StatsResponse(
            total_pnl=total_pnl,
            win_rate=win_rate,
            total_trades=total_trades,
            wins=wins,
            losses=losses,
            best_day=best_day,
            worst_day=worst_day,
            top_wins=top_wins,
            top_losses=top_losses,
        )
    finally:
        await conn.close()
