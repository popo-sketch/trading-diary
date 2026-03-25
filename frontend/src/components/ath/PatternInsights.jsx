/**
 * PatternInsights.jsx — 패턴 인사이트 대시보드
 *
 * A) 체인별 비교 카드
 * B) 카테고리별 비교
 * C) 수익/손실별 ATH 효율
 */
import { useMemo } from 'react'
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
      { name: 'Solana', icon: '◎', color: '#14F195', data: sol },
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

// ─── B) 카테고리별 ATH 효율 랭킹 ─────────────────────────────────────────────

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
      .map(([name, data]) => ({ name, data, avgEff: avg(data, 'athEfficiency') }))
      .sort((a, b) => b.avgEff - a.avgEff)
  }, [valid])

  if (categories.length === 0) return null

  const maxEff = Math.max(...categories.map(c => c.avgEff), 1)
  const medals = ['🥇', '🥈', '🥉']

  // 인사이트 자동 생성
  const best = categories[0]
  const worst = categories[categories.length - 1]
  let insight = ''
  if (categories.length >= 2) {
    if (best.avgEff >= 60) {
      insight = `${best.name} 카테고리가 평균 ${best.avgEff.toFixed(0)}%로 가장 높은 ATH 매도 효율을 보입니다`
    } else {
      insight = `전체적으로 ATH 효율이 낮습니다 — 가장 높은 ${best.name}도 ${best.avgEff.toFixed(0)}%`
    }
    if (worst.avgEff < 30 && categories.length > 1) {
      insight += `. ${worst.name}은(는) ${worst.avgEff.toFixed(0)}%로 매도 타이밍 개선이 필요합니다`
    }
  }

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 10,
      }}>카테고리별 ATH 효율 랭킹</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {categories.map((cat, idx) => {
          const effColor = cat.avgEff >= 50 ? GREEN : cat.avgEff >= 25 ? WARN : RED
          const isFirst = idx === 0 && categories.length > 1
          const isLast = idx === categories.length - 1 && categories.length > 1
          const isLowData = cat.data.length === 1

          return (
            <div key={cat.name} style={{
              padding: '10px 14px', borderRadius: 10,
              background: isFirst ? 'rgba(0,200,83,0.04)' : isLast ? 'rgba(255,23,68,0.04)' : 'rgba(255,255,255,0.02)',
              border: isFirst ? `1px solid ${GREEN}30` : isLast ? `1px solid ${RED}25` : '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* 메달 또는 순위 */}
                <span style={{
                  fontSize: idx < 3 ? 16 : 12, minWidth: 24, textAlign: 'center',
                  fontWeight: 700, color: idx >= 3 ? '#6b7280' : undefined,
                  fontFamily: idx >= 3 ? 'Inter, monospace' : undefined,
                }}>
                  {idx < 3 ? medals[idx] : `${idx + 1}`}
                </span>

                {/* 카테고리명 */}
                <span style={{
                  fontSize: 13, fontWeight: 700, color: '#e0e0e0',
                  fontFamily: 'Inter, monospace', minWidth: 80,
                }}>{cat.name}</span>

                {/* 프로그레스 바 */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1, height: 8, borderRadius: 4,
                    background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${(cat.avgEff / maxEff) * 100}%`, height: '100%',
                      borderRadius: 4, background: effColor,
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{
                    fontSize: 14, fontWeight: 800, color: effColor,
                    fontFamily: 'Inter, monospace', minWidth: 44, textAlign: 'right',
                  }}>{cat.avgEff.toFixed(0)}%</span>
                </div>

                {/* 건수 */}
                <span style={{
                  fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace', minWidth: 32, textAlign: 'right',
                }}>
                  {isLowData ? (
                    <span style={{ color: '#4b5563' }}>{cat.data.length}건 <span style={{ fontSize: 9 }}>(데이터 부족)</span></span>
                  ) : (
                    `${cat.data.length}건`
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {insight && (
        <div style={{
          marginTop: 10, fontSize: 12, color: '#9e9e9e', lineHeight: 1.7,
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

// ─── C) 수익/손실별 ATH 효율 ─────────────────────────────────────────────────

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
        <PnlGroupComparison analyses={analyses} />
      </div>
    </div>
  )
}
