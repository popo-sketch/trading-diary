/**
 * PatternInsights.jsx — 패턴 인사이트 대시보드
 *
 * A) 체인별 비교 카드
 * B) 카테고리별 비교
 * C) 보유 시간별 ATH 효율
 * D) 수익/손실별 ATH 효율
 */
import { useMemo, useState } from 'react'
import { formatPnl } from '../../utils/format'

const GREEN = '#00c853'
const RED = '#ff1744'
const WARN = '#ffc107'
const INFO = '#42a5f5'

const CARD = {
  background: '#1a1a2e', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 16,
}

function avg(arr, key) {
  if (arr.length === 0) return 0
  return arr.reduce((s, a) => s + (a[key] || 0), 0) / arr.length
}

// ─── A) 체인별 비교 ─────────────────────────────────────────────────────────

function ChainComparison({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1)

  const chains = useMemo(() => {
    const sol = valid.filter(a => a.chain === 'Solana')
    const bnb = valid.filter(a => a.chain === 'BNB' || a.chain === 'BSC')

    return [
      { name: 'Solana', icon: '◎', color: '#b794f6', data: sol },
      { name: 'BNB', icon: '◆', color: '#f3ba2f', data: bnb },
    ].filter(c => c.data.length > 0)
  }, [valid])

  if (chains.length === 0) return null

  const bestChain = chains.reduce((best, c) =>
    avg(c.data, 'athEfficiency') > avg(best.data, 'athEfficiency') ? c : best
  )

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 10,
      }}>체인별 비교</div>
      <div style={{ display: 'flex', gap: 10 }}>
        {chains.map(c => {
          const avgEff = avg(c.data, 'athEfficiency')
          const avgPnl = avg(c.data, 'pnl')
          const isBest = c.name === bestChain.name && chains.length > 1
          return (
            <div key={c.name} style={{
              flex: 1, padding: '14px 16px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: isBest ? `1px solid ${GREEN}30` : '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 14, color: c.color }}>{c.icon}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>
                  {c.name}
                </span>
                {isBest && (
                  <span style={{
                    fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                    background: `${GREEN}15`, color: GREEN, fontFamily: 'Inter, monospace',
                  }}>BETTER</span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', fontFamily: 'Inter, monospace' }}>
                  {c.data.length}건
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 2 }}>평균 ATH 효율</div>
                  <div style={{
                    fontSize: 18, fontWeight: 800, fontFamily: 'Inter, monospace',
                    color: avgEff >= 50 ? GREEN : avgEff >= 25 ? WARN : RED,
                  }}>{avgEff.toFixed(1)}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#4b5563', marginBottom: 2 }}>평균 PnL</div>
                  <div style={{
                    fontSize: 18, fontWeight: 800, fontFamily: 'Inter, monospace',
                    color: avgPnl >= 0 ? GREEN : RED,
                  }}>{formatPnl(avgPnl)}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── B) 카테고리별 비교 ──────────────────────────────────────────────────────

function CategoryComparison({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1 && a.trade_type)

  const categories = useMemo(() => {
    const groups = {}
    valid.forEach(a => {
      const t = a.trade_type
      if (!groups[t]) groups[t] = []
      groups[t].push(a)
    })
    return Object.entries(groups)
      .map(([name, data]) => ({ name, data }))
      .sort((a, b) => avg(b.data, 'athEfficiency') - avg(a.data, 'athEfficiency'))
  }, [valid])

  if (categories.length === 0) return null

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 10,
      }}>카테고리별 비교</div>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {categories.map(cat => {
          const avgEff = avg(cat.data, 'athEfficiency')
          const avgPnlVal = avg(cat.data, 'pnl')
          const effColor = avgEff >= 50 ? GREEN : avgEff >= 25 ? WARN : RED
          return (
            <div key={cat.name} style={{
              flexShrink: 0, minWidth: 150, padding: '12px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: '#e0e0e0',
                fontFamily: 'Inter, monospace', marginBottom: 8,
              }}>{cat.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#6b7280' }}>효율</span>
                  <span style={{ fontWeight: 700, color: effColor, fontFamily: 'Inter, monospace' }}>{avgEff.toFixed(0)}%</span>
                </div>
                <div style={{
                  width: '100%', height: 4, borderRadius: 2,
                  background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(avgEff, 100)}%`, height: '100%', borderRadius: 2,
                    background: effColor,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 4 }}>
                  <span style={{ color: '#6b7280' }}>Avg PnL</span>
                  <span style={{
                    fontWeight: 600, fontFamily: 'Inter, monospace',
                    color: avgPnlVal >= 0 ? GREEN : RED,
                  }}>{formatPnl(avgPnlVal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#6b7280' }}>건수</span>
                  <span style={{ color: '#9e9e9e', fontFamily: 'Inter, monospace' }}>{cat.data.length}건</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── C) 보유 시간별 ATH 효율 ─────────────────────────────────────────────────

const HOLD_BUCKETS = [
  { label: '<1h', maxMs: 3600000 },
  { label: '1-6h', maxMs: 21600000 },
  { label: '6-24h', maxMs: 86400000 },
  { label: '1-3d', maxMs: 259200000 },
  { label: '3d+', maxMs: Infinity },
]

function HoldTimeChart({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1 && a.created_at)

  const bucketData = useMemo(() => {
    return HOLD_BUCKETS.map((b, idx) => {
      const minMs = idx === 0 ? 0 : HOLD_BUCKETS[idx - 1].maxMs
      const items = valid.filter(a => {
        // 보유 시간 추정: created_at → date 기반 (정확하지 않지만 가능한 추정)
        const created = new Date(a.created_at)
        const dateEnd = new Date(a.date + 'T23:59:59')
        const holdMs = dateEnd - created
        return holdMs >= minMs && holdMs < b.maxMs
      })
      return { ...b, count: items.length, avgEff: avg(items, 'athEfficiency') }
    })
  }, [valid])

  const maxEff = Math.max(...bucketData.map(b => b.avgEff), 1)

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 10,
      }}>보유 시간별 ATH 효율</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
        {bucketData.map(b => {
          const heightPct = maxEff > 0 ? (b.avgEff / maxEff) * 100 : 0
          const color = b.avgEff >= 50 ? GREEN : b.avgEff >= 25 ? WARN : RED
          return (
            <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              {b.count > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4, fontFamily: 'Inter, monospace' }}>
                  {b.avgEff.toFixed(0)}%
                </div>
              )}
              <div style={{
                width: '100%', minHeight: 4,
                height: `${Math.max(heightPct, b.count > 0 ? 8 : 2)}%`,
                background: b.count > 0 ? color : 'rgba(255,255,255,0.04)',
                borderRadius: '4px 4px 0 0',
                opacity: 0.75,
              }} />
            </div>
          )
        })}
      </div>
      <div style={{
        display: 'flex', gap: 8, marginTop: 6,
        borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6,
      }}>
        {bucketData.map(b => (
          <div key={b.label} style={{
            flex: 1, textAlign: 'center', fontSize: 9, color: '#6b7280',
            fontFamily: 'Inter, monospace',
          }}>
            {b.label}
            <div style={{ fontSize: 8, color: '#4b5563' }}>{b.count}건</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── D) 수익/손실별 ATH 효율 ─────────────────────────────────────────────────

function PnlGroupComparison({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1)

  const winners = valid.filter(a => Number(a.pnl) >= 0)
  const losers = valid.filter(a => Number(a.pnl) < 0)

  const winEff = avg(winners, 'athEfficiency')
  const loseEff = avg(losers, 'athEfficiency')

  let insight = ''
  if (winners.length > 0 && losers.length > 0) {
    if (winEff < 40) {
      insight = `수익 트레이드도 ATH 대비 ${winEff.toFixed(0)}%에서 매도 — 더 높은 지점까지 홀딩 연습 필요`
    } else if (winEff >= 60) {
      insight = `수익 트레이드에서 ATH의 ${winEff.toFixed(0)}%를 확보 — 좋은 매도 습관`
    } else {
      insight = `수익 시 평균 ${winEff.toFixed(0)}%, 손실 시 평균 ${loseEff.toFixed(0)}% — 개선 여지 있음`
    }
  }

  const groups = [
    { label: '수익 트레이드', data: winners, color: GREEN, effVal: winEff },
    { label: '손실 트레이드', data: losers, color: RED, effVal: loseEff },
  ]

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 10,
      }}>수익/손실별 ATH 효율</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        {groups.map(g => (
          <div key={g.label} style={{
            flex: 1, padding: '10px 14px', borderRadius: 8,
            background: '#0d0d1a',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: g.color }}>{g.label}</span>
              <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace' }}>{g.data.length}건</span>
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, fontFamily: 'Inter, monospace',
              color: g.effVal >= 50 ? GREEN : g.effVal >= 25 ? WARN : RED,
            }}>{g.data.length > 0 ? `${g.effVal.toFixed(1)}%` : '—'}</div>
            <div style={{
              width: '100%', height: 5, borderRadius: 3,
              background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 6,
            }}>
              <div style={{
                width: `${Math.min(g.effVal, 100)}%`, height: '100%', borderRadius: 3,
                background: g.effVal >= 50 ? GREEN : g.effVal >= 25 ? WARN : RED,
              }} />
            </div>
          </div>
        ))}
      </div>

      {insight && (
        <div style={{
          fontSize: 12, color: '#9e9e9e', lineHeight: 1.7,
          fontFamily: "'Noto Sans KR', sans-serif",
          padding: '8px 12px', borderRadius: 8,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          💡 {insight}
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function PatternInsights({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1)
  if (valid.length < 2) return null

  return (
    <div style={CARD}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 16 }}>
        패턴 인사이트
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <ChainComparison analyses={analyses} />
        <CategoryComparison analyses={analyses} />
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <HoldTimeChart analyses={analyses} />
          </div>
          <div style={{ flex: 1 }}>
            <PnlGroupComparison analyses={analyses} />
          </div>
        </div>
      </div>
    </div>
  )
}
