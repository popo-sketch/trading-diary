/**
 * WinRateHeatmap.jsx — 요일별 · 시간대별 승률 히트맵
 */
import { useState, useMemo } from 'react'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => i)

const CARD = {
  background: '#1a1a2e', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 20, height: '100%', boxSizing: 'border-box',
}

function getColor(winRate) {
  if (winRate >= 80) return '#00c853'
  if (winRate >= 60) return '#69f0ae'
  if (winRate >= 40) return '#ffc107'
  if (winRate >= 20) return '#ff6d00'
  return '#ff1744'
}

function formatPnlShort(v) {
  if (v >= 0) return `+$${Math.round(v)}`
  return `-$${Math.abs(Math.round(v))}`
}

export default function WinRateHeatmap({ trades = [] }) {
  const [tooltip, setTooltip] = useState(null)

  const grid = useMemo(() => {
    const data = {}
    for (const day of DAYS) {
      data[day] = {}
      for (const h of HOURS) {
        data[day][h] = { wins: 0, total: 0, totalPnl: 0 }
      }
    }

    trades.forEach((t) => {
      const dt = new Date(t.created_at)
      if (isNaN(dt.getTime())) return
      const dayIdx = dt.getUTCDay()
      // UTC → KST (+9)
      const hour = (dt.getUTCHours() + 9) % 24
      const dayName = DAYS[dayIdx]
      const cell = data[dayName][hour]
      cell.total++
      cell.totalPnl += Number(t.pnl || 0)
      if (Number(t.pnl || 0) > 0) cell.wins++
    })

    return data
  }, [trades])

  // 활성 시간대만 표시 (트레이드가 있는 시간대)
  const activeHours = useMemo(() => {
    const hours = new Set()
    for (const day of DAYS) {
      for (const h of HOURS) {
        if (grid[day][h].total > 0) hours.add(h)
      }
    }
    if (hours.size === 0) return HOURS.slice(8, 24)
    const sorted = [...hours].sort((a, b) => a - b)
    const min = Math.max(0, sorted[0] - 1)
    const max = Math.min(23, sorted[sorted.length - 1] + 1)
    return Array.from({ length: max - min + 1 }, (_, i) => min + i)
  }, [grid])

  if (trades.length === 0) {
    return (
      <div style={CARD}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 }}>Win Rate Heatmap</h3>
        <div style={{ color: '#9e9e9e', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No Data</div>
      </div>
    )
  }

  return (
    <div style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>Win Rate Heatmap</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 9, color: '#6b7280' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ff1744', display: 'inline-block' }} /> 0-19%
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#ffc107', display: 'inline-block' }} /> 40-59%
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#00c853', display: 'inline-block' }} /> 80%+
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', position: 'relative' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `40px repeat(${activeHours.length}, minmax(32px, 1fr))`,
          gap: 2,
        }}>
          {/* 헤더 행 (시간) */}
          <div />
          {activeHours.map((h) => (
            <div key={h} style={{
              textAlign: 'center', fontSize: 9, color: '#6b7280',
              fontFamily: 'Inter, monospace', padding: '4px 0',
            }}>
              {String(h).padStart(2, '0')}
            </div>
          ))}

          {/* 데이터 행 */}
          {DAYS.map((day) => (
            <>
              <div key={`label-${day}`} style={{
                display: 'flex', alignItems: 'center', fontSize: 10, color: '#9e9e9e',
                fontFamily: 'Inter, monospace', fontWeight: 600, paddingRight: 4,
              }}>
                {day}
              </div>
              {activeHours.map((h) => {
                const cell = grid[day][h]
                const hasData = cell.total > 0
                const winRate = hasData ? (cell.wins / cell.total) * 100 : 0
                const avgPnl = hasData ? cell.totalPnl / cell.total : 0
                return (
                  <div
                    key={`${day}-${h}`}
                    onMouseEnter={(e) => {
                      if (!hasData) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTooltip({
                        x: rect.left + rect.width / 2,
                        y: rect.top - 8,
                        day, hour: h,
                        total: cell.total, winRate: winRate.toFixed(0),
                        avgPnl: formatPnlShort(avgPnl),
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      minHeight: 28, borderRadius: 4,
                      background: hasData ? getColor(winRate) : '#0d0d1a',
                      opacity: hasData ? (0.4 + (cell.total / Math.max(...Object.values(grid).flatMap((d) => Object.values(d).map((c) => c.total)), 1)) * 0.6) : 0.3,
                      transition: 'opacity 0.15s',
                      cursor: hasData ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, color: hasData ? '#fff' : 'transparent',
                      fontFamily: 'Inter, monospace', fontWeight: 600,
                    }}
                  >
                    {hasData && cell.total}
                  </div>
                )
              })}
            </>
          ))}
        </div>

        {/* 툴팁 */}
        {tooltip && (
          <div style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: '#0d0d1a',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, padding: '8px 12px',
            zIndex: 100, pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#e0e0e0', marginBottom: 4 }}>
              {tooltip.day} {String(tooltip.hour).padStart(2, '0')}:00
            </div>
            <div style={{ fontSize: 10, color: '#9e9e9e', display: 'flex', gap: 12 }}>
              <span>Trades: <span style={{ color: '#e0e0e0' }}>{tooltip.total}</span></span>
              <span>Win: <span style={{ color: Number(tooltip.winRate) >= 50 ? '#00c853' : '#ff1744' }}>{tooltip.winRate}%</span></span>
              <span>Avg: <span style={{ color: tooltip.avgPnl.startsWith('+') ? '#00c853' : '#ff1744' }}>{tooltip.avgPnl}</span></span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
