import { useMemo, useState, useEffect, useCallback } from 'react'
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

// ─── Vector Character (clean SVG) ────────────────────────────────────────────

function VectorChar({ stage, height = 80, faceRight = true }) {
  const palettes = [
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#e0e0e0', bottom: '#8899aa', shoe: '#888', acc: null },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#4a90d9', bottom: '#3b5998', shoe: '#f0f0f0', acc: '#8b5e3c' },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#444', bottom: '#333', shoe: '#222', acc: '#fff' },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#dde', bottom: '#3a3a50', shoe: '#e0e0e0', acc: '#c0c0c0' },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#1a1008', bottom: '#222', shoe: '#d44', acc: '#333' },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#1a1a2e', bottom: '#1a1a2e', shoe: '#333', acc: '#ffd700' },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#8b7355', bottom: '#3a3a50', shoe: '#5a3a1a', acc: '#c0c0c0' },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#1a1a3a', bottom: '#1a1a3a', shoe: '#333', acc: '#ffd700' },
    { hair: '#3a2a1a', skin: '#f4c28f', top: '#e05050', bottom: '#4a90d9', shoe: '#d4956a', acc: '#ff9' },
  ]
  const p = palettes[stage] || palettes[0]
  const W = 40, H = 80
  const scale = height / H

  return (
    <svg width={W * scale} height={height} viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: 'visible', display: 'block', transform: faceRight ? 'scaleX(-1)' : 'none' }}>
      <circle cx="20" cy="14" r="10" fill={p.skin} />
      <ellipse cx="20" cy="9" rx="10" ry="6" fill={p.hair} />
      <ellipse cx="20" cy="7" rx="8" ry="4" fill={p.hair} />
      {/* Eyes — slight right gaze */}
      <circle cx="16" cy="14" r="1.5" fill="#2a1a0a" />
      <circle cx="23" cy="14" r="1.5" fill="#2a1a0a" />
      <circle cx="16.5" cy="13.3" r="0.5" fill="#fff" />
      <circle cx="23.5" cy="13.3" r="0.5" fill="#fff" />
      <path d="M 17 17 Q 20 20 23 17" fill="none" stroke="#c77" strokeWidth="0.8" strokeLinecap="round" />
      <rect x="18" y="23" width="4" height="3" rx="1" fill={p.skin} />
      <rect x="10" y="25" width="20" height="18" rx="3" fill={p.top} />
      {/* Arms — right arm slightly forward */}
      <rect x="5" y="26" width="6" height="14" rx="3" fill={p.top} />
      <rect x="29" y="25" width="6" height="15" rx="3" fill={p.top} />
      <circle cx="8" cy="41" r="2.5" fill={p.skin} />
      <circle cx="32" cy="41" r="2.5" fill={p.skin} />
      {/* Legs — walking pose */}
      <rect x="12" y="42" width="7" height="16" rx="3" fill={p.bottom} />
      <rect x="21" y="42" width="7" height="16" rx="3" fill={p.bottom} />
      <ellipse cx="15" cy="59" rx="5" ry="2.5" fill={p.shoe} />
      <ellipse cx="25" cy="59" rx="5" ry="2.5" fill={p.shoe} />
      {/* Ear */}
      <ellipse cx="10" cy="14" r="2" fill={p.skin} />
      {/* Nose */}
      <ellipse cx="26" cy="15" rx="1" ry="1.2" fill="#e0b080" />

      {stage === 1 && (
        <g>
          <rect x="30" y="34" width="5" height="7" rx="1" fill={p.acc} />
          <rect x="29.5" y="33" width="6" height="2" rx="1" fill="#a07040" />
          <path d="M 35 36 Q 37 37 35 39" fill="none" stroke="#a07040" strokeWidth="0.8" />
          <path d="M 31 31 Q 32 29 31 27" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" className="steam-anim" />
          <path d="M 33 32 Q 34 30 33 28" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" className="steam-anim-2" />
        </g>
      )}
      {stage === 2 && (
        <g>
          <circle cx="10" cy="15" r="1.5" fill={p.acc} />
          <circle cx="30" cy="15" r="1.5" fill={p.acc} />
          <line x1="10" y1="15" x2="10" y2="20" stroke={p.acc} strokeWidth="0.5" />
          <line x1="30" y1="15" x2="30" y2="20" stroke={p.acc} strokeWidth="0.5" />
        </g>
      )}
      {stage >= 3 && stage < 8 && (
        <rect x="29" y="38" width="5" height="3" rx="1" fill={p.acc} stroke="#888" strokeWidth="0.3" />
      )}
      {stage === 4 && (
        <g>
          <rect x="13" y="12" width="6" height="4" rx="1.5" fill={p.acc} opacity="0.8" />
          <rect x="21" y="12" width="6" height="4" rx="1.5" fill={p.acc} opacity="0.8" />
          <line x1="19" y1="14" x2="21" y2="14" stroke={p.acc} strokeWidth="0.8" />
        </g>
      )}
      {stage === 5 && (
        <polygon points="19,26 21,26 21.5,34 20,36 18.5,34" fill={p.acc} />
      )}
      {stage === 6 && (
        <g>
          <path d="M 10 26 Q 20 30 30 26" fill="none" stroke={p.acc} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="28" y1="27" x2="30" y2="35" stroke={p.acc} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {stage === 7 && (
        <g>
          <rect x="30" y="38" width="8" height="6" rx="1" fill={p.acc} />
          <rect x="32" y="37" width="4" height="2" rx="0.5" fill="none" stroke={p.acc} strokeWidth="0.5" />
        </g>
      )}
      {stage >= 8 && (
        <g>
          <rect x="13" y="12" width="6" height="4" rx="1.5" fill="#333" opacity="0.7" />
          <rect x="21" y="12" width="6" height="4" rx="1.5" fill="#333" opacity="0.7" />
          <line x1="19" y1="14" x2="21" y2="14" stroke="#333" strokeWidth="0.8" />
          <path d="M 11 26 Q 20 30 29 26" fill="none" stroke="#ff9" strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  )
}

// ─── Stage Backgrounds ───────────────────────────────────────────────────────

const STAGE_BG = [
  { grad: 'linear-gradient(180deg, #0a0a14 0%, #15151f 40%, #0d0d14 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #0a0a16 0%, #14141e 40%, #0f0f16 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.30), rgba(13,13,26,0.50))' },
  { grad: 'linear-gradient(180deg, #0a0e18 0%, #0f1422 40%, #0a0e18 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #1a1410 0%, #201810 40%, #1a1410 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.30), rgba(13,13,26,0.50))' },
  { grad: 'linear-gradient(180deg, #0a0a1a 0%, #14102a 40%, #0a0a1a 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.30), rgba(13,13,26,0.50))' },
  { grad: 'linear-gradient(180deg, #060818 0%, #0a1028 40%, #060818 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.25), rgba(13,13,26,0.45))' },
  { grad: 'linear-gradient(180deg, #08081a 0%, #0e0e28 40%, #08081a 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.25), rgba(13,13,26,0.45))' },
  { grad: 'linear-gradient(180deg, #1a1008 0%, #2a1810 40%, #1a1008 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.20), rgba(13,13,26,0.40))' },
  { grad: 'linear-gradient(180deg, #081820 0%, #0a2030 40%, #081820 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.20), rgba(13,13,26,0.40))' },
]

function StageBackground({ stage }) {
  const bg = STAGE_BG[stage] || STAGE_BG[0]

  const scenes = {
    0: ( // 고시원 골목 — 좁은 골목, 낡은 건물, 가로등, 갈라진 바닥
      <g>
        {/* 건물 왼쪽 */}
        <rect x="0" y="15" width="60" height="85" fill="#1a1a22" />
        <rect x="5" y="25" width="12" height="10" fill="#252530" /><rect x="5" y="25" width="12" height="10" fill="rgba(255,200,100,0.04)" />
        <rect x="25" y="20" width="12" height="10" fill="#252530" />
        <rect x="5" y="45" width="12" height="10" fill="#252530" />
        <rect x="25" y="50" width="12" height="10" fill="rgba(255,200,100,0.06)" />
        {/* 건물 오른쪽 */}
        <rect x="420" y="10" width="80" height="90" fill="#1a1a22" />
        <rect x="430" y="22" width="12" height="10" fill="#252530" />
        <rect x="455" y="30" width="12" height="10" fill="rgba(255,200,100,0.04)" />
        <rect x="430" y="50" width="12" height="10" fill="#252530" />
        <rect x="470" y="22" width="12" height="10" fill="#252530" />
        {/* 가로등 */}
        <line x1="100" y1="15" x2="100" y2="80" stroke="#3a3a44" strokeWidth="2" />
        <circle cx="100" cy="14" r="4" fill="#ffc96630" /><circle cx="100" cy="14" r="2" fill="#ffc966" className="flicker-light" />
        {/* 바닥 갈라짐 */}
        <line x1="0" y1="82" x2="500" y2="82" stroke="#2a2a32" strokeWidth="1" />
        <path d="M 150 82 L 160 90 L 170 85 L 185 92" fill="none" stroke="#2a2a32" strokeWidth="0.5" />
        <path d="M 300 82 L 310 88 L 320 84" fill="none" stroke="#2a2a32" strokeWidth="0.5" />
        {/* 별 */}
        <circle cx="200" cy="8" r="0.8" fill="#fff" className="star-twinkle" />
        <circle cx="350" cy="5" r="0.6" fill="#fff" className="star-twinkle-2" />
        <circle cx="280" cy="12" r="0.5" fill="#ddd" className="star-twinkle" />
      </g>
    ),
    1: ( // 편의점 앞 — 간판, 네온빛, 가로등, 보도블록 (전체 영역)
      <g>
        {/* 왼쪽 낡은 건물 */}
        <rect x="0" y="15" width="70" height="85" fill="#1a1a24" />
        <rect x="8" y="25" width="12" height="10" fill="#222230" />
        <rect x="30" y="25" width="12" height="10" fill="rgba(255,200,100,0.06)" />
        <rect x="8" y="45" width="12" height="10" fill="#222230" />
        <rect x="30" y="45" width="12" height="10" fill="rgba(255,200,100,0.04)" />
        {/* 편의점 건물 (중앙~오른쪽) */}
        <rect x="160" y="10" width="200" height="80" fill="#1e1e2a" rx="2" />
        <rect x="165" y="15" width="190" height="28" fill="#1a2a1a" rx="1" />
        <rect x="165" y="15" width="190" height="28" fill="rgba(68,221,136,0.15)" rx="1" />
        <text x="210" y="34" fill="#44dd88" fontSize="14" fontFamily="Inter, monospace" fontWeight="800" opacity="0.8">24H MART</text>
        {/* 간판 글로우 */}
        <ellipse cx="260" cy="14" rx="80" ry="6" fill="rgba(68,221,136,0.08)" />
        {/* 간판 빛 바닥 반사 */}
        <ellipse cx="260" cy="88" rx="80" ry="10" fill="rgba(68,221,136,0.08)" />
        {/* 편의점 창문들 */}
        <rect x="170" y="48" width="25" height="28" fill="rgba(255,200,100,0.1)" rx="1" />
        <rect x="200" y="48" width="25" height="28" fill="rgba(255,200,100,0.08)" rx="1" />
        <rect x="230" y="48" width="45" height="28" fill="rgba(255,200,100,0.12)" rx="1" />
        <rect x="285" y="48" width="25" height="28" fill="rgba(255,200,100,0.08)" rx="1" />
        <rect x="320" y="48" width="25" height="28" fill="rgba(255,200,100,0.06)" rx="1" />
        {/* 오른쪽 건물 */}
        <rect x="410" y="20" width="90" height="80" fill="#181822" />
        <rect x="420" y="30" width="12" height="10" fill="#222230" />
        <rect x="445" y="30" width="12" height="10" fill="rgba(255,200,100,0.04)" />
        <rect x="470" y="30" width="12" height="10" fill="#222230" />
        <rect x="420" y="50" width="12" height="10" fill="rgba(255,200,100,0.05)" />
        <rect x="445" y="50" width="12" height="10" fill="#222230" />
        {/* 가로등 3개 (균등 배치) */}
        <line x1="90" y1="10" x2="90" y2="78" stroke="#3a3a44" strokeWidth="2" />
        <circle cx="90" cy="9" r="4" fill="#ffc96630" /><circle cx="90" cy="9" r="2" fill="#ffc966" className="flicker-light" />
        <ellipse cx="90" cy="82" rx="15" ry="4" fill="rgba(255,201,102,0.06)" />
        <line x1="380" y1="12" x2="380" y2="78" stroke="#3a3a44" strokeWidth="2" />
        <circle cx="380" cy="11" r="4" fill="#ffc96630" /><circle cx="380" cy="11" r="2" fill="#ffc966" className="flicker-light" />
        <ellipse cx="380" cy="82" rx="15" ry="4" fill="rgba(255,201,102,0.06)" />
        {/* 보도블록 */}
        <line x1="0" y1="80" x2="500" y2="80" stroke="#2a2a35" strokeWidth="1" />
        {[0,35,70,105,140,175,210,245,280,315,350,385,420,455,490].map(x => (
          <line key={x} x1={x} y1="80" x2={x} y2="92" stroke="#2a2a35" strokeWidth="0.3" />
        ))}
        {/* 별 */}
        <circle cx="30" cy="5" r="0.7" fill="#fff" className="star-twinkle" />
        <circle cx="130" cy="3" r="0.5" fill="#ddd" className="star-twinkle-2" />
        <circle cx="460" cy="6" r="0.6" fill="#eee" className="star-twinkle" />
      </g>
    ),
    2: ( // 원룸 책상 — 듀얼 모니터, 작은 창문, 도시불빛
      <g>
        {/* 벽 */}
        <rect x="0" y="0" width="500" height="100" fill="#10101a" />
        {/* 창문 */}
        <rect x="360" y="8" width="80" height="50" rx="2" fill="#0a0a16" stroke="#2a2a36" strokeWidth="1" />
        <rect x="362" y="10" width="76" height="46" rx="1" fill="#0a0a16" />
        {/* 창밖 도시불빛 */}
        {[370,380,390,400,410,420,425,430].map((x, i) => (
          <rect key={x} x={x} y={20 + (i%3)*8} width={2 + i%2} height={15 + (i%4)*5} fill={`rgba(${100+i*15},${150+i*10},255,0.15)`} />
        ))}
        {/* 모니터 2개 */}
        <rect x="80" y="40" width="60" height="38" rx="2" fill="#0d0d1a" stroke="#42a5f5" strokeWidth="0.5" />
        <rect x="82" y="42" width="56" height="32" rx="1" fill="rgba(66,165,245,0.08)" />
        <text x="92" y="60" fill="#42a5f5" fontSize="5" opacity="0.5" fontFamily="monospace">$ profit +3.2%</text>
        <rect x="150" y="40" width="60" height="38" rx="2" fill="#0d0d1a" stroke="#42a5f5" strokeWidth="0.5" />
        <rect x="152" y="42" width="56" height="32" rx="1" fill="rgba(66,165,245,0.06)" />
        {/* 모니터 차트라인 */}
        <polyline points="155,65 165,58 175,62 185,55 195,60 205,52" fill="none" stroke="#00c853" strokeWidth="0.8" opacity="0.4" />
        {/* 모니터 스탠드 */}
        <rect x="100" y="78" width="20" height="3" rx="1" fill="#2a2a36" />
        <rect x="108" y="76" width="4" height="4" fill="#2a2a36" />
        <rect x="170" y="78" width="20" height="3" rx="1" fill="#2a2a36" />
        <rect x="178" y="76" width="4" height="4" fill="#2a2a36" />
        {/* 책상 */}
        <rect x="60" y="80" width="180" height="4" rx="1" fill="#2a2a36" />
        {/* 모니터 글로우 */}
        <ellipse cx="140" cy="85" rx="80" ry="10" fill="rgba(66,165,245,0.04)" />
      </g>
    ),
    3: ( // 깔끔한 카페 — 큰 창문, 따뜻한 조명
      <g>
        <rect x="0" y="0" width="500" height="100" fill="#18140e" />
        {/* 큰 창문 */}
        <rect x="300" y="5" width="180" height="65" rx="3" fill="#10100a" stroke="#3a3020" strokeWidth="1" />
        {/* 창밖 불빛 */}
        {[310,330,350,370,390,410,430,450].map((x, i) => (
          <rect key={x} x={x} y={15 + (i%3)*10} width={3} height={10 + (i%4)*8} fill={`rgba(255,${180+i*8},${80+i*5},0.1)`} />
        ))}
        {/* 창문 프레임 중간 */}
        <line x1="390" y1="5" x2="390" y2="70" stroke="#3a3020" strokeWidth="0.5" />
        {/* 천장 조명 */}
        <line x1="200" y1="0" x2="200" y2="8" stroke="#4a4030" strokeWidth="0.5" />
        <circle cx="200" cy="10" r="4" fill="rgba(232,192,128,0.15)" />
        <circle cx="200" cy="10" r="2" fill="rgba(232,192,128,0.3)" className="flicker-light" />
        <ellipse cx="200" cy="85" rx="80" ry="10" fill="rgba(232,192,128,0.04)" />
        {/* 바닥 */}
        <rect x="0" y="78" width="500" height="22" fill="#1a1610" />
        {/* 왼쪽 소파/의자 */}
        <rect x="20" y="55" width="40" height="25" rx="4" fill="#2a2218" />
        <rect x="80" y="60" width="25" height="20" rx="3" fill="#2a2218" />
        {/* 테이블 */}
        <rect x="75" y="72" width="35" height="3" rx="1" fill="#3a3020" />
        <circle cx="90" cy="70" r="2" fill="rgba(232,192,128,0.15)" />
      </g>
    ),
    4: ( // 도심 거리 — 네온사인, 빌딩, 반사광
      <g>
        {/* 빌딩들 */}
        <rect x="0" y="5" width="40" height="95" fill="#1a1a28" />
        <rect x="45" y="15" width="35" height="85" fill="#161624" />
        <rect x="400" y="0" width="45" height="100" fill="#1a1a28" />
        <rect x="450" y="10" width="50" height="90" fill="#161624" />
        {/* 네온사인 라인 */}
        <line x1="5" y1="20" x2="5" y2="70" stroke="#b794f6" strokeWidth="1.5" opacity="0.4" className="neon-pulse" />
        <line x1="35" y1="30" x2="35" y2="60" stroke="#ff44aa" strokeWidth="1" opacity="0.3" className="neon-pulse-2" />
        <line x1="410" y1="15" x2="410" y2="65" stroke="#42a5f5" strokeWidth="1" opacity="0.3" className="neon-pulse" />
        <line x1="475" y1="25" x2="475" y2="75" stroke="#b794f6" strokeWidth="1.5" opacity="0.4" className="neon-pulse-2" />
        {/* 창문 빛 */}
        {[8,18,52,58,408,420,458,468,478].map((x, i) => (
          <rect key={i} x={x} y={25 + (i*11)%40} width="5" height="5" fill={`rgba(255,${180+i*8},${100+i*10},0.08)`} rx="0.5" />
        ))}
        {/* 바닥 반사 */}
        <rect x="0" y="82" width="500" height="18" fill="#0a0a16" />
        <line x1="0" y1="82" x2="500" y2="82" stroke="rgba(183,148,246,0.15)" strokeWidth="0.5" />
        <ellipse cx="20" cy="90" rx="20" ry="4" fill="rgba(183,148,246,0.04)" />
        <ellipse cx="460" cy="90" rx="25" ry="4" fill="rgba(66,165,245,0.04)" />
        {/* 별 */}
        <circle cx="200" cy="5" r="0.6" fill="#fff" className="star-twinkle" />
        <circle cx="300" cy="8" r="0.5" fill="#ddd" className="star-twinkle-2" />
      </g>
    ),
    5: ( // 한강 야경 — 강물, 다리, 빌딩 반사, 물결
      <g>
        {/* 하늘 */}
        {/* 먼 빌딩 실루엣 */}
        {[60,90,120,140,180,210,250,280,310,340,370,400].map((x, i) => (
          <rect key={i} x={x} y={25 + (i%3)*8} width={12 + i%8} height={35 - (i%3)*8} fill="#0c0c20" />
        ))}
        {/* 빌딩 창문 빛 */}
        {[65,95,125,185,255,315,345,375,405].map((x, i) => (
          <rect key={i} x={x} y={30 + (i*7)%20} width="2" height="2" fill={`rgba(255,${200+i*5},${80+i*10},0.15)`} />
        ))}
        {/* 강물 */}
        <rect x="0" y="62" width="500" height="38" fill="#0a1530" />
        {/* 다리 */}
        <line x1="80" y1="55" x2="420" y2="55" stroke="#1a1a30" strokeWidth="4" />
        <line x1="80" y1="53" x2="420" y2="53" stroke="#22223a" strokeWidth="1" />
        {[120,170,220,270,320,370].map(x => (
          <line key={x} x1={x} y1="55" x2={x} y2="62" stroke="#1a1a30" strokeWidth="1.5" />
        ))}
        {/* 물위 반사 */}
        <ellipse cx="150" cy="75" rx="20" ry="2" fill="rgba(255,215,0,0.08)" className="water-glow" />
        <ellipse cx="300" cy="72" rx="25" ry="2" fill="rgba(255,215,0,0.06)" className="water-glow" />
        <ellipse cx="400" cy="78" rx="15" ry="1.5" fill="rgba(66,165,245,0.06)" className="water-glow" />
        {/* 물결 라인 */}
        <path d="M 0 68 Q 50 66 100 68 Q 150 70 200 68 Q 250 66 300 68 Q 350 70 400 68 Q 450 66 500 68" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
        {/* 별 */}
        <circle cx="100" cy="8" r="0.7" fill="#ffd700" className="star-twinkle" />
        <circle cx="250" cy="5" r="0.5" fill="#fff" className="star-twinkle-2" />
        <circle cx="450" cy="10" r="0.6" fill="#ddd" className="star-twinkle" />
      </g>
    ),
    6: ( // 펜트하우스 — 고층 야경, 불빛, 별
      <g>
        {/* 바닥 (발코니) */}
        <rect x="0" y="75" width="500" height="25" fill="#1a1a28" />
        <line x1="0" y1="75" x2="500" y2="75" stroke="#2a2a3a" strokeWidth="1" />
        {/* 난간 */}
        <line x1="0" y1="72" x2="500" y2="72" stroke="#3a3a4a" strokeWidth="1.5" />
        {[0,30,60,90,120,150,180,210,240,270,300,330,360,390,420,450,480].map(x => (
          <line key={x} x1={x} y1="72" x2={x} y2="75" stroke="#3a3a4a" strokeWidth="0.5" />
        ))}
        {/* 아래 도시불빛 (수백개) */}
        {Array.from({length: 60}).map((_, i) => (
          <circle key={i} cx={10 + (i * 31) % 480} cy={78 + (i * 7) % 15}
            r={0.5 + (i%3)*0.3}
            fill={['#ffd700','#fff','#42a5f5','#ff6b6b','#b794f6'][i%5]}
            opacity={0.15 + (i%4)*0.05} />
        ))}
        {/* 먼 빌딩 */}
        {[30,80,160,250,320,400,450].map((x, i) => (
          <rect key={i} x={x} y={30 + (i%4)*10} width={8 + i%5} height={42 - (i%4)*10} fill="#10101a" opacity="0.6" />
        ))}
        {/* 별 */}
        {Array.from({length: 12}).map((_, i) => (
          <circle key={i} cx={20 + (i * 41) % 460} cy={5 + (i * 13) % 20}
            r={0.3 + (i%3)*0.2} fill="#fff" opacity={0.3 + (i%3)*0.15}
            className={i%2 === 0 ? 'star-twinkle' : 'star-twinkle-2'} />
        ))}
      </g>
    ),
    7: ( // 해안도로 — 바다, 야자수, 석양 그라데이션
      <g>
        {/* 석양 하늘 */}
        <rect x="0" y="0" width="500" height="50" fill="url(#sunset-grad)" />
        <defs>
          <linearGradient id="sunset-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1808" />
            <stop offset="50%" stopColor="#3a2010" />
            <stop offset="100%" stopColor="#1a1008" />
          </linearGradient>
        </defs>
        {/* 태양 */}
        <circle cx="400" cy="25" r="15" fill="rgba(255,136,85,0.2)" />
        <circle cx="400" cy="25" r="8" fill="rgba(255,136,85,0.3)" />
        {/* 바다 */}
        <rect x="0" y="55" width="500" height="45" fill="#0a1828" />
        <path d="M 0 58 Q 60 55 120 58 Q 180 61 240 58 Q 300 55 360 58 Q 420 61 500 58" fill="none" stroke="rgba(255,136,85,0.1)" strokeWidth="0.5" />
        {/* 바다 반사 */}
        <ellipse cx="400" cy="65" rx="40" ry="3" fill="rgba(255,136,85,0.08)" className="water-glow" />
        {/* 도로 */}
        <rect x="0" y="72" width="500" height="12" fill="#1a1a22" />
        <line x1="0" y1="78" x2="500" y2="78" stroke="#2a2a32" strokeWidth="0.5" strokeDasharray="10 8" />
        {/* 야자수 */}
        <line x1="440" y1="15" x2="440" y2="55" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="428" cy="12" rx="18" ry="7" fill="#2a5020" opacity="0.7" className="palm-sway" />
        <ellipse cx="452" cy="10" rx="15" ry="6" fill="#2a5020" opacity="0.6" className="palm-sway" />
        <ellipse cx="435" cy="16" rx="12" ry="5" fill="#305028" opacity="0.5" className="palm-sway" />
      </g>
    ),
    8: ( // 프라이빗 비치 — 열대 해변, 맑은 바다, 야자수, 해먹
      <g>
        {/* 하늘 */}
        <rect x="0" y="0" width="500" height="50" fill="#082028" />
        {/* 바다 */}
        <rect x="0" y="45" width="500" height="20" fill="#0a2838" />
        <rect x="0" y="50" width="500" height="15" fill="rgba(64,224,208,0.06)" />
        <path d="M 0 48 Q 50 46 100 48 Q 150 50 200 48 Q 250 46 300 48 Q 350 50 400 48 Q 450 46 500 48" fill="none" stroke="rgba(64,224,208,0.1)" strokeWidth="0.5" />
        {/* 모래 해변 */}
        <rect x="0" y="65" width="500" height="35" fill="#2a2418" rx="0" />
        <rect x="0" y="65" width="500" height="5" fill="#3a3420" />
        {/* 야자수 왼쪽 */}
        <line x1="50" y1="10" x2="50" y2="55" stroke="#2a4020" strokeWidth="3.5" />
        <ellipse cx="35" cy="8" rx="20" ry="7" fill="#2a5020" opacity="0.7" className="palm-sway" />
        <ellipse cx="62" cy="6" rx="16" ry="6" fill="#2a5020" opacity="0.6" className="palm-sway" />
        <ellipse cx="45" cy="14" rx="14" ry="5" fill="#305028" opacity="0.5" className="palm-sway" />
        {/* 야자수 오른쪽 */}
        <line x1="440" y1="15" x2="440" y2="55" stroke="#2a4020" strokeWidth="3" />
        <ellipse cx="428" cy="12" rx="17" ry="7" fill="#2a5020" opacity="0.6" className="palm-sway" />
        <ellipse cx="453" cy="10" rx="14" ry="6" fill="#2a5020" opacity="0.5" className="palm-sway" />
        {/* 해먹 */}
        <path d="M 45 40 Q 75 52 105 40" fill="none" stroke="#aa6633" strokeWidth="1.5" opacity="0.6" />
        {/* 별 */}
        {Array.from({length: 8}).map((_, i) => (
          <circle key={i} cx={60 + (i * 53) % 380} cy={5 + (i * 9) % 15}
            r={0.4 + (i%3)*0.2} fill="#fff" opacity={0.25 + (i%3)*0.1}
            className={i%2 === 0 ? 'star-twinkle' : 'star-twinkle-2'} />
        ))}
      </g>
    ),
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', borderRadius: 16 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.grad }} />
      <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.35 }}>
        {scenes[stage]}
      </svg>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.overlay }} />
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
  const colors = percent < 25 ? ['#cd7f32','#e8a862'] : percent < 50 ? ['#cd7f32','#c0c0c0'] : percent < 75 ? ['#c0c0c0','#ffd700'] : ['#ffd700','#7c4dff']
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        <linearGradient id="donut-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors[0]} /><stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#donut-grad)" strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
    </svg>
  )
}

// ─── Stat Cards ──────────────────────────────────────────────────────────────

function StatCards({ journey, ps }) {
  const pnlColor = journey.cumulativePnl >= 0 ? GREEN : RED
  const CARD = { background: '#1a1a2e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 20, flex: 1, minWidth: 150, position: 'relative', overflow: 'hidden' }
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ ...CARD, backgroundImage: `linear-gradient(to top right, ${pnlColor}0d, transparent)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${pnlColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChartIcon color={pnlColor} size={18} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>누적 PNL</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: pnlColor, fontFamily: 'Inter, monospace' }}>{fmtPnl(journey.cumulativePnl)}</div>
          </div>
        </div>
      </div>
      <div style={{ ...CARD, backgroundImage: `linear-gradient(to top right, ${INFO}0d, transparent)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${INFO}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlagIcon color={INFO} size={18} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>다음 체크포인트</div>
            {journey.nextCheckpoint ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>{fmtK(journey.nextCheckpoint)}</div>
                <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>(남은 금액: {fmtDollar(journey.nextCpRemaining)})</div>
              </>
            ) : <div style={{ fontSize: 20, fontWeight: 900, color: '#fbbf24', fontFamily: 'Inter, monospace' }}>완주!</div>}
          </div>
        </div>
      </div>
      <div style={{ ...CARD, backgroundImage: `linear-gradient(to top right, ${ps.color}0d, transparent)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DonutChart percent={journey.progressPercent} size={44} strokeWidth={5} />
          <div>
            <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>진행률</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: ps.color, fontFamily: 'Inter, monospace' }}>{journey.progressPercent.toFixed(2)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Badge Row ───────────────────────────────────────────────────────────────

function BadgeRow({ journey, personalBests, curve }) {
  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length
  let estimateDelta = null
  if (curve && curve.length >= 30 && journey.cumulativePnl > 0) {
    const now = new Date()
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
    const lastMonth = now.getMonth() === 0 ? `${now.getFullYear()-1}-12` : `${now.getFullYear()}-${String(now.getMonth()).padStart(2,'0')}`
    const lastD = curve.filter(p => p.date?.startsWith(lastMonth)), thisD = curve.filter(p => p.date?.startsWith(thisMonth))
    if (lastD.length >= 2 && thisD.length >= 2) {
      const lp = (lastD[lastD.length-1].cumulative_pnl - lastD[0].cumulative_pnl) / Math.max(1, (new Date(lastD[lastD.length-1].date) - new Date(lastD[0].date)) / 86400000)
      const tp = (thisD[thisD.length-1].cumulative_pnl - thisD[0].cumulative_pnl) / Math.max(1, (new Date(thisD[thisD.length-1].date) - new Date(thisD[0].date)) / 86400000)
      if (lp > 0 && tp > 0) { const r = JOURNEY_GOAL - journey.cumulativePnl; const d = Math.round(r/(lp*30) - r/(tp*30)); if (Math.abs(d) >= 1) estimateDelta = d }
    }
  }
  const badges = []
  if (journey.streak >= 2) badges.push({ icon: journey.streakType === 'win' ? '🔥' : '❄️', label: `${journey.streak}${journey.streakType === 'win' ? '연승' : '연패'}`, color: journey.streakType === 'win' ? GREEN : RED })
  if (personalBests?.estimatedDate) {
    const b = { icon: '🎯', label: `$200K ${personalBests.estimatedDate}`, color: '#60a5fa', borderColor: null, sub: null, subColor: null }
    if (estimateDelta > 0) { b.borderColor = GREEN; b.sub = `↑ ${estimateDelta}개월 단축!`; b.subColor = GREEN }
    else if (estimateDelta && estimateDelta < 0) { b.borderColor = RED; b.sub = `↓ ${Math.abs(estimateDelta)}개월 지연`; b.subColor = RED }
    badges.push(b)
  }
  if (personalBests?.bestDayPnl > 0) badges.push({ icon: '💎', label: `BEST DAY ${fmtPnl(personalBests.bestDayPnl)}`, color: '#a78bfa' })
  if (personalBests?.longestWinStreak >= 2) badges.push({ icon: '⚡', label: `BEST STREAK ${personalBests.longestWinStreak}연승`, color: WARN })
  badges.push({ icon: '🏆', label: `CLEARED ${reachedCount}/${CHECKPOINTS.length}`, color: '#fbbf24' })
  if (badges.length === 0) return null
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {badges.map((b, i) => (
        <div key={i} className="badge-hover" style={{ display: 'flex', flexDirection: 'column', gap: 2, background: `${b.color}08`, border: `1px solid ${b.borderColor || b.color}25`, borderRadius: 10, padding: '12px 16px', cursor: 'default', transition: 'transform 0.2s, box-shadow 0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{b.icon}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: b.color, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{b.label}</span>
          </div>
          {b.sub && <div style={{ fontSize: 10, fontWeight: 700, color: b.subColor, fontFamily: 'Inter, monospace', paddingLeft: 22, lineHeight: 1.7 }}>{b.sub}</div>}
        </div>
      ))}
    </div>
  )
}

// ─── Character Profile Card ──────────────────────────────────────────────────

function CharacterProfileCard({ stage, journey }) {
  const current = STAGES[stage], next = STAGES[stage + 1]
  const stageStart = current.cp, stageEnd = next ? next.cp : JOURNEY_GOAL
  const stageProgress = Math.min(100, Math.max(0, ((journey.cumulativePnl - stageStart) / (stageEnd - stageStart)) * 100))
  const stageRemaining = Math.max(0, stageEnd - journey.cumulativePnl)
  const tint = stage <= 1 ? 'rgba(107,114,128,0.06)' : stage <= 5 ? 'rgba(66,165,245,0.06)' : 'rgba(255,215,0,0.06)'

  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
      padding: '16px 20px', position: 'relative', overflow: 'hidden',
      backgroundImage: `linear-gradient(to top right, ${tint}, transparent)`,
      width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flexShrink: 0, width: 50, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <VectorChar stage={stage} height={100} faceRight />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>현재 단계</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace', marginBottom: 4 }}>{current.icon} {current.label}</div>
          {next ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: '#4b5563', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>다음: {next.label}</span>
              <span style={{ fontSize: 10, color: '#374151' }}>🔒</span>
            </div>
          ) : <div style={{ fontSize: 12, color: '#fbbf24', fontFamily: 'Inter, monospace', marginBottom: 10, lineHeight: 1.7 }}>최종 단계 달성!</div>}
          {next && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#9e9e9e', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>다음 변신까지</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: INFO, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{fmtDollar(stageRemaining)} 남음</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${stageProgress}%`, height: '100%', borderRadius: 3, background: stage <= 1 ? '#cd7f32' : stage <= 4 ? INFO : '#ffd700', transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace', marginTop: 3, textAlign: 'right', lineHeight: 1.7 }}>{stageProgress.toFixed(1)}%</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Progress Bar ────────────────────────────────────────────────────────────

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
  if (reached && curve) { for (const p of curve) { if (p.cumulative_pnl >= cp) { achievedDate = p.date; break } } }
  const remaining = cp - cumulativePnl
  let estimateStr = null
  if (!reached && cumulativePnl > 0 && curve?.length >= 2) {
    const first = new Date(curve[0].date).getTime(), last = new Date(curve[curve.length-1].date).getTime()
    const perDay = cumulativePnl / Math.max(1, (last - first) / 86400000)
    if (perDay > 0) { const t = new Date(last + (remaining / perDay) * 86400000); estimateStr = `${t.getFullYear()}년 ${t.getMonth()+1}월` }
  }
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: reached ? 3 : isNext ? 2 : 1, cursor: 'pointer', pointerEvents: 'auto' }}>
      {hovered && (
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, background: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', fontSize: 11, fontFamily: 'Inter, monospace' }}>
          <div style={{ fontWeight: 700, color: reached ? '#fbbf24' : '#9ca3af', marginBottom: 2, lineHeight: 1.7 }}>{stageInfo.icon} {stageInfo.badge || `$${CP_LABELS[cp]}`} — {reached ? '달성!' : '미달성'}</div>
          {reached && achievedDate && <div style={{ color: '#6b7280', fontSize: 10, lineHeight: 1.7 }}>달성일: {achievedDate}</div>}
          {!reached && <div style={{ color: '#6b7280', fontSize: 10, lineHeight: 1.7 }}>남은 금액: {fmtK(remaining)}</div>}
          {!reached && estimateStr && <div style={{ color: '#4b5563', fontSize: 9, lineHeight: 1.7 }}>현재 페이스 기준: {estimateStr}</div>}
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid rgba(255,255,255,0.12)' }} />
        </div>
      )}
      <div className={reached ? 'ms-reached' : isNext ? 'ms-next' : ''} style={{
        width: reached ? 30 : 24, height: reached ? 30 : 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: reached ? 13 : 10, background: reached ? 'radial-gradient(circle, #2a1f00, #151000)' : isNext ? 'radial-gradient(circle, rgba(66,165,245,0.1), #121220)' : '#15151f',
        border: reached ? '2px solid #fbbf24' : isNext ? '2px dashed rgba(66,165,245,0.5)' : '1px solid #2a2a3a',
        boxShadow: reached ? '0 0 12px rgba(255,215,0,0.4)' : 'none', filter: reached ? 'none' : isNext ? 'none' : 'grayscale(1) opacity(0.4)', position: 'relative', transition: 'all 0.3s',
      }}>
        {stageInfo.icon || '?'}
        {reached && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 5, fontWeight: 900, color: '#fff', border: '2px solid #121220' }}>✓</div>}
        {!reached && !isNext && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 4, color: '#6b7280' }}>🔒</div>}
      </div>
      <div style={{ marginTop: 2, fontSize: 7, fontWeight: 700, fontFamily: 'Inter, monospace', color: reached ? '#fbbf24' : isNext ? '#42a5f5' : '#3a3a4a', textAlign: 'center', whiteSpace: 'nowrap' }}>${CP_LABELS[cp]}</div>
    </div>
  )
}

// Log-scale milestone positions so early milestones don't overlap
const MILESTONE_PCT = {
  1000: 5,
  5000: 15,
  10000: 25,
  25000: 40,
  50000: 55,
  100000: 70,
  150000: 85,
  200000: 100,
}

function getLogPct(pnl) {
  // Map pnl to the same log scale as milestones
  if (pnl <= 0) return 0
  if (pnl >= JOURNEY_GOAL) return 100
  const cps = Object.keys(MILESTONE_PCT).map(Number).sort((a, b) => a - b)
  for (let i = 0; i < cps.length; i++) {
    if (pnl <= cps[i]) {
      const prev = i === 0 ? 0 : cps[i - 1]
      const prevPct = i === 0 ? 0 : MILESTONE_PCT[prev]
      const curPct = MILESTONE_PCT[cps[i]]
      const ratio = (pnl - prev) / (cps[i] - prev)
      return prevPct + ratio * (curPct - prevPct)
    }
  }
  return 100
}

function ProgressSection({ journey, ps, curve, personalBests, stage }) {
  const logPct = getLogPct(journey.cumulativePnl)
  const pct = Math.min(100, Math.max(0, logPct))
  const realPct = Math.min(100, Math.max(0, journey.progressPercent))
  const grad = getProgressGradient(realPct)
  const showInside = pct > 12
  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* 캐릭터 위 영역 */}
      <div style={{ position: 'relative', height: 105, marginBottom: 4 }}>
        <div style={{
          position: 'absolute', left: `${Math.max(5, Math.min(95, pct))}%`, bottom: 0,
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10,
        }}>
          <div style={{ background: 'rgba(26,26,46,0.92)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 10px', marginBottom: 4, whiteSpace: 'nowrap', position: 'relative' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: journey.cumulativePnl >= 0 ? GREEN : RED, fontFamily: 'Inter, monospace', textAlign: 'center' }}>{fmtPnl(journey.cumulativePnl)}</div>
            {journey.nextCpRemaining > 0 && <div style={{ fontSize: 9, color: '#9e9e9e', fontFamily: 'Inter, monospace', textAlign: 'center', lineHeight: 1.7 }}>다음까지 {fmtK(journey.nextCpRemaining)}</div>}
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '4px solid rgba(255,255,255,0.15)' }} />
          </div>
          {/* 캐릭터 (65px, 오른쪽 바라봄) */}
          <div className="char-bounce">
            <VectorChar stage={stage} height={65} faceRight />
          </div>
        </div>
      </div>

      {/* 프로그레스 바 */}
      <div style={{ position: 'relative', height: 50 }}>
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: 40,
          transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.05)',
          borderRadius: 20, border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: grad, borderRadius: 20, boxShadow: '0 0 12px rgba(255,215,0,0.3)', transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)', borderRadius: 20 }} />
            <div className="progress-shimmer" style={{ position: 'absolute', inset: 0, borderRadius: 20, overflow: 'hidden' }} />
          </div>
          {showInside ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, fontFamily: 'Inter, monospace', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)', zIndex: 5 }}>{realPct.toFixed(2)}%</div>
          ) : (
            <div style={{ position: 'absolute', top: '50%', left: `${pct + 2}%`, transform: 'translateY(-50%)', fontSize: 11, fontWeight: 800, fontFamily: 'Inter, monospace', color: '#9e9e9e', zIndex: 5, whiteSpace: 'nowrap' }}>{realPct.toFixed(2)}%</div>
          )}
        </div>
        {CHECKPOINTS.map(cp => (
          <MilestoneMarker key={cp} cp={cp} reached={journey.cumulativePnl >= cp} isNext={journey.nextCheckpoint === cp} pct={MILESTONE_PCT[cp] || (cp / JOURNEY_GOAL) * 100} cumulativePnl={journey.cumulativePnl} curve={curve} personalBests={personalBests} />
        ))}
      </div>
    </div>
  )
}

// ─── Personal Bests ──────────────────────────────────────────────────────────

function computePersonalBests(allTimeAnalytics) {
  const curve = allTimeAnalytics?.equity_curve ?? []
  if (curve.length === 0) return null
  let bestDayPnl = 0, bestDayDate = null, longestWinStreak = 0, cs = 0
  for (let i = 0; i < curve.length; i++) {
    const prev = i > 0 ? curve[i-1].cumulative_pnl : 0, delta = curve[i].cumulative_pnl - prev
    if (delta > bestDayPnl) { bestDayPnl = delta; bestDayDate = curve[i].date }
    if (delta > 0) { cs++; if (cs > longestWinStreak) longestWinStreak = cs } else if (delta < 0) cs = 0
  }
  let estimatedDate = null
  const cum = curve[curve.length-1]?.cumulative_pnl ?? 0
  if (curve[0]?.date && curve[curve.length-1]?.date && cum > 0) {
    const d = Math.max(1, (new Date(curve[curve.length-1].date) - new Date(curve[0].date)) / 86400000), pd = cum / d
    if (pd > 0) { const t = new Date(new Date(curve[curve.length-1].date).getTime() + ((JOURNEY_GOAL-cum)/pd)*86400000); estimatedDate = `${t.getFullYear()}년 ${t.getMonth()+1}월` }
  }
  return { bestDayPnl, bestDayDate, longestWinStreak, estimatedDate }
}

// ─── Celebration Modal ───────────────────────────────────────────────────────

function CelebrationModal({ stage, onClose }) {
  const current = STAGES[stage], prev = STAGES[Math.max(0, stage - 1)]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="celebration-bounce-in" onClick={e => e.stopPropagation()} style={{ background: '#1a1a2e', borderRadius: 16, border: `2px solid ${GREEN}40`, padding: 32, maxWidth: 400, width: '90%', textAlign: 'center', boxShadow: `0 0 60px ${GREEN}20`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 30 }).map((_, i) => <div key={i} className="confetti-piece" style={{ '--delay': `${i*0.1}s`, '--x': `${(i*13)%100}%`, '--rotation': `${(i*47)%720}deg`, '--color': ['#fbbf24','#00c853','#42a5f5','#ff1744','#a78bfa','#f472b6'][i%6] }} />)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, marginBottom: 20, position: 'relative', zIndex: 1 }}>
          <div className="celebration-fade-out" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VectorChar stage={Math.max(0, stage-1)} height={60} />
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{prev.label}</div>
          </div>
          <div style={{ fontSize: 24, color: '#fbbf24' }}>→</div>
          <div className="celebration-glow-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VectorChar stage={stage} height={60} />
            <div style={{ fontSize: 10, color: '#e0e0e0', marginTop: 4, fontFamily: 'Inter, monospace', fontWeight: 700, lineHeight: 1.7 }}>{current.label}</div>
          </div>
        </div>
        <div style={{ fontSize: 24, marginBottom: 8, position: 'relative', zIndex: 1 }}>🎉</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace', marginBottom: 8, position: 'relative', zIndex: 1 }}>{fmtK(current.cp)} 달성!</div>
        <div style={{ fontSize: 13, color: '#9e9e9e', marginBottom: 4, position: 'relative', zIndex: 1, lineHeight: 1.7 }}>{current.badge}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, position: 'relative', zIndex: 1, lineHeight: 1.7 }}>{current.reward}</div>
        <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: `${GREEN}20`, color: GREEN, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, monospace', position: 'relative', zIndex: 1 }}>확인</button>
      </div>
    </div>
  )
}

// ─── Evolution Timeline ──────────────────────────────────────────────────────

function EvolutionTimeline({ journey, curve }) {
  const [open, setOpen] = useState(false)
  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length
  const milestones = useMemo(() => {
    const startDate = curve?.[0]?.date || null
    return STAGES.slice(1).map((st, i) => {
      let achievedDate = null, daysSinceStart = null
      if (curve && journey.cumulativePnl >= st.cp) { for (const p of curve) { if (p.cumulative_pnl >= st.cp) { achievedDate = p.date; if (startDate) daysSinceStart = Math.round((new Date(p.date) - new Date(startDate)) / 86400000); break } } }
      return { ...st, reached: journey.cumulativePnl >= st.cp, achievedDate, daysSinceStart, idx: i + 1 }
    })
  }, [journey, curve])

  return (
    <div style={{ background: '#1a1a2e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>변신 기록</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', fontFamily: 'Inter, monospace', background: 'rgba(251,191,36,0.1)', borderRadius: 6, padding: '2px 8px' }}>{reachedCount}/{CHECKPOINTS.length}</span>
        </div>
        <span style={{ fontSize: 12, color: '#6b7280', transition: 'transform 0.3s', transform: open ? 'rotate(180deg)' : 'rotate(0)', display: 'inline-block' }}>▼</span>
      </div>
      {open && (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{ position: 'absolute', left: 8, top: 4, bottom: 4, width: 2, background: 'rgba(255,255,255,0.06)' }} />
            {milestones.map((ms, i) => (
              <div key={ms.cp} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < milestones.length - 1 ? 16 : 0, position: 'relative' }}>
                <div style={{ position: 'absolute', left: -24, top: 3, width: 12, height: 12, borderRadius: '50%', background: ms.reached ? GREEN : '#1a1a2e', border: ms.reached ? `2px solid ${GREEN}` : '2px solid #374151', zIndex: 1 }} />
                <div style={{ flex: 1 }}>
                  {ms.reached ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{ms.icon} {ms.badge}</span>
                        {ms.achievedDate && <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{ms.achievedDate}</span>}
                        {ms.daysSinceStart !== null && <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>(시작 후 {ms.daysSinceStart}일)</span>}
                      </div>
                      <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, lineHeight: 1.7 }}>{ms.reward}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#374151', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>??? — {fmtK(ms.cp)} 도달 시 해금</span>
                      <span style={{ fontSize: 10, color: '#374151' }}>🔒</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Reset Modal ─────────────────────────────────────────────────────────────

function ResetModal({ stage, onConfirm, onCancel }) {
  const current = STAGES[stage], initial = STAGES[0]
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a2e', borderRadius: 16, border: `1px solid ${RED}30`, padding: 28, maxWidth: 380, width: '90%', textAlign: 'center', boxShadow: `0 0 40px ${RED}15` }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#e0e0e0', marginBottom: 12, fontFamily: 'Inter, monospace' }}>정말 리셋하시겠습니까?</div>
        <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 16, lineHeight: 1.7 }}>모든 마일스톤 달성 기록과 캐릭터 진화가 초기화됩니다.</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '12px 0', marginBottom: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VectorChar stage={stage} height={50} />
            <div style={{ fontSize: 10, color: '#e0e0e0', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{current.icon} {current.label}</div>
          </div>
          <div style={{ fontSize: 16, color: RED }}>→</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VectorChar stage={0} height={50} />
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>{initial.icon} {initial.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9e9e9e', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, monospace' }}>취소</button>
          <button onClick={onConfirm} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: RED, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, monospace' }}>리셋</button>
        </div>
      </div>
    </div>
  )
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function ConfettiEffect({ active }) {
  if (!active) return null
  return (
    <div className="confetti-container" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20 }}>
      {Array.from({ length: 25 }).map((_, i) => <div key={i} className="confetti-piece" style={{ '--delay': `${i*0.12}s`, '--x': `${(i*17)%100}%`, '--rotation': `${(i*53)%720}deg`, '--color': ['#fbbf24','#00c853','#42a5f5','#ff1744','#a78bfa','#f472b6'][i%6] }} />)}
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

  useEffect(() => {
    const lastStage = Number(localStorage.getItem(LAST_STAGE_KEY) || '0')
    if (stage > lastStage && stage > 0) {
      setCelebrationStage(stage); setShowConfetti(true)
      const ms = JSON.parse(localStorage.getItem(MILESTONE_STORAGE_KEY) || '{}')
      if (!ms[stage]) { ms[stage] = new Date().toISOString().slice(0, 10); localStorage.setItem(MILESTONE_STORAGE_KEY, JSON.stringify(ms)) }
      localStorage.setItem(LAST_STAGE_KEY, String(stage))
      const t = setTimeout(() => setShowConfetti(false), 3000); return () => clearTimeout(t)
    } else if (stage !== lastStage) localStorage.setItem(LAST_STAGE_KEY, String(stage))
  }, [stage])

  const handleReset = useCallback(() => { localStorage.removeItem(MILESTONE_STORAGE_KEY); localStorage.removeItem(LAST_STAGE_KEY); setShowResetModal(false) }, [])
  const stageInfo = STAGES[stage]

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', position: 'relative', border: `1px solid ${ps.color}30`, boxShadow: `0 0 40px ${ps.color}08` }}>
      <StageBackground stage={stage} />
      <ConfettiEffect active={showConfetti} />
      {celebrationStage !== null && <CelebrationModal stage={celebrationStage} onClose={() => setCelebrationStage(null)} />}
      {showResetModal && <ResetModal stage={stage} onConfirm={handleReset} onCancel={() => setShowResetModal(false)} />}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#5a5a6a', letterSpacing: '0.14em', fontFamily: 'Inter, monospace' }}>JOURNEY TO $200K</span>
          <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'Inter, monospace', color: ps.color, background: `${ps.color}12`, border: `1px solid ${ps.color}30`, borderRadius: 6, padding: '3px 10px', letterSpacing: '0.1em' }}>{ps.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, fontFamily: 'Inter, monospace', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 6, padding: '3px 10px' }}>{stageInfo?.badge || '🚀 시작'}</div>
          <button onClick={() => setShowResetModal(true)} style={{ fontSize: 9, fontWeight: 600, fontFamily: 'Inter, monospace', color: '#4b5563', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', transition: 'color 0.2s' }}
            onMouseEnter={e => e.target.style.color = RED} onMouseLeave={e => e.target.style.color = '#4b5563'}>RESET</button>
        </div>
      </div>

      {/* 메인 영역: 왼쪽 프로필 + 오른쪽 배경+프로그레스 */}
      <div style={{ display: 'flex', gap: 16, padding: '16px', position: 'relative', zIndex: 1, minHeight: 200 }}>
        {/* 왼쪽 프로필 카드 (20%) */}
        <div style={{ width: '20%', maxWidth: 200, flexShrink: 0 }}>
          <CharacterProfileCard stage={stage} journey={journey} />
        </div>
        {/* 오른쪽 프로그레스 영역 (75%) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px' }}>
          <ProgressSection journey={journey} ps={ps} curve={curve} personalBests={personalBests} stage={stage} />
        </div>
      </div>

      {/* 스탯 카드 */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px 12px' }}>
        <StatCards journey={journey} ps={ps} />
      </div>

      {/* 뱃지 */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px 12px' }}>
        <BadgeRow journey={journey} personalBests={personalBests} curve={curve} />
      </div>

      {/* 변신 기록 */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px 16px' }}>
        <EvolutionTimeline journey={journey} curve={curve} />
      </div>

      <style>{`
        .char-bounce { animation: charBounce 1.2s ease-in-out infinite; }
        @keyframes charBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

        .ms-reached { animation: msGlow 2s ease-in-out infinite; }
        .ms-next { animation: msNextSpin 4s linear infinite; }
        @keyframes msGlow { 0%,100% { box-shadow: 0 0 12px rgba(255,215,0,0.4); } 50% { box-shadow: 0 0 20px rgba(255,215,0,0.6); } }
        @keyframes msNextSpin { 0% { border-color: rgba(66,165,245,0.5); } 50% { border-color: rgba(66,165,245,0.2); } 100% { border-color: rgba(66,165,245,0.5); } }

        .progress-shimmer::after { content: ''; position: absolute; top: 0; left: -100%; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent); animation: shimmer 2s infinite; }
        @keyframes shimmer { 0% { left: -100%; } 100% { left: 200%; } }

        .flicker-light { animation: flicker 3s ease-in-out infinite; }
        @keyframes flicker { 0%,100% { opacity: 0.8; } 40% { opacity: 0.4; } 70% { opacity: 0.9; } }

        .water-glow { animation: waterGlow 4s ease-in-out infinite; }
        @keyframes waterGlow { 0%,100% { opacity: 0.06; } 50% { opacity: 0.14; } }

        .palm-sway { animation: palmSway 5s ease-in-out infinite; transform-origin: bottom center; }
        @keyframes palmSway { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(3deg); } }

        .star-twinkle { animation: starTwinkle 3s ease-in-out infinite; }
        .star-twinkle-2 { animation: starTwinkle 3s ease-in-out infinite 1.5s; }
        @keyframes starTwinkle { 0%,100% { opacity: 0.3; } 50% { opacity: 0.8; } }

        .neon-pulse { animation: neonPulse 3s ease-in-out infinite; }
        .neon-pulse-2 { animation: neonPulse 3s ease-in-out infinite 1.5s; }
        @keyframes neonPulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.6; } }

        .steam-anim { animation: steamRise 2s ease-out infinite; }
        .steam-anim-2 { animation: steamRise 2s ease-out infinite 0.5s; }
        @keyframes steamRise { 0% { opacity: 0.3; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-4px); } }

        .confetti-container .confetti-piece { position: absolute; top: -10px; left: var(--x); width: 6px; height: 6px; background: var(--color); border-radius: 1px; animation: confettiFall 3s var(--delay) ease-out forwards; opacity: 0; }
        @keyframes confettiFall { 0% { opacity: 1; transform: translateY(0) rotate(0) scale(1); } 50% { opacity: 1; } 100% { opacity: 0; transform: translateY(400px) rotate(var(--rotation)) scale(0.5); } }

        .badge-hover:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }

        .celebration-bounce-in { animation: celebBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes celebBounce { 0% { transform: scale(0.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .celebration-fade-out { animation: celebFade 1.5s ease-out forwards; }
        @keyframes celebFade { 0% { opacity: 1; filter: brightness(1); } 60% { opacity: 1; filter: brightness(2); } 100% { opacity: 0.3; filter: brightness(0.5); } }
        .celebration-glow-in { animation: celebGlow 1.5s ease-out forwards; }
        @keyframes celebGlow { 0% { opacity: 0; filter: brightness(3); transform: scale(0.5); } 50% { opacity: 0.8; filter: brightness(2); transform: scale(1.1); } 100% { opacity: 1; filter: brightness(1); transform: scale(1); } }
      `}</style>
    </div>
  )
}
