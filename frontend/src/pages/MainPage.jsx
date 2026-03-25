import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { getTradesByMonth } from '../api/trades'
import { getMonthlyStats } from '../api/stats'
import { getAnalytics } from '../api/analytics'
import { formatPnl, calcGiveback } from '../utils/format'
import Calendar from '../components/Calendar'
import EquityCurveCompact from '../components/analytics/EquityCurveCompact'
import PositionSizeTableCompact from '../components/analytics/PositionSizeTableCompact'
import TradeTypeTableCompact from '../components/analytics/TradeTypeTableCompact'
import SeohuBriefing from '../components/SeohuBriefing'
import JourneyRoad from '../components/JourneyRoad'
import RiskWeatherCard from '../components/RiskWeatherCard'
import MonthlyReplay from '../components/MonthlyReplay'

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

export default function MainPage() {
  const location = useLocation()
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth)
  const [trades, setTrades] = useState([])
  const [stats, setStats] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [allTimeAnalytics, setAllTimeAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // 일별 상세에서 뒤로가기 시 전달된 year/month로 복귀
  useEffect(() => {
    if (location.state?.year != null && location.state?.month != null) {
      setYear(location.state.year)
      setMonth(location.state.month)
    }
  }, [location.state?.year, location.state?.month])

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
  }, [year, month, location.key])

  // All-time analytics for Journey Road (refresh on navigation back)
  useEffect(() => {
    getAnalytics(null, null, null)
      .then(setAllTimeAnalytics)
      .catch(() => {})
  }, [location.key])

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

  const dailyGiveback = useMemo(() => {
    const map = {}
    Object.entries(dailyTrades).forEach(([date, ts]) => {
      const result = calcGiveback(ts)
      if (result && result.givebackRate > 0) map[date] = result
    })
    return map
  }, [dailyTrades])

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
    <div className="min-h-screen p-6 bg-dark-bg text-[#e8e8e8]">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* 헤더 한 줄 */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[#f0f0f0]">PNL Calendar</h1>
          
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
                  <span className="font-medium text-[#e8e8e8]">
                    {(stats.win_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-[#6B7280] text-xs">Trades: </span>
                  <span className="font-medium text-[#e8e8e8]">{stats.total_trades}</span>
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
          <div className="flex items-center gap-4 shrink-0">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="bg-dark-card border border-white/[0.06] rounded-lg px-3 py-2 text-[#e8e8e8] text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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
                className="p-2 rounded-lg bg-dark-card border border-white/[0.06] text-[#e8e8e8] hover:bg-[#282838] cursor-pointer"
              >
                ←
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg bg-dark-card border border-white/[0.06] text-[#e8e8e8] hover:bg-[#282838] cursor-pointer"
              >
                →
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-loss/20 text-loss border border-loss/50 text-sm">
            {error}
          </div>
        )}

        {/* Journey Road — 20만불 여정 */}
        {allTimeAnalytics && (
          <JourneyRoad allTimeAnalytics={allTimeAnalytics} />
        )}

        {/* 이서후 브리핑 — 항상 최상단 */}
        <SeohuBriefing analytics={analytics} trades={trades} error={error} />

        {/* 캘린더 + 트레이딩 규칙 */}
        <div className="grid grid-cols-[1fr_280px] gap-4 items-stretch">
          <Calendar
            year={year}
            month={month}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            dailyPnl={dailyPnl}
            dailyTradeCount={dailyTradeCount}
            dailyTrades={dailyTrades}
            dailyGiveback={dailyGiveback}
            isLoading={loading}
          />

          {/* 트레이딩 규칙 */}
          <div className="bg-dark-card border border-white/[0.06] rounded-xl p-4 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
            <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-widest">Trading Rules</h3>
            {[
              {
                num: '1',
                title: '좋은 판에만 앉는다',
                desc: '모든 급등이 나의 게임은 아니다.',
              },
              {
                num: '2',
                title: '맞히는 능력보다, 잃지 않는 구조가 먼저다',
                desc: '큰돈을 번 사람은 촉이 좋은 사람이 아니라, 잘못된 판에서 크게 안 죽는 사람이다.',
              },
              {
                num: '3',
                title: '흥분은 신호가 아니라 잡음이다',
                desc: '심장이 뛰는 진입은 대체로 늦은 진입일 가능성이 높다.',
              },
              {
                num: '4',
                title: '현금은 패배가 아니라 옵션이다',
                desc: '안 들어간 돈은 죽은 돈이 아니라 다음 좋은 판을 살 수 있는 탄약이다.',
              },
              {
                num: '5',
                title: '복구 욕망은 가장 비싼 감정이다',
                desc: '"한 번에 복구"가 계좌를 망친다.',
              },
            ].map((rule) => (
              <div key={rule.num} className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="text-[#4a4a4a] text-xs font-bold mt-0.5">{rule.num}.</span>
                  <p className="text-[#e8e8e8] text-xs font-semibold leading-snug">{rule.title}</p>
                </div>
                <p className="text-[#6B7280] text-[11px] leading-relaxed pl-4">{rule.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 리스크 날씨 + Equity Curve + EV Curve */}
        {analytics && (
          <div className="grid grid-cols-[280px_1fr] gap-4 items-stretch">
            <RiskWeatherCard analytics={analytics} trades={trades} />
            <EquityCurveCompact data={analytics.equity_curve} evCurve={analytics.ev_curve ?? []} kellyPercent={analytics.kelly_percent} />
          </div>
        )}

        {/* 포지션 사이즈 / 트레이드 타입 + 월간 리플레이 */}
        {analytics && (
          <div className="grid grid-cols-[1fr_1fr_300px] gap-4 items-stretch">
            <PositionSizeTableCompact buckets={analytics.position_size_buckets} />
            <TradeTypeTableCompact stats={analytics.trade_type_stats} />
            <MonthlyReplay trades={trades} analytics={analytics} />
          </div>
        )}
      </div>
    </div>
  )
}
