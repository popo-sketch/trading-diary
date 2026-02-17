from fastapi import APIRouter, HTTPException, Query
from app.database import get_db
from app.models import TradeCreate, TradeUpdate, TradeResponse
import uuid
from datetime import datetime, timezone, timedelta

KST = timezone(timedelta(hours=9))

router = APIRouter()


@router.get("", response_model=list[TradeResponse])
async def get_trades_by_month(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
):
    """특정 월의 모든 거래 반환"""
    date_prefix = f"{year}-{month:02d}"
    conn = await get_db()
    try:
        cursor = await conn.execute(
            """
            SELECT id, date, ticker, chain, ca, pnl, memo, entry_amount, return_percent, trade_type, created_at, updated_at
            FROM trades
            WHERE date LIKE ?
            ORDER BY date, created_at
            """,
            (f"{date_prefix}%",)
        )
        rows = await cursor.fetchall()
        return [_row_to_trade(row) for row in rows]
    finally:
        await conn.close()


@router.get("/daily", response_model=list[TradeResponse])
async def get_trades_by_date(
    date: str = Query(..., pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD")
):
    """특정 날짜의 거래들 반환"""
    conn = await get_db()
    try:
        cursor = await conn.execute(
            """
            SELECT id, date, ticker, chain, ca, pnl, memo, entry_amount, return_percent, trade_type, created_at, updated_at
            FROM trades
            WHERE date = ?
            ORDER BY created_at
            """,
            (date,)
        )
        rows = await cursor.fetchall()
        return [_row_to_trade(row) for row in rows]
    finally:
        await conn.close()


@router.post("", response_model=TradeResponse, status_code=201)
async def create_trade(data: TradeCreate):
    """새 거래 추가"""
    trade_id = str(uuid.uuid4())
    conn = await get_db()
    try:
        await conn.execute(
            """
            INSERT INTO trades (id, date, ticker, chain, ca, pnl, memo, entry_amount, return_percent, trade_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (trade_id, data.date, data.ticker, data.chain, data.ca, data.pnl, data.memo, data.entry_amount, data.return_percent, data.trade_type)
        )
        await conn.commit()
        cursor = await conn.execute(
            "SELECT id, date, ticker, chain, ca, pnl, memo, entry_amount, return_percent, trade_type, created_at, updated_at FROM trades WHERE id = ?",
            (trade_id,)
        )
        row = await cursor.fetchone()
        return _row_to_trade(row)
    finally:
        await conn.close()


@router.put("/{trade_id}", response_model=TradeResponse)
async def update_trade(trade_id: str, data: TradeUpdate):
    """거래 수정"""
    conn = await get_db()
    try:
        updates = []
        params = []

        if data.memo is not None:
            updates.append("memo = ?")
            params.append(data.memo)
        if data.pnl is not None:
            updates.append("pnl = ?")
            params.append(data.pnl)
        if data.entry_amount is not None:
            updates.append("entry_amount = ?")
            params.append(data.entry_amount)
        if data.return_percent is not None:
            updates.append("return_percent = ?")
            params.append(data.return_percent)
        if data.trade_type is not None:
            updates.append("trade_type = ?")
            params.append(data.trade_type)

        if not updates:
            raise HTTPException(status_code=400, detail="수정할 필드가 없습니다")

        updates.append("updated_at = ?")
        params.append(datetime.now(KST).isoformat())
        params.append(trade_id)

        cursor = await conn.execute(
            f"UPDATE trades SET {', '.join(updates)} WHERE id = ?",
            params
        )
        await conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다")

        cursor = await conn.execute(
            "SELECT id, date, ticker, chain, ca, pnl, memo, entry_amount, return_percent, trade_type, created_at, updated_at FROM trades WHERE id = ?",
            (trade_id,)
        )
        row = await cursor.fetchone()
        return _row_to_trade(row)
    finally:
        await conn.close()


@router.delete("/{trade_id}", status_code=204)
async def delete_trade(trade_id: str):
    """거래 삭제"""
    conn = await get_db()
    try:
        cursor = await conn.execute("DELETE FROM trades WHERE id = ?", (trade_id,))
        await conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다")
    finally:
        await conn.close()


def _row_to_trade(row) -> TradeResponse:
    return TradeResponse(
        id=row["id"],
        date=row["date"],
        ticker=row["ticker"],
        chain=row["chain"],
        ca=row["ca"],
        pnl=row["pnl"],
        memo=row["memo"],
        entry_amount=row.get("entry_amount"),
        return_percent=row.get("return_percent"),
        trade_type=row.get("trade_type"),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )
