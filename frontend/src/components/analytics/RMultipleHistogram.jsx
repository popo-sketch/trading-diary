/**
 * RMultipleHistogram.jsx — R배수 분포 히스토그램
 *
 * 1R = 평균 손실 금액 (절대값)
 * R배수 = 각 트레이드 PnL / 1R
 */
import { useState, useMemo } from 'react'
import { formatPnl } from '../../utils/format'

const GREEN = '#00c853'
const RED = '#ff1744'
const GRAY = '#6b7280'

const BUCKETS = [
  { label: '≤-3R', min: -Infinity, max: -3 },
  { label: '-2R', min: -3, max: -2 },
  { label: '-1R', min: -2, max: -1 },
  { label: '0', min: -1, max: 0 },
  { label: '+1R', min: 0, max: 1 },
  { label: '+2R', min: 1, max: 2 },
  { label: '+3R', min: 2, max: 3 },
  { label: '≥+4R', min: 3, max: Infinity },
]

const CARD = {
  background: '#1a1a2e', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 20, height: '100%', boxSizing: 'border-box',
  display: 'flex', flexDirection: 'column',
}

function getBucketColor(label) {
  if (label.startsWith('≤-') || label === '-2R') return RED
  if (label === '-1R') return '#ff6d00'
  if (label === '0') return GRAY
  if (label === '+1R') return '#69f0ae'
  if (label === '+2R') return GREEN
  return GREEN
}

export default function RMultipleHistogram({ trades = [] }) {
  const [hoveredBucket, setHoveredBucket] = useState(null)

  const { bucketData, avgR, expectancy, oneR } = useMemo(() => {
    const losses = trades.filter((t) => Number(t.pnl || 0) < 0)
    const avgLoss = losses.length > 0
      ? losses.reduce((s, t) => s + Math.abs(Number(t.pnl || 0)), 0) / losses.length
      : 1

    const rValues = trades.map((t) => ({
      ...t,
      rMultiple: Number(t.pnl || 0) / avgLoss,
    }))

    const data = BUCKETS.map((b) => {
      const inBucket = rValues.filter((t) => {
        if (b.max === Infinity) return t.rMultiple >= b.min
        if (b.min === -Infinity) return t.rMultiple < b.max
        return t.rMultiple >= b.min && t.rMultiple < b.max
      })
      return {
        ...b,
        count: inBucket.length,
        avgPnl: inBucket.length > 0 ? inBucket.reduce((s, t) => s + Number(t.pnl || 0), 0) / inBucket.length : 0,
      }
    })

    const totalR = rValues.reduce((s, t) => s + t.rMultiple, 0)
    const avg = trades.length > 0 ? totalR / trades.length : 0
    const exp = trades.length > 0 ? trades.reduce((s, t) => s + Number(t.pnl || 0), 0) / trades.length : 0

    return { bucketData: data, avgR: avg, expectancy: exp, oneR: avgLoss }
  }, [trades])

  const maxCount = Math.max(...bucketData.map((b) => b.count), 1)

  if (trades.length === 0) {
    return (
      <div style={CARD}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 }}>R-Multiple Distribution</h3>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9e9e9e', fontSize: 13 }}>No Data</div>
      </div>
    )
  }

  return (
    <div style={CARD}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>R-Multiple Distribution</h3>
        <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
          <span style={{ color: '#9e9e9e' }}>
            Avg R: <span style={{ color: avgR >= 0 ? GREEN : RED, fontWeight: 700 }}>{avgR >= 0 ? '+' : ''}{avgR.toFixed(2)}R</span>
          </span>
          <span style={{ color: '#9e9e9e' }}>
            Expectancy: <span style={{ color: expectancy >= 0 ? GREEN : RED, fontWeight: 700 }}>{formatPnl(expectancy)}</span>
          </span>
        </div>
      </div>

      {/* 1R 기준 표시 */}
      <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 12, fontFamily: 'Inter, monospace' }}>
        1R = ${Math.round(oneR)} (평균 손실)
      </div>

      {/* 히스토그램 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 160 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flex: 1 }}>
          {bucketData.map((b, i) => {
            const heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0
            const color = getBucketColor(b.label)
            const isHovered = hoveredBucket === i
            return (
              <div
                key={b.label}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
                onMouseEnter={() => setHoveredBucket(i)}
                onMouseLeave={() => setHoveredBucket(null)}
              >
                {/* 호버 툴팁 */}
                {isHovered && b.count > 0 && (
                  <div style={{
                    position: 'absolute', bottom: `calc(${Math.max(heightPct, 10)}% + 28px)`,
                    background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6, padding: '6px 10px', zIndex: 10,
                    whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#e0e0e0', marginBottom: 2 }}>{b.label}</div>
                    <div style={{ fontSize: 9, color: '#9e9e9e' }}>
                      {b.count}건 ({trades.length > 0 ? ((b.count / trades.length) * 100).toFixed(0) : 0}%)
                    </div>
                    <div style={{ fontSize: 9, color: '#9e9e9e' }}>
                      Avg: <span style={{ color: b.avgPnl >= 0 ? GREEN : RED }}>{formatPnl(b.avgPnl)}</span>
                    </div>
                  </div>
                )}

                {/* 막대 위 숫자 */}
                {b.count > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4, fontFamily: 'Inter, monospace' }}>
                    {b.count}
                  </div>
                )}

                {/* 막대 */}
                <div style={{
                  width: '100%', minHeight: 4,
                  height: `${Math.max(heightPct, b.count > 0 ? 8 : 2)}%`,
                  background: color,
                  borderRadius: '4px 4px 0 0',
                  opacity: isHovered ? 1 : 0.75,
                  transition: 'opacity 0.15s, height 0.3s',
                  cursor: b.count > 0 ? 'pointer' : 'default',
                }} />
              </div>
            )
          })}
        </div>

        {/* X축 라벨 */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
          {bucketData.map((b) => (
            <div key={b.label} style={{
              flex: 1, textAlign: 'center', fontSize: 9, color: '#6b7280',
              fontFamily: 'Inter, monospace',
            }}>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
