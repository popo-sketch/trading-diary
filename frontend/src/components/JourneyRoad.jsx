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

// ─── Vector Character (clean chibi SVG, 2.5등신) ─────────────────────────────

function VectorChar({ stage, height = 80, faceRight = true }) {
  // Stage palettes: hair, skin, top, topAccent, bottom, shoe, shoeAccent
  const palettes = [
    // $0: 흰 민소매 + 회색 반바지 + 슬리퍼
    { hair: '#2a1f14', skin: '#f0c088', top: '#e8e8e8', topAcc: null, bottom: '#8a8a96', shoe: '#a09080', shoeAcc: null },
    // $1K: 파란 티셔츠 + 남색 청바지 + 흰 운동화
    { hair: '#2a1f14', skin: '#f0c088', top: '#4a90d9', topAcc: '#3a78c0', bottom: '#2c3e6e', shoe: '#f0f0f0', shoeAcc: '#ddd' },
    // $5K: 검정 후드티 + 회색 조거팬츠
    { hair: '#2a1f14', skin: '#f0c088', top: '#2a2a2a', topAcc: '#3a3a3a', bottom: '#4a4a54', shoe: '#1a1a1a', shoeAcc: '#333' },
    // $10K: 흰 셔츠 + 베이지 슬랙스 + 갈색 구두
    { hair: '#2a1f14', skin: '#f0c088', top: '#eee', topAcc: '#ddd', bottom: '#c4a882', shoe: '#6b4226', shoeAcc: '#5a3520' },
    // $25K: 검정 가죽자켓 + 검정 바지
    { hair: '#2a1f14', skin: '#f0c088', top: '#1a1a1a', topAcc: '#333', bottom: '#1a1a1a', shoe: '#2a2a2a', shoeAcc: '#444' },
    // $50K: 남색 정장 + 흰 셔츠
    { hair: '#2a1f14', skin: '#f0c088', top: '#1a2040', topAcc: '#2a3060', bottom: '#1a2040', shoe: '#2a2a2a', shoeAcc: '#1a1a1a' },
    // $100K: 베이지 캐시미어 코트 + 검정 슬랙스
    { hair: '#2a1f14', skin: '#f0c088', top: '#c4a870', topAcc: '#b0986a', bottom: '#1e1e28', shoe: '#3a2a1a', shoeAcc: '#2a1a10' },
    // $150K: 검정 풀 수트
    { hair: '#2a1f14', skin: '#f0c088', top: '#111118', topAcc: '#1a1a24', bottom: '#111118', shoe: '#1a1a1a', shoeAcc: '#0a0a0a' },
    // $200K: 하와이안 셔츠 + 반바지 + 샌들
    { hair: '#2a1f14', skin: '#f0c088', top: '#d94040', topAcc: '#e06060', bottom: '#4a7ab0', shoe: '#c49060', shoeAcc: '#a87850' },
  ]
  const p = palettes[stage] || palettes[0]
  // ViewBox: 60x80 gives more horizontal space for accessories
  const W = 60, H = 80
  const scale = height / H

  // Expression varies by stage
  const isSmile = stage >= 1 && stage !== 4 && stage !== 7
  const isConfident = stage === 3 || stage === 5 || stage === 6
  const isDetermined = stage === 0
  const isRelaxed = stage === 8

  return (
    <svg width={W * scale} height={height} viewBox={`0 0 ${W} ${H}`}
      style={{ overflow: 'visible', display: 'block', transform: faceRight ? 'scaleX(-1)' : 'none' }}>

      {/* ── Head (큰 원형, 2.5등신 = 머리 40%) ── */}
      <circle cx="30" cy="17" r="14" fill={p.skin} />
      {/* Ear */}
      <ellipse cx="16" cy="19" rx="2.5" ry="3" fill={p.skin} />
      <ellipse cx="16" cy="19" rx="1.5" ry="2" fill="#e0a870" />
      {/* Hair — 반원형 볼륨 */}
      <ellipse cx="30" cy="11" rx="15" ry="10" fill={p.hair} />
      <ellipse cx="30" cy="7" rx="12" ry="7" fill={p.hair} />
      {/* Side fringe */}
      <path d="M 16 15 Q 15 8 20 5" fill={p.hair} stroke="none" />
      <path d="M 44 15 Q 45 8 40 5" fill={p.hair} stroke="none" />
      {/* Hair shine */}
      <path d="M 22 4 Q 27 2 32 4" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1.2" />

      {/* ── Face ── */}
      {/* Eyes — 검정 타원 */}
      <ellipse cx="24" cy="18" rx="2.2" ry="2.5" fill="#1a1008" />
      <ellipse cx="36" cy="18" rx="2.2" ry="2.5" fill="#1a1008" />
      {/* Eye highlights — 하이라이트 */}
      <circle cx="25" cy="17" r="1" fill="#fff" />
      <circle cx="37" cy="17" r="1" fill="#fff" />
      <circle cx="23.5" cy="19" r="0.5" fill="rgba(255,255,255,0.4)" />
      <circle cx="35.5" cy="19" r="0.5" fill="rgba(255,255,255,0.4)" />
      {/* Eyebrows */}
      {isDetermined ? (
        <>
          <line x1="21" y1="13.5" x2="27" y2="14" stroke={p.hair} strokeWidth="1" strokeLinecap="round" />
          <line x1="33" y1="14" x2="39" y2="13.5" stroke={p.hair} strokeWidth="1" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M 21 14 Q 24 12.8 27 14" fill="none" stroke={p.hair} strokeWidth="0.8" strokeLinecap="round" />
          <path d="M 33 14 Q 36 12.8 39 14" fill="none" stroke={p.hair} strokeWidth="0.8" strokeLinecap="round" />
        </>
      )}
      {/* Nose */}
      <ellipse cx="30" cy="22" rx="1.2" ry="1" fill="#dda070" />
      {/* Mouth — 미소 곡선 */}
      {isDetermined && <path d="M 26 25 L 34 25" fill="none" stroke="#c08060" strokeWidth="1" strokeLinecap="round" />}
      {isSmile && !isConfident && !isRelaxed && <path d="M 25 25 Q 30 29 35 25" fill="none" stroke="#c08060" strokeWidth="1" strokeLinecap="round" />}
      {isConfident && <path d="M 25 24.5 Q 30 29.5 35 24.5" fill="none" stroke="#c08060" strokeWidth="1.2" strokeLinecap="round" />}
      {isRelaxed && (
        <>
          <path d="M 25 25 Q 30 30 35 25" fill="none" stroke="#c08060" strokeWidth="1" strokeLinecap="round" />
          {/* Blush */}
          <ellipse cx="21" cy="23" rx="3" ry="1.8" fill="rgba(255,130,100,0.18)" />
          <ellipse cx="39" cy="23" rx="3" ry="1.8" fill="rgba(255,130,100,0.18)" />
        </>
      )}
      {(stage === 4 || stage === 7) && <path d="M 26 25 Q 30 28 34 25" fill="none" stroke="#c08060" strokeWidth="0.9" strokeLinecap="round" />}

      {/* ── Neck ── */}
      <rect x="27" y="29" width="6" height="4" rx="2" fill={p.skin} />

      {/* ── Body (torso) — 중심 cx=30 ── */}
      {stage === 0 ? (
        /* 민소매 */
        <rect x="20" y="32" width="20" height="18" rx="4" fill={p.top} />
      ) : stage === 2 ? (
        /* 후드티 — hood + kangaroo pocket */
        <>
          <rect x="18" y="32" width="24" height="19" rx="4" fill={p.top} />
          <path d="M 20 32 Q 30 29 40 32" fill={p.topAcc} stroke="none" />
          <rect x="22" y="43" width="16" height="5" rx="2" fill={p.topAcc} />
        </>
      ) : stage === 5 ? (
        /* 정장 + 흰셔츠 + 빨간넥타이 */
        <>
          <rect x="18" y="32" width="24" height="19" rx="3" fill={p.top} />
          <path d="M 27 32 L 30 39 L 33 32" fill="#eee" stroke="none" />
          <polygon points="29.5,33 30.5,33 31,43 30,45 29,43" fill="#cc2020" />
          <line x1="27" y1="32" x2="24" y2="39" stroke={p.topAcc} strokeWidth="0.8" />
          <line x1="33" y1="32" x2="36" y2="39" stroke={p.topAcc} strokeWidth="0.8" />
        </>
      ) : stage === 6 ? (
        /* 코트 */
        <>
          <rect x="17" y="32" width="26" height="22" rx="4" fill={p.top} />
          <rect x="25" y="33" width="10" height="10" rx="1" fill="#2a2a36" />
          <path d="M 22 32 L 27 36" stroke={p.topAcc} strokeWidth="1.2" fill="none" />
          <path d="M 38 32 L 33 36" stroke={p.topAcc} strokeWidth="1.2" fill="none" />
        </>
      ) : stage === 7 ? (
        /* 풀 수트 */
        <>
          <rect x="18" y="32" width="24" height="19" rx="3" fill={p.top} />
          <path d="M 27 32 L 30 37 L 33 32" fill="#2a2a36" stroke="none" />
          <line x1="27" y1="32" x2="25" y2="38" stroke={p.topAcc} strokeWidth="0.6" />
          <line x1="33" y1="32" x2="35" y2="38" stroke={p.topAcc} strokeWidth="0.6" />
          <rect x="20" y="36" width="3" height="2" rx="0.5" fill="#e0e0e0" />
        </>
      ) : stage === 8 ? (
        /* 하와이안 셔츠 */
        <>
          <rect x="18" y="32" width="24" height="16" rx="3" fill={p.top} />
          <circle cx="22" cy="37" r="1.5" fill="#ffcc44" opacity="0.7" />
          <circle cx="30" cy="35" r="1.2" fill="#44cc88" opacity="0.6" />
          <circle cx="36" cy="39" r="1.3" fill="#ffcc44" opacity="0.6" />
          <circle cx="24" cy="42" r="1" fill="#44cc88" opacity="0.5" />
          <circle cx="34" cy="43" r="1.4" fill="#ffaa44" opacity="0.5" />
          <path d="M 27 32 L 30 36 L 33 32" fill={p.skin} stroke="none" />
        </>
      ) : (
        /* Default torso (stages 1, 3, 4) */
        <>
          <rect x="18" y="32" width="24" height="19" rx="4" fill={p.top} />
          <path d="M 26 32 Q 30 35 34 32" fill="none" stroke={p.topAcc || 'rgba(0,0,0,0.1)'} strokeWidth="0.6" />
          {stage === 3 && (
            <>
              <path d="M 25 32 L 22 35" stroke={p.topAcc} strokeWidth="0.8" fill="none" />
              <path d="M 35 32 L 38 35" stroke={p.topAcc} strokeWidth="0.8" fill="none" />
              <circle cx="30" cy="37" r="0.7" fill="#bbb" />
              <circle cx="30" cy="41" r="0.7" fill="#bbb" />
            </>
          )}
        </>
      )}

      {/* ── Arms ── */}
      {stage === 6 ? (
        <>
          <rect x="10" y="33" width="9" height="16" rx="4.5" fill={p.top} />
          <rect x="41" y="32" width="9" height="17" rx="4.5" fill={p.top} />
          <circle cx="14.5" cy="50" r="3" fill={p.skin} />
          <circle cx="45.5" cy="50" r="3" fill={p.skin} />
        </>
      ) : (
        <>
          <rect x="11" y="33" width="8" height="15" rx="4" fill={stage === 0 ? p.skin : p.top} />
          <rect x="41" y="32" width="8" height="16" rx="4" fill={stage === 0 ? p.skin : p.top} />
          <circle cx="15" cy="49" r="3" fill={p.skin} />
          <circle cx="45" cy="49" r="3" fill={p.skin} />
        </>
      )}

      {/* ── Legs ── */}
      {(stage === 0 || stage === 8) ? (
        <>
          <rect x="21" y="50" width="8" height="9" rx="3" fill={p.bottom} />
          <rect x="31" y="50" width="8" height="9" rx="3" fill={p.bottom} />
          <rect x="22" y="58" width="6" height="10" rx="2.5" fill={p.skin} />
          <rect x="32" y="58" width="6" height="10" rx="2.5" fill={p.skin} />
        </>
      ) : (
        <>
          <rect x="21" y="50" width="8" height="19" rx="3" fill={p.bottom} />
          <rect x="31" y="50" width="8" height="19" rx="3" fill={p.bottom} />
        </>
      )}

      {/* ── Shoes ── */}
      {stage === 0 ? (
        <>
          <ellipse cx="25" cy="69" rx="5.5" ry="2.2" fill={p.shoe} />
          <ellipse cx="35" cy="69" rx="5.5" ry="2.2" fill={p.shoe} />
          <path d="M 22 68 Q 25 66.5 28 68" fill={p.shoe} stroke="none" />
          <path d="M 32 68 Q 35 66.5 38 68" fill={p.shoe} stroke="none" />
        </>
      ) : stage === 8 ? (
        <>
          <ellipse cx="25" cy="69" rx="5" ry="2" fill={p.shoe} />
          <ellipse cx="35" cy="69" rx="5" ry="2" fill={p.shoe} />
          <line x1="22" y1="68" x2="28" y2="68" stroke={p.shoeAcc} strokeWidth="0.8" />
          <line x1="32" y1="68" x2="38" y2="68" stroke={p.shoeAcc} strokeWidth="0.8" />
          <line x1="25" y1="66" x2="25" y2="69" stroke={p.shoeAcc} strokeWidth="0.6" />
          <line x1="35" y1="66" x2="35" y2="69" stroke={p.shoeAcc} strokeWidth="0.6" />
        </>
      ) : (
        <>
          <ellipse cx="25" cy="70" rx="6" ry="2.5" fill={p.shoe} />
          <ellipse cx="35" cy="70" rx="6" ry="2.5" fill={p.shoe} />
          <path d="M 20 70 Q 25 68.5 30 70" fill="none" stroke={p.shoeAcc || 'rgba(255,255,255,0.1)'} strokeWidth="0.5" />
          <path d="M 30 70 Q 35 68.5 40 70" fill="none" stroke={p.shoeAcc || 'rgba(255,255,255,0.1)'} strokeWidth="0.5" />
          {stage === 1 && (
            <>
              <line x1="22" y1="70" x2="24" y2="69" stroke="#ccc" strokeWidth="0.5" />
              <line x1="32" y1="70" x2="34" y2="69" stroke="#ccc" strokeWidth="0.5" />
            </>
          )}
        </>
      )}

      {/* ── Stage-specific Accessories ── */}

      {/* $1K: 갈색 커피컵 (#8B4513) in right hand */}
      {stage === 1 && (
        <g>
          <rect x="43" y="43" width="7" height="9" rx="2" fill="#8B4513" />
          <rect x="42" y="42" width="9" height="3" rx="1.2" fill="#f5f5f5" />
          <path d="M 50 45 Q 52.5 47 50 49" fill="none" stroke="#6a3410" strokeWidth="1" />
          {/* Steam */}
          <path d="M 45 40 Q 46 37 45 34" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" className="steam-anim" />
          <path d="M 48 41 Q 49 38 48 35" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" className="steam-anim-2" />
        </g>
      )}

      {/* $5K: Airpods */}
      {stage === 2 && (
        <g>
          <circle cx="16" cy="20" r="2" fill="#f0f0f0" />
          <circle cx="16" cy="20" r="1.2" fill="#e0e0e0" />
          <line x1="16" y1="22" x2="16" y2="25" stroke="#e0e0e0" strokeWidth="0.7" />
        </g>
      )}

      {/* $10K: Gold wristwatch */}
      {stage === 3 && (
        <g>
          <rect x="42" y="45" width="6" height="4.5" rx="1.2" fill="#c0a040" />
          <rect x="43" y="45.5" width="4" height="3.5" rx="0.8" fill="#1a1a2a" />
          <circle cx="45" cy="47.2" r="0.4" fill="#ffd700" />
          <rect x="43.5" y="43" width="3" height="2.5" rx="0.6" fill="#c0a040" />
          <rect x="43.5" y="49.5" width="3" height="2.5" rx="0.6" fill="#c0a040" />
        </g>
      )}

      {/* $25K: Sunglasses */}
      {stage === 4 && (
        <g>
          <rect x="20" y="16" width="8" height="5" rx="2.5" fill="#1a1a1a" opacity="0.85" />
          <rect x="32" y="16" width="8" height="5" rx="2.5" fill="#1a1a1a" opacity="0.85" />
          <line x1="28" y1="18.5" x2="32" y2="18.5" stroke="#1a1a1a" strokeWidth="1" />
          <line x1="20" y1="18.5" x2="16" y2="17.5" stroke="#1a1a1a" strokeWidth="0.7" />
          <line x1="22" y1="17.5" x2="25" y2="18" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
          <line x1="34" y1="17.5" x2="37" y2="18" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
        </g>
      )}

      {/* $50K: Gold watch */}
      {stage === 5 && (
        <g>
          <rect x="42" y="45" width="6" height="4.5" rx="1.5" fill="#daa520" />
          <rect x="43" y="45.5" width="4" height="3.5" rx="1" fill="#0a0a1a" />
          <circle cx="45" cy="47.2" r="0.5" fill="#ffd700" />
          <rect x="43.5" y="43" width="3" height="2.5" rx="0.6" fill="#c8a830" />
          <rect x="43.5" y="49.5" width="3" height="2.5" rx="0.6" fill="#c8a830" />
        </g>
      )}

      {/* $100K: Scarf */}
      {stage === 6 && (
        <g>
          <path d="M 23 32 Q 30 35 37 32" fill="none" stroke="#8a7050" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="37" y1="32" x2="39" y2="40" stroke="#8a7050" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}

      {/* $150K: Briefcase */}
      {stage === 7 && (
        <g>
          <rect x="43" y="44" width="12" height="8" rx="2" fill="#2a2a2a" />
          <rect x="46.5" y="42" width="5" height="3" rx="1" fill="none" stroke="#3a3a3a" strokeWidth="0.7" />
          <line x1="49" y1="47.5" x2="49" y2="49" stroke="#c0a040" strokeWidth="0.6" />
          <circle cx="49" cy="49.5" r="0.6" fill="#c0a040" />
        </g>
      )}

      {/* $200K: Sunglasses */}
      {stage === 8 && (
        <g>
          <rect x="20" y="16" width="8" height="5" rx="2.5" fill="#2a2a2a" opacity="0.8" />
          <rect x="32" y="16" width="8" height="5" rx="2.5" fill="#2a2a2a" opacity="0.8" />
          <line x1="28" y1="18.5" x2="32" y2="18.5" stroke="#2a2a2a" strokeWidth="1" />
          <line x1="20" y1="18.5" x2="16" y2="17.5" stroke="#2a2a2a" strokeWidth="0.7" />
          <line x1="22" y1="17.5" x2="26" y2="18" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
          <line x1="34" y1="17.5" x2="38" y2="18" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
        </g>
      )}
    </svg>
  )
}

// ─── Stage Backgrounds (은은한 실루엣 파노라마) ──────────────────────────────

const STAGE_BG = [
  { grad: 'linear-gradient(180deg, #0a0a14 0%, #15151f 40%, #0d0d14 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #0a0a16 0%, #14141e 40%, #0f0f16 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #0a0e18 0%, #0f1422 40%, #0a0e18 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #1a1410 0%, #201810 40%, #1a1410 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #0a0a1a 0%, #14102a 40%, #0a0a1a 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #060818 0%, #0a1028 40%, #060818 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #08081a 0%, #0e0e28 40%, #08081a 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #1a1008 0%, #2a1810 40%, #1a1008 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
  { grad: 'linear-gradient(180deg, #081820 0%, #0a2030 40%, #081820 100%)', overlay: 'linear-gradient(to bottom, rgba(13,13,26,0.7), rgba(13,13,26,0.85))' },
]

/* Helper: 건물 실루엣 + 창문 */
function BuildingSilhouette({ x, y, w, h, fill, windowRows = 3, windowCols = 2 }) {
  const windows = []
  const ww = 3, wh = 3, px = (w - windowCols * (ww + 4)) / 2 + 2, py = 6
  for (let r = 0; r < windowRows; r++) {
    for (let c = 0; c < windowCols; c++) {
      const lit = (r * 3 + c * 7) % 5 !== 0
      windows.push(
        <rect key={`${r}-${c}`} x={x + px + c * (ww + 4)} y={y + py + r * (wh + 5)}
          width={ww} height={wh} rx="0.5"
          fill={lit ? 'rgba(255,200,100,0.08)' : '#181822'} />
      )
    }
  }
  return <g><rect x={x} y={y} width={w} height={h} fill={fill || '#1a1a24'} />{windows}</g>
}

/* Helper: 가로등 */
function Streetlight({ x, baseY = 82, topY = 10 }) {
  return (
    <g>
      <line x1={x} y1={topY} x2={x} y2={baseY} stroke="#2a2a36" strokeWidth="1.5" />
      <circle cx={x} cy={topY - 1} r="3" fill="rgba(255,200,100,0.15)" />
      <circle cx={x} cy={topY - 1} r="1.5" fill="rgba(255,200,100,0.3)" className="flicker-light" />
      <ellipse cx={x} cy={baseY} rx="10" ry="3" fill="rgba(255,200,100,0.04)" />
    </g>
  )
}

/* Helper: 별 */
function Stars({ count = 4, seed = 0 }) {
  return Array.from({ length: count }).map((_, i) => (
    <circle key={i}
      cx={30 + ((i + seed) * 97) % 440}
      cy={3 + ((i + seed) * 37) % 14}
      r={0.4 + (i % 3) * 0.2}
      fill="#fff"
      opacity={0.3 + (i % 3) * 0.15}
      className={i % 2 === 0 ? 'star-twinkle' : 'star-twinkle-2'} />
  ))
}

/* Helper: 보도블록 */
function Sidewalk({ y = 82 }) {
  return (
    <g>
      <line x1="0" y1={y} x2="500" y2={y} stroke="#2a2a35" strokeWidth="0.8" />
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360, 390, 420, 450, 480].map(x => (
        <line key={x} x1={x} y1={y} x2={x} y2={y + 8} stroke="#2a2a35" strokeWidth="0.3" />
      ))}
    </g>
  )
}

function StageBackground({ stage }) {
  const bg = STAGE_BG[stage] || STAGE_BG[0]

  const scenes = {
    0: ( // 고시원 골목 — 좁은 골목, 낡은 건물, 가로등, 갈라진 바닥
      <g>
        <Stars count={3} seed={0} />
        <BuildingSilhouette x={0} y={18} w={50} h={82} windowRows={4} windowCols={2} />
        <BuildingSilhouette x={55} y={25} w={40} h={75} windowRows={3} windowCols={1} />
        <BuildingSilhouette x={400} y={12} w={45} h={88} windowRows={4} windowCols={2} />
        <BuildingSilhouette x={450} y={22} w={50} h={78} windowRows={3} windowCols={2} />
        <Streetlight x={120} topY={15} />
        <Streetlight x={350} topY={18} />
        <Sidewalk y={82} />
        <path d="M 150 82 L 160 90 L 175 85 L 190 92" fill="none" stroke="#2a2a34" strokeWidth="0.4" />
        <path d="M 280 82 L 290 88 L 300 85" fill="none" stroke="#2a2a34" strokeWidth="0.4" />
      </g>
    ),
    1: ( // 편의점이 있는 밤거리 장면
      <g>
        <Stars count={4} seed={1} />
        {/* 왼쪽 건물 */}
        <BuildingSilhouette x={0} y={20} w={55} h={80} windowRows={4} windowCols={2} />
        <BuildingSilhouette x={60} y={28} w={40} h={72} windowRows={3} windowCols={1} />
        {/* 편의점 건물 (중앙) */}
        <rect x={180} y={22} width={120} height={68} fill="#1c1c28" />
        {/* 간판 (텍스트 제거, 빛나는 간판 rect 실루엣으로만) */}
        <rect x={195} y={25} width={90} height={10} fill="rgba(68,220,136,0.06)" rx="1" />
        <rect x={210} y={27} width={12} height={5} rx="1" fill="rgba(68,220,136,0.1)" />
        <rect x={226} y={27} width={8} height={5} rx="1" fill="rgba(68,220,136,0.08)" />
        {/* 간판 따뜻한 빛 glow */}
        <ellipse cx={240} cy={30} rx={25} ry={4} fill="rgba(255,200,100,0.04)" />
        {/* 편의점 창문 (밝은 노란 빛) */}
        <rect x={188} y={42} width={20} height={22} fill="rgba(255,200,100,0.08)" rx="1" />
        <rect x={212} y={42} width={20} height={22} fill="rgba(255,200,100,0.06)" rx="1" />
        <rect x={236} y={42} width={35} height={22} fill="rgba(255,200,100,0.1)" rx="1" />
        <rect x={276} y={42} width={18} height={22} fill="rgba(255,200,100,0.06)" rx="1" />
        {/* 바닥 반사 */}
        <ellipse cx={240} cy={88} rx={50} ry={6} fill="rgba(68,220,136,0.04)" />
        {/* 오른쪽 건물들 */}
        <BuildingSilhouette x={330} y={18} w={50} h={82} windowRows={4} windowCols={2} />
        <BuildingSilhouette x={385} y={25} w={45} h={75} windowRows={3} windowCols={2} />
        <BuildingSilhouette x={435} y={15} w={65} h={85} windowRows={4} windowCols={2} />
        {/* 가로등 */}
        <Streetlight x={115} topY={12} />
        <Streetlight x={310} topY={14} />
        <Sidewalk y={82} />
      </g>
    ),
    2: ( // 원룸 — 모니터 실루엣, 작은 창문, 도시 불빛
      <g>
        <rect x="0" y="0" width="500" height="100" fill="#10101a" />
        {/* 창문 */}
        <rect x="360" y="10" width="70" height="45" rx="2" fill="#0a0a16" stroke="#22223a" strokeWidth="0.8" />
        <line x1="395" y1="10" x2="395" y2="55" stroke="#22223a" strokeWidth="0.4" />
        {/* 창밖 빌딩 실루엣 */}
        {[368, 378, 388, 400, 410, 418].map((x, i) => (
          <rect key={x} x={x} y={20 + (i % 3) * 6} width={3 + i % 2} height={15 + (i % 4) * 6}
            fill={`rgba(${80 + i * 12},${120 + i * 10},200,0.12)`} />
        ))}
        {/* 모니터 2개 실루엣 */}
        <rect x="100" y="45" width="50" height="32" rx="2" fill="#0d0d1a" stroke="rgba(66,165,245,0.2)" strokeWidth="0.5" />
        <rect x="102" y="47" width="46" height="26" rx="1" fill="rgba(66,165,245,0.04)" />
        <polyline points="106,65 114,58 122,62 130,55 138,60 146,54" fill="none" stroke="rgba(0,200,83,0.2)" strokeWidth="0.6" />
        <rect x="158" y="45" width="50" height="32" rx="2" fill="#0d0d1a" stroke="rgba(66,165,245,0.15)" strokeWidth="0.5" />
        <rect x="160" y="47" width="46" height="26" rx="1" fill="rgba(66,165,245,0.03)" />
        {/* 스탠드 */}
        <rect x="118" y="77" width="14" height="3" rx="1" fill="#222236" />
        <rect x="176" y="77" width="14" height="3" rx="1" fill="#222236" />
        {/* 책상 */}
        <rect x="80" y="80" width="150" height="3" rx="1" fill="#222236" />
        <ellipse cx="155" cy="85" rx="60" ry="8" fill="rgba(66,165,245,0.02)" />
      </g>
    ),
    3: ( // 깔끔한 카페 — 천장조명, 큰 창문, 소파
      <g>
        <rect x="0" y="0" width="500" height="100" fill="#14120e" />
        {/* 큰 창문 */}
        <rect x="300" y="8" width="160" height="55" rx="2" fill="#0e0e08" stroke="#2a2418" strokeWidth="0.8" />
        <line x1="380" y1="8" x2="380" y2="63" stroke="#2a2418" strokeWidth="0.4" />
        {/* 창밖 도시 실루엣 */}
        {[310, 325, 340, 360, 390, 410, 430, 445].map((x, i) => (
          <rect key={x} x={x} y={18 + (i % 3) * 8} width={4}
            height={12 + (i % 4) * 6} fill={`rgba(255,${180 + i * 6},${80 + i * 5},0.07)`} />
        ))}
        {/* 천장 조명 */}
        <line x1="180" y1="0" x2="180" y2="6" stroke="#3a3020" strokeWidth="0.4" />
        <circle cx="180" cy="8" r="3" fill="rgba(232,192,128,0.1)" />
        <circle cx="180" cy="8" r="1.5" fill="rgba(232,192,128,0.2)" className="flicker-light" />
        <ellipse cx="180" cy="85" rx="60" ry="8" fill="rgba(232,192,128,0.03)" />
        {/* 바닥 */}
        <rect x="0" y="78" width="500" height="22" fill="#18150e" />
        {/* 소파 */}
        <rect x="20" y="58" width="35" height="22" rx="3" fill="#24201a" />
        <rect x="70" y="62" width="22" height="18" rx="2" fill="#24201a" />
        {/* 테이블 */}
        <rect x="68" y="74" width="28" height="2.5" rx="1" fill="#302a1e" />
      </g>
    ),
    4: ( // 도심 네온 거리 — 빌딩, 네온 라인, 반사
      <g>
        <Stars count={3} seed={4} />
        <BuildingSilhouette x={0} y={8} w={35} h={92} windowRows={5} windowCols={1} />
        <BuildingSilhouette x={40} y={18} w={30} h={82} windowRows={4} windowCols={1} />
        <BuildingSilhouette x={400} y={5} w={40} h={95} windowRows={5} windowCols={2} />
        <BuildingSilhouette x={445} y={12} w={55} h={88} windowRows={4} windowCols={2} />
        {/* 네온 라인 */}
        <line x1="5" y1="22" x2="5" y2="65" stroke="#b794f6" strokeWidth="1" opacity="0.3" className="neon-pulse" />
        <line x1="30" y1="32" x2="30" y2="55" stroke="#ff44aa" strokeWidth="0.8" opacity="0.2" className="neon-pulse-2" />
        <line x1="410" y1="18" x2="410" y2="60" stroke="#42a5f5" strokeWidth="0.8" opacity="0.2" className="neon-pulse" />
        <line x1="470" y1="28" x2="470" y2="70" stroke="#b794f6" strokeWidth="1" opacity="0.3" className="neon-pulse-2" />
        {/* 바닥 젖은 반사 */}
        <rect x="0" y="82" width="500" height="18" fill="#0a0a16" />
        <line x1="0" y1="82" x2="500" y2="82" stroke="rgba(183,148,246,0.1)" strokeWidth="0.4" />
        <ellipse cx="20" cy="90" rx="15" ry="3" fill="rgba(183,148,246,0.03)" />
        <ellipse cx="460" cy="90" rx="18" ry="3" fill="rgba(66,165,245,0.03)" />
      </g>
    ),
    5: ( // 한강 야경 — 스카이라인, 강물, 다리
      <g>
        <Stars count={4} seed={5} />
        {/* 스카이라인 실루엣 */}
        {[50, 80, 110, 135, 170, 200, 240, 270, 300, 330, 360, 390, 420].map((x, i) => (
          <rect key={i} x={x} y={28 + (i % 3) * 6}
            width={10 + i % 6} height={30 - (i % 3) * 6}
            fill="#0c0c20" />
        ))}
        {/* 빌딩 창문 빛 (작은 점들) */}
        {[55, 90, 120, 180, 250, 310, 365, 395, 425].map((x, i) => (
          <rect key={i} x={x} y={32 + (i * 5) % 16} width="2" height="2"
            fill={`rgba(255,${200 + i * 4},${80 + i * 8},0.1)`} />
        ))}
        {/* 강물 */}
        <rect x="0" y="60" width="500" height="40" fill="#0a1530" />
        {/* 다리 */}
        <line x1="70" y1="56" x2="430" y2="56" stroke="#161630" strokeWidth="3" />
        {[110, 160, 210, 260, 310, 360].map(x => (
          <line key={x} x1={x} y1="56" x2={x} y2="60" stroke="#161630" strokeWidth="1" />
        ))}
        {/* 물결 */}
        <path d="M 0 66 Q 50 64 100 66 Q 150 68 200 66 Q 250 64 300 66 Q 350 68 400 66 Q 450 64 500 66"
          fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.4" />
        {/* 반사광 */}
        <ellipse cx="150" cy="75" rx="15" ry="2" fill="rgba(255,215,0,0.05)" className="water-glow" />
        <ellipse cx="300" cy="72" rx="20" ry="2" fill="rgba(255,215,0,0.04)" className="water-glow" />
      </g>
    ),
    6: ( // 펜트하우스 — 고층 야경, 난간, 도시 불빛
      <g>
        <Stars count={8} seed={6} />
        {/* 먼 빌딩 실루엣 */}
        {[25, 70, 140, 220, 300, 380, 440].map((x, i) => (
          <rect key={i} x={x} y={32 + (i % 4) * 8}
            width={6 + i % 4} height={38 - (i % 4) * 8}
            fill="#10101a" opacity="0.5" />
        ))}
        {/* 난간 */}
        <line x1="0" y1="72" x2="500" y2="72" stroke="#2a2a3a" strokeWidth="1.2" />
        {Array.from({ length: 17 }).map((_, i) => (
          <line key={i} x1={i * 30} y1="72" x2={i * 30} y2="75" stroke="#2a2a3a" strokeWidth="0.4" />
        ))}
        {/* 바닥 */}
        <rect x="0" y="75" width="500" height="25" fill="#161624" />
        {/* 도시 불빛 (작은 점들) */}
        {Array.from({ length: 40 }).map((_, i) => (
          <circle key={i}
            cx={8 + (i * 37) % 484}
            cy={78 + (i * 11) % 12}
            r={0.4 + (i % 3) * 0.2}
            fill={['#ffd700', '#fff', '#42a5f5', '#ff8888', '#b794f6'][i % 5]}
            opacity={0.1 + (i % 4) * 0.04} />
        ))}
      </g>
    ),
    7: ( // 해안도로 — 바다, 야자수, 석양
      <g>
        <defs>
          <linearGradient id="sunset-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a1808" />
            <stop offset="50%" stopColor="#3a2010" />
            <stop offset="100%" stopColor="#1a1008" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="500" height="50" fill="url(#sunset-grad)" />
        {/* 석양 */}
        <circle cx="400" cy="28" r="12" fill="rgba(255,136,85,0.15)" />
        <circle cx="400" cy="28" r="6" fill="rgba(255,136,85,0.2)" />
        {/* 바다 */}
        <rect x="0" y="52" width="500" height="25" fill="#0a1828" />
        <path d="M 0 56 Q 60 54 120 56 Q 180 58 240 56 Q 300 54 360 56 Q 420 58 500 56"
          fill="none" stroke="rgba(255,136,85,0.06)" strokeWidth="0.4" />
        <ellipse cx="400" cy="62" rx="30" ry="2" fill="rgba(255,136,85,0.05)" className="water-glow" />
        {/* 도로 */}
        <rect x="0" y="75" width="500" height="10" fill="#161620" />
        <line x1="0" y1="80" x2="500" y2="80" stroke="#22222e" strokeWidth="0.4" strokeDasharray="8 6" />
        <rect x="0" y="85" width="500" height="15" fill="#1a1a20" />
        {/* 야자수 */}
        <line x1="435" y1="18" x2="435" y2="52" stroke="#1e3818" strokeWidth="2.5" />
        <ellipse cx="422" cy="15" rx="16" ry="6" fill="#1e4018" opacity="0.6" className="palm-sway" />
        <ellipse cx="448" cy="13" rx="13" ry="5" fill="#1e4018" opacity="0.5" className="palm-sway" />
        <ellipse cx="430" cy="19" rx="10" ry="4" fill="#244820" opacity="0.4" className="palm-sway" />
        <Stars count={3} seed={7} />
      </g>
    ),
    8: ( // 프라이빗 비치 — 열대 해변, 맑은 바다, 야자수
      <g>
        <Stars count={5} seed={8} />
        <rect x="0" y="0" width="500" height="48" fill="#082028" />
        {/* 바다 */}
        <rect x="0" y="45" width="500" height="18" fill="#0a2838" />
        <rect x="0" y="50" width="500" height="10" fill="rgba(64,224,208,0.04)" />
        <path d="M 0 48 Q 60 46 120 48 Q 180 50 240 48 Q 300 46 360 48 Q 420 50 500 48"
          fill="none" stroke="rgba(64,224,208,0.06)" strokeWidth="0.4" />
        {/* 모래 */}
        <rect x="0" y="63" width="500" height="37" fill="#221e14" />
        <rect x="0" y="63" width="500" height="4" fill="#2a2418" />
        {/* 야자수 왼쪽 */}
        <line x1="45" y1="12" x2="45" y2="52" stroke="#1e3818" strokeWidth="3" />
        <ellipse cx="30" cy="10" rx="18" ry="6" fill="#1e4018" opacity="0.6" className="palm-sway" />
        <ellipse cx="58" cy="8" rx="14" ry="5" fill="#1e4018" opacity="0.5" className="palm-sway" />
        <ellipse cx="40" cy="15" rx="12" ry="4" fill="#244820" opacity="0.4" className="palm-sway" />
        {/* 야자수 오른쪽 */}
        <line x1="435" y1="16" x2="435" y2="52" stroke="#1e3818" strokeWidth="2.5" />
        <ellipse cx="422" cy="13" rx="15" ry="6" fill="#1e4018" opacity="0.5" className="palm-sway" />
        <ellipse cx="448" cy="11" rx="12" ry="5" fill="#1e4018" opacity="0.4" className="palm-sway" />
        {/* 해먹 */}
        <path d="M 40 38 Q 70 48 100 38" fill="none" stroke="rgba(170,100,50,0.3)" strokeWidth="1" />
      </g>
    ),
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'hidden', borderRadius: 16 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: bg.grad }} />
      <svg width="100%" height="100%" viewBox="0 0 500 100" preserveAspectRatio="none"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0.28 }}>
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
      padding: 12, position: 'relative', overflow: 'hidden',
      backgroundImage: `linear-gradient(to top right, ${tint}, transparent)`,
      width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flexShrink: 0, width: 55, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <VectorChar stage={stage} height={100} faceRight />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'Inter, monospace', fontWeight: 600, lineHeight: 1.7 }}>현재 단계</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace', marginBottom: 4, whiteSpace: 'nowrap' }}>{current.icon} {current.label}</div>
          {next ? (
            <div style={{ marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <span style={{ fontSize: 11, color: '#4b5563', fontFamily: 'Inter, monospace', lineHeight: 1.7 }}>다음: {next.label} 🔒</span>
            </div>
          ) : <div style={{ fontSize: 11, color: '#fbbf24', fontFamily: 'Inter, monospace', marginBottom: 8, lineHeight: 1.7 }}>최종 단계 달성!</div>}
          {next && (
            <div>
              <div style={{ fontSize: 11, color: '#9e9e9e', fontFamily: 'Inter, monospace', lineHeight: 1.7, marginBottom: 2 }}>다음 변신까지</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#00c853', fontFamily: 'Inter, monospace', lineHeight: 1.7, marginBottom: 6 }}>{fmtDollar(stageRemaining)} 남음</div>
              <div style={{ width: '100%', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${stageProgress}%`, height: '100%', borderRadius: 3, background: stage <= 1 ? '#cd7f32' : stage <= 4 ? INFO : '#ffd700', transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace', marginTop: 2, textAlign: 'right', lineHeight: 1.7 }}>{stageProgress.toFixed(1)}%</div>
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
          {/* 캐릭터 (64px, 오른쪽 바라봄) */}
          <div className="char-bounce">
            <VectorChar stage={stage} height={64} faceRight />
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
