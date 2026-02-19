import { useState, useEffect, useMemo } from 'react'
import { getTradesByMonth } from '../api/trades'
import { getMonthlyStats } from '../api/stats'
import { getAnalytics } from '../api/analytics'
import { formatPnl } from '../utils/format'
import Calendar from '../components/Calendar'
import EquityCurveCompact from '../components/analytics/EquityCurveCompact'
import PositionSizeTableCompact from '../components/analytics/PositionSizeTableCompact'
import TradeTypeTableCompact from '../components/analytics/TradeTypeTableCompact'
import FlowStatusModule from '../components/FlowStatusModule'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function MainPage() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getTradesByMonth(year, month),
      getMonthlyStats(year, month),
      getAnalytics(year, month, null),
    ])
      .then(([tradesData, statsData, analyticsData]) => {
        if (!cancelled) {
          setTrades(tradesData)
          setStats(statsData)
          setAnalytics(analyticsData)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.response?.data?.detail
          setError(typeof msg === 'string' ? msg : (Array.isArray(msg) ? msg.map((d) => d.msg).join(', ') : null) || err?.message || 'Failed to load')
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

  const dailyTradeCount = useMemo(() => {
    const map = {}
    trades.forEach((t) => {
      map[t.date] = (map[t.date] ?? 0) + 1
    })
    return map
  }, [trades])

  const dailyTrades = useMemo(() => {
    const map = {}
    trades.forEach((t) => {
      if (!map[t.date]) map[t.date] = []
      map[t.date].push(t)
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

  const bestTrade = stats?.top_wins?.[0]
  const worstTrade = stats?.top_losses?.[0]

  return (
    <div className="min-h-screen p-6 bg-dark-bg">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 헤더 한 줄 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">PNL Calendar</h1>
          
          <div className="flex items-center gap-6 flex-1 justify-center">
            {/* 중앙 좌: Total PNL / Win Rate% / Trades / (W/L) */}
            {stats && (
              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-[#6B7280] text-xs">Total PNL: </span>
                  <span className={`font-medium ${stats.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatPnl(stats.total_pnl)}
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] text-xs">Win Rate: </span>
                  <span className="font-medium text-white">
                    {(stats.win_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] text-xs">Trades: </span>
                  <span className="font-medium text-white">{stats.total_trades}</span>
                  <span className="text-[#6B7280] ml-1">
                    ({stats.wins}W / {stats.losses}L)
                  </span>
                </div>
              </div>
            )}

            {/* 중앙 우: Best / Worst */}
            {(bestTrade || worstTrade) && (
              <div className="flex items-center gap-4 text-xs">
                {bestTrade && (
                  <div>
                    <span className="text-[#6B7280]">Best: </span>
                    <span className="text-profit font-medium">
                      {bestTrade.ticker} {formatPnl(bestTrade.pnl)}
                    </span>
                  </div>
                )}
                {worstTrade && (
                  <div>
                    <span className="text-[#6B7280]">Worst: </span>
                    <span className="text-loss font-medium">
                      {worstTrade.ticker} {formatPnl(worstTrade.pnl)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 우: 연도 드롭다운 + 화살표 */}
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

        <FlowStatusModule analytics={analytics} trades={trades} error={error} />

        {error && (
          <div className="p-3 rounded-lg bg-loss/20 text-loss border border-loss/50 text-sm">
            {error}
          </div>
        )}

        {/* 캘린더 */}
        <Calendar
          year={year}
          month={month}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          dailyPnl={dailyPnl}
          dailyTradeCount={dailyTradeCount}
          dailyTrades={dailyTrades}
          isLoading={loading}
        />

        {/* Equity Curve + Expected Value Curve */}
        {analytics && (
          <EquityCurveCompact data={analytics.equity_curve} evCurve={analytics.ev_curve ?? []} kellyPercent={analytics.kelly_percent} />
        )}

        {/* 좌우 50:50 테이블 */}
        {analytics && (
          <div className="grid grid-cols-2 gap-4">
            <PositionSizeTableCompact buckets={analytics.position_size_buckets} />
            <TradeTypeTableCompact stats={analytics.trade_type_stats} />
          </div>
        )}
      </div>
    </div>
  )
}
