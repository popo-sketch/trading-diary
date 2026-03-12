import { useState, useEffect } from 'react'
import { getAnalytics } from '../api/analytics'
import { formatPnl } from '../utils/format'
import PositionSizeTable from '../components/analytics/PositionSizeTable'
import TradeTypeTable from '../components/analytics/TradeTypeTable'
import EquityCurve from '../components/analytics/EquityCurve'
import Overview from '../components/analytics/Overview'

export default function StatsPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(null)
  const [bucketFilter, setBucketFilter] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAnalytics(year, month, bucketFilter)
      .then(setData)
      .catch((err) => {
        const detail = err?.response?.data?.detail
        const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
        setError(msg || err?.message || '로딩 실패')
      })
      .finally(() => setLoading(false))
  }, [year, month, bucketFilter])

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  return (
    <div className="min-h-screen p-8 bg-dark-bg">
      <div className="max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-white mb-6">Trading Analytics</h1>

        {/* Global Filter Bar */}
        <div className="flex gap-4 items-end p-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a]">
          <div>
            <label className="block text-xs text-[#a0a0a0] mb-1">Year</label>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value))
                setMonth(null)
              }}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          {year && (
            <div>
              <label className="block text-xs text-[#a0a0a0] mb-1">Month</label>
              <select
                value={month || ''}
                onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : null)}
                className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="">All</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-[#a0a0a0] mb-1">Position Size</label>
            <select
              value={bucketFilter || ''}
              onChange={(e) => setBucketFilter(e.target.value || null)}
              className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All</option>
              <option value="< 1000">&lt; 1000</option>
              <option value="1000-5000">1000-5000</option>
              <option value="5000-10000">5000-10000</option>
              <option value="> 10000">&gt; 10000</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-loss/20 text-loss border border-loss/50">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64 text-neutral">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
          </div>
        ) : data ? (
          <>
            <Overview data={data} />
            <EquityCurve data={data.equity_curve} />
            <PositionSizeTable buckets={data.position_size_buckets} />
            <TradeTypeTable stats={data.trade_type_stats} />
          </>
        ) : null}
      </div>
    </div>
  )
}
