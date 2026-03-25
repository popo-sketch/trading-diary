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

function HeaderTooltip({ text, children }) {
  const [show, setShow] = useState(false)
  return (
    <span
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-[10px] bg-dark-card border border-white/[0.06] text-[#e0e0e0] whitespace-nowrap z-50 shadow-lg">
          {text}
        </span>
      )}
    </span>
  )
}

function HeaderDivider() {
  return <div className="w-px h-6 bg-white/[0.1] shrink-0" />
}

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
    <div className="min-h-screen p-6 bg-dark-bg text-[#e0e0e0]">
      <div className="max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── 헤더 바 ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between bg-dark-card rounded-xl border border-white/[0.06] px-5 py-3">
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>PNL Calendar</h1>

          <div className="flex items-center gap-4 flex-1 justify-center">
            {stats && (
              <>
                <div className="text-[13px]">
                  <span className="text-[#9e9e9e] text-[12px]">Total PNL </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: stats.total_pnl >= 0 ? '#00c853' : '#ff1744' }}>
                    {formatPnl(stats.total_pnl)}
                  </span>
                </div>
                <HeaderDivider />
                <div className="text-[13px]">
                  <span className="text-[#9e9e9e] text-[12px]">Win Rate </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                    {(stats.win_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <HeaderDivider />
                <div className="text-[13px]">
                  <span className="text-[#9e9e9e] text-[12px]">Trades </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>{stats.total_trades}</span>
                  <span className="text-[#9e9e9e] text-[12px] ml-1">
                    ({stats.wins}W / {stats.losses}L)
                  </span>
                </div>
              </>
            )}

            {(bestTrade || worstTrade) && (
              <>
                <HeaderDivider />
                {bestTrade && (
                  <HeaderTooltip text={`${bestTrade.ticker} ${formatPnl(bestTrade.pnl)}`}>
                    <div className="text-[12px]">
                      <span className="text-[#9e9e9e]">Best </span>
                      <span className="text-profit font-bold max-w-[120px] inline-block truncate align-bottom">
                        {bestTrade.ticker} {formatPnl(bestTrade.pnl)}
                      </span>
                    </div>
                  </HeaderTooltip>
                )}
                {worstTrade && (
                  <HeaderTooltip text={`${worstTrade.ticker} ${formatPnl(worstTrade.pnl)}`}>
                    <div className="text-[12px]">
                      <span className="text-[#9e9e9e]">Worst </span>
                      <span className="text-loss font-bold max-w-[120px] inline-block truncate align-bottom">
                        {worstTrade.ticker} {formatPnl(worstTrade.pnl)}
                      </span>
                    </div>
                  </HeaderTooltip>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
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
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-lg bg-dark-hover border border-white/[0.06] text-[#e0e0e0] hover:bg-[#2e2e4a] cursor-pointer transition-colors"
              >→</button>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-loss/20 text-loss border border-loss/50 text-[13px]">
            {error}
          </div>
        )}

        {/* Journey Road */}
        {allTimeAnalytics && (
          <JourneyRoad allTimeAnalytics={allTimeAnalytics} />
        )}

        {/* 이서후 브리핑 */}
        <SeohuBriefing analytics={analytics} trades={trades} error={error} />

        {/* 캘린더 + 트레이딩 규칙 */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bg-dark-card rounded-xl border border-white/[0.06]" style={{ padding: 20, height: '100%' }}>
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
            </div>
          </div>

          {/* 트레이딩 규칙 */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div className="bg-dark-card rounded-xl border border-white/[0.06] h-full" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 16 }}>Trading Rules</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { num: '1', title: '좋은 판에만 앉는다', desc: '모든 급등이 나의 게임은 아니다.', compliance: 0 },
                  { num: '2', title: '맞히는 능력보다, 잃지 않는 구조가 먼저다', desc: '큰돈을 번 사람은 촉이 좋은 사람이 아니라, 잘못된 판에서 크게 안 죽는 사람이다.', compliance: 0 },
                  { num: '3', title: '흥분은 신호가 아니라 잡음이다', desc: '심장이 뛰는 진입은 대체로 늦은 진입일 가능성이 높다.', compliance: 0 },
                  { num: '4', title: '현금은 패배가 아니라 옵션이다', desc: '안 들어간 돈은 죽은 돈이 아니라 다음 좋은 판을 살 수 있는 탄약이다.', compliance: 0 },
                  { num: '5', title: '복구 욕망은 가장 비싼 감정이다', desc: '"한 번에 복구"가 계좌를 망친다.', compliance: 0 },
                ].map((rule) => {
                  const c = rule.compliance
                  const barColor = c >= 80 ? '#00c853' : c >= 50 ? '#ffc107' : '#ff1744'
                  return (
                    <div key={rule.num}>
                      <div className="flex items-start gap-2">
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#9e9e9e', marginTop: 1 }}>{rule.num}.</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0', margin: 0, lineHeight: 1.4 }}>{rule.title}</p>
                          <p style={{ fontSize: 12, color: '#9e9e9e', margin: '4px 0 0 0', lineHeight: 1.5 }}>{rule.desc}</p>
                          {/* 준수율 프로그레스 바 */}
                          <div style={{ marginTop: 6 }}>
                            <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <div style={{ width: `${Math.min(c, 100)}%`, height: '100%', borderRadius: 2, background: barColor, transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: 11, color: barColor, fontFamily: 'Inter, monospace', marginTop: 2, display: 'inline-block' }}>
                              {c}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 리스크 날씨 + Equity Curve */}
        {analytics && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <div style={{ width: 280, flexShrink: 0 }}>
              <RiskWeatherCard analytics={analytics} trades={trades} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <EquityCurveCompact data={analytics.equity_curve} evCurve={analytics.ev_curve ?? []} kellyPercent={analytics.kelly_percent} />
            </div>
          </div>
        )}

        {/* 포지션 사이즈 / 트레이드 타입 + 월간 리플레이 */}
        {analytics && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <PositionSizeTableCompact buckets={analytics.position_size_buckets} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TradeTypeTableCompact stats={analytics.trade_type_stats} />
            </div>
            <div style={{ width: 300, flexShrink: 0 }}>
              <MonthlyReplay trades={trades} analytics={analytics} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
