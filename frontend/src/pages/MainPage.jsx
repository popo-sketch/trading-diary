import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getTradesByMonth } from '../api/trades'
import { getMonthlyStats } from '../api/stats'
import { formatPnl } from '../utils/format'
import Calendar from '../components/Calendar'
import StatsPanel from '../components/StatsPanel'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function MainPage() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getTradesByMonth(year, month),
      getMonthlyStats(year, month),
    ])
      .then(([tradesData, statsData]) => {
        if (!cancelled) {
          setTrades(tradesData)
          setStats(statsData)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.response?.data?.detail
          setError(typeof msg === 'string' ? msg : (Array.isArray(msg) ? msg.map((d) => d.msg).join(', ') : null) || err?.message || '로딩 실패')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [year, month])

  const dailyPnl = useMemo(() => {
    const map = {}
    trades.forEach((t) => {
      map[t.date] = (map[t.date] ?? 0) + Number(t.pnl || 0)
    })
    return map
  }, [trades])

  const winStats = useMemo(() => {
    if (!stats) return null
    const days = {}
    trades.forEach((t) => {
      days[t.date] = (days[t.date] ?? 0) + Number(t.pnl || 0)
    })
    let winDays = 0
    let lossDays = 0
    let winAmount = 0
    let lossAmount = 0
    Object.entries(days).forEach(([, pnl]) => {
      if (pnl > 0) {
        winDays++
        winAmount += pnl
      } else if (pnl < 0) {
        lossDays++
        lossAmount += pnl
      }
    })
    return { winDays, lossDays, winAmount, lossAmount }
  }, [trades, stats])

  const years = Array.from({ length: 10 }, (_, i) => currentYear + i)

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-[7] p-8 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-white">PNL Calendar</h1>
            <Link
              to="/stats"
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 text-sm"
            >
              Analytics
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222] cursor-pointer"
              >
                ←
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222] cursor-pointer"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {stats && (
          <div className="mb-6">
            <div
              className={`text-4xl font-bold ${
                stats.total_pnl >= 0 ? 'text-profit' : 'text-loss'
              }`}
            >
              {formatPnl(stats.total_pnl)}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-loss/20 text-loss border border-loss/50">
            {error}
          </div>
        )}

        <Calendar
          year={year}
          month={month}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          dailyPnl={dailyPnl}
          winStats={winStats}
          isLoading={loading}
        />
      </div>

      <div className="flex-[3] p-8 pt-4">
        <StatsPanel stats={stats} isLoading={loading} />
      </div>
    </div>
  )
}
