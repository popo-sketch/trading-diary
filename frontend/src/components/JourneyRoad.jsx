import { useMemo, useState, useEffect } from 'react'
import { computeJourneyState, getJourneyBriefing, JOURNEY_GOAL, CHECKPOINTS } from '../utils/journeyEngine'

// ─── Stage Definitions ───────────────────────────────────────────────────────

const STAGES = [
  { cp: 0,      label: '무일푼',      badge: '🚀 시작',        icon: '🚀' },
  { cp: 1000,   label: '첫 수익',     badge: '☕ 첫 월급',      icon: '☕' },
  { cp: 5000,   label: '자기투자',    badge: '🖥️ 트레이딩 셋업', icon: '🖥️' },
  { cp: 10000,  label: '좀 벌어본 사람', badge: '⌚ 첫 시계',    icon: '⌚' },
  { cp: 25000,  label: '확실히 달라진 삶', badge: '🏍️ 내 바이크', icon: '🏍️' },
  { cp: 50000,  label: '반타작',      badge: '👔 넥스트 레벨',   icon: '👔' },
  { cp: 100000, label: '여섯 자리',   badge: '🚗 드림카',       icon: '🚗' },
  { cp: 150000, label: '거의 다 왔다', badge: '🏠 내 집',       icon: '🏠' },
  { cp: 200000, label: '자유',        badge: '🏝️ 자유 달성',    icon: '🏝️' },
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

// ─── Pixel Art Characters (SVG) ──────────────────────────────────────────────

function PixelChar({ stage }) {
  // 8 stages of character evolution (pixel art style)
  const W = 32, H = 48

  const parts = {
    // Color palettes per stage
    0: { skin:'#f4c28f', hair:'#3a2a1a', top:'#ffffff', bottom:'#7a8899', shoe:'#d4956a', acc:null },
    1: { skin:'#f4c28f', hair:'#3a2a1a', top:'#4a90d9', bottom:'#3b5998', shoe:'#f0f0f0', acc:'#8b5e3c' },
    2: { skin:'#f4c28f', hair:'#3a2a1a', top:'#555555', bottom:'#444444', shoe:'#333333', acc:'#ffffff' },
    3: { skin:'#f4c28f', hair:'#3a2a1a', top:'#e8e8ff', bottom:'#3a3a50', shoe:'#f0f0f0', acc:'#c0c0c0' },
    4: { skin:'#f4c28f', hair:'#3a2a1a', top:'#2a1a0a', bottom:'#222222', shoe:'#ff4444', acc:'#333333' },
    5: { skin:'#f4c28f', hair:'#3a2a1a', top:'#1a1a2e', bottom:'#1a1a2e', shoe:'#333333', acc:'#ffd700' },
    6: { skin:'#f4c28f', hair:'#3a2a1a', top:'#d4aa70', bottom:'#3a3a50', shoe:'#6a4a2a', acc:'#c0c0c0' },
    7: { skin:'#f4c28f', hair:'#3a2a1a', top:'#1a1a3a', bottom:'#1a1a3a', shoe:'#333333', acc:'#ffd700' },
    8: { skin:'#f4c28f', hair:'#3a2a1a', top:'#ff6b6b', bottom:'#4a90d9', shoe:'#d4956a', acc:'#333333' },
  }[stage] || parts?.[0]

  const p = parts || { skin:'#f4c28f', hair:'#3a2a1a', top:'#ffffff', bottom:'#7a8899', shoe:'#d4956a', acc:null }
  const px = 2 // pixel size

  return (
    <svg width={W*2} height={H*2} viewBox={`0 0 ${W} ${H}`} style={{ imageRendering: 'pixelated' }}>
      {/* Hair */}
      <rect x={11*px} y={0} width={5*px} height={px} fill={p.hair} />
      <rect x={10*px} y={px} width={7*px} height={px} fill={p.hair} />
      {/* Head */}
      <rect x={11*px} y={2*px} width={5*px} height={px} fill={p.skin} />
      <rect x={10*px} y={3*px} width={7*px} height={2*px} fill={p.skin} />
      {/* Eyes */}
      <rect x={11*px} y={3*px} width={px} height={px} fill="#2a1a0a" />
      <rect x={14*px} y={3*px} width={px} height={px} fill="#2a1a0a" />
      {/* Mouth - smile progression */}
      {stage >= 1 && <rect x={12*px} y={4*px} width={2*px} height={0.5*px} fill="#cc7755" />}
      {/* Neck */}
      <rect x={12*px} y={5*px} width={3*px} height={px} fill={p.skin} />
      {/* Torso */}
      <rect x={10*px} y={6*px} width={7*px} height={4*px} fill={p.top} />
      {/* Arms */}
      <rect x={8*px} y={6*px} width={2*px} height={4*px} fill={p.top} />
      <rect x={17*px} y={6*px} width={2*px} height={4*px} fill={p.top} />
      <rect x={8*px} y={10*px} width={2*px} height={px} fill={p.skin} />
      <rect x={17*px} y={10*px} width={2*px} height={px} fill={p.skin} />
      {/* Legs */}
      <rect x={10*px} y={10*px} width={3*px} height={4*px} fill={p.bottom} />
      <rect x={14*px} y={10*px} width={3*px} height={4*px} fill={p.bottom} />
      {/* Shoes */}
      <rect x={9*px} y={14*px} width={4*px} height={px} fill={p.shoe} />
      <rect x={14*px} y={14*px} width={4*px} height={px} fill={p.shoe} />

      {/* Stage-specific accessories */}
      {/* Stage 1: Coffee cup */}
      {stage === 1 && <>
        <rect x={18*px} y={9*px} width={2*px} height={2*px} fill={p.acc} />
        <rect x={18.5*px} y={8.5*px} width={px} height={0.5*px} fill="#aaa" />
      </>}
      {/* Stage 2: Earbuds */}
      {stage === 2 && <>
        <rect x={9*px} y={3*px} width={px} height={px} fill={p.acc} />
        <rect x={16*px} y={3*px} width={px} height={px} fill={p.acc} />
      </>}
      {/* Stage 3: Watch */}
      {stage >= 3 && <>
        <rect x={7*px} y={9*px} width={px} height={px} fill={p.acc} />
      </>}
      {/* Stage 4: Sunglasses */}
      {stage === 4 && <>
        <rect x={10*px} y={3*px} width={7*px} height={px} fill={p.acc} />
      </>}
      {/* Stage 5: Tie */}
      {stage === 5 && <>
        <rect x={12.5*px} y={6*px} width={2*px} height={4*px} fill={p.acc} />
      </>}
      {/* Stage 6: Scarf */}
      {stage === 6 && <>
        <rect x={10*px} y={5.5*px} width={7*px} height={px} fill={p.acc} />
      </>}
      {/* Stage 7: Briefcase */}
      {stage === 7 && <>
        <rect x={18*px} y={8*px} width={3*px} height={3*px} fill={p.acc} />
        <rect x={19*px} y={7.5*px} width={px} height={0.5*px} fill={p.acc} />
      </>}
      {/* Stage 8: Sunglasses + lei */}
      {stage >= 8 && <>
        <rect x={10*px} y={3*px} width={7*px} height={px} fill="#333" />
        <rect x={10*px} y={5.5*px} width={7*px} height={px} fill="#ff9999" />
      </>}
    </svg>
  )
}

// ─── Stage Backgrounds (CSS + SVG) ──────────────────────────────────────────

const STAGE_BG = [
  // 0: 고시원 골목
  { gradient: 'linear-gradient(180deg, #0a0a14 0%, #121218 50%, #0d0d14 100%)',
    accent: '#555566', ground: '#2a2a2a' },
  // 1: 편의점 앞
  { gradient: 'linear-gradient(180deg, #0a0a16 0%, #14141e 50%, #0f0f16 100%)',
    accent: '#44dd88', ground: '#3a3a3a' },
  // 2: 원룸 책상
  { gradient: 'linear-gradient(180deg, #0a0e18 0%, #0f1422 50%, #0a0e18 100%)',
    accent: '#42a5f5', ground: '#3a2a1a' },
  // 3: 깔끔한 카페
  { gradient: 'linear-gradient(180deg, #1a1410 0%, #201810 50%, #1a1410 100%)',
    accent: '#e8c080', ground: '#aa9070' },
  // 4: 도심 거리
  { gradient: 'linear-gradient(180deg, #0a0a1a 0%, #14102a 50%, #0a0a1a 100%)',
    accent: '#b794f6', ground: '#333344' },
  // 5: 한강 야경
  { gradient: 'linear-gradient(180deg, #060818 0%, #0a1028 50%, #060818 100%)',
    accent: '#ffd700', ground: '#2a3040' },
  // 6: 펜트하우스 발코니
  { gradient: 'linear-gradient(180deg, #08081a 0%, #0e0e28 50%, #08081a 100%)',
    accent: '#e0e0ff', ground: '#888899' },
  // 7: 해안도로
  { gradient: 'linear-gradient(180deg, #1a1008 0%, #2a1810 50%, #1a1008 100%)',
    accent: '#ff8855', ground: '#aa8866' },
  // 8: 프라이빗 비치
  { gradient: 'linear-gradient(180deg, #081820 0%, #0a2030 50%, #081820 100%)',
    accent: '#40e0d0', ground: '#e8d8a0' },
]

function StageBackground({ stage }) {
  const bg = STAGE_BG[stage] || STAGE_BG[0]

  const silhouettes = {
    0: ( // 골목 - 낡은 건물, 가로등
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
    1: ( // 편의점
      <g opacity="0.15">
        <rect x="420" y="25" width="70" height="65" fill="#333" rx="2" />
        <rect x="425" y="30" width="60" height="20" fill={bg.accent} opacity="0.3" rx="1" />
        <text x="440" y="44" fill={bg.accent} fontSize="8" opacity="0.5">24H</text>
        <rect x="10" y="30" width="35" height="60" fill="#2a2a2a" />
      </g>
    ),
    2: ( // 듀얼 모니터
      <g opacity="0.15">
        <rect x="400" y="35" width="30" height="22" fill={bg.accent} opacity="0.4" rx="1" />
        <rect x="435" y="35" width="30" height="22" fill={bg.accent} opacity="0.3" rx="1" />
        <rect x="415" y="57" width="35" height="3" fill="#333" />
        <rect x="20" y="50" width="40" height="30" fill="#1a1a2a" rx="2" />
      </g>
    ),
    3: ( // 카페 창문
      <g opacity="0.12">
        <rect x="0" y="20" width="500" height="2" fill={bg.accent} opacity="0.3" />
        <rect x="350" y="22" width="120" height="60" fill="rgba(255,255,255,0.03)" rx="3" />
        <rect x="360" y="27" width="100" height="40" fill="rgba(255,255,255,0.02)" />
        <circle cx="30" cy="50" r="15" fill={bg.accent} opacity="0.1" />
      </g>
    ),
    4: ( // 네온 빌딩
      <g opacity="0.15">
        <rect x="20" y="10" width="30" height="80" fill="#222233" />
        <rect x="60" y="20" width="25" height="70" fill="#1a1a2a" />
        <rect x="400" y="5" width="35" height="85" fill="#222233" />
        <rect x="440" y="15" width="25" height="75" fill="#1a1a2a" />
        <line x1="25" y1="15" x2="25" y2="85" stroke={bg.accent} strokeWidth="1" opacity="0.3" />
        <line x1="445" y1="20" x2="445" y2="80" stroke="#ff44aa" strokeWidth="1" opacity="0.2" />
      </g>
    ),
    5: ( // 한강 + 다리
      <g opacity="0.12">
        <rect x="0" y="65" width="500" height="25" fill="#0a1530" />
        <line x1="0" y1="60" x2="500" y2="60" stroke={bg.accent} strokeWidth="0.5" opacity="0.3" />
        <line x1="100" y1="50" x2="400" y2="50" stroke="#334" strokeWidth="3" />
        <line x1="150" y1="50" x2="150" y2="60" stroke="#334" strokeWidth="1" />
        <line x1="250" y1="50" x2="250" y2="60" stroke="#334" strokeWidth="1" />
        <line x1="350" y1="50" x2="350" y2="60" stroke="#334" strokeWidth="1" />
        {/* 불빛 반사 */}
        <circle cx="200" cy="72" r="2" fill={bg.accent} opacity="0.2" className="water-glow" />
        <circle cx="300" cy="75" r="2" fill={bg.accent} opacity="0.15" className="water-glow" />
      </g>
    ),
    6: ( // 펜트하우스 야경
      <g opacity="0.12">
        <rect x="0" y="70" width="500" height="20" fill={bg.ground} opacity="0.3" />
        {Array.from({length: 30}).map((_, i) => (
          <circle key={i} cx={15 + i * 16} cy={75 + Math.random() * 10} r={0.8}
            fill={['#ffd700','#fff','#42a5f5','#ff6b6b'][i%4]} opacity={0.2 + Math.random()*0.2} />
        ))}
        <rect x="180" y="60" width="3" height="15" fill="#333" opacity="0.3" />
        <rect x="320" y="55" width="3" height="20" fill="#333" opacity="0.3" />
      </g>
    ),
    7: ( // 해안도로 + 석양 + 야자수
      <g opacity="0.15">
        <rect x="0" y="70" width="500" height="20" fill="#1a3050" opacity="0.3" />
        <line x1="0" y1="70" x2="500" y2="70" stroke={bg.accent} strokeWidth="0.5" opacity="0.3" />
        {/* 야자수 */}
        <line x1="450" y1="20" x2="450" y2="60" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="440" cy="18" rx="15" ry="6" fill="#2a5020" opacity="0.5" className="palm-sway" />
        <ellipse cx="458" cy="15" rx="12" ry="5" fill="#2a5020" opacity="0.4" className="palm-sway" />
      </g>
    ),
    8: ( // 프라이빗 비치
      <g opacity="0.15">
        <rect x="0" y="65" width="500" height="25" fill={bg.accent} opacity="0.15" />
        <line x1="0" y1="65" x2="500" y2="65" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        {/* 야자수 2개 */}
        <line x1="30" y1="15" x2="30" y2="55" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="20" cy="12" rx="15" ry="6" fill="#2a5020" opacity="0.5" className="palm-sway" />
        <line x1="460" y1="20" x2="460" y2="55" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="470" cy="17" rx="15" ry="6" fill="#2a5020" opacity="0.5" className="palm-sway" />
        {/* 해먹 */}
        <path d="M 25 40 Q 50 50 75 40" fill="none" stroke="#aa6633" strokeWidth="1" opacity="0.5" />
      </g>
    ),
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 16 }}>
      {/* 배경 그라데이션 */}
      <div style={{ position: 'absolute', inset: 0, background: bg.gradient }} />
      {/* SVG 실루엣 */}
      <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}>
        {silhouettes[stage]}
      </svg>
      {/* 가독성 오버레이 */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(13,13,26,0.7)' }} />
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
  // Pace estimation for tooltip
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
      {/* Tooltip */}
      {hovered && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)', marginBottom: 8,
          background: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap',
          zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          fontSize: 11, fontFamily: 'Inter, monospace',
        }}>
          <div style={{ fontWeight: 700, color: reached ? '#fbbf24' : '#9ca3af', marginBottom: 2 }}>
            {stageInfo.icon} {stageInfo.badge || `$${CP_LABELS[cp]}`} — {reached ? '달성!' : '미달성'}
          </div>
          {reached && achievedDate && <div style={{ color: '#6b7280', fontSize: 10 }}>달성일: {achievedDate}</div>}
          {!reached && <div style={{ color: '#6b7280', fontSize: 10 }}>남은 금액: {fmtK(remaining)}</div>}
          {!reached && estimateStr && <div style={{ color: '#4b5563', fontSize: 9 }}>현재 페이스 기준: {estimateStr}</div>}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(255,255,255,0.12)',
          }} />
        </div>
      )}

      {/* 아이콘 */}
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
            width: 13, height: 13, borderRadius: '50%', background: '#00c853',
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
      {/* 바 트랙 */}
      <div style={{
        position: 'absolute', top: '50%', left: 0, right: 0, height: 48,
        transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)',
        borderRadius: 24, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
      }}>
        {/* 진행 */}
        <div style={{
          position: 'absolute', inset: 0, width: `${pct}%`,
          background: grad, borderRadius: 24,
          boxShadow: '0 0 12px rgba(255,215,0,0.3)',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)', borderRadius: 24 }} />
          <div className="progress-shimmer" style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden' }} />
        </div>

        {/* 진행률 텍스트 */}
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

      {/* 마일스톤 */}
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
        {/* 말풍선 */}
        <div style={{
          background: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8, padding: '4px 10px', marginBottom: 4,
          whiteSpace: 'nowrap', position: 'relative',
        }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#00c853', fontFamily: 'Inter, monospace', textAlign: 'center' }}>
            {fmtPnl(journey.cumulativePnl)}
          </div>
          {journey.nextCpRemaining > 0 && (
            <div style={{ fontSize: 9, color: '#9e9e9e', fontFamily: 'Inter, monospace', textAlign: 'center', lineHeight: 1.7 }}>
              다음까지 {fmtK(journey.nextCpRemaining)}
            </div>
          )}
          {/* 삼각형 꼬리 */}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
            borderTop: '4px solid rgba(255,255,255,0.15)',
          }} />
        </div>

        {/* 캐릭터 + 바운스 */}
        <div className="char-bounce" style={{ transform: 'scaleX(-1)' }}>
          <PixelChar stage={stage} />
        </div>
        {/* 그림자 */}
        <div className="char-shadow" style={{
          width: 32, height: 6, borderRadius: '50%',
          background: 'rgba(0,0,0,0.3)', marginTop: -2,
        }} />
      </div>
    </div>
  )
}

// ─── Stat Cards + Streaks (kept compact) ────────────────────────────────────

function StatRow({ journey, ps, personalBests }) {
  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length

  const items = [
    { label: '누적 PNL', value: fmtPnl(journey.cumulativePnl), color: journey.cumulativePnl >= 0 ? '#00c853' : '#ff1744' },
    { label: '진행률', value: `${journey.progressPercent.toFixed(2)}%`, color: ps.color },
    { label: '다음 CP', value: journey.nextCheckpoint ? `${fmtK(journey.nextCheckpoint)} (−${fmtK(journey.nextCpRemaining)})` : '🏁 완주!', color: journey.nextCheckpoint ? '#a0a0a0' : '#fbbf24' },
    { label: 'CLEARED', value: `${reachedCount}/${CHECKPOINTS.length}`, color: '#fbbf24' },
  ]

  if (journey.streak > 0) {
    items.push({
      label: journey.streakType === 'win' ? '🔥 연승' : '❄️ 연패',
      value: `${journey.streak}${journey.streakType === 'win' ? '연승' : '연패'}`,
      color: journey.streakType === 'win' ? '#00c853' : '#ff1744',
    })
  }

  if (personalBests?.estimatedDate) {
    items.push({ label: '🎯 $200K 도달', value: personalBests.estimatedDate, color: '#60a5fa' })
  }

  return (
    <div style={{ display: 'flex', gap: 8, padding: '0 16px', flexWrap: 'wrap' }}>
      {items.map(item => (
        <div key={item.label} style={{
          flex: '1 1 auto', minWidth: 110,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 10, padding: '8px 12px',
        }}>
          <div style={{ fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, marginBottom: 2 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 800, color: item.color, fontFamily: 'Inter, monospace' }}>
            {item.value}
          </div>
        </div>
      ))}
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

// ─── Confetti ────────────────────────────────────────────────────────────────

function ConfettiEffect({ active }) {
  if (!active) return null
  return (
    <div className="confetti-container" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="confetti-piece" style={{
          '--delay': `${Math.random()*2}s`, '--x': `${Math.random()*100}%`,
          '--rotation': `${Math.random()*720}deg`,
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
  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length
  useEffect(() => {
    if (reachedCount > 0) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(t)
    }
  }, [reachedCount])

  const stageInfo = STAGES[stage]

  return (
    <div style={{
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      border: `1px solid ${ps.color}30`,
      boxShadow: `0 0 40px ${ps.color}08`,
    }}>
      <StageBackground stage={stage} />
      <ConfettiEffect active={showConfetti} />

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
        {/* 현재 단계 뱃지 */}
        <div style={{
          fontSize: 10, fontWeight: 700, fontFamily: 'Inter, monospace',
          color: '#fbbf24', background: 'rgba(251,191,36,0.08)',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 6, padding: '3px 10px',
        }}>
          {stageInfo?.badge || '🚀 시작'}
        </div>
      </div>

      {/* 프로그레스 바 + 마일스톤 + 캐릭터 */}
      <div style={{ padding: '24px 8px 16px', position: 'relative', zIndex: 1 }}>
        <ProgressBarNew journey={journey} ps={ps} curve={curve} personalBests={personalBests} stage={stage} />
      </div>

      {/* 스탯 */}
      <div style={{ position: 'relative', zIndex: 1, paddingBottom: 12 }}>
        <StatRow journey={journey} ps={ps} personalBests={personalBests} />
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
      `}</style>
    </div>
  )
}
