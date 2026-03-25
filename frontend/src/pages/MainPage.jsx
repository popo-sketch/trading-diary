import { useState, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { getTradesByMonth } from '../api/trades'
import { getMonthlyStats } from '../api/stats'
import { getAnalytics } from '../api/analytics'
import { formatPnl, calcGiveback } from '../utils/format'
import NavHeader from '../components/NavHeader'
import Calendar from '../components/Calendar'
import TradeSidePanel from '../components/TradeSidePanel'
import SeohuBriefing from '../components/SeohuBriefing'
import JourneyRoad from '../components/JourneyRoad'

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
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded text-[13px] bg-dark-card border border-white/[0.06] text-[#e0e0e0] whitespace-nowrap z-50 shadow-lg">
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
  const [selectedDate, setSelectedDate] = useState(null)

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
        <NavHeader>
          <div className="flex items-center gap-4 flex-1 justify-center">
            {stats && (
              <>
                <div className="text-[15px]">
                  <span className="text-[#9e9e9e] text-[14px]">Total PNL </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: stats.total_pnl >= 0 ? '#00c853' : '#ff1744' }}>
                    {formatPnl(stats.total_pnl)}
                  </span>
                </div>
                <HeaderDivider />
                <div className="text-[15px]">
                  <span className="text-[#9e9e9e] text-[14px]">Win Rate </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>
                    {(stats.win_rate * 100).toFixed(1)}%
                  </span>
                </div>
                <HeaderDivider />
                <div className="text-[15px]">
                  <span className="text-[#9e9e9e] text-[14px]">Trades </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#ffffff' }}>{stats.total_trades}</span>
                  <span className="text-[#9e9e9e] text-[14px] ml-1">
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
                    <div className="text-[14px]">
                      <span className="text-[#9e9e9e]">Best </span>
                      <span className="text-profit font-bold max-w-[120px] inline-block truncate align-bottom">
                        {bestTrade.ticker} {formatPnl(bestTrade.pnl)}
                      </span>
                    </div>
                  </HeaderTooltip>
                )}
                {worstTrade && (
                  <HeaderTooltip text={`${worstTrade.ticker} ${formatPnl(worstTrade.pnl)}`}>
                    <div className="text-[14px]">
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
              className="bg-dark-hover border border-white/[0.06] rounded-lg px-3 py-2 text-[#e0e0e0] text-[15px] focus:outline-none focus:ring-2 focus:ring-info"
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
        </NavHeader>

        {error && (
          <div className="p-3 rounded-xl bg-loss/20 text-loss border border-loss/50 text-[15px]">
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
                onDateClick={(dateStr) => setSelectedDate(dateStr)}
              />
            </div>
          </div>

          {/* 트레이딩 규칙 */}
          <div style={{ width: 320, flexShrink: 0 }}>
            <div className="bg-dark-card rounded-xl border border-white/[0.06] h-full" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: '#e0e0e0', marginBottom: 16 }}>Trading Rules</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { num: '1', title: '좋은 판에만 앉는다', desc: '모든 급등이 나의 게임은 아니다.' },
                  { num: '2', title: '맞히는 능력보다, 잃지 않는 구조가 먼저다', desc: '큰돈을 번 사람은 촉이 좋은 사람이 아니라, 잘못된 판에서 크게 안 죽는 사람이다.' },
                  { num: '3', title: '흥분은 신호가 아니라 잡음이다', desc: '심장이 뛰는 진입은 대체로 늦은 진입일 가능성이 높다.' },
                  { num: '4', title: '현금은 패배가 아니라 옵션이다', desc: '안 들어간 돈은 죽은 돈이 아니라 다음 좋은 판을 살 수 있는 탄약이다.' },
                  { num: '5', title: '복구 욕망은 가장 비싼 감정이다', desc: '"한 번에 복구"가 계좌를 망친다.' },
                ].map((rule) => (
                    <div key={rule.num}>
                      <div className="flex items-start gap-2">
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#9e9e9e', marginTop: 1 }}>{rule.num}.</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 16, fontWeight: 600, color: '#e0e0e0', margin: 0, lineHeight: 1.8 }}>{rule.title}</p>
                          <p style={{ fontSize: 14, color: '#9e9e9e', margin: '4px 0 0 0', lineHeight: 1.8 }}>{rule.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* 트레이드 상세 사이드 패널 */}
      {selectedDate && (
        <TradeSidePanel
          dateStr={selectedDate}
          trades={dailyTrades[selectedDate] ?? []}
          onClose={() => setSelectedDate(null)}
          onRefresh={() => {
            Promise.all([
              getTradesByMonth(year, month),
              getMonthlyStats(year, month),
              getAnalytics(year, month, null),
            ]).then(([tradesData, statsData, analyticsData]) => {
              setTrades(tradesData)
              setStats(statsData)
              setAnalytics(analyticsData)
            }).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
