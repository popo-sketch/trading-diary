/**
 * DrawdownPanel.jsx — 드로우다운 분석 패널
 *
 * Equity Curve 데이터를 기반으로:
 * - DD 구간 시각화 (SVG 차트)
 * - 통계 카드 4개 (최대 DD, 최대 DD%, 최장 DD 기간, 평균 회복 시간)
 * - 현재 DD 진행 중 경고 배너
 */
import { useMemo } from 'react'
import { formatPnl } from '../../utils/format'

const RED = '#ff1744'
const GREEN = '#00c853'

const CARD = {
  background: '#1a1a2e', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 20, height: '100%', boxSizing: 'border-box',
}

function daysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / (1000 * 60 * 60 * 24))
}

export default function DrawdownPanel({ equityCurve = [] }) {
  const { ddStats, ddPeriods, currentDD, chartData } = useMemo(() => {
    if (equityCurve.length < 2) {
      return { ddStats: null, ddPeriods: [], currentDD: null, chartData: [] }
    }

    let peak = equityCurve[0].cumulative_pnl
    let peakDate = equityCurve[0].date
    let maxDDAmount = 0
    let maxDDPercent = 0
    let maxDDDays = 0
    const periods = []
    let currentPeriod = null

    const chart = equityCurve.map((point, i) => {
      const pnl = point.cumulative_pnl
      if (pnl > peak) {
        // 고점 갱신 → 기존 DD 기간 종료
        if (currentPeriod) {
          currentPeriod.endDate = equityCurve[i - 1]?.date || point.date
          currentPeriod.recoveryDate = point.date
          currentPeriod.recoveryDays = daysBetween(currentPeriod.troughDate, point.date)
          periods.push(currentPeriod)
          currentPeriod = null
        }
        peak = pnl
        peakDate = point.date
      }

      const dd = peak - pnl
      const ddPct = peak > 0 ? (dd / peak) * 100 : 0

      if (dd > 0 && !currentPeriod) {
        currentPeriod = {
          startDate: peakDate,
          peakValue: peak,
          troughValue: pnl,
          troughDate: point.date,
          maxDD: dd,
          maxDDPct: ddPct,
          endDate: null,
          recoveryDate: null,
          recoveryDays: null,
        }
      }

      if (currentPeriod && dd > currentPeriod.maxDD) {
        currentPeriod.maxDD = dd
        currentPeriod.maxDDPct = ddPct
        currentPeriod.troughValue = pnl
        currentPeriod.troughDate = point.date
      }

      if (dd > maxDDAmount) maxDDAmount = dd
      if (ddPct > maxDDPercent) maxDDPercent = ddPct

      return { ...point, drawdown: dd, drawdownPct: ddPct, peak }
    })

    // 현재 진행 중인 DD
    let curDD = null
    if (currentPeriod) {
      const lastPoint = equityCurve[equityCurve.length - 1]
      const elapsed = daysBetween(currentPeriod.startDate, lastPoint.date)
      curDD = {
        amount: peak - lastPoint.cumulative_pnl,
        percent: peak > 0 ? ((peak - lastPoint.cumulative_pnl) / peak) * 100 : 0,
        startDate: currentPeriod.startDate,
        elapsed,
      }
    }

    // 최장 DD 기간
    const allPeriods = [...periods]
    if (currentPeriod) {
      const lastDate = equityCurve[equityCurve.length - 1].date
      allPeriods.push({ ...currentPeriod, endDate: lastDate })
    }

    allPeriods.forEach((p) => {
      const days = daysBetween(p.startDate, p.endDate || p.troughDate)
      if (days > maxDDDays) maxDDDays = days
    })

    // 평균 회복 시간 (완료된 DD만)
    const recoveredPeriods = periods.filter((p) => p.recoveryDays != null)
    const avgRecovery = recoveredPeriods.length > 0
      ? recoveredPeriods.reduce((s, p) => s + p.recoveryDays, 0) / recoveredPeriods.length
      : 0

    return {
      ddStats: { maxDDAmount, maxDDPercent, maxDDDays, avgRecovery: Math.round(avgRecovery) },
      ddPeriods: allPeriods,
      currentDD: curDD,
      chartData: chart,
    }
  }, [equityCurve])

  if (!ddStats || equityCurve.length < 2) {
    return (
      <div style={CARD}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 }}>Drawdown Analysis</h3>
        <div style={{ color: '#9e9e9e', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No Data</div>
      </div>
    )
  }

  // 차트 치수
  const width = 500
  const height = 100
  const paddingLeft = 44
  const paddingRight = 20
  const paddingTop = 10
  const paddingBottom = 20
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  const maxDD = Math.max(...chartData.map((d) => d.drawdown), 1)
  const points = chartData.map((d, i) => ({
    x: paddingLeft + (chartData.length === 1 ? 0 : (i / (chartData.length - 1)) * chartWidth),
    y: paddingTop + (d.drawdown / maxDD) * chartHeight,
    ...d,
  }))

  const areaPath = (() => {
    if (points.length === 0) return ''
    let path = `M ${points[0].x} ${paddingTop}`
    points.forEach((p) => { path += ` L ${p.x} ${p.y}` })
    path += ` L ${points[points.length - 1].x} ${paddingTop} Z`
    return path
  })()

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div style={CARD}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 }}>Drawdown Analysis</h3>

      {/* 현재 DD 경고 배너 */}
      {currentDD && currentDD.amount > 0 && (
        <div style={{
          background: 'rgba(255,23,68,0.1)',
          borderLeft: `3px solid ${RED}`,
          borderRadius: '0 8px 8px 0',
          padding: '8px 12px', marginBottom: 12,
          fontSize: 11, color: '#e0e0e0',
          fontFamily: "'Noto Sans KR', sans-serif",
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>⚠️</span>
          <span>
            현재 DD 진행 중: <span style={{ color: RED, fontWeight: 700 }}>{formatPnl(-currentDD.amount)} (-{currentDD.percent.toFixed(1)}%)</span>
            {' | '}시작: {currentDD.startDate} | 경과: {currentDD.elapsed}일
          </span>
        </div>
      )}

      {/* 통계 카드 4개 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: '최대 DD 금액', value: formatPnl(-ddStats.maxDDAmount), color: RED },
          { label: '최대 DD %', value: `-${ddStats.maxDDPercent.toFixed(1)}%`, color: RED },
          { label: '최장 DD 기간', value: `${ddStats.maxDDDays}일`, color: '#ffc107' },
          { label: '평균 회복 시간', value: `${ddStats.avgRecovery}일`, color: '#42a5f5' },
        ].map((item) => (
          <div key={item.label} style={{ background: '#0d0d1a', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: 'Inter, monospace' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* DD 차트 */}
      <div style={{ overflow: 'hidden' }}>
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          <path d={areaPath} fill={RED} fillOpacity="0.15" />
          <path d={linePath} fill="none" stroke={RED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6" />
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={paddingLeft - 6} y={paddingTop + 4} fill="#6b7280" fontSize="8" textAnchor="end">$0</text>
          <text x={paddingLeft - 6} y={paddingTop + chartHeight + 4} fill={RED} fontSize="8" textAnchor="end">{formatPnl(-maxDD)}</text>
        </svg>
      </div>
    </div>
  )
}
