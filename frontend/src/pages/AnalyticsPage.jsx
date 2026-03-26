import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getAnalytics } from '../api/analytics'
import { getTradesByMonth } from '../api/trades'
import NavHeader from '../components/NavHeader'
import EquityCurveCompact from '../components/analytics/EquityCurveCompact'
import PositionSizeTableCompact from '../components/analytics/PositionSizeTableCompact'
import TradeTypeTableCompact from '../components/analytics/TradeTypeTableCompact'
import MonthlyReplay from '../components/MonthlyReplay'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function AnalyticsPage() {
  const location = useLocation()
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [analytics, setAnalytics] = useState(null)
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const years = Array.from({ length: 10 }, (_, i) => currentYear + i)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      getAnalytics(year, month, null),
      getTradesByMonth(year, month),
    ])
      .then(([analyticsData, tradesData]) => {
        if (!cancelled) {
          setAnalytics(analyticsData)
          setTrades(tradesData)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err?.response?.data?.detail
          setError(typeof msg === 'string' ? msg : err?.message || 'Failed to load')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [year, month, location.key])

  const handlePrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const handleNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <div className="min-h-screen p-6 bg-dark-bg text-[#e0e0e0]">
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px', width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <NavHeader>
          <div className="flex items-center gap-3 flex-1 justify-end">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-dark-hover border border-white/[0.06] rounded-lg px-3 py-2 text-[#e0e0e0] text-[13px] focus:outline-none focus:ring-2 focus:ring-info"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-lg bg-dark-hover border border-white/[0.06] text-[#e0e0e0] hover:bg-[#2e2e4a] cursor-pointer transition-colors"
              >←</button>
              <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Inter, monospace', color: '#e0e0e0', minWidth: 40, textAlign: 'center' }}>
                {month}월
              </span>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg bg-dark-hover border border-white/[0.06] text-[#e0e0e0] hover:bg-[#2e2e4a] cursor-pointer transition-colors"
              >→</button>
            </div>
          </div>
        </NavHeader>

        {error && (
          <div className="p-3 rounded-xl bg-loss/20 text-loss border border-loss/50 text-[13px]">
            {error}
          </div>
        )}

        {loading && !analytics && (
          <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: 13 }}>
            Loading...
          </div>
        )}

        {analytics && (
          <>
            {/* 상단: Equity Curve + Expected Value Curve (2-column) */}
            <EquityCurveCompact data={analytics.equity_curve} evCurve={analytics.ev_curve ?? []} kellyPercent={analytics.kelly_percent} />

            {/* 중단: Position Size + Trade Type (2-column) */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <PositionSizeTableCompact buckets={analytics.position_size_buckets} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TradeTypeTableCompact stats={analytics.trade_type_stats} />
              </div>
            </div>

            {/* 하단: Monthly Replay */}
            <MonthlyReplay trades={trades} analytics={analytics} />
          </>
        )}
      </div>
    </div>
  )
}
