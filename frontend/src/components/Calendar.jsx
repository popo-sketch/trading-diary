import { useNavigate, Link } from 'react-router-dom'
import { formatPnl, formatMonthKst } from '../utils/format'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Calendar({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  dailyPnl,
  dailyTradeCount = {},
  dailyTrades = {},
  dailyGiveback = {},
  isLoading,
  onDateClick,
}) {
  const navigate = useNavigate()

  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startOffset = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7
  const cells = []

  for (let i = 0; i < startOffset; i++) {
    cells.push({ empty: true })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    const dateStr = `${year}-${mm}-${dd}`
    const pnl = dailyPnl[dateStr] ?? null
    const tradeCount = dailyTradeCount[dateStr] ?? 0
    const trades = dailyTrades[dateStr] ?? []
    const giveback = dailyGiveback[dateStr] ?? null
    cells.push({ date: dateStr, day: d, pnl, tradeCount, trades, giveback })
  }
  while (cells.length < totalCells) {
    cells.push({ empty: true })
  }

  const handleDateClick = (dateStr) => {
    if (!dateStr) return
    if (onDateClick) {
      onDateClick(dateStr)
    } else {
      navigate(`/daily/${dateStr}`, { state: { year, month } })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-info border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#e0e0e0', margin: 0, lineHeight: 1.7 }}>{formatMonthKst(year, month)}</h2>
        <Link
          to={`/leaderboard?year=${year}&month=${month}`}
          style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#242442', transition: 'background 0.2s', lineHeight: 1.7 }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#2e2e4a'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#242442'}
        >
          Leaderboard
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 14, color: '#9e9e9e', padding: '8px 0', fontWeight: 500, lineHeight: 1.7 }}>
            {w}
          </div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            onClick={() => !cell.empty && handleDateClick(cell.date)}
            style={{
              minHeight: 85, padding: 9, borderRadius: 8,
              border: cell.empty ? 'none' : '1px solid rgba(255,255,255,0.06)',
              background: cell.empty ? 'transparent' : '#1a1a2e',
              cursor: cell.empty ? 'default' : 'pointer',
              transition: 'background 0.15s',
              borderLeft: cell.pnl != null && cell.pnl > 0 ? '4px solid #00c853'
                : cell.pnl != null && cell.pnl < 0 ? '4px solid #ff1744'
                : cell.pnl != null && cell.pnl === 0 ? '4px solid #9e9e9e'
                : undefined,
            }}
            onMouseEnter={(e) => { if (!cell.empty) e.currentTarget.style.background = '#242442' }}
            onMouseLeave={(e) => { if (!cell.empty) e.currentTarget.style.background = '#1a1a2e' }}
          >
            {!cell.empty && (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', lineHeight: 1.7 }}>{cell.day}</div>
                <div style={{
                  fontSize: 13, marginTop: 4, fontWeight: 600, lineHeight: 1.7,
                  color: cell.pnl != null
                    ? cell.pnl > 0 ? '#00c853' : cell.pnl < 0 ? '#ff1744' : '#9e9e9e'
                    : '#9e9e9e',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {cell.pnl != null ? formatPnl(cell.pnl) : '—'}
                </div>
                {cell.tradeCount > 0 && (
                  <div style={{ fontSize: 12, marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 2, lineHeight: 1.7 }}>
                    {cell.trades.slice(0, 5).map((trade, idx) => {
                      const pnl = Number(trade.pnl || 0)
                      return <span key={idx} style={{ color: pnl > 0 ? '#00c853' : pnl < 0 ? '#ff1744' : '#9e9e9e' }}>●</span>
                    })}
                    {cell.tradeCount > 5 && (
                      <span style={{ color: '#9e9e9e', fontSize: 12 }}>+{cell.tradeCount}</span>
                    )}
                  </div>
                )}
                {cell.giveback && (
                  <div style={{
                    fontSize: 12, marginTop: 4, fontWeight: 600, lineHeight: 1.7,
                    color: cell.giveback.givebackRate >= 50 ? '#ff1744' : cell.giveback.givebackRate >= 20 ? '#ffc107' : '#9e9e9e',
                  }}>
                    ↓{cell.giveback.givebackRate.toFixed(0)}% 반납
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
