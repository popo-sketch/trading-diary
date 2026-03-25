import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { computeJourneyState, getJourneyBriefing, JOURNEY_GOAL, CHECKPOINTS } from '../utils/journeyEngine'

// ─── Stage Definitions ───────────────────────────────────────────────────────

const STAGES = [
  { cp: 0,      label: '무일푼',          badge: '🚀 시작',         icon: '🚀', reward: '맨몸 출발' },
  { cp: 1000,   label: '첫 수익',         badge: '☕ 첫 월급',       icon: '☕', reward: '티셔츠 + 청바지 해금' },
  { cp: 5000,   label: '자기투자',        badge: '🖥️ 트레이딩 셋업', icon: '🖥️', reward: '후드티 + 에어팟 해금' },
  { cp: 10000,  label: '좀 벌어본 사람',  badge: '⌚ 첫 시계',       icon: '⌚', reward: '셔츠 + 시계 해금' },
  { cp: 25000,  label: '확실히 달라진 삶', badge: '🏍️ 내 바이크',   icon: '🏍️', reward: '가죽자켓 + 선글라스 해금' },
  { cp: 50000,  label: '반타작',          badge: '👔 넥스트 레벨',   icon: '👔', reward: '정장 + 넥타이 해금' },
  { cp: 100000, label: '여섯 자리',       badge: '🚗 드림카',       icon: '🚗', reward: '코트 + 스카프 해금' },
  { cp: 150000, label: '거의 다 왔다',    badge: '🏠 내 집',        icon: '🏠', reward: '수트 + 서류가방 해금' },
  { cp: 200000, label: '자유',            badge: '🏝️ 자유 달성',    icon: '🏝️', reward: '하와이안셔츠 + 자유 해금' },
]

function getCurrentStage(pnl) {
  let stage = 0
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (pnl >= STAGES[i].cp) { stage = i; break }
  }
  return stage
}

const CP_LABELS = { 1000:'1K', 5000:'5K', 10000:'10K', 25000:'25K', 50000:'50K', 100000:'100K', 150000:'150K', 200000:'200K' }

const PHASE_STYLE = {
  BUILD:   { color: '#42a5f5', label: 'BUILD' },
  ATTACK:  { color: '#00c853', label: 'ATTACK' },
  DEFENSE: { color: '#ffc107', label: 'DEFENSE' },
  RESET:   { color: '#ff1744', label: 'RESET' },
}

const GREEN = '#00c853', RED = '#ff1744', WARN = '#ffc107', INFO = '#42a5f5'

const MILESTONE_STORAGE_KEY = 'journey_milestones'
const LAST_STAGE_KEY = 'journey_last_stage'

function fmtPnl(n) {
  const sign = n >= 0 ? '+' : '-'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${sign}$${(abs/1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs/1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}
function fmtK(n) {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `$${(abs/1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${Math.round(abs/1e3)}K`
  return `$${Math.round(abs)}`
}
function fmtDollar(n) {
  return '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

// ─── Pixel Art Characters (SVG) ──────────────────────────────────────────────

function PixelChar({ stage, size = 1 }) {
  const W = 32, H = 48
  const s = size

  const parts = {
    0: { skin:'#f4c28f', hair:'#3a2a1a', top:'#ffffff', bottom:'#7a8899', shoe:'#d4956a', acc:null },
    1: { skin:'#f4c28f', hair:'#3a2a1a', top:'#4a90d9', bottom:'#3b5998', shoe:'#f0f0f0', acc:'#8b5e3c' },
    2: { skin:'#f4c28f', hair:'#3a2a1a', top:'#555555', bottom:'#444444', shoe:'#333333', acc:'#ffffff' },
    3: { skin:'#f4c28f', hair:'#3a2a1a', top:'#e8e8ff', bottom:'#3a3a50', shoe:'#f0f0f0', acc:'#c0c0c0' },
    4: { skin:'#f4c28f', hair:'#3a2a1a', top:'#2a1a0a', bottom:'#222222', shoe:'#ff4444', acc:'#333333' },
    5: { skin:'#f4c28f', hair:'#3a2a1a', top:'#1a1a2e', bottom:'#1a1a2e', shoe:'#333333', acc:'#ffd700' },
    6: { skin:'#f4c28f', hair:'#3a2a1a', top:'#d4aa70', bottom:'#3a3a50', shoe:'#6a4a2a', acc:'#c0c0c0' },
    7: { skin:'#f4c28f', hair:'#3a2a1a', top:'#1a1a3a', bottom:'#1a1a3a', shoe:'#333333', acc:'#ffd700' },
    8: { skin:'#f4c28f', hair:'#3a2a1a', top:'#ff6b6b', bottom:'#4a90d9', shoe:'#d4956a', acc:'#333333' },
  }[stage] || { skin:'#f4c28f', hair:'#3a2a1a', top:'#ffffff', bottom:'#7a8899', shoe:'#d4956a', acc:null }

  const p = parts
  const px = 2

  return (
    <svg width={W * s * 2} height={H * s * 2} viewBox={`0 0 ${W} ${H}`} style={{ imageRendering: 'pixelated' }}>
      <rect x={11*px} y={0} width={5*px} height={px} fill={p.hair} />
      <rect x={10*px} y={px} width={7*px} height={px} fill={p.hair} />
      <rect x={11*px} y={2*px} width={5*px} height={px} fill={p.skin} />
      <rect x={10*px} y={3*px} width={7*px} height={2*px} fill={p.skin} />
      <rect x={11*px} y={3*px} width={px} height={px} fill="#2a1a0a" />
      <rect x={14*px} y={3*px} width={px} height={px} fill="#2a1a0a" />
      {stage >= 1 && <rect x={12*px} y={4*px} width={2*px} height={0.5*px} fill="#cc7755" />}
      <rect x={12*px} y={5*px} width={3*px} height={px} fill={p.skin} />
      <rect x={10*px} y={6*px} width={7*px} height={4*px} fill={p.top} />
      <rect x={8*px} y={6*px} width={2*px} height={4*px} fill={p.top} />
      <rect x={17*px} y={6*px} width={2*px} height={4*px} fill={p.top} />
      <rect x={8*px} y={10*px} width={2*px} height={px} fill={p.skin} />
      <rect x={17*px} y={10*px} width={2*px} height={px} fill={p.skin} />
      <rect x={10*px} y={10*px} width={3*px} height={4*px} fill={p.bottom} />
      <rect x={14*px} y={10*px} width={3*px} height={4*px} fill={p.bottom} />
      <rect x={9*px} y={14*px} width={4*px} height={px} fill={p.shoe} />
      <rect x={14*px} y={14*px} width={4*px} height={px} fill={p.shoe} />
      {stage === 1 && <>
        <rect x={18*px} y={9*px} width={2*px} height={2*px} fill={p.acc} />
        <rect x={18.5*px} y={8.5*px} width={px} height={0.5*px} fill="#aaa" />
      </>}
      {stage === 2 && <>
        <rect x={9*px} y={3*px} width={px} height={px} fill={p.acc} />
        <rect x={16*px} y={3*px} width={px} height={px} fill={p.acc} />
      </>}
      {stage >= 3 && <rect x={7*px} y={9*px} width={px} height={px} fill={p.acc} />}
      {stage === 4 && <rect x={10*px} y={3*px} width={7*px} height={px} fill={p.acc} />}
      {stage === 5 && <rect x={12.5*px} y={6*px} width={2*px} height={4*px} fill={p.acc} />}
      {stage === 6 && <rect x={10*px} y={5.5*px} width={7*px} height={px} fill={p.acc} />}
      {stage === 7 && <>
        <rect x={18*px} y={8*px} width={3*px} height={3*px} fill={p.acc} />
        <rect x={19*px} y={7.5*px} width={px} height={0.5*px} fill={p.acc} />
      </>}
      {stage >= 8 && <>
        <rect x={10*px} y={3*px} width={7*px} height={px} fill="#333" />
        <rect x={10*px} y={5.5*px} width={7*px} height={px} fill="#ff9999" />
      </>}
    </svg>
  )
}

// ─── Stage Backgrounds (CSS + SVG) ──────────────────────────────────────────

const STAGE_BG = [
  { gradient: 'linear-gradient(180deg, #0a0a14 0%, #121218 50%, #0d0d14 100%)', accent: '#555566', ground: '#2a2a2a' },
  { gradient: 'linear-gradient(180deg, #0a0a16 0%, #14141e 50%, #0f0f16 100%)', accent: '#44dd88', ground: '#3a3a3a' },
  { gradient: 'linear-gradient(180deg, #0a0e18 0%, #0f1422 50%, #0a0e18 100%)', accent: '#42a5f5', ground: '#3a2a1a' },
  { gradient: 'linear-gradient(180deg, #1a1410 0%, #201810 50%, #1a1410 100%)', accent: '#e8c080', ground: '#aa9070' },
  { gradient: 'linear-gradient(180deg, #0a0a1a 0%, #14102a 50%, #0a0a1a 100%)', accent: '#b794f6', ground: '#333344' },
  { gradient: 'linear-gradient(180deg, #060818 0%, #0a1028 50%, #060818 100%)', accent: '#ffd700', ground: '#2a3040' },
  { gradient: 'linear-gradient(180deg, #08081a 0%, #0e0e28 50%, #08081a 100%)', accent: '#e0e0ff', ground: '#888899' },
  { gradient: 'linear-gradient(180deg, #1a1008 0%, #2a1810 50%, #1a1008 100%)', accent: '#ff8855', ground: '#aa8866' },
  { gradient: 'linear-gradient(180deg, #081820 0%, #0a2030 50%, #081820 100%)', accent: '#40e0d0', ground: '#e8d8a0' },
]

function StageBackground({ stage }) {
  const bg = STAGE_BG[stage] || STAGE_BG[0]
  const silhouettes = {
    0: (
      <g opacity="0.15">
        <rect x="10" y="20" width="40" height="80" fill="#333" />
        <rect x="15" y="30" width="8" height="8" fill="#555" />
        <rect x="30" y="35" width="8" height="8" fill="#555" />
        <rect x="440" y="15" width="50" height="85" fill="#333" />
        <rect x="455" y="25" width="8" height="8" fill="#555" />
        <line x1="80" y1="10" x2="80" y2="70" stroke="#444" strokeWidth="2" />
        <circle cx="80" cy="10" r="4" fill={bg.accent} opacity="0.6" className="flicker-light" />
      </g>
    ),
    1: (
      <g opacity="0.15">
        <rect x="420" y="25" width="70" height="65" fill="#333" rx="2" />
        <rect x="425" y="30" width="60" height="20" fill={bg.accent} opacity="0.3" rx="1" />
        <text x="440" y="44" fill={bg.accent} fontSize="8" opacity="0.5">24H</text>
        <rect x="10" y="30" width="35" height="60" fill="#2a2a2a" />
      </g>
    ),
    2: (
      <g opacity="0.15">
        <rect x="400" y="35" width="30" height="22" fill={bg.accent} opacity="0.4" rx="1" />
        <rect x="435" y="35" width="30" height="22" fill={bg.accent} opacity="0.3" rx="1" />
        <rect x="415" y="57" width="35" height="3" fill="#333" />
        <rect x="20" y="50" width="40" height="30" fill="#1a1a2a" rx="2" />
      </g>
    ),
    3: (
      <g opacity="0.12">
        <rect x="0" y="20" width="500" height="2" fill={bg.accent} opacity="0.3" />
        <rect x="350" y="22" width="120" height="60" fill="rgba(255,255,255,0.03)" rx="3" />
        <rect x="360" y="27" width="100" height="40" fill="rgba(255,255,255,0.02)" />
        <circle cx="30" cy="50" r="15" fill={bg.accent} opacity="0.1" />
      </g>
    ),
    4: (
      <g opacity="0.15">
        <rect x="20" y="10" width="30" height="80" fill="#222233" />
        <rect x="60" y="20" width="25" height="70" fill="#1a1a2a" />
        <rect x="400" y="5" width="35" height="85" fill="#222233" />
        <rect x="440" y="15" width="25" height="75" fill="#1a1a2a" />
        <line x1="25" y1="15" x2="25" y2="85" stroke={bg.accent} strokeWidth="1" opacity="0.3" />
        <line x1="445" y1="20" x2="445" y2="80" stroke="#ff44aa" strokeWidth="1" opacity="0.2" />
      </g>
    ),
    5: (
      <g opacity="0.12">
        <rect x="0" y="65" width="500" height="25" fill="#0a1530" />
        <line x1="0" y1="60" x2="500" y2="60" stroke={bg.accent} strokeWidth="0.5" opacity="0.3" />
        <line x1="100" y1="50" x2="400" y2="50" stroke="#334" strokeWidth="3" />
        <line x1="150" y1="50" x2="150" y2="60" stroke="#334" strokeWidth="1" />
        <line x1="250" y1="50" x2="250" y2="60" stroke="#334" strokeWidth="1" />
        <line x1="350" y1="50" x2="350" y2="60" stroke="#334" strokeWidth="1" />
        <circle cx="200" cy="72" r="2" fill={bg.accent} opacity="0.2" className="water-glow" />
        <circle cx="300" cy="75" r="2" fill={bg.accent} opacity="0.15" className="water-glow" />
      </g>
    ),
    6: (
      <g opacity="0.12">
        <rect x="0" y="70" width="500" height="20" fill={bg.ground} opacity="0.3" />
        {Array.from({length: 30}).map((_, i) => (
          <circle key={i} cx={15 + i * 16} cy={75 + (i * 7) % 10} r={0.8}
            fill={['#ffd700','#fff','#42a5f5','#ff6b6b'][i%4]} opacity={0.2 + (i%3)*0.1} />
        ))}
        <rect x="180" y="60" width="3" height="15" fill="#333" opacity="0.3" />
        <rect x="320" y="55" width="3" height="20" fill="#333" opacity="0.3" />
      </g>
    ),
    7: (
      <g opacity="0.15">
        <rect x="0" y="70" width="500" height="20" fill="#1a3050" opacity="0.3" />
        <line x1="0" y1="70" x2="500" y2="70" stroke={bg.accent} strokeWidth="0.5" opacity="0.3" />
        <line x1="450" y1="20" x2="450" y2="60" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="440" cy="18" rx="15" ry="6" fill="#2a5020" opacity="0.5" className="palm-sway" />
        <ellipse cx="458" cy="15" rx="12" ry="5" fill="#2a5020" opacity="0.4" className="palm-sway" />
      </g>
    ),
    8: (
      <g opacity="0.15">
        <rect x="0" y="65" width="500" height="25" fill={bg.accent} opacity="0.15" />
        <line x1="0" y1="65" x2="500" y2="65" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        <line x1="30" y1="15" x2="30" y2="55" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="20" cy="12" rx="15" ry="6" fill="#2a5020" opacity="0.5" className="palm-sway" />
        <line x1="460" y1="20" x2="460" y2="55" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="470" cy="17" rx="15" ry="6" fill="#2a5020" opacity="0.5" className="palm-sway" />
        <path d="M 25 40 Q 50 50 75 40" fill="none" stroke="#aa6633" strokeWidth="1" opacity="0.5" />
      </g>
    ),
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: bg.gradient }} />
      <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}>
        {silhouettes[stage]}
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.7)' }} />
    </div>
  )
}

// ─── SVG Icons ───────────────────────────────────────────────────────────────

function ChartIcon({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function FlagIcon({ color, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

// ─── Mini Donut Chart ────────────────────────────────────────────────────────

function DonutChart({ percent, size = 36, strokeWidth = 4 }) {
  const r = (size - strokeWidth) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (Math.min(percent, 100) / 100) * circ

  let gradId = 'donut-grad'
  let colors
  if (percent < 25) colors = ['#cd7f32', '#e8a862']
  else if (percent < 50) colors = ['#cd7f32', '#c0c0c0']
  else if (percent < 75) colors = ['#c0c0c0', '#ffd700']
  else colors = ['#ffd700', '#7c4dff']

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={`url(#${gradId})`} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  )
}

// ─── 6. Stat Cards (redesigned) ─────────────────────────────────────────────

function StatCards({ journey, ps }) {
  const pnlColor = journey.cumulativePnl >= 0 ? GREEN : RED
  const remaining = journey.nextCpRemaining

  const CARD = {
    background: '#1a1a2e',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.06)',
    padding: 20,
    flex: 1,
    minWidth: 150,
    position: 'relative',
    overflow: 'hidden',
  }

  return (
    <div style={{ display: 'flex', gap: 12, padding: '0 16px', flexWrap: 'wrap' }}>
      {/* 누적 PNL */}
      <div style={{
        ...CARD,
        backgroundImage: `linear-gradient(to top right, ${pnlColor}0d, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${pnlColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ChartIcon color={pnlColor} size={18} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>
              누적 PNL
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: pnlColor, fontFamily: 'Inter, monospace' }}>
              {fmtPnl(journey.cumulativePnl)}
            </div>
          </div>
        </div>
      </div>

      {/* 다음 체크포인트 */}
      <div style={{
        ...CARD,
        backgroundImage: `linear-gradient(to top right, ${INFO}0d, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${INFO}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FlagIcon color={INFO} size={18} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>
              다음 체크포인트
            </div>
            {journey.nextCheckpoint ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>
                  {fmtK(journey.nextCheckpoint)}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                  (남은 금액: {fmtDollar(remaining)})
                </div>
              </>
            ) : (
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fbbf24', fontFamily: 'Inter, monospace' }}>
                완주!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 진행률 + 도넛 */}
      <div style={{
        ...CARD,
        backgroundImage: `linear-gradient(to top right, ${ps.color}0d, transparent)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DonutChart percent={journey.progressPercent} size={44} strokeWidth={5} />
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>
              진행률
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ps.color, fontFamily: 'Inter, monospace' }}>
              {journey.progressPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── 7. Badges (redesigned) ─────────────────────────────────────────────────

function BadgeRow({ journey, personalBests, curve }) {
  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length

  // $200K 도달 예상 변화 계산
  let estimateDelta = null
  if (curve && curve.length >= 30 && journey.cumulativePnl > 0) {
    // 지난달 vs 이번달 페이스 비교
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear()-1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`

    const lastMonthData = curve.filter(p => p.date?.startsWith(lastMonth))
    const thisMonthData = curve.filter(p => p.date?.startsWith(thisMonth))

    if (lastMonthData.length >= 2 && thisMonthData.length >= 2) {
      const lastPace = (lastMonthData[lastMonthData.length-1].cumulative_pnl - lastMonthData[0].cumulative_pnl) /
        Math.max(1, (new Date(lastMonthData[lastMonthData.length-1].date) - new Date(lastMonthData[0].date)) / 86400000)
      const thisPace = (thisMonthData[thisMonthData.length-1].cumulative_pnl - thisMonthData[0].cumulative_pnl) /
        Math.max(1, (new Date(thisMonthData[thisMonthData.length-1].date) - new Date(thisMonthData[0].date)) / 86400000)

      if (lastPace > 0 && thisPace > 0) {
        const remaining = JOURNEY_GOAL - journey.cumulativePnl
        const lastMonths = remaining / (lastPace * 30)
        const thisMonths = remaining / (thisPace * 30)
        const diff = Math.round(lastMonths - thisMonths) // positive = faster
        if (Math.abs(diff) >= 1) estimateDelta = diff
      }
    }
  }

  const badges = []

  // 연승/연패
  if (journey.streak >= 2) {
    badges.push({
      icon: journey.streakType === 'win' ? '🔥' : '❄️',
      label: `${journey.streak}${journey.streakType === 'win' ? '연승' : '연패'}`,
      color: journey.streakType === 'win' ? GREEN : RED,
    })
  }

  // $200K 도달 예상
  if (personalBests?.estimatedDate) {
    const estimateBadge = {
      icon: '🎯',
      label: `$200K ${personalBests.estimatedDate}`,
      color: '#60a5fa',
      borderColor: null,
      sub: null,
    }
    if (estimateDelta !== null) {
      if (estimateDelta > 0) {
        estimateBadge.borderColor = GREEN
        estimateBadge.sub = `↑ ${estimateDelta}개월 단축!`
        estimateBadge.subColor = GREEN
      } else {
        estimateBadge.borderColor = RED
        estimateBadge.sub = `↓ ${Math.abs(estimateDelta)}개월 지연`
        estimateBadge.subColor = RED
      }
    }
    badges.push(estimateBadge)
  }

  // BEST DAY
  if (personalBests?.bestDayPnl > 0) {
    badges.push({
      icon: '💎',
      label: `BEST DAY ${fmtPnl(personalBests.bestDayPnl)}`,
      color: '#a78bfa',
    })
  }

  // BEST STREAK
  if (personalBests?.longestWinStreak >= 2) {
    badges.push({
      icon: '⚡',
      label: `BEST STREAK ${personalBests.longestWinStreak}연승`,
      color: WARN,
    })
  }

  // CLEARED
  badges.push({
    icon: '🏆',
    label: `CLEARED ${reachedCount}/${CHECKPOINTS.length}`,
    color: '#fbbf24',
  })

  if (badges.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 16, padding: '0 16px', flexWrap: 'wrap' }}>
      {badges.map((b, i) => (
        <div key={i} className="badge-hover" style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          background: `${b.color}08`, border: `1px solid ${b.borderColor || b.color}25`,
          borderRadius: 10, padding: '12px 16px',
          cursor: 'default', transition: 'transform 0.2s, box-shadow 0.2s',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{b.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: b.color, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
              {b.label}
            </span>
          </div>
          {b.sub && (
            <div style={{ fontSize: 10, fontWeight: 700, color: b.subColor, fontFamily: 'Inter, monospace', paddingLeft: 22, lineHeight: 1.7 }}>
              {b.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── 8. Character Profile Card ───────────────────────────────────────────────

function getProfileTint(stage) {
  if (stage <= 1) return 'rgba(107,114,128,0.06)' // gray
  if (stage <= 3) return 'rgba(66,165,245,0.06)'   // blue
  if (stage <= 5) return 'rgba(66,165,245,0.08)'   // brighter blue
  if (stage <= 6) return 'rgba(255,215,0,0.06)'     // gold
  return 'rgba(255,215,0,0.08)'                      // bright gold
}

function CharacterProfileCard({ stage, journey }) {
  const current = STAGES[stage]
  const next = STAGES[stage + 1]

  // Progress within current stage
  const stageStart = current.cp
  const stageEnd = next ? next.cp : JOURNEY_GOAL
  const stageProgress = Math.min(100, Math.max(0,
    ((journey.cumulativePnl - stageStart) / (stageEnd - stageStart)) * 100
  ))
  const stageRemaining = Math.max(0, stageEnd - journey.cumulativePnl)

  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 20, position: 'relative', overflow: 'hidden',
      backgroundImage: `linear-gradient(to top right, ${getProfileTint(stage)}, transparent)`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* 큰 캐릭터 */}
        <div style={{ flexShrink: 0 }}>
          <PixelChar stage={stage} size={2} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* 현재 칭호 */}
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>
            현재 단계
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace', marginBottom: 4 }}>
            {current.icon} {current.label}
          </div>

          {/* 다음 칭호 */}
          {next ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: '#4b5563', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                다음: {next.label}
              </span>
              <span style={{ fontSize: 10, color: '#374151' }}>🔒</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#fbbf24', fontFamily: 'Inter, monospace', marginBottom: 12, lineHeight: 1.7 }}>
              최종 단계 달성!
            </div>
          )}

          {/* 다음 변신까지 미니 프로그레스 */}
          {next && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#9e9e9e', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                  다음 변신까지
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: INFO, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                  {fmtDollar(stageRemaining)} 남음
                </span>
              </div>
              <div style={{
                width: '100%', height: 6, borderRadius: 3,
                background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${stageProgress}%`, height: '100%', borderRadius: 3,
                  background: stage <= 1 ? '#cd7f32' : stage <= 4 ? INFO : '#ffd700',
                  transition: 'width 0.5s',
                }} />
              </div>
              <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace', marginTop: 3, textAlign: 'right', lineHeight: 1.7 }}>
                {stageProgress.toFixed(1)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Progress Bar (upgraded) ─────────────────────────────────────────────────

function getProgressGradient(pct) {
  if (pct < 25) return 'linear-gradient(90deg, #cd7f32, #e8a862)'
  if (pct < 50) return 'linear-gradient(90deg, #cd7f32, #c0c0c0, #e0e0e0)'
  if (pct < 75) return 'linear-gradient(90deg, #cd7f32, #c0c0c0, #ffd700, #ffec80)'
  return 'linear-gradient(90deg, #cd7f32, #c0c0c0, #ffd700, #b9f2ff, #42a5f5, #7c4dff)'
}

function MilestoneMarker({ cp, reached, isNext, pct, cumulativePnl, curve, personalBests }) {
  const [hovered, setHovered] = useState(false)
  const stageIdx = STAGES.findIndex(s => s.cp === cp)
  const stageInfo = STAGES[stageIdx] || {}

  let achievedDate = null
  if (reached && curve) {
    for (const p of curve) {
      if (p.cumulative_pnl >= cp) { achievedDate = p.date; break }
    }
  }

  const remaining = cp - cumulativePnl
  let estimateStr = null
  if (!reached && personalBests?.estimatedDate && cumulativePnl > 0) {
    const curveArr = curve || []
    if (curveArr.length >= 2) {
      const first = new Date(curveArr[0].date).getTime()
      const last = new Date(curveArr[curveArr.length-1].date).getTime()
      const days = Math.max(1, (last - first) / 86400000)
      const perDay = cumulativePnl / days
      if (perDay > 0) {
        const daysTo = remaining / perDay
        const target = new Date(last + daysTo * 86400000)
        estimateStr = `${target.getFullYear()}년 ${target.getMonth()+1}월`
      }
    }
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute', left: `${pct}%`, top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        zIndex: reached ? 3 : isNext ? 2 : 1, cursor: 'pointer',
      }}
    >
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)', marginBottom: 8,
          background: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap',
          zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          fontSize: 11, fontFamily: 'Inter, monospace',
        }}>
          <div style={{ fontWeight: 700, color: reached ? '#fbbf24' : '#9ca3af', marginBottom: 2, lineHeight: 1.7 }}>
            {stageInfo.icon} {stageInfo.badge || `$${CP_LABELS[cp]}`} — {reached ? '달성!' : '미달성'}
          </div>
          {reached && achievedDate && <div style={{ color: '#6b7280', fontSize: 10, lineHeight: 1.7 }}>달성일: {achievedDate}</div>}
          {!reached && <div style={{ color: '#6b7280', fontSize: 10, lineHeight: 1.7 }}>남은 금액: {fmtK(remaining)}</div>}
          {!reached && estimateStr && <div style={{ color: '#4b5563', fontSize: 9, lineHeight: 1.7 }}>현재 페이스 기준: {estimateStr}</div>}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(255,255,255,0.12)',
          }} />
        </div>
      )}

      <div
        className={reached ? 'ms-reached' : isNext ? 'ms-next' : ''}
        style={{
          width: reached ? 40 : 32, height: reached ? 40 : 32,
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: reached ? 18 : 14,
          background: reached
            ? 'radial-gradient(circle, #2a1f00, #151000)'
            : isNext ? 'radial-gradient(circle, rgba(66,165,245,0.1), #121220)' : '#15151f',
          border: reached ? '2px solid #fbbf24'
            : isNext ? '2px dashed rgba(66,165,245,0.5)' : '1px solid #2a2a3a',
          boxShadow: reached ? '0 0 12px rgba(255,215,0,0.4)' : 'none',
          filter: reached ? 'none' : isNext ? 'none' : 'grayscale(1) opacity(0.4)',
          position: 'relative', transition: 'all 0.3s',
        }}
      >
        {stageInfo.icon || '?'}
        {reached && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 13, height: 13, borderRadius: '50%', background: GREEN,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, fontWeight: 900, color: '#fff', border: '2px solid #121220',
          }}>✓</div>
        )}
        {!reached && !isNext && (
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 11, height: 11, borderRadius: '50%', background: '#374151',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 6, color: '#6b7280',
          }}>🔒</div>
        )}
      </div>

      <div style={{
        marginTop: 3, fontSize: 8, fontWeight: 700, fontFamily: 'Inter, monospace',
        color: reached ? '#fbbf24' : isNext ? '#42a5f5' : '#3a3a4a',
        textAlign: 'center', whiteSpace: 'nowrap',
      }}>${CP_LABELS[cp]}</div>
    </div>
  )
}

function ProgressBarNew({ journey, ps, curve, personalBests, stage }) {
  const pct = Math.min(100, Math.max(0, journey.progressPercent))
  const grad = getProgressGradient(pct)
  const showInside = pct > 12

  return (
    <div style={{ position: 'relative', height: 130, margin: '0 24px' }}>
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 48,
        transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)',
        borderRadius: 24, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, width: `${pct}%`,
          background: grad, borderRadius: 24,
          boxShadow: '0 0 12px rgba(255,215,0,0.3)',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)', borderRadius: 24 }} />
          <div className="progress-shimmer" style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden' }} />
        </div>

        {showInside ? (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, fontFamily: 'Inter, monospace', color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.6)', zIndex: 5, letterSpacing: '0.05em',
          }}>{pct.toFixed(2)}%</div>
        ) : (
          <div style={{
            position: 'absolute', top: '50%', left: `${pct + 1}%`, transform: 'translateY(-50%)',
            fontSize: 12, fontWeight: 800, fontFamily: 'Inter, monospace', color: '#9e9e9e',
            zIndex: 5, whiteSpace: 'nowrap',
          }}>{pct.toFixed(2)}%</div>
        )}
      </div>

      {CHECKPOINTS.map(cp => (
        <MilestoneMarker
          key={cp} cp={cp}
          reached={journey.cumulativePnl >= cp}
          isNext={journey.nextCheckpoint === cp}
          pct={(cp / JOURNEY_GOAL) * 100}
          cumulativePnl={journey.cumulativePnl}
          curve={curve}
          personalBests={personalBests}
        />
      ))}

      {/* 캐릭터 */}
      <div style={{
        position: 'absolute', left: `${pct}%`, top: '50%',
        transform: 'translate(-50%, -100%) translateY(-28px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10,
      }}>
        <div style={{
          background: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8, padding: '4px 10px', marginBottom: 4,
          whiteSpace: 'nowrap', position: 'relative',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: GREEN, fontFamily: 'Inter, monospace', textAlign: 'center' }}>
            {fmtPnl(journey.cumulativePnl)}
          </div>
          {journey.nextCpRemaining > 0 && (
            <div style={{ fontSize: 9, color: '#9e9e9e', fontFamily: 'Inter, monospace', textAlign: 'center', lineHeight: 1.7 }}>
              다음까지 {fmtK(journey.nextCpRemaining)}
            </div>
          )}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
            borderTop: '4px solid rgba(255,255,255,0.15)',
          }} />
        </div>

        <div className="char-bounce" style={{ transform: 'scaleX(-1)' }}>
          <PixelChar stage={stage} />
        </div>
        <div className="char-shadow" style={{
          width: 32, height: 6, borderRadius: '50%',
          background: 'rgba(0,0,0,0.3)', marginTop: -2,
        }} />
      </div>
    </div>
  )
}

// ─── Personal Bests ──────────────────────────────────────────────────────────

function computePersonalBests(allTimeAnalytics) {
  const curve = allTimeAnalytics?.equity_curve ?? []
  if (curve.length === 0) return null
  let bestDayPnl = 0, bestDayDate = null, longestWinStreak = 0, currentWinStreak = 0
  for (let i = 0; i < curve.length; i++) {
    const prev = i > 0 ? curve[i-1].cumulative_pnl : 0
    const delta = curve[i].cumulative_pnl - prev
    if (delta > bestDayPnl) { bestDayPnl = delta; bestDayDate = curve[i].date }
    if (delta > 0) { currentWinStreak++; if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak }
    else if (delta < 0) currentWinStreak = 0
  }
  let estimatedDate = null
  const cumulativePnl = curve[curve.length-1]?.cumulative_pnl ?? 0
  if (curve[0]?.date && curve[curve.length-1]?.date && cumulativePnl > 0) {
    const days = Math.max(1, (new Date(curve[curve.length-1].date) - new Date(curve[0].date)) / 86400000)
    const perDay = cumulativePnl / days
    if (perDay > 0) {
      const remaining = JOURNEY_GOAL - cumulativePnl
      const target = new Date(new Date(curve[curve.length-1].date).getTime() + (remaining/perDay)*86400000)
      estimatedDate = `${target.getFullYear()}년 ${target.getMonth()+1}월`
    }
  }
  return { bestDayPnl, bestDayDate, longestWinStreak, estimatedDate }
}

// ─── 9. Milestone Celebration Modal ──────────────────────────────────────────

function CelebrationModal({ stage, onClose }) {
  const current = STAGES[stage]
  const prev = STAGES[Math.max(0, stage - 1)]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div className="celebration-bounce-in" onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e', borderRadius: 16,
        border: `2px solid ${GREEN}40`, padding: 32,
        maxWidth: 400, width: '90%', textAlign: 'center',
        boxShadow: `0 0 60px ${GREEN}20`,
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Confetti inside modal */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="confetti-piece" style={{
              '--delay': `${(i * 0.1)}s`, '--x': `${(i * 13) % 100}%`,
              '--rotation': `${(i * 47) % 720}deg`,
              '--color': ['#fbbf24','#00c853','#42a5f5','#ff1744','#a78bfa','#f472b6'][i%6],
            }} />
          ))}
        </div>

        {/* Before/After */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <div className="celebration-fade-out" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PixelChar stage={Math.max(0, stage - 1)} size={1.5} />
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{prev.label}</div>
          </div>
          <div style={{ fontSize: 24, color: '#fbbf24' }}>→</div>
          <div className="celebration-glow-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PixelChar stage={stage} size={1.5} />
            <div style={{ fontSize: 10, color: '#e0e0e0', marginTop: 4, fontFamily: 'Inter, monospace', fontWeight: 700, lineHeight: 1.7 }}>{current.label}</div>
          </div>
        </div>

        <div style={{ fontSize: 24, marginBottom: 8, position: 'relative', zIndex: 1 }}>🎉</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace', marginBottom: 8, position: 'relative', zIndex: 1 }}>
          {fmtK(current.cp)} 달성!
        </div>
        <div style={{ fontSize: 13, color: '#9e9e9e', marginBottom: 4, position: 'relative', zIndex: 1, lineHeight: 1.7 }}>
          {current.badge}
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, position: 'relative', zIndex: 1, lineHeight: 1.7 }}>
          {current.reward}
        </div>

        <button onClick={onClose} style={{
          padding: '8px 24px', borderRadius: 8, border: 'none',
          background: `${GREEN}20`, color: GREEN, fontSize: 13,
          fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, monospace',
          position: 'relative', zIndex: 1,
        }}>확인</button>
      </div>
    </div>
  )
}

// ─── 10. Evolution Timeline (Accordion) ──────────────────────────────────────

function EvolutionTimeline({ journey, curve }) {
  const [open, setOpen] = useState(false)
  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length

  // 각 달성 단계의 날짜 계산
  const milestones = useMemo(() => {
    const startDate = curve?.[0]?.date || null
    return STAGES.slice(1).map((st, i) => {
      let achievedDate = null
      let daysSinceStart = null
      if (curve && journey.cumulativePnl >= st.cp) {
        for (const p of curve) {
          if (p.cumulative_pnl >= st.cp) {
            achievedDate = p.date
            if (startDate) {
              daysSinceStart = Math.round((new Date(p.date) - new Date(startDate)) / 86400000)
            }
            break
          }
        }
      }
      return { ...st, reached: journey.cumulativePnl >= st.cp, achievedDate, daysSinceStart, idx: i + 1 }
    })
  }, [journey, curve])

  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {/* 헤더 (클릭으로 토글) */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: '14px 20px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>
            변신 기록
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#fbbf24', fontFamily: 'Inter, monospace',
            background: 'rgba(251,191,36,0.1)', borderRadius: 6, padding: '2px 8px',
          }}>
            {reachedCount}/{CHECKPOINTS.length}
          </span>
        </div>
        <span style={{
          fontSize: 12, color: '#6b7280', transition: 'transform 0.3s',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          display: 'inline-block',
        }}>▼</span>
      </div>

      {/* 타임라인 본문 */}
      {open && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            {/* 세로 연결선 */}
            <div style={{
              position: 'absolute', left: 8, top: 4, bottom: 4,
              width: 2, background: 'rgba(255,255,255,0.06)',
            }} />

            {milestones.map((ms, i) => (
              <div key={ms.cp} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                marginBottom: i < milestones.length - 1 ? 16 : 0,
                position: 'relative',
              }}>
                {/* 점 */}
                <div style={{
                  position: 'absolute', left: -24, top: 3,
                  width: 12, height: 12, borderRadius: '50%',
                  background: ms.reached ? GREEN : '#1a1a2e',
                  border: ms.reached ? `2px solid ${GREEN}` : '2px solid #374151',
                  zIndex: 1,
                }} />

                <div style={{ flex: 1 }}>
                  {ms.reached ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                          {ms.icon} {ms.badge}
                        </span>
                        {ms.achievedDate && (
                          <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                            {ms.achievedDate}
                          </span>
                        )}
                        {ms.daysSinceStart !== null && (
                          <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                            (시작 후 {ms.daysSinceStart}일)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.7 }}>
                        {ms.reward}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12, color: '#374151', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
                          ??? — {fmtK(ms.cp)} 도달 시 해금
                        </span>
                        <span style={{ fontSize: 10, color: '#374151' }}>🔒</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 미니 캐릭터 아이콘 */}
                <div style={{
                  flexShrink: 0, opacity: ms.reached ? 1 : 0.2,
                  filter: ms.reached ? 'none' : 'grayscale(1)',
                }}>
                  <PixelChar stage={ms.idx} size={0.4} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 11. Reset Confirmation Modal ────────────────────────────────────────────

function ResetModal({ stage, onConfirm, onCancel }) {
  const current = STAGES[stage]
  const initial = STAGES[0]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e', borderRadius: 16,
        border: `1px solid ${RED}30`, padding: 28,
        maxWidth: 380, width: '90%', textAlign: 'center',
        boxShadow: `0 0 40px ${RED}15`,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', marginBottom: 12, fontFamily: 'Inter, monospace' }}>
          정말 리셋하시겠습니까?
        </div>
        <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 16, lineHeight: 1.7 }}>
          모든 마일스톤 달성 기록과 캐릭터 진화가 초기화됩니다.
        </div>

        {/* 비포/애프터 미리보기 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: '12px 0', marginBottom: 16,
          background: 'rgba(255,255,255,0.02)', borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PixelChar stage={stage} size={0.8} />
            <div style={{ fontSize: 10, color: '#e0e0e0', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
              {current.icon} {current.label}
            </div>
          </div>
          <div style={{ fontSize: 16, color: RED }}>→</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <PixelChar stage={0} size={0.8} />
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>
              {initial.icon} {initial.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: '#9e9e9e', fontSize: 13,
            fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, monospace',
          }}>취소</button>
          <button onClick={onConfirm} style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: RED, color: '#fff', fontSize: 13,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, monospace',
          }}>리셋</button>
        </div>
      </div>
    </div>
  )
}

// ─── Confetti Effect ─────────────────────────────────────────────────────────

function ConfettiEffect({ active }) {
  if (!active) return null
  return (
    <div className="confetti-container" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className="confetti-piece" style={{
          '--delay': `${(i * 0.12)}s`, '--x': `${(i * 17) % 100}%`,
          '--rotation': `${(i * 53) % 720}deg`,
          '--color': ['#fbbf24','#00c853','#42a5f5','#ff1744','#a78bfa','#f472b6'][i%6],
        }} />
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function JourneyRoad({ allTimeAnalytics }) {
  const journey = useMemo(() => computeJourneyState(allTimeAnalytics), [allTimeAnalytics])
  const { phase } = useMemo(() => getJourneyBriefing(journey, allTimeAnalytics), [journey, allTimeAnalytics])
  const ps = PHASE_STYLE[phase] ?? PHASE_STYLE.BUILD
  const personalBests = useMemo(() => computePersonalBests(allTimeAnalytics), [allTimeAnalytics])
  const curve = allTimeAnalytics?.equity_curve ?? []
  const stage = getCurrentStage(journey.cumulativePnl)

  const [showConfetti, setShowConfetti] = useState(false)
  const [celebrationStage, setCelebrationStage] = useState(null)
  const [showResetModal, setShowResetModal] = useState(false)

  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length

  // 마일스톤 달성 감지
  useEffect(() => {
    const lastStage = Number(localStorage.getItem(LAST_STAGE_KEY) || '0')
    if (stage > lastStage && stage > 0) {
      // 새 단계 달성!
      setCelebrationStage(stage)
      setShowConfetti(true)

      // 달성 기록 저장
      const milestones = JSON.parse(localStorage.getItem(MILESTONE_STORAGE_KEY) || '{}')
      if (!milestones[stage]) {
        milestones[stage] = new Date().toISOString().slice(0, 10)
        localStorage.setItem(MILESTONE_STORAGE_KEY, JSON.stringify(milestones))
      }
      localStorage.setItem(LAST_STAGE_KEY, String(stage))

      const t = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(t)
    } else if (stage !== lastStage) {
      localStorage.setItem(LAST_STAGE_KEY, String(stage))
    }
  }, [stage])

  const handleReset = useCallback(() => {
    localStorage.removeItem(MILESTONE_STORAGE_KEY)
    localStorage.removeItem(LAST_STAGE_KEY)
    setShowResetModal(false)
  }, [])

  const stageInfo = STAGES[stage]

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      border: `1px solid ${ps.color}30`,
      boxShadow: `0 0 40px ${ps.color}08`,
    }}>
      <StageBackground stage={stage} />
      <ConfettiEffect active={showConfetti} />

      {/* 축하 모달 */}
      {celebrationStage !== null && (
        <CelebrationModal stage={celebrationStage} onClose={() => setCelebrationStage(null)} />
      )}

      {/* 리셋 모달 */}
      {showResetModal && (
        <ResetModal stage={stage} onConfirm={handleReset} onCancel={() => setShowResetModal(false)} />
      )}

      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#5a5a6a', letterSpacing: '0.14em', fontFamily: 'Inter, monospace' }}>
            JOURNEY TO $200K
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: ps.color, background: `${ps.color}12`,
            border: `1px solid ${ps.color}30`, borderRadius: 6,
            padding: '3px 10px', letterSpacing: '0.1em',
          }}>{ps.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, fontFamily: 'Inter, monospace',
            color: '#fbbf24', background: 'rgba(251,191,36,0.08)',
            border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 6, padding: '3px 10px',
          }}>
            {stageInfo?.badge || '🚀 시작'}
          </div>
          <button
            onClick={() => setShowResetModal(true)}
            style={{
              fontSize: 9, fontWeight: 600, fontFamily: 'Inter, monospace',
              color: '#4b5563', background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => e.target.style.color = RED}
            onMouseLeave={e => e.target.style.color = '#4b5563'}
          >RESET</button>
        </div>
      </div>

      {/* 캐릭터 프로필 카드 */}
      <div style={{ padding: '12px 16px 0', position: 'relative', zIndex: 1 }}>
        <CharacterProfileCard stage={stage} journey={journey} />
      </div>

      {/* 프로그레스 바 + 마일스톤 + 캐릭터 */}
      <div style={{ padding: '24px 8px 16px', position: 'relative', zIndex: 1 }}>
        <ProgressBarNew journey={journey} ps={ps} curve={curve} personalBests={personalBests} stage={stage} />
      </div>

      {/* 스탯 카드 */}
      <div style={{ position: 'relative', zIndex: 1, paddingBottom: 12 }}>
        <StatCards journey={journey} ps={ps} />
      </div>

      {/* 뱃지 */}
      <div style={{ position: 'relative', zIndex: 1, paddingBottom: 12 }}>
        <BadgeRow journey={journey} personalBests={personalBests} curve={curve} />
      </div>

      {/* 변신 기록 타임라인 */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px 16px' }}>
        <EvolutionTimeline journey={journey} curve={curve} />
      </div>

      <style>{`
        .char-bounce {
          animation: charBounce 0.6s ease-in-out infinite;
        }
        .char-shadow {
          animation: shadowPulse 0.6s ease-in-out infinite;
        }
        @keyframes charBounce {
          0%,100% { transform: scaleX(-1) translateY(0); }
          50% { transform: scaleX(-1) translateY(-3px); }
        }
        @keyframes shadowPulse {
          0%,100% { transform: scaleX(1); opacity: 0.3; }
          50% { transform: scaleX(0.8); opacity: 0.15; }
        }

        .ms-reached { animation: msGlow 2s ease-in-out infinite; }
        .ms-next { animation: msNextSpin 4s linear infinite; }
        @keyframes msGlow {
          0%,100% { box-shadow: 0 0 12px rgba(255,215,0,0.4); }
          50% { box-shadow: 0 0 20px rgba(255,215,0,0.6); }
        }
        @keyframes msNextSpin {
          0% { border-color: rgba(66,165,245,0.5); }
          50% { border-color: rgba(66,165,245,0.2); }
          100% { border-color: rgba(66,165,245,0.5); }
        }

        .progress-shimmer::after {
          content: '';
          position: absolute; top: 0; left: -100%; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          animation: shimmer 2s infinite;
        }
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        .flicker-light { animation: flicker 3s ease-in-out infinite; }
        @keyframes flicker {
          0%,100% { opacity: 0.6; }
          50% { opacity: 0.2; }
          75% { opacity: 0.7; }
        }

        .water-glow { animation: waterGlow 4s ease-in-out infinite; }
        @keyframes waterGlow {
          0%,100% { opacity: 0.15; }
          50% { opacity: 0.3; }
        }

        .palm-sway { animation: palmSway 5s ease-in-out infinite; }
        @keyframes palmSway {
          0%,100% { transform: rotate(0deg); }
          50% { transform: rotate(3deg); }
        }

        .confetti-container .confetti-piece {
          position: absolute; top: -10px; left: var(--x);
          width: 6px; height: 6px; background: var(--color); border-radius: 1px;
          animation: confettiFall 3s var(--delay) ease-out forwards; opacity: 0;
        }
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0) scale(1); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(400px) rotate(var(--rotation)) scale(0.5); }
        }

        .badge-hover:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        }

        .celebration-bounce-in {
          animation: celebBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes celebBounce {
          0% { transform: scale(0.3); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .celebration-fade-out {
          animation: celebFade 1.5s ease-out forwards;
        }
        @keyframes celebFade {
          0% { opacity: 1; filter: brightness(1); }
          60% { opacity: 1; filter: brightness(2); }
          100% { opacity: 0.3; filter: brightness(0.5); }
        }

        .celebration-glow-in {
          animation: celebGlow 1.5s ease-out forwards;
        }
        @keyframes celebGlow {
          0% { opacity: 0; filter: brightness(3); transform: scale(0.5); }
          50% { opacity: 0.8; filter: brightness(2); transform: scale(1.1); }
          100% { opacity: 1; filter: brightness(1); transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
