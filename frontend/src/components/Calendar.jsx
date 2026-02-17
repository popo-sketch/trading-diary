import { useNavigate } from 'react-router-dom'
import { formatPnl, formatMonthKst } from '../utils/format'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function Calendar({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  dailyPnl,
  isLoading,
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
    cells.push({ date: dateStr, day: d, pnl })
  }
  while (cells.length < totalCells) {
    cells.push({ empty: true })
  }

  const handleDateClick = (dateStr) => {
    if (dateStr) navigate(`/daily/${dateStr}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-neutral">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-[#a0a0a0]">{formatMonthKst(year, month)}</h2>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-xs text-[#a0a0a0] py-2 font-medium"
          >
            {w}
          </div>
        ))}
        {cells.map((cell, i) => (
          <div
            key={i}
            onClick={() => !cell.empty && handleDateClick(cell.date)}
            className={`
              min-h-[80px] p-2 rounded-lg border transition-colors
              ${cell.empty ? 'bg-transparent border-transparent' : 'border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#222] cursor-pointer'}
              ${cell.pnl != null && cell.pnl > 0 ? 'border-l-4 border-l-profit' : ''}
              ${cell.pnl != null && cell.pnl < 0 ? 'border-l-4 border-l-loss' : ''}
              ${cell.pnl != null && cell.pnl === 0 ? 'border-l-4 border-l-neutral' : ''}
              ${cell.empty || cell.pnl == null ? '' : ''}
            `}
          >
            {!cell.empty && (
              <>
                <div className="text-sm font-medium text-white">{cell.day}</div>
                <div
                  className={`text-xs mt-1 font-medium truncate ${
                    cell.pnl != null
                      ? cell.pnl > 0
                        ? 'text-profit'
                        : cell.pnl < 0
                        ? 'text-loss'
                        : 'text-neutral'
                      : 'text-neutral'
                  }`}
                >
                  {cell.pnl != null ? formatPnl(cell.pnl) : '—'}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
