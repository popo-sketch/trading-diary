import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getTradesByMonth } from '../api/trades'
import { formatPnl, formatDollarKMB, formatMonthKst } from '../utils/format'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

/** YYYY-MM-DD → MM/DD */
function formatDateShort(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return ''
  return `${parts[1]}/${parts[2]}`
}

/** PnL% 표시 (+50.0% / -50.0%) */
function formatPnlPercent(num) {
  if (num == null || !Number.isFinite(num)) return ''
  const sign = num >= 0 ? '+' : ''
  return `${sign}${Number(num).toFixed(2)}%`
}

function LeaderboardTable({ title, trades, showMedals, year, month }) {
  const navigate = useNavigate()

  if (!trades.length) {
    return (
      <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        <p className="text-[#6B7280] text-sm">No trades this month</p>
      </div>
    )
  }

  const medal = (rank) => {
    if (!showMedals) return `${rank}`
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `${rank}`
  }

  const displayTicker = (t) => {
    if (t == null || t === '') return '—'
    return String(t).startsWith('$') ? t : `$${t}`
  }

  return (
    <div className="rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] overflow-hidden">
      <h3 className="text-lg font-semibold text-white p-4 border-b border-[#2a2a2a]">{title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[#6B7280] border-b border-[#2a2a2a]">
              <th className="py-2 px-3 w-12">Rank</th>
              <th className="py-2 px-3">Ticker</th>
              <th className="py-2 px-3">Date</th>
              <th className="py-2 px-3">Avg. Entry</th>
              <th className="py-2 px-3">Avg. Exit</th>
              <th className="py-2 px-3">PnL%</th>
              <th className="py-2 px-3">PnL$</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, idx) => {
              const rank = idx + 1
              const pnl = Number(trade.pnl ?? 0)
              const pnlPercent = trade.return_percent != null && Number.isFinite(trade.return_percent) ? trade.return_percent : null
              const avgEntry = trade.avg_entry_mc != null && Number.isFinite(trade.avg_entry_mc) ? trade.avg_entry_mc : null
              const exitEntry = avgEntry != null && pnlPercent != null ? avgEntry * (1 + pnlPercent / 100) : null

              return (
                <tr
                  key={trade.id}
                  className="border-b border-[#2a2a2a] hover:bg-[#222] transition-colors"
                >
                  <td className="py-2 px-3 text-white whitespace-nowrap">{medal(rank)}</td>
                  <td className="py-2 px-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/daily/${trade.date}`, { state: { year, month } })}
                      className="text-left text-white hover:underline focus:outline-none"
                    >
                      {displayTicker(trade.ticker)}
                    </button>
                    {(trade.chain || trade.trade_type) && (
                      <div className="text-[10px] text-[#6B7280] mt-0.5">
                        {[trade.chain, trade.trade_type].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-[#a0a0a0] whitespace-nowrap">{formatDateShort(trade.date) || '—'}</td>
                  <td className="py-2 px-3 text-[#a0a0a0] whitespace-nowrap">{avgEntry != null ? formatDollarKMB(avgEntry) : ''}</td>
                  <td className="py-2 px-3 text-[#a0a0a0] whitespace-nowrap">{exitEntry != null ? formatDollarKMB(exitEntry) : ''}</td>
                  <td className={`py-2 px-3 whitespace-nowrap ${pnlPercent != null ? (pnlPercent >= 0 ? 'text-profit' : 'text-loss') : ''}`}>
                    {pnlPercent != null ? formatPnlPercent(pnlPercent) : ''}
                  </td>
                  <td className={`py-2 px-3 whitespace-nowrap font-medium ${pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatPnl(pnl)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function LeaderboardPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const year = Number(searchParams.get('year')) || currentYear
  const month = Number(searchParams.get('month')) || currentMonth

  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getTradesByMonth(year, month)
      .then((data) => {
        if (!cancelled) setTrades(Array.isArray(data) ? data : [])
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

  const sortedByPnl = [...trades].sort((a, b) => Number(b.pnl ?? 0) - Number(a.pnl ?? 0))
  const top10Winners = sortedByPnl.filter((t) => Number(t.pnl ?? 0) > 0).slice(0, 10)
  const top10Losers = [...sortedByPnl].reverse().filter((t) => Number(t.pnl ?? 0) < 0).slice(0, 10)

  const handleBack = () => {
    navigate('/', { state: { year, month } })
  }

  return (
    <div className="min-h-screen p-6 bg-dark-bg">
      <div className="max-w-6xl mx-auto space-y-4">
        <button
          type="button"
          onClick={handleBack}
          className="mb-2 inline-flex items-center gap-2 p-2 rounded-lg hover:bg-[#222] transition-colors text-white"
        >
          <span className="text-2xl">←</span>
        </button>

        <h1 className="text-2xl font-bold">
          <span className="text-white">Trading Leaderboard </span>
          <span className="text-white/60">{formatMonthKst(year, month)}</span>
        </h1>

        {error && (
          <div className="p-3 rounded-lg bg-loss/20 text-loss border border-loss/50 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LeaderboardTable
              title="Top 10 Winners"
              trades={top10Winners}
              showMedals
              year={year}
              month={month}
            />
            <LeaderboardTable
              title="Top 10 Losers"
              trades={top10Losers}
              showMedals={false}
              year={year}
              month={month}
            />
          </div>
        )}
      </div>
    </div>
  )
}
