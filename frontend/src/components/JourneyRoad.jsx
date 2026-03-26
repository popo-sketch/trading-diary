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

// ─── Vector Character (clean chibi SVG) ──────────────────────────────────────

function VectorChar({ stage, height = 64, faceRight = true }) {
  const size = height
  // Stage-specific colors: top, bottom, shoe, hair, extras
  const configs = [
    // $0: 흰 민소매 + 회색 반바지 + 슬리퍼
    { top: '#e8e8e8', bottom: '#8a8a96', shoe: '#a09080', hair: '#5D4037' },
    // $1K: 파란 티셔츠 + 남색 청바지 + 흰 운동화
    { top: '#4a90d9', bottom: '#1a237e', shoe: 'white', hair: '#5D4037' },
    // $5K: 검정 후드티 + 회색 조거팬츠
    { top: '#2a2a2a', bottom: '#4a4a54', shoe: '#1a1a1a', hair: '#5D4037' },
    // $10K: 흰 셔츠 + 베이지 슬랙스 + 갈색 구두
    { top: '#eeeeee', bottom: '#c4a882', shoe: '#6b4226', hair: '#5D4037' },
    // $25K: 검정 가죽자켓 + 검정 바지
    { top: '#1a1a1a', bottom: '#1a1a1a', shoe: '#2a2a2a', hair: '#5D4037' },
    // $50K: 남색 정장 + 흰 셔츠
    { top: '#1a2040', bottom: '#1a2040', shoe: '#2a2a2a', hair: '#5D4037' },
    // $100K: 베이지 코트 + 검정 슬랙스
    { top: '#c4a870', bottom: '#1e1e28', shoe: '#3a2a1a', hair: '#5D4037' },
    // $150K: 검정 풀 수트
    { top: '#111118', bottom: '#111118', shoe: '#1a1a1a', hair: '#5D4037' },
    // $200K: 하와이안 셔츠 + 반바지 + 샌들
    { top: '#d94040', bottom: '#4a7ab0', shoe: '#c49060', hair: '#5D4037' },
  ]
  const c = configs[stage] || configs[0]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64"
      style={{ overflow: 'visible', display: 'block', transform: faceRight ? 'scaleX(-1)' : 'none' }}>
      {/* Hair */}
      <ellipse cx="32" cy="18" rx="14" ry="5" fill={c.hair} />
      {/* Head */}
      <circle cx="32" cy="22" r="12" fill="#FFCC80" />
      {/* Eyes */}
      <ellipse cx="27" cy="21" rx="2" ry="2.5" fill="#333" />
      <ellipse cx="37" cy="21" rx="2" ry="2.5" fill="#333" />
      <circle cx="28" cy="20" r="0.8" fill="white" />
      <circle cx="38" cy="20" r="0.8" fill="white" />
      {/* Mouth */}
      <path d="M28 27 Q32 31 36 27" stroke="#333" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Body / Top */}
      <rect x="22" y="34" width="20" height="14" fill={c.top} rx="3" />
      {/* Neck */}
      <rect x="29" y="32" width="6" height="4" fill="#FFCC80" />
      {/* Arms */}
      <rect x="16" y="35" width="7" height="4" fill={c.top} rx="2" />
      <rect x="14" y="35" width="4" height="4" fill="#FFCC80" rx="2" />
      <rect x="41" y="35" width="7" height="4" fill={c.top} rx="2" />
      <rect x="46" y="35" width="4" height="4" fill="#FFCC80" rx="2" />
      {/* Legs */}
      <rect x="23" y="48" width="8" height="10" fill={c.bottom} rx="2" />
      <rect x="33" y="48" width="8" height="10" fill={c.bottom} rx="2" />
      {/* Shoes */}
      <rect x="22" y="57" width="10" height="4" fill={c.shoe} rx="2" />
      <rect x="32" y="57" width="10" height="4" fill={c.shoe} rx="2" />
      {/* Stage-specific accessories */}
      {stage === 1 && (
        <g>{/* Coffee cup */}
          <rect x="46" y="32" width="5" height="8" fill="#8B4513" rx="1" />
          <rect x="45" y="31" width="7" height="2" fill="#D7CCC8" rx="1" />
        </g>
      )}
      {stage === 2 && (
        <g>{/* Airpods */}
          <circle cx="17" cy="22" r="1.8" fill="#f0f0f0" />
          <line x1="17" y1="24" x2="17" y2="27" stroke="#e0e0e0" strokeWidth="0.7" />
        </g>
      )}
      {stage === 3 && (
        <g>{/* Gold watch */}
          <rect x="46" y="36" width="4" height="3" rx="1" fill="#c0a040" />
          <rect x="47" y="36.5" width="2" height="2" rx="0.5" fill="#1a1a2a" />
        </g>
      )}
      {stage === 4 && (
        <g>{/* Sunglasses */}
          <rect x="23" y="19" width="7" height="4" rx="2" fill="#1a1a1a" opacity="0.85" />
          <rect x="34" y="19" width="7" height="4" rx="2" fill="#1a1a1a" opacity="0.85" />
          <line x1="30" y1="21" x2="34" y2="21" stroke="#1a1a1a" strokeWidth="0.8" />
        </g>
      )}
      {stage === 5 && (
        <g>{/* Red tie */}
          <polygon points="31,34 33,34 33.5,44 32,46 30.5,44" fill="#cc2020" />
          <rect x="46" y="36" width="4" height="3" rx="1" fill="#daa520" />
        </g>
      )}
      {stage === 6 && (
        <g>{/* Scarf */}
          <path d="M24 34 Q32 37 40 34" fill="none" stroke="#8a7050" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="40" y1="34" x2="42" y2="42" stroke="#8a7050" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
      {stage === 7 && (
        <g>{/* Briefcase */}
          <rect x="46" y="40" width="10" height="7" rx="1.5" fill="#2a2a2a" />
          <rect x="49" y="38.5" width="4" height="2.5" rx="1" fill="none" stroke="#3a3a3a" strokeWidth="0.7" />
          <circle cx="51" cy="43.5" r="0.5" fill="#c0a040" />
        </g>
      )}
      {stage === 8 && (
        <g>{/* Sunglasses + flowers on shirt */}
          <rect x="23" y="19" width="7" height="4" rx="2" fill="#2a2a2a" opacity="0.8" />
          <rect x="34" y="19" width="7" height="4" rx="2" fill="#2a2a2a" opacity="0.8" />
          <line x1="30" y1="21" x2="34" y2="21" stroke="#2a2a2a" strokeWidth="0.8" />
          <circle cx="26" cy="39" r="1.5" fill="#ffcc44" opacity="0.7" />
          <circle cx="34" cy="37" r="1.2" fill="#44cc88" opacity="0.6" />
          <circle cx="38" cy="42" r="1.3" fill="#ffcc44" opacity="0.6" />
        </g>
      )}
    </svg>
  )
}

// ─── Stage Backgrounds (은은한 실루엣 파노라마) ──────────────────────────────

const STAGE_BG = [
  { grad: 'linear-gradient(180deg, #0a0a14 0%, #15151f 40%, #0d0d14 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #0a0a16 0%, #14141e 40%, #0f0f16 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #0a0e18 0%, #0f1422 40%, #0a0e18 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #1a1410 0%, #201810 40%, #1a1410 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #0a0a1a 0%, #14102a 40%, #0a0a1a 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #060818 0%, #0a1028 40%, #060818 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #08081a 0%, #0e0e28 40%, #08081a 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #1a1008 0%, #2a1810 40%, #1a1008 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
  { grad: 'linear-gradient(180deg, #081820 0%, #0a2030 40%, #081820 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.35), rgba(13,13,26,0.55))' },
]

/* Helpers removed — each stage now has its own full inline SVG scene */

function StageBackground({ stage }) {
  const bg = STAGE_BG[stage] || STAGE_BG[0]

  /* Helper functions inline */
  const star = (cx, cy, r, dur) => (
    <circle cx={cx} cy={cy} r={r} fill="white" opacity="0.3">
      <animate attributeName="opacity" values="0.2;0.5;0.2" dur={dur} repeatCount="indefinite"/>
    </circle>
  )
  const streetlight = (x, topY, baseY = 290) => (
    <g>
      <rect x={x-1} y={topY} width="3" height={baseY-topY} fill="#2a2a4a"/>
      <rect x={x-10} y={topY-3} width="25" height="5" fill="#2a2a4a" rx="2"/>
      <circle cx={x+1} cy={topY-5} r="5" fill="rgba(255,200,100,0.4)"/>
      <ellipse cx={x+1} cy={baseY} rx="30" ry="5" fill="rgba(255,200,100,0.04)"/>
    </g>
  )
  const bldg = (x, y, w, h, fill = '#0d0d25', wRows = 3, wCols = 2) => {
    const wins = []
    for (let r = 0; r < wRows; r++) for (let c = 0; c < wCols; c++) {
      const lit = (r * 3 + c * 7) % 5 !== 0
      wins.push(<rect key={`${r}-${c}`} x={x + 10 + c * 18} y={y + 15 + r * 22} width="12" height="12" fill={lit ? 'rgba(255,213,79,0.2)' : 'rgba(255,213,79,0.05)'} rx="1"/>)
    }
    return <g><rect x={x} y={y} width={w} height={h} fill={fill} rx="2"/>{wins}</g>
  }

  const scenes = {
    0: ( // $0 고시원 골목
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <defs><linearGradient id="sky0" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0a2e"/><stop offset="100%" stopColor="#1a1a3e"/></linearGradient></defs>
        <rect width="1200" height="300" fill="url(#sky0)"/>
        {star(80,25,1,'3s')}{star(250,15,1.5,'4s')}{star(500,35,1,'2.5s')}{star(700,20,1.5,'3.5s')}{star(950,30,1,'2s')}
        {/* 좁은 골목 벽 */}
        <rect x="0" y="60" width="180" height="240" fill="#0c0c22" rx="2"/>
        <rect x="15" y="80" width="10" height="10" fill="rgba(255,213,79,0.15)" rx="1"/>
        <rect x="40" y="80" width="10" height="10" fill="rgba(255,213,79,0.08)" rx="1"/>
        <rect x="15" y="110" width="10" height="10" fill="rgba(255,213,79,0.1)" rx="1"/>
        <rect x="40" y="110" width="10" height="10" fill="rgba(255,213,79,0.18)" rx="1"/>
        <rect x="15" y="140" width="10" height="10" fill="rgba(255,213,79,0.06)" rx="1"/>
        {/* 에어컨 실외기 */}
        <rect x="100" y="130" width="30" height="20" fill="#1a1a30" rx="2"/>
        <rect x="103" y="133" width="24" height="14" fill="#0d0d20" rx="1"/>
        <line x1="107" y1="135" x2="107" y2="145" stroke="#2a2a40" strokeWidth="1"/>
        <line x1="113" y1="135" x2="113" y2="145" stroke="#2a2a40" strokeWidth="1"/>
        <line x1="119" y1="135" x2="119" y2="145" stroke="#2a2a40" strokeWidth="1"/>
        {/* 빨래줄 */}
        <path d="M180,100 Q350,120 500,95" fill="none" stroke="#2a2a45" strokeWidth="0.8"/>
        <rect x="240" y="105" width="8" height="14" fill="#2a2a45" rx="1"/>
        <rect x="320" y="112" width="10" height="12" fill="#2a2a45" rx="1"/>
        <rect x="400" y="100" width="7" height="13" fill="#2a2a45" rx="1"/>
        {/* 반대쪽 벽 */}
        <rect x="1000" y="50" width="200" height="250" fill="#0e0e24" rx="2"/>
        <rect x="1020" y="70" width="10" height="10" fill="rgba(255,213,79,0.12)" rx="1"/>
        <rect x="1050" y="70" width="10" height="10" fill="rgba(255,213,79,0.06)" rx="1"/>
        <rect x="1020" y="100" width="10" height="10" fill="rgba(255,213,79,0.1)" rx="1"/>
        {/* 가로등 */}
        {streetlight(220, 80)}
        {streetlight(750, 90)}
        {/* 쓰레기통 */}
        <rect x="600" y="250" width="25" height="35" fill="#1a1a30" rx="2"/>
        <rect x="598" y="248" width="29" height="5" fill="#222240" rx="2"/>
        {/* 갈라진 바닥 */}
        <line x1="0" y1="290" x2="1200" y2="290" stroke="#2a2a4a" strokeWidth="0.5"/>
        <path d="M400,290 L420,298 L440,292" fill="none" stroke="#2a2a3a" strokeWidth="0.5"/>
        <path d="M700,290 L715,296 L730,291" fill="none" stroke="#2a2a3a" strokeWidth="0.5"/>
        {/* 🐱 골목 고양이 — 쓰레기통 위 */}
        <g transform="translate(603, 230)" opacity="0.2">
          <ellipse cx="8" cy="10" rx="6" ry="5" fill="#4a4a6a"/>
          <circle cx="8" cy="4" r="4" fill="#4a4a6a"/>
          <polygon points="5,1 4,-3 7,0" fill="#4a4a6a"/>
          <polygon points="11,1 12,-3 9,0" fill="#4a4a6a"/>
          <circle cx="6" cy="3.5" r="0.8" fill="#aaffaa" opacity="0.5"/>
          <circle cx="10" cy="3.5" r="0.8" fill="#aaffaa" opacity="0.5"/>
          <path d="M14,10 Q18,8 20,12" stroke="#4a4a6a" strokeWidth="1.5" fill="none">
            <animateTransform attributeName="transform" type="rotate" values="-5,14,10;5,14,10;-5,14,10" dur="3s" repeatCount="indefinite"/>
          </path>
        </g>
        {/* 🐀 쥐 — 골목 구석 */}
        <g transform="translate(160, 280)" opacity="0.15">
          <ellipse cx="5" cy="4" rx="4" ry="3" fill="#3a3a5a"/>
          <circle cx="2" cy="2" r="2" fill="#3a3a5a"/>
          <path d="M9,4 Q13,2 15,5" stroke="#3a3a5a" strokeWidth="0.8" fill="none"/>
        </g>
      </svg>
    ),
    1: ( // $1K 편의점 앞 밤거리
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.35,pointerEvents:'none'}}>
        <defs><linearGradient id="sky1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0a2e"/><stop offset="100%" stopColor="#1a1a3e"/></linearGradient></defs>
        <rect width="1200" height="300" fill="url(#sky1)"/>
        {/* 달 */}
        <circle cx="1050" cy="45" r="20" fill="#ffd54f" opacity="0.3"/>
        <circle cx="1058" cy="40" r="17" fill="#0a0a2e"/>
        {star(100,30,1,'3s')}{star(300,20,1.5,'4s')}{star(500,40,1,'2.5s')}{star(750,15,1.5,'3.5s')}{star(900,35,1,'2s')}{star(650,25,1,'4.5s')}
        {/* 왼쪽 아파트 */}
        <rect x="50" y="80" width="120" height="220" fill="#0d0d25" rx="2"/>
        <rect x="65" y="100" width="12" height="12" fill="#ffd54f" opacity="0.2" rx="1"/>
        <rect x="90" y="100" width="12" height="12" fill="#ffd54f" opacity="0.15" rx="1"/>
        <rect x="115" y="100" width="12" height="12" fill="#ffd54f" opacity="0.1" rx="1"/>
        <rect x="65" y="130" width="12" height="12" fill="#ffd54f" opacity="0.1" rx="1"/>
        <rect x="90" y="130" width="12" height="12" fill="#ffd54f" opacity="0.2" rx="1"/>
        <rect x="65" y="160" width="12" height="12" fill="#ffd54f" opacity="0.15" rx="1"/>
        <rect x="115" y="160" width="12" height="12" fill="#ffd54f" opacity="0.1" rx="1"/>
        {/* 편의점 */}
        <rect x="250" y="140" width="200" height="160" fill="#111130" rx="2"/>
        <rect x="260" y="145" width="180" height="20" fill="#1a3a5c" opacity="0.3"/>
        <rect x="280" y="175" width="60" height="80" fill="rgba(255,220,150,0.06)" rx="1"/>
        <rect x="360" y="175" width="60" height="80" fill="rgba(255,220,150,0.06)" rx="1"/>
        <rect x="320" y="210" width="30" height="50" fill="rgba(255,220,150,0.08)" rx="1"/>
        <ellipse cx="350" cy="295" rx="100" ry="8" fill="rgba(255,220,150,0.03)"/>
        {/* 가로등 */}
        {streetlight(220, 120)}
        {streetlight(520, 130)}
        {/* 자판기 */}
        <rect x="460" y="210" width="30" height="50" fill="#1a1a40" rx="2"/>
        <rect x="463" y="215" width="24" height="15" fill="rgba(100,180,255,0.1)" rx="1"/>
        <rect x="463" y="235" width="24" height="15" fill="rgba(255,100,100,0.08)" rx="1"/>
        {/* 오른쪽 상가 */}
        <rect x="600" y="160" width="150" height="140" fill="#0e0e28" rx="2"/>
        <rect x="610" y="165" width="60" height="12" fill="#3a1a4a" opacity="0.2" rx="1"/>
        <rect x="620" y="190" width="40" height="50" fill="rgba(255,220,150,0.04)" rx="1"/>
        <rect x="690" y="190" width="40" height="50" fill="rgba(255,220,150,0.03)" rx="1"/>
        {/* 먼 빌딩 */}
        <rect x="800" y="100" width="80" height="200" fill="#08081e" rx="1"/>
        <rect x="900" y="130" width="60" height="170" fill="#0a0a20" rx="1"/>
        <rect x="980" y="110" width="90" height="190" fill="#08081e" rx="1"/>
        <rect x="1080" y="140" width="70" height="160" fill="#0a0a22" rx="1"/>
        {/* 전봇대 + 전선 */}
        <rect x="559" y="70" width="3" height="230" fill="#1a1a3a"/>
        <line x1="220" y1="120" x2="560" y2="75" stroke="#1a1a3a" strokeWidth="0.5"/>
        <line x1="560" y1="80" x2="900" y2="110" stroke="#1a1a3a" strokeWidth="0.5"/>
        {/* 벤치 */}
        <rect x="480" y="270" width="35" height="3" fill="#2a2a4a" rx="1"/>
        <rect x="483" y="273" width="3" height="12" fill="#2a2a4a"/>
        <rect x="509" y="273" width="3" height="12" fill="#2a2a4a"/>
        <rect x="480" y="278" width="35" height="2" fill="#2a2a4a" rx="1"/>
        {/* 🐱 고양이 */}
        <g transform="translate(455, 268)" opacity="0.2">
          <ellipse cx="8" cy="10" rx="6" ry="5" fill="#4a4a6a"/>
          <circle cx="8" cy="4" r="4" fill="#4a4a6a"/>
          <polygon points="5,1 4,-3 7,0" fill="#4a4a6a"/>
          <polygon points="11,1 12,-3 9,0" fill="#4a4a6a"/>
          <circle cx="6" cy="3.5" r="0.8" fill="#aaffaa" opacity="0.5"/>
          <circle cx="10" cy="3.5" r="0.8" fill="#aaffaa" opacity="0.5"/>
          <path d="M14,10 Q18,8 20,12" stroke="#4a4a6a" strokeWidth="1.5" fill="none">
            <animateTransform attributeName="transform" type="rotate" values="-5,14,10;5,14,10;-5,14,10" dur="3s" repeatCount="indefinite"/>
          </path>
        </g>
        {/* 바닥 */}
        <line x1="0" y1="290" x2="1200" y2="290" stroke="#2a2a4a" strokeWidth="0.5"/>
        <line x1="0" y1="295" x2="1200" y2="295" stroke="#1a1a3a" strokeWidth="0.5"/>
      </svg>
    ),
    2: ( // $5K 원룸 책상
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <rect width="1200" height="300" fill="#10101a"/>
        {/* 창문 */}
        <rect x="850" y="20" width="180" height="120" rx="3" fill="#0a0a16" stroke="#22223a" strokeWidth="1.5"/>
        <line x1="940" y1="20" x2="940" y2="140" stroke="#22223a" strokeWidth="0.6"/>
        <line x1="850" y1="80" x2="1030" y2="80" stroke="#22223a" strokeWidth="0.6"/>
        {/* 창밖 빌딩 */}
        {[870,895,915,940,960,980,1000].map((x,i) => <rect key={x} x={x} y={40+(i%3)*10} width={6+i%3} height={25+(i%4)*8} fill={`rgba(100,150,220,0.1)`}/>)}
        {/* 달 (창밖) */}
        <circle cx="990" cy="40" r="8" fill="#ffd54f" opacity="0.15"/>
        {/* 듀얼 모니터 */}
        <rect x="250" y="110" width="140" height="90" rx="4" fill="#0d0d1a" stroke="rgba(66,165,245,0.25)" strokeWidth="1"/>
        <rect x="254" y="114" width="132" height="78" rx="2" fill="rgba(66,165,245,0.04)"/>
        <polyline points="270,170 290,150 310,160 330,140 350,155 370,135" fill="none" stroke="rgba(0,200,83,0.2)" strokeWidth="1"/>
        <rect x="420" y="110" width="140" height="90" rx="4" fill="#0d0d1a" stroke="rgba(66,165,245,0.18)" strokeWidth="1"/>
        <rect x="424" y="114" width="132" height="78" rx="2" fill="rgba(66,165,245,0.03)"/>
        {/* 모니터 스탠드 */}
        <rect x="305" y="200" width="30" height="6" rx="2" fill="#222236"/>
        <rect x="475" y="200" width="30" height="6" rx="2" fill="#222236"/>
        {/* 책상 */}
        <rect x="180" y="210" width="450" height="8" rx="2" fill="#222236"/>
        <rect x="200" y="218" width="8" height="60" fill="#1c1c30"/>
        <rect x="610" y="218" width="8" height="60" fill="#1c1c30"/>
        {/* 키보드 */}
        <rect x="340" y="220" width="80" height="20" rx="3" fill="#1a1a2e" stroke="#2a2a40" strokeWidth="0.5"/>
        {/* 커피잔 */}
        <rect x="610" y="195" width="18" height="15" rx="3" fill="#3a2a1a"/>
        <path d="M628,200 Q634,204 628,208" fill="none" stroke="#2a1a0a" strokeWidth="1"/>
        <path d="M616,192 Q618,186 620,192" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6"/>
        {/* 의자 */}
        <ellipse cx="400" cy="275" rx="35" ry="8" fill="#1a1a2e"/>
        <rect x="390" y="245" width="20" height="30" rx="3" fill="#1a1a2e"/>
        {/* 모니터 glow */}
        <ellipse cx="350" cy="250" rx="120" ry="20" fill="rgba(66,165,245,0.02)"/>
        {/* 🐱 책상 위 자는 고양이 */}
        <g transform="translate(155, 190)" opacity="0.18">
          <ellipse cx="12" cy="8" rx="10" ry="5" fill="#4a4a6a"/>
          <circle cx="4" cy="5" r="4" fill="#4a4a6a"/>
          <polygon points="1,2 0,-2 3,1" fill="#4a4a6a"/>
          <polygon points="7,2 8,-2 5,1" fill="#4a4a6a"/>
          <path d="M1,6 Q2,7 3,6" stroke="#2a2a4a" strokeWidth="0.5" fill="none"/>
        </g>
      </svg>
    ),
    3: ( // $10K 깔끔한 카페
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <rect width="1200" height="300" fill="#14120e"/>
        {/* 큰 창문 */}
        <rect x="700" y="15" width="420" height="150" rx="3" fill="#0e0e08" stroke="#2a2418" strokeWidth="1.5"/>
        <line x1="910" y1="15" x2="910" y2="165" stroke="#2a2418" strokeWidth="0.6"/>
        {/* 창밖 나무 */}
        <rect x="750" y="80" width="6" height="60" fill="#1e3018"/>
        <circle cx="753" cy="65" r="20" fill="#1e3818" opacity="0.4"/>
        <rect x="1050" y="90" width="5" height="50" fill="#1e3018"/>
        <circle cx="1053" cy="75" r="16" fill="#1e3818" opacity="0.3"/>
        {/* 창밖 차 불빛 */}
        <circle cx="850" cy="140" r="3" fill="rgba(255,200,100,0.15)"/>
        <circle cx="856" cy="140" r="3" fill="rgba(255,100,100,0.1)"/>
        {/* 천장 조명 1 */}
        <line x1="350" y1="0" x2="350" y2="15" stroke="#3a3020" strokeWidth="0.6"/>
        <circle cx="350" cy="18" r="8" fill="rgba(232,192,128,0.08)"/>
        <circle cx="350" cy="18" r="4" fill="rgba(232,192,128,0.15)"><animate attributeName="opacity" values="0.12;0.2;0.12" dur="3s" repeatCount="indefinite"/></circle>
        {/* 천장 조명 2 */}
        <line x1="600" y1="0" x2="600" y2="15" stroke="#3a3020" strokeWidth="0.6"/>
        <circle cx="600" cy="18" r="8" fill="rgba(232,192,128,0.08)"/>
        <circle cx="600" cy="18" r="4" fill="rgba(232,192,128,0.15)"><animate attributeName="opacity" values="0.12;0.2;0.12" dur="4s" repeatCount="indefinite"/></circle>
        <ellipse cx="350" cy="285" rx="80" ry="10" fill="rgba(232,192,128,0.03)"/>
        {/* 바닥 */}
        <rect x="0" y="220" width="1200" height="80" fill="#18150e"/>
        {/* 테이블+의자 */}
        <rect x="100" y="180" width="60" height="5" rx="2" fill="#302a1e"/>
        <rect x="108" y="185" width="5" height="35" fill="#28221a"/>
        <rect x="148" y="185" width="5" height="35" fill="#28221a"/>
        <rect x="80" y="165" width="30" height="55" rx="3" fill="#24201a"/>
        <rect x="170" y="165" width="30" height="55" rx="3" fill="#24201a"/>
        {/* 테이블 2 */}
        <rect x="400" y="190" width="50" height="5" rx="2" fill="#302a1e"/>
        <rect x="410" y="195" width="5" height="28" fill="#28221a"/>
        <rect x="435" y="195" width="5" height="28" fill="#28221a"/>
        {/* 🐕 카페 앞 강아지 */}
        <g transform="translate(660, 260)" opacity="0.18">
          <ellipse cx="12" cy="8" rx="8" ry="5" fill="#5a4a3a"/>
          <circle cx="4" cy="4" r="4" fill="#5a4a3a"/>
          <ellipse cx="2" cy="1" rx="2" ry="3" fill="#5a4a3a"/>
          <circle cx="3" cy="3.5" r="0.6" fill="#222"/>
          <path d="M20,8 Q24,6 26,10" stroke="#5a4a3a" strokeWidth="1.2" fill="none"/>
          {/* 리드줄 */}
          <line x1="12" y1="4" x2="30" y2="-10" stroke="#3a3a4a" strokeWidth="0.5"/>
        </g>
        {/* 🐦 참새 (창문 위) */}
        <g transform="translate(780, 10)" opacity="0.18">
          <ellipse cx="4" cy="4" rx="3" ry="2.5" fill="#5a4a3a"/>
          <circle cx="2" cy="2.5" r="1.5" fill="#5a4a3a"/>
          <path d="M0,2.5 L-1.5,2.5" stroke="#5a4a3a" strokeWidth="0.5"/>
        </g>
      </svg>
    ),
    4: ( // $25K 도심 거리
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <defs><linearGradient id="sky4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0a0a2e"/><stop offset="100%" stopColor="#12122a"/></linearGradient></defs>
        <rect width="1200" height="300" fill="url(#sky4)"/>
        {star(100,20,1,'3s')}{star(400,10,1.5,'4s')}{star(800,25,1,'2.5s')}
        {/* 빌딩들 */}
        <rect x="0" y="20" width="90" height="280" fill="#0c0c20"/>
        <rect x="100" y="50" width="70" height="250" fill="#0a0a1e"/>
        <rect x="180" y="30" width="80" height="270" fill="#0d0d22"/>
        <rect x="900" y="15" width="100" height="285" fill="#0c0c20"/>
        <rect x="1010" y="40" width="80" height="260" fill="#0a0a1e"/>
        <rect x="1100" y="25" width="100" height="275" fill="#0d0d22"/>
        {/* 창문 빛 */}
        {[20,45,120,200,920,950,1030,1060,1120,1150].map((x,i) => <rect key={x} x={x} y={60+(i%4)*35} width="10" height="10" fill={`rgba(255,213,79,${0.08+i%3*0.05})`} rx="1"/>)}
        {/* 네온사인 */}
        <rect x="30" y="70" width="40" height="8" fill="rgba(183,148,246,0.15)" rx="2"><animate attributeName="opacity" values="0.1;0.2;0.1" dur="3s" repeatCount="indefinite"/></rect>
        <rect x="930" y="60" width="50" height="8" fill="rgba(255,68,170,0.12)" rx="2"><animate attributeName="opacity" values="0.08;0.18;0.08" dur="4s" repeatCount="indefinite"/></rect>
        <rect x="1030" y="80" width="35" height="8" fill="rgba(66,165,245,0.12)" rx="2"><animate attributeName="opacity" values="0.08;0.16;0.08" dur="2.5s" repeatCount="indefinite"/></rect>
        <rect x="195" y="55" width="45" height="8" fill="rgba(0,200,83,0.1)" rx="2"/>
        {/* 횡단보도 */}
        <rect x="0" y="270" width="1200" height="30" fill="#0a0a16"/>
        {[400,420,440,460,480,500,520,540,560,580].map(x => <rect key={x} x={x} y="272" width="14" height="24" fill="rgba(255,255,255,0.06)" rx="1"/>)}
        {/* 택시 */}
        <rect x="650" y="265" width="50" height="18" rx="4" fill="#1a1a30"/>
        <rect x="655" y="260" width="40" height="8" rx="3" fill="#2a2a40"/>
        <circle cx="660" cy="283" r="4" fill="#1a1a2a"/>
        <circle cx="693" cy="283" r="4" fill="#1a1a2a"/>
        <circle cx="650" cy="270" r="3" fill="rgba(255,213,79,0.2)"/>
        {/* 간판들 */}
        <rect x="350" y="180" width="80" height="15" fill="rgba(255,100,100,0.08)" rx="2"/>
        <rect x="750" y="190" width="60" height="12" fill="rgba(100,200,255,0.08)" rx="2"/>
        {/* 가로등 */}
        {streetlight(330, 80)}
        {streetlight(700, 90)}
        {/* 🐕 산책 강아지 */}
        <g transform="translate(560, 262)" opacity="0.18">
          <ellipse cx="12" cy="6" rx="8" ry="4" fill="#4a4a5a"/>
          <circle cx="4" cy="3" r="3.5" fill="#4a4a5a"/>
          <rect x="5" y="10" width="3" height="6" rx="1" fill="#4a4a5a">
            <animate attributeName="height" values="6;4;6" dur="0.6s" repeatCount="indefinite"/>
          </rect>
          <rect x="15" y="10" width="3" height="6" rx="1" fill="#4a4a5a">
            <animate attributeName="height" values="4;6;4" dur="0.6s" repeatCount="indefinite"/>
          </rect>
        </g>
        {/* 🕊️ 비둘기 */}
        <g transform="translate(480, 267)" opacity="0.15">
          <ellipse cx="3" cy="3" rx="2.5" ry="2" fill="#5a5a6a"/>
          <circle cx="1" cy="2" r="1.2" fill="#5a5a6a"/>
        </g>
        <g transform="translate(510, 269)" opacity="0.13">
          <ellipse cx="3" cy="3" rx="2.5" ry="2" fill="#5a5a6a"/>
          <circle cx="1" cy="2" r="1.2" fill="#5a5a6a"/>
        </g>
      </svg>
    ),
    5: ( // $50K 한강 야경
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <defs><linearGradient id="sky5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#060818"/><stop offset="100%" stopColor="#0a1530"/></linearGradient></defs>
        <rect width="1200" height="300" fill="url(#sky5)"/>
        {star(80,15,1.5,'3s')}{star(300,10,1,'4s')}{star(550,20,1.5,'2.5s')}{star(800,12,1,'3.5s')}{star(1050,18,1.5,'2s')}
        {/* 달 */}
        <circle cx="1000" cy="35" r="15" fill="#ffd54f" opacity="0.2"/>
        <circle cx="1006" cy="31" r="12" fill="#060818"/>
        {/* 스카이라인 */}
        {[80,130,180,230,300,360,440,520,600,680,760,840,920,1000,1080].map((x,i) => <rect key={x} x={x} y={60+(i%3)*15} width={18+i%8} height={80-(i%3)*15} fill="#0c0c20"/>)}
        {/* 빌딩 창문 */}
        {[100,150,250,370,530,630,770,860,960,1040].map((x,i) => <rect key={x} x={x} y={75+(i*7)%30} width="4" height="4" fill={`rgba(255,213,79,${0.06+i%3*0.04})`}/>)}
        {/* 강물 */}
        <rect x="0" y="150" width="1200" height="150" fill="#0a1530"/>
        {/* 다리 */}
        <line x1="150" y1="140" x2="1050" y2="140" stroke="#161630" strokeWidth="6"/>
        {[250,370,490,610,730,850].map(x => <line key={x} x1={x} y1="140" x2={x} y2="150" stroke="#161630" strokeWidth="2"/>)}
        {/* 물결 */}
        <path d="M0,170 Q100,166 200,170 Q300,174 400,170 Q500,166 600,170 Q700,174 800,170 Q900,166 1000,170 Q1100,174 1200,170" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.6"/>
        <path d="M0,200 Q150,196 300,200 Q450,204 600,200 Q750,196 900,200 Q1050,204 1200,200" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="0.4"/>
        {/* 반사광 */}
        <ellipse cx="350" cy="200" rx="40" ry="4" fill="rgba(255,215,0,0.04)"><animate attributeName="opacity" values="0.03;0.06;0.03" dur="4s" repeatCount="indefinite"/></ellipse>
        <ellipse cx="700" cy="190" rx="50" ry="4" fill="rgba(255,215,0,0.03)"><animate attributeName="opacity" values="0.02;0.05;0.02" dur="5s" repeatCount="indefinite"/></ellipse>
        {/* 산책로 */}
        <rect x="0" y="260" width="1200" height="40" fill="#0c1525"/>
        {/* 나무 */}
        <rect x="100" y="230" width="6" height="30" fill="#1a2a18"/>
        <circle cx="103" cy="220" r="15" fill="#1a2a18" opacity="0.4"/>
        <rect x="500" y="235" width="5" height="25" fill="#1a2a18"/>
        <circle cx="503" cy="225" r="12" fill="#1a2a18" opacity="0.35"/>
        {/* 벤치 */}
        <rect x="300" y="265" width="40" height="4" rx="1" fill="#1a2a3a"/>
        <rect x="305" y="269" width="4" height="10" fill="#1a2a3a"/>
        <rect x="332" y="269" width="4" height="10" fill="#1a2a3a"/>
        {/* 🦆 오리 2마리 */}
        <g transform="translate(400, 175)" opacity="0.18">
          <ellipse cx="6" cy="4" rx="5" ry="3" fill="#3a4a5a"/>
          <circle cx="2" cy="2" r="2.5" fill="#3a4a5a"/>
          <path d="M0,2 L-2,2.5" stroke="#5a6a4a" strokeWidth="0.8"/>
          <animateTransform attributeName="transform" type="translate" values="400,175;402,174;400,175" dur="4s" repeatCount="indefinite"/>
        </g>
        <g transform="translate(430, 180)" opacity="0.16">
          <ellipse cx="5" cy="3.5" rx="4" ry="2.5" fill="#3a4a5a"/>
          <circle cx="1.5" cy="1.5" r="2" fill="#3a4a5a"/>
          <animateTransform attributeName="transform" type="translate" values="430,180;428,181;430,180" dur="5s" repeatCount="indefinite"/>
        </g>
        {/* 🐱 벤치 아래 고양이 */}
        <g transform="translate(310, 275)" opacity="0.16">
          <ellipse cx="8" cy="5" rx="6" ry="3" fill="#3a3a5a"/>
          <circle cx="3" cy="3" r="3" fill="#3a3a5a"/>
          <polygon points="1,0 0,-3 3,-1" fill="#3a3a5a"/>
          <polygon points="5,0 6,-3 3,-1" fill="#3a3a5a"/>
        </g>
      </svg>
    ),
    6: ( // $100K 펜트하우스 발코니
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <defs><linearGradient id="sky6" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#08081a"/><stop offset="100%" stopColor="#0e0e28"/></linearGradient></defs>
        <rect width="1200" height="300" fill="url(#sky6)"/>
        {star(50,10,1.5,'3s')}{star(200,18,1,'4s')}{star(380,8,1.5,'2.5s')}{star(550,22,1,'3.5s')}{star(750,12,1.5,'2s')}{star(900,6,1,'4.5s')}{star(1080,15,1.5,'3s')}{star(1150,25,1,'2.5s')}
        {/* 달 */}
        <circle cx="200" cy="40" r="18" fill="#ffd54f" opacity="0.2"/>
        <circle cx="207" cy="35" r="15" fill="#08081a"/>
        {/* 먼 빌딩 스카이라인 */}
        {[50,120,200,300,400,500,600,700,800,900,1000,1080].map((x,i) => <rect key={x} x={x} y={100+(i%4)*20} width={15+i%8} height={80-(i%4)*20} fill="#10101a" opacity="0.5"/>)}
        {/* 빌딩 불빛 */}
        {Array.from({length:50}).map((_,i) => <circle key={i} cx={20+(i*47)%1160} cy={200+(i*13)%30} r={0.6+(i%3)*0.3} fill={['#ffd700','#fff','#42a5f5','#ff8888','#b794f6'][i%5]} opacity={0.08+(i%4)*0.03}/>)}
        {/* 유리 난간 */}
        <line x1="0" y1="195" x2="1200" y2="195" stroke="#3a3a5a" strokeWidth="2"/>
        {Array.from({length:25}).map((_,i) => <line key={i} x1={i*50} y1="195" x2={i*50} y2="200" stroke="#3a3a5a" strokeWidth="0.6"/>)}
        <rect x="0" y="195" width="1200" height="8" fill="rgba(100,150,200,0.03)"/>
        {/* 바닥 */}
        <rect x="0" y="200" width="1200" height="100" fill="#161624"/>
        {/* 실내 조명 반사 */}
        <ellipse cx="600" cy="250" rx="300" ry="20" fill="rgba(232,192,128,0.02)"/>
        {/* 와인잔 */}
        <g transform="translate(900, 170)">
          <line x1="5" y1="8" x2="5" y2="20" stroke="#3a3a5a" strokeWidth="1"/>
          <ellipse cx="5" cy="20" rx="6" ry="2" fill="#3a3a5a" opacity="0.3"/>
          <ellipse cx="5" cy="6" rx="5" ry="6" fill="rgba(150,30,50,0.08)"/>
          <ellipse cx="5" cy="6" rx="5" ry="6" fill="none" stroke="#3a3a5a" strokeWidth="0.5"/>
        </g>
        {/* 🐈 난간 위 고양이 */}
        <g transform="translate(450, 175)" opacity="0.2">
          <ellipse cx="8" cy="8" rx="6" ry="4" fill="#4a4a6a"/>
          <circle cx="3" cy="4" r="4" fill="#4a4a6a"/>
          <polygon points="0,1 -1,-3 3,-1" fill="#4a4a6a"/>
          <polygon points="6,1 7,-3 3,-1" fill="#4a4a6a"/>
          <circle cx="2" cy="3.5" r="0.7" fill="#aaddff" opacity="0.5"/>
          <circle cx="5" cy="3.5" r="0.7" fill="#aaddff" opacity="0.5"/>
          <path d="M14,8 Q18,4 20,8" stroke="#4a4a6a" strokeWidth="1.2" fill="none">
            <animateTransform attributeName="transform" type="rotate" values="-3,14,8;3,14,8;-3,14,8" dur="4s" repeatCount="indefinite"/>
          </path>
        </g>
        {/* 🦅 먼 하늘 매 */}
        <g transform="translate(800, 50)" opacity="0.12">
          <path d="M0,3 Q4,0 8,3 Q12,0 16,3" fill="none" stroke="#4a4a6a" strokeWidth="1">
            <animate attributeName="d" values="M0,3 Q4,0 8,3 Q12,0 16,3;M0,3 Q4,5 8,3 Q12,5 16,3;M0,3 Q4,0 8,3 Q12,0 16,3" dur="2s" repeatCount="indefinite"/>
          </path>
        </g>
      </svg>
    ),
    7: ( // $150K 해안도로
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <defs><linearGradient id="sky7" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2a1808"/><stop offset="40%" stopColor="#3a2010"/><stop offset="100%" stopColor="#1a1008"/></linearGradient></defs>
        <rect width="1200" height="300" fill="url(#sky7)"/>
        {star(100,15,1,'3s')}{star(400,10,1.5,'4s')}{star(700,20,1,'2.5s')}
        {/* 석양 */}
        <circle cx="900" cy="75" r="40" fill="rgba(255,136,85,0.12)"/>
        <circle cx="900" cy="75" r="20" fill="rgba(255,136,85,0.18)"/>
        {/* 구름 */}
        <ellipse cx="300" cy="40" rx="60" ry="12" fill="rgba(255,136,85,0.04)"/>
        <ellipse cx="650" cy="30" rx="80" ry="10" fill="rgba(255,136,85,0.03)"/>
        {/* 바다 */}
        <rect x="0" y="120" width="1200" height="80" fill="#0a1828"/>
        <path d="M0,130 Q100,126 200,130 Q300,134 400,130 Q500,126 600,130 Q700,134 800,130 Q900,126 1000,130 Q1100,134 1200,130" fill="none" stroke="rgba(255,136,85,0.05)" strokeWidth="0.6"/>
        <ellipse cx="900" cy="155" rx="80" ry="6" fill="rgba(255,136,85,0.04)"><animate attributeName="opacity" values="0.03;0.06;0.03" dur="4s" repeatCount="indefinite"/></ellipse>
        {/* 도로 */}
        <rect x="0" y="200" width="1200" height="25" fill="#161620"/>
        <line x1="0" y1="212" x2="1200" y2="212" stroke="#22222e" strokeWidth="0.6" strokeDasharray="15 10"/>
        <rect x="0" y="225" width="1200" height="75" fill="#1a1a20"/>
        {/* 야자수 1 */}
        <line x1="150" y1="40" x2="150" y2="130" stroke="#1e3818" strokeWidth="5"/>
        <ellipse cx="125" cy="30" rx="35" ry="12" fill="#1e4018" opacity="0.5" className="palm-sway"/>
        <ellipse cx="175" cy="25" rx="28" ry="10" fill="#1e4018" opacity="0.4" className="palm-sway"/>
        <ellipse cx="145" cy="40" rx="22" ry="8" fill="#244820" opacity="0.35" className="palm-sway"/>
        {/* 야자수 2 */}
        <line x1="450" y1="50" x2="450" y2="125" stroke="#1e3818" strokeWidth="4"/>
        <ellipse cx="430" cy="42" rx="28" ry="10" fill="#1e4018" opacity="0.45" className="palm-sway"/>
        <ellipse cx="470" cy="38" rx="22" ry="8" fill="#1e4018" opacity="0.35" className="palm-sway"/>
        {/* 야자수 3 */}
        <line x1="1050" y1="35" x2="1050" y2="125" stroke="#1e3818" strokeWidth="5"/>
        <ellipse cx="1030" cy="28" rx="30" ry="11" fill="#1e4018" opacity="0.5" className="palm-sway"/>
        <ellipse cx="1070" cy="24" rx="25" ry="9" fill="#1e4018" opacity="0.4" className="palm-sway"/>
        {/* 스포츠카 실루엣 */}
        <rect x="750" y="198" width="60" height="15" rx="5" fill="#1a1a2a"/>
        <rect x="755" y="193" width="50" height="8" rx="4" fill="#1a1a2a"/>
        <circle cx="760" cy="213" r="4" fill="#10101a"/>
        <circle cx="800" cy="213" r="4" fill="#10101a"/>
        {/* 🐕 골든리트리버 */}
        <g transform="translate(280, 240)" opacity="0.18">
          <ellipse cx="12" cy="6" rx="9" ry="5" fill="#5a4a30"/>
          <circle cx="3" cy="2" r="4" fill="#5a4a30"/>
          <ellipse cx="1" cy="-1" rx="2.5" ry="3" fill="#5a4a30"/>
          <rect x="5" y="11" width="3" height="7" rx="1" fill="#5a4a30">
            <animate attributeName="height" values="7;5;7" dur="0.4s" repeatCount="indefinite"/>
          </rect>
          <rect x="15" y="11" width="3" height="7" rx="1" fill="#5a4a30">
            <animate attributeName="height" values="5;7;5" dur="0.4s" repeatCount="indefinite"/>
          </rect>
          <path d="M21,5 Q25,0 27,5" stroke="#5a4a30" strokeWidth="1.5" fill="none">
            <animateTransform attributeName="transform" type="rotate" values="-10,21,5;10,21,5;-10,21,5" dur="0.5s" repeatCount="indefinite"/>
          </path>
        </g>
        {/* 🦅 갈매기 */}
        <g transform="translate(500, 45)" opacity="0.15">
          <path d="M0,4 Q5,0 10,4 Q15,0 20,4" fill="none" stroke="#5a5a6a" strokeWidth="1">
            <animate attributeName="d" values="M0,4 Q5,0 10,4 Q15,0 20,4;M0,4 Q5,6 10,4 Q15,6 20,4;M0,4 Q5,0 10,4 Q15,0 20,4" dur="1.5s" repeatCount="indefinite"/>
          </path>
        </g>
        <g transform="translate(580, 35)" opacity="0.12">
          <path d="M0,3 Q4,0 8,3 Q12,0 16,3" fill="none" stroke="#5a5a6a" strokeWidth="0.8">
            <animate attributeName="d" values="M0,3 Q4,0 8,3 Q12,0 16,3;M0,3 Q4,5 8,3 Q12,5 16,3;M0,3 Q4,0 8,3 Q12,0 16,3" dur="2s" repeatCount="indefinite"/>
          </path>
        </g>
        <g transform="translate(350, 55)" opacity="0.1">
          <path d="M0,3 Q3,0 6,3 Q9,0 12,3" fill="none" stroke="#5a5a6a" strokeWidth="0.7">
            <animate attributeName="d" values="M0,3 Q3,0 6,3 Q9,0 12,3;M0,3 Q3,4 6,3 Q9,4 12,3;M0,3 Q3,0 6,3 Q9,0 12,3" dur="1.8s" repeatCount="indefinite"/>
          </path>
        </g>
      </svg>
    ),
    8: ( // $200K 프라이빗 비치
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,opacity:0.38,pointerEvents:'none'}}>
        <defs><linearGradient id="sky8" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#082028"/><stop offset="100%" stopColor="#0a2838"/></linearGradient></defs>
        <rect width="1200" height="300" fill="url(#sky8)"/>
        {star(100,12,1.5,'3s')}{star(300,8,1,'4s')}{star(550,18,1.5,'2.5s')}{star(800,10,1,'3.5s')}{star(1050,15,1.5,'2s')}
        {/* 바다 */}
        <rect x="0" y="100" width="1200" height="60" fill="#0a2838"/>
        <rect x="0" y="120" width="1200" height="25" fill="rgba(64,224,208,0.03)"/>
        <path d="M0,110 Q100,106 200,110 Q300,114 400,110 Q500,106 600,110 Q700,114 800,110 Q900,106 1000,110 Q1100,114 1200,110" fill="none" stroke="rgba(64,224,208,0.05)" strokeWidth="0.6"/>
        <path d="M0,125 Q150,121 300,125 Q450,129 600,125 Q750,121 900,125 Q1050,129 1200,125" fill="none" stroke="rgba(64,224,208,0.03)" strokeWidth="0.4"/>
        {/* 모래 */}
        <rect x="0" y="160" width="1200" height="140" fill="#221e14"/>
        <rect x="0" y="160" width="1200" height="10" fill="#2a2418"/>
        {/* 야자수 왼쪽 */}
        <line x1="120" y1="25" x2="120" y2="130" stroke="#1e3818" strokeWidth="6"/>
        <ellipse cx="90" cy="18" rx="40" ry="14" fill="#1e4018" opacity="0.5" className="palm-sway"/>
        <ellipse cx="150" cy="12" rx="32" ry="11" fill="#1e4018" opacity="0.4" className="palm-sway"/>
        <ellipse cx="115" cy="30" rx="25" ry="9" fill="#244820" opacity="0.35" className="palm-sway"/>
        {/* 야자수 오른쪽 */}
        <line x1="1050" y1="30" x2="1050" y2="125" stroke="#1e3818" strokeWidth="5"/>
        <ellipse cx="1025" cy="22" rx="35" ry="12" fill="#1e4018" opacity="0.45" className="palm-sway"/>
        <ellipse cx="1075" cy="18" rx="28" ry="10" fill="#1e4018" opacity="0.35" className="palm-sway"/>
        {/* 해먹 */}
        <path d="M100,95 Q200,125 300,95" fill="none" stroke="rgba(170,100,50,0.2)" strokeWidth="1.5"/>
        <line x1="100" y1="95" x2="120" y2="50" stroke="rgba(170,100,50,0.1)" strokeWidth="0.5"/>
        <line x1="300" y1="95" x2="290" y2="50" stroke="rgba(170,100,50,0.1)" strokeWidth="0.5"/>
        {/* 파라솔 */}
        <line x1="700" y1="90" x2="700" y2="165" stroke="#2a2a3a" strokeWidth="2"/>
        <path d="M650,90 Q700,65 750,90" fill="rgba(200,60,60,0.06)" stroke="rgba(200,60,60,0.1)" strokeWidth="0.5"/>
        {/* 칵테일 */}
        <g transform="translate(720, 150)">
          <line x1="5" y1="0" x2="5" y2="12" stroke="#2a2a3a" strokeWidth="0.8"/>
          <path d="M0,0 L10,0 L5,8 Z" fill="rgba(255,140,0,0.06)" stroke="#2a2a3a" strokeWidth="0.4"/>
          <circle cx="8" cy="-2" r="2" fill="rgba(0,200,83,0.08)"/>
        </g>
        {/* 🐕 해먹 옆 강아지 */}
        <g transform="translate(320, 170)" opacity="0.18">
          <ellipse cx="10" cy="6" rx="8" ry="4" fill="#5a4a3a"/>
          <circle cx="3" cy="4" r="3.5" fill="#5a4a3a"/>
          <ellipse cx="1" cy="1" rx="2" ry="3" fill="#5a4a3a"/>
          <path d="M18,5 Q22,2 24,6" stroke="#5a4a3a" strokeWidth="1" fill="none"/>
        </g>
        {/* 🦜 앵무새 (야자수 위) */}
        <g transform="translate(130, 40)" opacity="0.18">
          <ellipse cx="4" cy="5" rx="3" ry="4" fill="#2a6a3a"/>
          <circle cx="4" cy="1" r="2.5" fill="#4a8a2a"/>
          <path d="M6,1 L9,0.5" stroke="#5a5a1a" strokeWidth="0.6"/>
          <path d="M1,7 Q-2,12 0,14" stroke="#2a6a3a" strokeWidth="1" fill="none"/>
        </g>
        {/* 🐢 거북이 */}
        <g transform="translate(550, 200)" opacity="0.15">
          <ellipse cx="6" cy="4" rx="6" ry="4" fill="#3a4a3a"/>
          <circle cx="0" cy="3" r="2" fill="#3a4a3a"/>
          <rect x="3" y="7" width="2" height="2" rx="1" fill="#3a4a3a"/>
          <rect x="8" y="7" width="2" height="2" rx="1" fill="#3a4a3a"/>
          <animateTransform attributeName="transform" type="translate" values="550,200;552,200;550,200" dur="8s" repeatCount="indefinite"/>
        </g>
        {/* 🐠 물고기 */}
        <g transform="translate(400, 135)" opacity="0.12">
          <ellipse cx="4" cy="3" rx="4" ry="2" fill="#2a4a6a"/>
          <polygon points="8,3 11,1 11,5" fill="#2a4a6a"/>
        </g>
        <g transform="translate(600, 140)" opacity="0.1">
          <ellipse cx="3" cy="2.5" rx="3" ry="1.5" fill="#2a4a6a"/>
          <polygon points="6,2.5 8,1 8,4" fill="#2a4a6a"/>
        </g>
      </svg>
    ),
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', borderRadius: 16 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.grad }} />
      {scenes[stage]}
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
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.8 }}>누적 PNL</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: pnlColor, fontFamily: 'Inter, monospace' }}>{fmtPnl(journey.cumulativePnl)}</div>
          </div>
        </div>
      </div>
      <div style={{ ...CARD, backgroundImage: `linear-gradient(to top right, ${INFO}0d, transparent)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${INFO}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FlagIcon color={INFO} size={18} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.8 }}>다음 체크포인트</div>
            {journey.nextCheckpoint ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>{fmtK(journey.nextCheckpoint)}</div>
                <div style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>(남은 금액: {fmtDollar(journey.nextCpRemaining)})</div>
              </>
            ) : <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', fontFamily: 'Inter, monospace' }}>완주!</div>}
          </div>
        </div>
      </div>
      <div style={{ ...CARD, backgroundImage: `linear-gradient(to top right, ${ps.color}0d, transparent)` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DonutChart percent={journey.progressPercent} size={44} strokeWidth={5} />
          <div>
            <div style={{ fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.8 }}>진행률</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: ps.color, fontFamily: 'Inter, monospace' }}>{journey.progressPercent.toFixed(2)}%</div>
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
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      {badges.map((b, i) => (
        <div key={i} className="badge-hover" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          background: `${b.color}08`, border: `1px solid ${b.borderColor || b.color}20`,
          borderRadius: 8, padding: '5px 12px', cursor: 'default',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}>
          <span style={{ fontSize: 13 }}>{b.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: b.color, fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>{b.label}</span>
          {b.sub && <span style={{ fontSize: 13, fontWeight: 600, color: b.subColor, fontFamily: 'Inter, monospace', marginLeft: 2 }}>{b.sub}</span>}
        </div>
      ))}
    </div>
  )
}

// ─── Hero Section (현재 위치 + PNL + 다음 체크포인트 통합) ─────────────────────

function HeroSection({ stage, journey, ps }) {
  const current = STAGES[stage]
  const next = STAGES[stage + 1]
  const pnlColor = journey.cumulativePnl >= 0 ? GREEN : RED
  const stageStart = current.cp
  const stageEnd = next ? next.cp : JOURNEY_GOAL
  const stageProgress = Math.min(100, Math.max(0, ((journey.cumulativePnl - stageStart) / (stageEnd - stageStart)) * 100))

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '16px 24px',
      position: 'relative', zIndex: 1, gap: 0,
    }}>
      {/* Left: Character + Stage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: '0 0 auto' }}>
        <div style={{ flexShrink: 0 }}>
          <VectorChar stage={stage} height={72} faceRight />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#7a7a8a', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.8 }}>현재 단계</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace', whiteSpace: 'nowrap', marginTop: 2 }}>{current.icon} {current.label}</div>
          {next && (
            <>
              <div style={{ fontSize: 12, color: '#4b5563', fontFamily: 'Inter, monospace', marginTop: 6, whiteSpace: 'nowrap', lineHeight: 1.8 }}>→ {next.icon} {next.label}</div>
              <div style={{ width: 90, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: `${stageProgress}%`, height: '100%', borderRadius: 2, background: stage <= 1 ? '#cd7f32' : stage <= 4 ? INFO : '#ffd700', transition: 'width 0.5s' }} />
              </div>
            </>
          )}
          {!next && <div style={{ fontSize: 12, color: '#fbbf24', fontFamily: 'Inter, monospace', marginTop: 4, lineHeight: 1.8 }}>최종 달성!</div>}
        </div>
      </div>

      <div style={{ width: 1, height: 52, background: 'rgba(255,255,255,0.06)', margin: '0 24px', flexShrink: 0 }} />

      {/* Center: Current PNL (HERO) */}
      <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#7a7a8a', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.8 }}>누적 PNL</div>
        <div style={{ fontSize: 36, fontWeight: 900, color: pnlColor, fontFamily: 'Inter, monospace', letterSpacing: '-0.02em', lineHeight: 1.8, marginTop: 4 }}>{fmtPnl(journey.cumulativePnl)}</div>
        <div style={{ fontSize: 12, color: '#7a7a8a', fontFamily: 'Inter, monospace', marginTop: 6, lineHeight: 1.8 }}>
          진행률 <span style={{ fontWeight: 700, color: ps.color }}>{journey.progressPercent.toFixed(2)}%</span>
        </div>
      </div>

      <div style={{ width: 1, height: 52, background: 'rgba(255,255,255,0.06)', margin: '0 24px', flexShrink: 0 }} />

      {/* Right: Next Checkpoint */}
      <div style={{ flex: '0 0 auto', textAlign: 'right' }}>
        <div style={{ fontSize: 12, color: '#7a7a8a', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.8 }}>다음 체크포인트</div>
        {journey.nextCheckpoint ? (
          <>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#e0e0e0', fontFamily: 'Inter, monospace', lineHeight: 1.8, marginTop: 4 }}>{fmtK(journey.nextCheckpoint)}</div>
            <div style={{ fontSize: 12, color: INFO, fontFamily: 'Inter, monospace', fontWeight: 600, marginTop: 6, lineHeight: 1.8 }}>
              남은: <span style={{ color: '#e0e0e0' }}>{fmtDollar(journey.nextCpRemaining)}</span>
            </div>
          </>
        ) : (
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', fontFamily: 'Inter, monospace', lineHeight: 1.8, marginTop: 4 }}>🏝️ 완주!</div>
        )}
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
        <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8, background: 'rgba(26,26,46,0.95)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 12px', whiteSpace: 'nowrap', zIndex: 100, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', fontSize: 12, fontFamily: 'Inter, monospace' }}>
          <div style={{ fontWeight: 700, color: reached ? '#fbbf24' : '#9ca3af', marginBottom: 2, lineHeight: 1.8 }}>{stageInfo.icon} {stageInfo.badge || `$${CP_LABELS[cp]}`} — {reached ? '달성!' : '미달성'}</div>
          {reached && achievedDate && <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.8 }}>달성일: {achievedDate}</div>}
          {!reached && <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.8 }}>남은 금액: {fmtK(remaining)}</div>}
          {!reached && estimateStr && <div style={{ color: '#4b5563', fontSize: 12, lineHeight: 1.8 }}>현재 페이스 기준: {estimateStr}</div>}
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
      <div style={{ marginTop: 2, fontSize: 10, fontWeight: 700, fontFamily: 'Inter, monospace', color: reached ? '#fbbf24' : isNext ? '#42a5f5' : '#3a3a4a', textAlign: 'center', whiteSpace: 'nowrap' }}>${CP_LABELS[cp]}</div>
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
      <div style={{ position: 'relative', height: 110, marginBottom: 4 }}>
        <div style={{
          position: 'absolute', left: `${Math.max(5, Math.min(95, pct))}%`, bottom: 0,
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10,
        }}>
          <div style={{ background: 'rgba(20,20,36,0.94)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 10, padding: '5px 12px', marginBottom: 4, whiteSpace: 'nowrap', position: 'relative', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: journey.cumulativePnl >= 0 ? GREEN : RED, fontFamily: 'Inter, monospace', textAlign: 'center' }}>{fmtPnl(journey.cumulativePnl)}</div>
            {journey.nextCpRemaining > 0 && <div style={{ fontSize: 12, color: '#9e9e9e', fontFamily: 'Inter, monospace', textAlign: 'center', lineHeight: 1.8 }}>다음까지 {fmtK(journey.nextCpRemaining)}</div>}
            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid rgba(255,255,255,0.18)' }} />
          </div>
          {/* 캐릭터 (72px, 오른쪽 바라봄) */}
          <div className="char-bounce">
            <VectorChar stage={stage} height={72} faceRight />
          </div>
        </div>
      </div>

      {/* 프로그레스 바 — 두껍고 존재감 있는 로드 */}
      <div style={{ position: 'relative', height: 62 }}>
        <div style={{
          position: 'absolute', top: '50%', left: 0, right: 0, height: 48,
          transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.06)',
          borderRadius: 24, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden',
          boxShadow: '0 0 30px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: grad, borderRadius: 24, boxShadow: '0 0 20px rgba(255,215,0,0.4), 0 0 40px rgba(255,215,0,0.12)', transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 50%, rgba(0,0,0,0.12) 100%)', borderRadius: 24 }} />
            <div className="progress-shimmer" style={{ position: 'absolute', inset: 0, borderRadius: 24, overflow: 'hidden' }} />
          </div>
          {showInside ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.7)', zIndex: 5 }}>{realPct.toFixed(2)}%</div>
          ) : (
            <div style={{ position: 'absolute', top: '50%', left: `${pct + 2}%`, transform: 'translateY(-50%)', fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace', color: '#9e9e9e', zIndex: 5, whiteSpace: 'nowrap' }}>{realPct.toFixed(2)}%</div>
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
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>{prev.label}</div>
          </div>
          <div style={{ fontSize: 24, color: '#fbbf24' }}>→</div>
          <div className="celebration-glow-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VectorChar stage={stage} height={60} />
            <div style={{ fontSize: 12, color: '#e0e0e0', marginTop: 4, fontFamily: 'Inter, monospace', fontWeight: 700, lineHeight: 1.8 }}>{current.label}</div>
          </div>
        </div>
        <div style={{ fontSize: 24, marginBottom: 8, position: 'relative', zIndex: 1 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace', marginBottom: 8, position: 'relative', zIndex: 1 }}>{fmtK(current.cp)} 달성!</div>
        <div style={{ fontSize: 15, color: '#9e9e9e', marginBottom: 4, position: 'relative', zIndex: 1, lineHeight: 1.8 }}>{current.badge}</div>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, position: 'relative', zIndex: 1, lineHeight: 1.8 }}>{current.reward}</div>
        <button onClick={onClose} style={{ padding: '8px 24px', borderRadius: 8, border: 'none', background: `${GREEN}20`, color: GREEN, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, monospace', position: 'relative', zIndex: 1 }}>확인</button>
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
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>변신 기록</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24', fontFamily: 'Inter, monospace', background: 'rgba(251,191,36,0.1)', borderRadius: 6, padding: '2px 8px' }}>{reachedCount}/{CHECKPOINTS.length}</span>
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
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>{ms.icon} {ms.badge}</span>
                        {ms.achievedDate && <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>{ms.achievedDate}</span>}
                        {ms.daysSinceStart !== null && <span style={{ fontSize: 12, color: '#4b5563', fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>(시작 후 {ms.daysSinceStart}일)</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.8 }}>{ms.reward}</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, color: '#374151', fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>??? — {fmtK(ms.cp)} 도달 시 해금</span>
                      <span style={{ fontSize: 12, color: '#374151' }}>🔒</span>
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
        <div style={{ fontSize: 20, fontWeight: 800, color: '#e0e0e0', marginBottom: 12, fontFamily: 'Inter, monospace' }}>정말 리셋하시겠습니까?</div>
        <div style={{ fontSize: 16, color: '#9e9e9e', marginBottom: 16, lineHeight: 1.8 }}>모든 마일스톤 달성 기록과 캐릭터 진화가 초기화됩니다.</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '12px 0', marginBottom: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VectorChar stage={stage} height={50} />
            <div style={{ fontSize: 12, color: '#e0e0e0', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>{current.icon} {current.label}</div>
          </div>
          <div style={{ fontSize: 16, color: RED }}>→</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <VectorChar stage={0} height={50} />
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontFamily: 'Inter, monospace', lineHeight: 1.8 }}>{initial.icon} {initial.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#9e9e9e', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, monospace' }}>취소</button>
          <button onClick={onConfirm} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: RED, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'Inter, monospace' }}>리셋</button>
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
    <div style={{ borderRadius: 16, overflow: 'hidden', position: 'relative', border: `1px solid ${ps.color}35`, boxShadow: `0 0 50px ${ps.color}10, 0 2px 20px rgba(0,0,0,0.3)` }}>
      <svg width="100%" height="100%" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',opacity:0.2,pointerEvents:'none',zIndex:0}}>
        <defs>
          <linearGradient id="bgSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0a2e"/>
            <stop offset="100%" stopColor="#1a1a3e"/>
          </linearGradient>
        </defs>
        <rect width="1200" height="300" fill="url(#bgSky)"/>
        <circle cx="1050" cy="45" r="20" fill="#ffd54f" opacity="0.3"/>
        <circle cx="1058" cy="40" r="17" fill="#0a0a2e"/>
        <circle cx="100" cy="30" r="1" fill="white" opacity="0.4"/>
        <circle cx="300" cy="20" r="1.5" fill="white" opacity="0.3"/>
        <circle cx="500" cy="40" r="1" fill="white" opacity="0.3"/>
        <circle cx="750" cy="15" r="1.5" fill="white" opacity="0.4"/>
        <circle cx="900" cy="35" r="1" fill="white" opacity="0.3"/>
        <rect x="50" y="80" width="120" height="220" fill="#0d0d25" rx="2"/>
        <rect x="65" y="100" width="12" height="12" fill="#ffd54f" opacity="0.2" rx="1"/>
        <rect x="90" y="100" width="12" height="12" fill="#ffd54f" opacity="0.15" rx="1"/>
        <rect x="65" y="130" width="12" height="12" fill="#ffd54f" opacity="0.1" rx="1"/>
        <rect x="90" y="130" width="12" height="12" fill="#ffd54f" opacity="0.2" rx="1"/>
        <rect x="65" y="160" width="12" height="12" fill="#ffd54f" opacity="0.15" rx="1"/>
        <rect x="250" y="140" width="200" height="160" fill="#111130" rx="2"/>
        <rect x="260" y="145" width="180" height="20" fill="#1a3a5c" opacity="0.3"/>
        <text x="350" y="160" textAnchor="middle" fill="#4fc3f7" fontSize="8" opacity="0.2">24H</text>
        <rect x="280" y="175" width="60" height="80" fill="rgba(255,220,150,0.06)" rx="1"/>
        <rect x="360" y="175" width="60" height="80" fill="rgba(255,220,150,0.06)" rx="1"/>
        <rect x="320" y="210" width="30" height="50" fill="rgba(255,220,150,0.08)" rx="1"/>
        <rect x="220" y="120" width="3" height="180" fill="#2a2a4a"/>
        <rect x="210" y="118" width="25" height="5" fill="#2a2a4a" rx="2"/>
        <circle cx="222" cy="115" r="5" fill="rgba(255,200,100,0.4)"/>
        <ellipse cx="222" cy="298" rx="30" ry="5" fill="rgba(255,200,100,0.04)"/>
        <rect x="520" y="130" width="3" height="170" fill="#2a2a4a"/>
        <rect x="510" y="128" width="25" height="5" fill="#2a2a4a" rx="2"/>
        <circle cx="522" cy="125" r="5" fill="rgba(255,200,100,0.35)"/>
        <rect x="460" y="210" width="30" height="50" fill="#1a1a40" rx="2"/>
        <rect x="463" y="215" width="24" height="15" fill="rgba(100,180,255,0.1)" rx="1"/>
        <rect x="463" y="235" width="24" height="15" fill="rgba(255,100,100,0.08)" rx="1"/>
        <rect x="600" y="160" width="150" height="140" fill="#0e0e28" rx="2"/>
        <rect x="620" y="190" width="40" height="50" fill="rgba(255,220,150,0.04)" rx="1"/>
        <rect x="690" y="190" width="40" height="50" fill="rgba(255,220,150,0.03)" rx="1"/>
        <rect x="800" y="100" width="80" height="200" fill="#08081e" rx="1"/>
        <rect x="900" y="130" width="60" height="170" fill="#0a0a20" rx="1"/>
        <rect x="980" y="110" width="90" height="190" fill="#08081e" rx="1"/>
        <rect x="560" y="70" width="3" height="230" fill="#1a1a3a"/>
        <line x1="220" y1="120" x2="560" y2="75" stroke="#1a1a3a" strokeWidth="0.5"/>
        <line x1="560" y1="80" x2="900" y2="110" stroke="#1a1a3a" strokeWidth="0.5"/>
        <rect x="480" y="270" width="35" height="3" fill="#2a2a4a" rx="1"/>
        <rect x="483" y="273" width="3" height="12" fill="#2a2a4a"/>
        <rect x="509" y="273" width="3" height="12" fill="#2a2a4a"/>
        <ellipse cx="458" cy="278" rx="6" ry="5" fill="#3a3a5a"/>
        <circle cx="458" cy="274" r="4" fill="#3a3a5a"/>
        <circle cx="456" cy="273" r="0.8" fill="#aaffaa" opacity="0.4"/>
        <circle cx="460" cy="273" r="0.8" fill="#aaffaa" opacity="0.4"/>
        <line x1="0" y1="290" x2="1200" y2="290" stroke="#2a2a4a" strokeWidth="0.5"/>
        <line x1="0" y1="295" x2="1200" y2="295" stroke="#1a1a3a" strokeWidth="0.5"/>
      </svg>
      <StageBackground stage={stage} />
      <ConfettiEffect active={showConfetti} />
      {celebrationStage !== null && <CelebrationModal stage={celebrationStage} onClose={() => setCelebrationStage(null)} />}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#6a6a7a', letterSpacing: '0.14em', fontFamily: 'Inter, monospace' }}>JOURNEY TO $200K</span>
          <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'Inter, monospace', color: ps.color, background: `${ps.color}15`, border: `1px solid ${ps.color}35`, borderRadius: 6, padding: '3px 10px', letterSpacing: '0.1em' }}>{ps.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Inter, monospace', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 6, padding: '3px 10px' }}>{stageInfo?.badge || '🚀 시작'}</div>
        </div>
      </div>

      {/* Hero: 현재 위치 + PNL + 다음 체크포인트 (전체 너비) */}
      <HeroSection stage={stage} journey={journey} ps={ps} />

      {/* 프로그레스 로드 (전체 너비, 두꺼운 바) */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 20px 12px' }}>
        <ProgressSection journey={journey} ps={ps} curve={curve} personalBests={personalBests} stage={stage} />
      </div>

      {/* 뱃지 (컴팩트) */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 20px 12px' }}>
        <BadgeRow journey={journey} personalBests={personalBests} curve={curve} />
      </div>

      {/* 변신 기록 */}
      <div style={{ position: 'relative', zIndex: 1, padding: '0 20px 16px' }}>
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
