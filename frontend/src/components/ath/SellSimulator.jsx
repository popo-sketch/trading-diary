/**
 * SellSimulator.jsx — 다단계 매도 시뮬레이션
 *
 * A) 구간별 자동 계산 테이블 (25/50/75/90/100%)
 * B) 인터랙티브 슬라이더
 * C) 분할 매도 시뮬레이션 (최대 3분할)
 * D) 미니 가격 차트 (매수/매도/ATH 마커)
 */
import { useState, useMemo } from 'react'
import { formatPnl } from '../../utils/format'

const GREEN = '#00c853'
const RED = '#ff1744'
const WARN = '#ffc107'
const INFO = '#42a5f5'

const PERCENTILES = [25, 50, 75, 90, 100]

function calcPnlAtPercent(entryAmount, athMultiple, pct) {
  const sellMultiple = 1 + (athMultiple - 1) * (pct / 100)
  const exitValue = entryAmount * sellMultiple
  return exitValue - entryAmount
}

// ─── A) 구간별 테이블 ────────────────────────────────────────────────────────

function SimulationTable({ entryAmount, athMultiple, actualPnl, athEfficiency }) {
  const rows = PERCENTILES.map(pct => {
    const pnl = calcPnlAtPercent(entryAmount, athMultiple, pct)
    const diff = pnl - actualPnl
    const isMyRange = Math.abs(athEfficiency - pct) < 12.5
    return { pct, pnl, diff, isMyRange }
  })

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 8,
      }}>구간별 매도 시뮬레이션</div>
      <div style={{
        display: 'grid', gridTemplateColumns: '60px 1fr 1fr 1fr',
        fontSize: 11, fontFamily: 'Inter, monospace',
        gap: 0,
      }}>
        {/* 헤더 */}
        {['ATH %', '매도 PnL', '실제 대비', ''].map((h, i) => (
          <div key={i} style={{
            padding: '6px 8px', color: '#4b5563', fontSize: 9,
            fontWeight: 700, textTransform: 'uppercase',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>{h}</div>
        ))}

        {rows.map(r => (
          <>
            <div key={`pct-${r.pct}`} style={{
              padding: '6px 8px', color: r.isMyRange ? INFO : '#9e9e9e',
              fontWeight: r.isMyRange ? 700 : 400,
              background: r.isMyRange ? 'rgba(66,165,245,0.08)' : 'transparent',
              borderLeft: r.isMyRange ? `2px solid ${INFO}` : '2px solid transparent',
            }}>{r.pct}%</div>
            <div key={`pnl-${r.pct}`} style={{
              padding: '6px 8px', fontWeight: 600,
              color: r.pnl >= 0 ? GREEN : RED,
              background: r.isMyRange ? 'rgba(66,165,245,0.08)' : 'transparent',
            }}>{formatPnl(r.pnl)}</div>
            <div key={`diff-${r.pct}`} style={{
              padding: '6px 8px',
              color: r.diff > 0 ? RED : r.diff < 0 ? GREEN : '#6b7280',
              background: r.isMyRange ? 'rgba(66,165,245,0.08)' : 'transparent',
            }}>{r.diff > 0 ? '+' : ''}{formatPnl(r.diff)}</div>
            <div key={`mark-${r.pct}`} style={{
              padding: '6px 8px',
              background: r.isMyRange ? 'rgba(66,165,245,0.08)' : 'transparent',
              fontSize: 9, color: INFO,
            }}>{r.isMyRange ? '← 내 매도' : ''}</div>
          </>
        ))}
      </div>
    </div>
  )
}

// ─── B) 인터랙티브 슬라이더 ──────────────────────────────────────────────────

function SellSlider({ entryAmount, athMultiple, actualPnl, athEfficiency }) {
  const [sliderPct, setSliderPct] = useState(50)
  const simPnl = calcPnlAtPercent(entryAmount, athMultiple, sliderPct)
  const diff = simPnl - actualPnl
  const myPct = Math.min(100, Math.max(0, athEfficiency))

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 10,
      }}>매도 지점 슬라이더</div>

      <div style={{ position: 'relative', padding: '0 4px', marginBottom: 6 }}>
        {/* 내 실제 매도 마커 */}
        <div style={{
          position: 'absolute', left: `${myPct}%`, top: -6,
          transform: 'translateX(-50%)', fontSize: 10, color: WARN,
          fontWeight: 700, fontFamily: 'Inter, monospace',
          whiteSpace: 'nowrap',
        }}>▼ 내 매도 ({myPct.toFixed(0)}%)</div>

        <input
          type="range" min={0} max={100} value={sliderPct}
          onChange={e => setSliderPct(Number(e.target.value))}
          style={{
            width: '100%', marginTop: 16, accentColor: INFO,
            cursor: 'pointer',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#9e9e9e', fontFamily: 'Inter, monospace' }}>
          ATH의 <span style={{ color: INFO, fontWeight: 700 }}>{sliderPct}%</span>에서 매도 시
        </span>
        <div style={{ textAlign: 'right' }}>
          <span style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: simPnl >= 0 ? GREEN : RED,
          }}>{formatPnl(simPnl)}</span>
          <span style={{
            fontSize: 11, marginLeft: 8, fontFamily: 'Inter, monospace',
            color: diff > 0 ? RED : diff < 0 ? GREEN : '#6b7280',
          }}>({diff > 0 ? '+' : ''}{formatPnl(diff)} vs 실제)</span>
        </div>
      </div>
    </div>
  )
}

// ─── C) 분할 매도 시뮬레이션 ─────────────────────────────────────────────────

function SplitSellSim({ entryAmount, athMultiple, actualPnl }) {
  const [enabled, setEnabled] = useState(false)
  const [splits, setSplits] = useState([
    { ratio: 50, athPct: 50 },
    { ratio: 30, athPct: 75 },
    { ratio: 20, athPct: 90 },
  ])

  const updateSplit = (idx, field, value) => {
    setSplits(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: Math.max(0, Math.min(100, Number(value) || 0)) }
      return next
    })
  }

  const totalRatio = splits.reduce((s, sp) => s + sp.ratio, 0)
  const splitPnl = splits.reduce((total, sp) => {
    const portion = entryAmount * (sp.ratio / 100)
    return total + calcPnlAtPercent(portion, athMultiple, sp.athPct)
  }, 0)
  const diff = splitPnl - actualPnl

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#4b5563',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'Inter, monospace',
        }}>분할 매도 시뮬레이션</div>
        <button
          onClick={() => setEnabled(v => !v)}
          style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 10,
            fontWeight: 600, border: 'none', cursor: 'pointer',
            background: enabled ? `${INFO}20` : 'rgba(255,255,255,0.06)',
            color: enabled ? INFO : '#6b7280',
            fontFamily: 'Inter, monospace',
          }}
        >{enabled ? 'ON' : 'OFF'}</button>
      </div>

      {enabled && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {splits.map((sp, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: '#6b7280', fontFamily: 'Inter, monospace', width: 30, flexShrink: 0 }}>
                  {i + 1}차
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number" value={sp.ratio}
                    onChange={e => updateSplit(i, 'ratio', e.target.value)}
                    style={{
                      width: 50, padding: '4px 6px', borderRadius: 4,
                      background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e0e0e0', fontSize: 12, fontFamily: 'Inter, monospace',
                      textAlign: 'center', outline: 'none',
                    }}
                  />
                  <span style={{ color: '#6b7280', fontSize: 11 }}>% 물량</span>
                </div>
                <span style={{ color: '#4b5563' }}>→</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#6b7280', fontSize: 11 }}>ATH</span>
                  <input
                    type="number" value={sp.athPct}
                    onChange={e => updateSplit(i, 'athPct', e.target.value)}
                    style={{
                      width: 50, padding: '4px 6px', borderRadius: 4,
                      background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e0e0e0', fontSize: 12, fontFamily: 'Inter, monospace',
                      textAlign: 'center', outline: 'none',
                    }}
                  />
                  <span style={{ color: '#6b7280', fontSize: 11 }}>%에서</span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600, fontFamily: 'Inter, monospace',
                  color: calcPnlAtPercent(entryAmount * (sp.ratio / 100), athMultiple, sp.athPct) >= 0 ? GREEN : RED,
                  marginLeft: 'auto',
                }}>
                  {formatPnl(calcPnlAtPercent(entryAmount * (sp.ratio / 100), athMultiple, sp.athPct))}
                </span>
              </div>
            ))}
          </div>

          {totalRatio !== 100 && (
            <div style={{ fontSize: 10, color: WARN, marginTop: 6, fontFamily: 'Inter, monospace' }}>
              ⚠ 비율 합계: {totalRatio}% (100% 필요)
            </div>
          )}

          <div style={{
            marginTop: 10, padding: '10px 12px', borderRadius: 8,
            background: '#0d0d1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#9e9e9e' }}>
              <div>실제 일괄 매도: <span style={{ color: actualPnl >= 0 ? GREEN : RED, fontWeight: 700 }}>{formatPnl(actualPnl)}</span></div>
              <div>분할 매도 시: <span style={{ color: splitPnl >= 0 ? GREEN : RED, fontWeight: 700 }}>{formatPnl(splitPnl)}</span></div>
            </div>
            <div style={{
              fontSize: 14, fontWeight: 800, fontFamily: 'Inter, monospace',
              color: diff > 0 ? GREEN : diff < 0 ? RED : '#6b7280',
            }}>
              {diff > 0 ? '▲' : diff < 0 ? '▼' : '='} {formatPnl(Math.abs(diff))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── D) 미니 가격 차트 ───────────────────────────────────────────────────────

function MiniPriceChart({ athMultiple, athEfficiency }) {
  const W = 400, H = 120, PL = 40, PR = 16, PT = 16, PB = 24
  const cw = W - PL - PR, ch = H - PT - PB

  // 가격 곡선 생성 (매수 → ATH → 하락)
  const maxY = athMultiple
  const points = []
  const steps = 40
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // 매수(1x) → ATH(maxY) → 일부 하락
    let price
    if (t <= 0.6) {
      // 상승 구간
      price = 1 + (maxY - 1) * (t / 0.6) ** 0.8
    } else {
      // 하락 구간
      const decay = (t - 0.6) / 0.4
      price = maxY - (maxY - maxY * 0.3) * decay ** 1.2
    }
    points.push({ t, price })
  }

  const yScale = (price) => PT + ch - ((price - 0.5) / (maxY + 0.5 - 0.5)) * ch
  const xScale = (t) => PL + t * cw

  const pathD = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(p.t).toFixed(1)} ${yScale(p.price).toFixed(1)}`
  ).join(' ')

  // 마커 위치
  const entryX = xScale(0), entryY = yScale(1)
  const athX = xScale(0.6), athY = yScale(maxY)
  const sellT = 0.6 * (athEfficiency / 100)
  const sellPrice = 1 + (maxY - 1) * (sellT / 0.6) ** 0.8
  const sellX = xScale(Math.min(sellT, 0.6)), sellY = yScale(Math.min(sellPrice, maxY))

  // ATH 퍼센트 수평 점선
  const pctLines = [25, 50, 75, 90].map(pct => {
    const price = 1 + (maxY - 1) * (pct / 100)
    return { pct, y: yScale(price) }
  })

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 6,
      }}>가격 차트 (개념도)</div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* ATH % 점선 */}
        {pctLines.map(l => (
          <g key={l.pct}>
            <line x1={PL} y1={l.y} x2={W - PR} y2={l.y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 3" />
            <text x={PL - 4} y={l.y + 3} fill="#4b5563" fontSize="8" textAnchor="end"
              fontFamily="Inter, monospace">{l.pct}%</text>
          </g>
        ))}

        {/* 가격 곡선 */}
        <path d={pathD} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />

        {/* 매수 마커 */}
        <circle cx={entryX} cy={entryY} r={5} fill={GREEN} stroke="#0d0d1a" strokeWidth="2" />
        <text x={entryX + 8} y={entryY + 3} fill={GREEN} fontSize="9" fontFamily="Inter, monospace">매수</text>

        {/* ATH 마커 */}
        <text x={athX} y={athY - 8} fill={WARN} fontSize="12" textAnchor="middle">⭐</text>
        <text x={athX + 12} y={athY - 6} fill={WARN} fontSize="9" fontFamily="Inter, monospace">ATH ×{athMultiple.toFixed(1)}</text>

        {/* 매도 마커 */}
        <circle cx={sellX} cy={sellY} r={5} fill={WARN} stroke="#0d0d1a" strokeWidth="2" />
        <line x1={sellX} y1={sellY} x2={sellX} y2={H - PB} stroke={WARN} strokeWidth="1" strokeDasharray="3 2" opacity="0.5" />
        <text x={sellX} y={H - PB + 12} fill={WARN} fontSize="9" textAnchor="middle"
          fontFamily="Inter, monospace">매도 ({athEfficiency.toFixed(0)}%)</text>

        {/* 축 */}
        <line x1={PL} y1={PT} x2={PL} y2={H - PB} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      </svg>
    </div>
  )
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function SellSimulator({ analysis }) {
  const a = analysis
  const entryAmount = Number(a.entry_amount) || 0
  const pnl = Number(a.pnl) || 0

  if (!a.athMultiple || a.athMultiple <= 1 || entryAmount <= 0) {
    return (
      <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0' }}>
        매도 시뮬레이션에 필요한 데이터가 부족합니다.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {/* 좌측: 테이블 + 슬라이더 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SimulationTable
            entryAmount={entryAmount} athMultiple={a.athMultiple}
            actualPnl={pnl} athEfficiency={a.athEfficiency}
          />
          <SellSlider
            entryAmount={entryAmount} athMultiple={a.athMultiple}
            actualPnl={pnl} athEfficiency={a.athEfficiency}
          />
        </div>
        {/* 우측: 미니 차트 */}
        <div style={{ flex: 1 }}>
          <MiniPriceChart athMultiple={a.athMultiple} athEfficiency={a.athEfficiency} />
        </div>
      </div>

      {/* 분할 매도 */}
      <SplitSellSim entryAmount={entryAmount} athMultiple={a.athMultiple} actualPnl={pnl} />
    </div>
  )
}
