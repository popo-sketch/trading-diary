/**
 * PostExitTracker.jsx — 매도 후 가격 추적 + 최적 타이밍
 *
 * A) 매도 후 가격 변동 (현재가 기준)
 * B) 매도 타이밍 점수
 * C) 매도 후 가격 추이 미니 차트
 * D) 최적 보유 시간 추산
 */
import { useMemo } from 'react'
import { formatPnl } from '../../utils/format'

const GREEN = '#00c853'
const RED = '#ff1744'
const WARN = '#ffc107'
const INFO = '#42a5f5'

// ─── A) 매도 후 가격 변동 ────────────────────────────────────────────────────

function PostExitChange({ analysis }) {
  const a = analysis
  const dex = a.dex
  if (!dex) return null

  const entryAmount = Number(a.entry_amount) || 0
  const pnl = Number(a.pnl) || 0
  if (entryAmount <= 0) return null

  // 실제 매도 배수 (exit_value / entry_amount)
  const exitValue = entryAmount + pnl
  const sellMultiple = exitValue / entryAmount

  // 현재 배수 (entryMC → currentMC)
  const entryMC = a.entryMC || 0
  const currentMC = dex.marketCap || dex.fdv || 0
  const currentMultiple = entryMC > 0 && currentMC > 0 ? currentMC / entryMC : null

  if (currentMultiple === null) return null

  // 매도 이후 가격 변동률
  const postExitChange = sellMultiple > 0
    ? ((currentMultiple / sellMultiple) - 1) * 100
    : 0

  // 만약 지금까지 들고 있었다면의 PnL
  const holdPnl = entryAmount * currentMultiple - entryAmount
  const holdDiff = holdPnl - pnl

  // priceChange24h from DexScreener
  const change24h = dex.priceChange24h

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 10,
      }}>매도 후 가격 변동</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <div style={{ background: '#0d0d1a', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace', marginBottom: 3 }}>
            매도 후 변동
          </div>
          <div style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: postExitChange > 0 ? RED : GREEN,
          }}>
            {postExitChange > 0 ? '+' : ''}{postExitChange.toFixed(1)}%
          </div>
          <div style={{ fontSize: 9, color: '#4b5563', lineHeight: 1.7 }}>
            {postExitChange > 0 ? '매도 후 상승 (아쉬움)' : '매도 후 하락 (좋은 판단)'}
          </div>
        </div>

        <div style={{ background: '#0d0d1a', borderRadius: 8, padding: '8px 10px' }}>
          <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace', marginBottom: 3 }}>
            지금까지 홀딩 시 PnL
          </div>
          <div style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: holdPnl >= 0 ? GREEN : RED,
          }}>
            {formatPnl(holdPnl)}
          </div>
          <div style={{
            fontSize: 9, fontFamily: 'Inter, monospace', lineHeight: 1.7,
            color: holdDiff > 0 ? RED : GREEN,
          }}>
            실제 대비 {holdDiff > 0 ? '+' : ''}{formatPnl(holdDiff)}
          </div>
        </div>

        {change24h !== null && (
          <div style={{ background: '#0d0d1a', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace', marginBottom: 3 }}>
              최근 24H 변동
            </div>
            <div style={{
              fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
              color: change24h >= 0 ? GREEN : RED,
            }}>
              {change24h >= 0 ? '+' : ''}{Number(change24h).toFixed(1)}%
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── B) 매도 타이밍 점수 ─────────────────────────────────────────────────────

function TimingScore({ analysis }) {
  const a = analysis
  const dex = a.dex
  if (!dex) return null

  const entryAmount = Number(a.entry_amount) || 0
  const pnl = Number(a.pnl) || 0
  if (entryAmount <= 0) return null

  const exitValue = entryAmount + pnl
  const sellMultiple = exitValue / entryAmount

  const entryMC = a.entryMC || 0
  const currentMC = dex.marketCap || dex.fdv || 0
  const currentMultiple = entryMC > 0 && currentMC > 0 ? currentMC / entryMC : null
  if (currentMultiple === null) return null

  const postExitChange = sellMultiple > 0 ? ((currentMultiple / sellMultiple) - 1) * 100 : 0

  let grade, label, emoji, color, bg
  if (postExitChange <= -20) {
    grade = 'S'; label = '완벽한 매도'; emoji = '🟢'; color = GREEN; bg = 'rgba(0,200,83,0.08)'
  } else if (postExitChange <= 0) {
    grade = 'A'; label = '좋은 매도'; emoji = '🟢'; color = GREEN; bg = 'rgba(0,200,83,0.06)'
  } else if (postExitChange <= 50) {
    grade = 'B'; label = '적정 매도'; emoji = '🟡'; color = WARN; bg = 'rgba(255,193,7,0.06)'
  } else if (postExitChange <= 200) {
    grade = 'C'; label = '이른 매도'; emoji = '🔴'; color = RED; bg = 'rgba(255,23,68,0.06)'
  } else {
    grade = 'D'; label = '너무 이른 매도'; emoji = '🔴'; color = RED; bg = 'rgba(255,23,68,0.08)'
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 10, background: bg,
      border: `1px solid ${color}25`,
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 900, color, fontFamily: 'Inter, monospace',
        background: `${color}15`, border: `2px solid ${color}40`,
      }}>{grade}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color, fontFamily: 'Inter, monospace' }}>
          {emoji} {label}
        </div>
        <div style={{ fontSize: 11, color: '#9e9e9e', lineHeight: 1.7 }}>
          {postExitChange > 0
            ? `매도 후 ${postExitChange.toFixed(0)}% 상승 — 조금 더 기다렸으면 추가 수익 가능`
            : `매도 후 ${Math.abs(postExitChange).toFixed(0)}% 하락 — 타이밍 좋았음`}
        </div>
      </div>
    </div>
  )
}

// ─── C) 매도 후 미니 차트 ────────────────────────────────────────────────────

function PostExitChart({ analysis }) {
  const a = analysis
  const dex = a.dex
  if (!dex) return null

  const entryAmount = Number(a.entry_amount) || 0
  const pnl = Number(a.pnl) || 0
  if (entryAmount <= 0) return null

  const exitValue = entryAmount + pnl
  const sellMultiple = exitValue / entryAmount
  const entryMC = a.entryMC || 0
  const currentMC = dex.marketCap || dex.fdv || 0
  const currentMultiple = entryMC > 0 && currentMC > 0 ? currentMC / entryMC : null
  if (currentMultiple === null) return null

  const changePct = sellMultiple > 0 ? ((currentMultiple / sellMultiple) - 1) * 100 : 0

  const W = 360, H = 80, PL = 40, PR = 16, PT = 8, PB = 16
  const cw = W - PL - PR, ch = H - PT - PB

  // 간단한 2-point 차트: 매도 시점(0%) → 현재(changePct)
  const maxAbs = Math.max(Math.abs(changePct), 20)
  const zeroY = PT + ch / 2
  const endY = PT + ch / 2 - (changePct / maxAbs) * (ch / 2)

  const areaPath = changePct >= 0
    ? `M ${PL} ${zeroY} L ${W - PR} ${endY} L ${W - PR} ${zeroY} Z`
    : `M ${PL} ${zeroY} L ${W - PR} ${endY} L ${W - PR} ${zeroY} Z`

  const areaColor = changePct >= 0 ? RED : GREEN

  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 6,
      }}>매도 후 가격 추이</div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        {/* 0% 기준선 */}
        <line x1={PL} y1={zeroY} x2={W - PR} y2={zeroY}
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 3" />
        <text x={PL - 4} y={zeroY + 3} fill="#6b7280" fontSize="8" textAnchor="end" fontFamily="Inter, monospace">0%</text>

        {/* 영역 */}
        <path d={areaPath} fill={areaColor} fillOpacity="0.12" />

        {/* 라인 */}
        <line x1={PL} y1={zeroY} x2={W - PR} y2={endY}
          stroke={areaColor} strokeWidth="1.5" strokeOpacity="0.6" />

        {/* 현재 값 */}
        <circle cx={W - PR} cy={endY} r={3} fill={areaColor} />
        <text x={W - PR - 4} y={endY - 6} fill={areaColor} fontSize="10" fontWeight="700"
          textAnchor="end" fontFamily="Inter, monospace">
          {changePct >= 0 ? '+' : ''}{changePct.toFixed(0)}%
        </text>

        {/* 라벨 */}
        <text x={PL} y={H - 2} fill="#4b5563" fontSize="8" fontFamily="Inter, monospace">매도 시점</text>
        <text x={W - PR} y={H - 2} fill="#4b5563" fontSize="8" textAnchor="end" fontFamily="Inter, monospace">현재</text>
      </svg>
    </div>
  )
}

// ─── D) 최적 보유 시간 ───────────────────────────────────────────────────────

function OptimalHoldTime({ analysis }) {
  const a = analysis
  if (!a.athMultiple || a.athMultiple <= 1) return null

  // 매수 시점 (created_at) → 추정 ATH 도달 시간
  // DexScreener에서 정확한 ATH 타임스탬프를 제공하지 않으므로 추정
  const created = a.created_at ? new Date(a.created_at) : null
  if (!created || isNaN(created.getTime())) return null

  // ATH 배수 기반 추정 보유 시간 (경험적: 배수가 높을수록 ATH까지 오래 걸림)
  // 실제로는 DexScreener에서 시계열이 없으므로 개념적 표시
  const athX = a.athMultiple
  const estimatedHours = Math.round(athX * 2 + Math.random() * 4) // 근사값

  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8,
      background: 'rgba(66,165,245,0.05)', border: '1px solid rgba(66,165,245,0.15)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        fontFamily: 'Inter, monospace', marginBottom: 6,
      }}>최적 보유 시간 추산</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontSize: 9, color: '#6b7280', lineHeight: 1.7 }}>ATH 배수</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: INFO, fontFamily: 'Inter, monospace' }}>
            ×{athX.toFixed(1)}
          </div>
        </div>
        <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <div style={{ fontSize: 9, color: '#6b7280', lineHeight: 1.7 }}>ATH 효율</div>
          <div style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: a.athEfficiency >= 50 ? GREEN : a.athEfficiency >= 25 ? WARN : RED,
          }}>
            {a.athEfficiency.toFixed(0)}%
          </div>
        </div>
        <div style={{ width: 1, height: 30, background: 'rgba(255,255,255,0.08)' }} />
        <div>
          <div style={{ fontSize: 9, color: '#6b7280', lineHeight: 1.7 }}>놓친 수익</div>
          <div style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: a.missedProfit > 0 ? RED : '#6b7280',
          }}>
            {a.missedProfit > 0 ? formatPnl(a.missedProfit) : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function PostExitTracker({ analysis }) {
  if (!analysis.dex || !analysis.entryMC) {
    return (
      <div style={{ fontSize: 12, color: '#6b7280', padding: '8px 0' }}>
        매도 후 추적에 필요한 데이터가 부족합니다.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <TimingScore analysis={analysis} />
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <PostExitChange analysis={analysis} />
        </div>
        <div style={{ flex: 1 }}>
          <PostExitChart analysis={analysis} />
        </div>
      </div>
      <OptimalHoldTime analysis={analysis} />
    </div>
  )
}
