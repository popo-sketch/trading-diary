import { useMemo, useEffect, useRef, useState } from 'react'
import { computeJourneyState, getJourneyBriefing, JOURNEY_GOAL, CHECKPOINTS } from '../utils/journeyEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const CP_LABELS = {
  1000: '1K', 5000: '5K', 10000: '10K', 25000: '25K',
  50000: '50K', 100000: '100K', 150000: '150K', 200000: '200K',
}
const CP_TITLES = {
  1000: 'FIRST 1K', 5000: 'DISCIPLINE', 10000: 'SURVIVOR',
  25000: 'STRUCTURE', 50000: 'MOMENTUM', 100000: 'HALFWAY',
  150000: 'ENDGAME', 200000: 'LEGEND',
}
const CP_ICONS = {
  1000: '🥾', 5000: '🧱', 10000: '⚔️', 25000: '🏗️',
  50000: '🌊', 100000: '🔥', 150000: '🌅', 200000: '👑',
}

const PHASE_STYLE = {
  BUILD:   { color: '#3B82F6', glow: 'rgba(59,130,246,0.4)', label: 'BUILD',   bg: '#0f172a' },
  ATTACK:  { color: '#10B981', glow: 'rgba(16,185,129,0.4)', label: 'ATTACK',  bg: '#0a1f17' },
  DEFENSE: { color: '#EAB308', glow: 'rgba(234,179,8,0.4)',  label: 'DEFENSE', bg: '#1a1500' },
  RESET:   { color: '#EF4444', glow: 'rgba(239,68,68,0.4)',  label: 'RESET',   bg: '#1a0a0a' },
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtPnl(n) {
  const sign = n >= 0 ? '+' : '-'
  const abs = Math.abs(n)
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`
  return `${sign}$${abs.toFixed(0)}`
}
function fmtK(n) {
  const abs = Math.abs(n)
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`
  if (abs >= 1e3) return `$${Math.round(abs / 1e3)}K`
  return `$${Math.round(abs)}`
}

// ─── SVG Road (cinematic, neon-edge) ─────────────────────────────────────────

const ROAD_W = 1100
const ROAD_H = 190
const ROAD_Y = 105
const ROAD_PAD = 56
const ROAD_LEN = ROAD_W - ROAD_PAD * 2
const RH = 16 // road half-height (total 32px)

function pnlToX(pnl) {
  return ROAD_PAD + Math.min(1, Math.max(0, pnl / JOURNEY_GOAL)) * ROAD_LEN
}
function cpToX(cp) {
  return ROAD_PAD + (cp / JOURNEY_GOAL) * ROAD_LEN
}

function CharacterSVG({ x, charState, color, glowColor }) {
  const cls = `char-${charState}`
  return (
    <g transform={`translate(${x - 10}, ${ROAD_Y - 48})`} className={cls}>
      <ellipse cx="10" cy="50" rx="22" ry="6" fill={glowColor} opacity="0.15" />
      <ellipse cx="10" cy="49" rx="11" ry="3" fill="#000" opacity="0.5" />
      <circle cx="10" cy="5" r="6" fill={color} style={{ filter: `drop-shadow(0 0 5px ${color}aa)` }} />
      <rect x="5" y="12" width="10" height="4" rx="1" fill={color} />
      <rect x="3" y="16" width="14" height="16" rx="3.5" fill={color} style={{ filter: `drop-shadow(0 0 6px ${color}66)` }} />
      <rect x="-2" y="16" width="5" height="13" rx="2.5" fill={color} />
      <rect x="17" y="16" width="5" height="13" rx="2.5" fill={color} />
      <rect x="3" y="32" width="5" height="14" rx="2.5" fill={color} />
      <rect x="12" y="32" width="5" height="14" rx="2.5" fill={color} />
    </g>
  )
}

function CheckpointMarker({ cp, reached, isNext, ps }) {
  const x = cpToX(cp)
  const isGoal = cp === JOURNEY_GOAL
  const markerColor = reached ? '#fbbf24' : isNext ? ps.color : '#2a2a2a'
  const alpha = reached ? 1 : isNext ? 0.7 : 0.25

  return (
    <g opacity={alpha}>
      {/* pillar glow */}
      {reached && (
        <rect x={x - 1} y={ROAD_Y - RH - 24} width={2} height={24} rx={1}>
          <animate attributeName="opacity" values="0.4;0.9;0.4" dur="3s" repeatCount="indefinite" />
        </rect>
      )}
      {reached && (
        <rect x={x - 1} y={ROAD_Y - RH - 24} width={2} height={24} fill="#fbbf24" opacity="0.7" />
      )}

      {/* vertical tick */}
      <line x1={x} y1={ROAD_Y - RH} x2={x} y2={ROAD_Y + RH}
        stroke={markerColor} strokeWidth={reached ? 1.5 : 0.8}
        strokeDasharray={reached ? 'none' : '3 3'} opacity={reached ? 0.6 : 0.3} />

      {/* symbol */}
      {reached ? (
        <polygon
          points={`${x},${ROAD_Y - RH - 32} ${x + 8},${ROAD_Y - RH - 23} ${x},${ROAD_Y - RH - 14} ${x - 8},${ROAD_Y - RH - 23}`}
          fill="#fbbf24"
          style={{ filter: 'drop-shadow(0 0 4px #fbbf24)' }}
        />
      ) : (
        <rect x={x - 4} y={ROAD_Y - RH - 24} width={8} height={8} rx={2}
          fill={isNext ? ps.color : 'none'} stroke={markerColor} strokeWidth={isNext ? 1.2 : 0.8}
          opacity={isNext ? 0.8 : 0.4} />
      )}

      {/* badge title */}
      {reached && (
        <text x={x} y={ROAD_Y - RH - 38} textAnchor="middle"
          fill="#fbbf24" fontSize="7.5" fontWeight="800"
          fontFamily="Inter, monospace" letterSpacing="0.06em"
          style={{ filter: 'drop-shadow(0 0 3px #fbbf2488)' }}>
          {CP_TITLES[cp] ?? ''}
        </text>
      )}

      {/* label */}
      <text x={x} y={ROAD_Y + RH + 13} textAnchor="middle"
        fill={reached ? '#d4a017' : isNext ? '#93c5fd' : '#333'}
        fontSize={isGoal ? '10' : '9'} fontWeight={reached || isGoal ? '700' : '400'}
        fontFamily="Inter, monospace">
        {isGoal ? '$200K' : `$${CP_LABELS[cp]}`}
      </text>

      {/* icon */}
      {reached && (
        <text x={x} y={ROAD_Y + RH + 25} textAnchor="middle" fontSize="10">
          {CP_ICONS[cp] ?? ''}
        </text>
      )}
    </g>
  )
}

function SVGRoad({ journey, ps }) {
  const pct = journey.progressPercent / 100  // 0~1
  const charX = pnlToX(Math.max(0, journey.cumulativePnl))
  const pctStr = (pct * 100).toFixed(1)

  // next checkpoint
  const nextCp = journey.nextCheckpoint
  const distToNext = journey.nextCpRemaining

  return (
    <svg viewBox={`0 0 ${ROAD_W} ${ROAD_H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="jr-base" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a1f2e" />
          <stop offset={`${pctStr}%`} stopColor="#252d3e" />
          <stop offset={`${pctStr}%`} stopColor="#0f1318" />
          <stop offset="100%" stopColor="#080b0f" />
        </linearGradient>
        <linearGradient id="jr-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={ps.color} stopOpacity="0.1" />
          <stop offset="80%" stopColor={ps.color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={ps.color} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="jr-pillar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.8" />
        </linearGradient>
        <filter id="jr-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {/* ambient shadow */}
      <rect x={ROAD_PAD - 3} y={ROAD_Y - RH - 4} width={ROAD_LEN + 6} height={RH * 2 + 8}
        rx="9" fill={ps.color} opacity="0.03" />

      {/* road base */}
      <rect x={ROAD_PAD} y={ROAD_Y - RH} width={ROAD_LEN} height={RH * 2}
        rx="6" fill="url(#jr-base)" stroke="#1f2937" strokeWidth="1" />

      {/* progress fill */}
      {pct > 0 && (
        <rect x={ROAD_PAD} y={ROAD_Y - RH + 1} width={ROAD_LEN * pct} height={RH * 2 - 2}
          rx="5" fill="url(#jr-fill)" />
      )}

      {/* top edge glow */}
      <rect x={ROAD_PAD} y={ROAD_Y - RH} width={ROAD_LEN} height={2}
        rx="1" fill={ps.color} opacity="0.45" />
      {/* bottom edge glow */}
      <rect x={ROAD_PAD} y={ROAD_Y + RH - 2} width={ROAD_LEN} height={2}
        rx="1" fill={ps.color} opacity="0.25" />

      {/* center dashed line */}
      <line x1={ROAD_PAD} y1={ROAD_Y} x2={ROAD_PAD + ROAD_LEN * pct} y2={ROAD_Y}
        stroke={ps.color} strokeWidth="1.5" strokeDasharray="10 7" opacity="0.4" />
      <line x1={ROAD_PAD + ROAD_LEN * pct} y1={ROAD_Y} x2={ROAD_PAD + ROAD_LEN} y2={ROAD_Y}
        stroke="#1f2937" strokeWidth="1" strokeDasharray="10 7" opacity="0.3" />

      {/* destination $200K marker */}
      <polygon
        points={`${ROAD_PAD + ROAD_LEN},${ROAD_Y - RH - 44} ${ROAD_PAD + ROAD_LEN + 10},${ROAD_Y - RH - 34} ${ROAD_PAD + ROAD_LEN},${ROAD_Y - RH - 24} ${ROAD_PAD + ROAD_LEN - 10},${ROAD_Y - RH - 34}`}
        fill="#fbbf24" style={{ filter: 'drop-shadow(0 0 6px #fbbf24)' }}
      />

      {/* START label */}
      <text x={ROAD_PAD} y={ROAD_Y + RH + 13} textAnchor="middle"
        fill="#333" fontSize="9" fontFamily="Inter, monospace">START</text>

      {/* checkpoints */}
      {CHECKPOINTS.map(cp => (
        <CheckpointMarker key={cp} cp={cp} reached={journey.cumulativePnl >= cp}
          isNext={nextCp === cp} ps={ps} />
      ))}

      {/* character */}
      <CharacterSVG x={charX} charState={journey.charState} color={ps.color} glowColor={ps.glow} />

      {/* position info card */}
      {journey.cumulativePnl !== 0 && (() => {
        const cardW = 126
        const cx = Math.min(Math.max(charX, ROAD_PAD + cardW / 2 + 4), ROAD_W - cardW / 2 - 4)
        const cardX = cx - cardW / 2
        const cardY = ROAD_Y - RH - 64
        return (
          <g>
            <line x1={charX} y1={ROAD_Y - RH - 2} x2={cx} y2={cardY + 32}
              stroke={ps.color} strokeWidth="1" opacity="0.35" strokeDasharray="4 3" />
            <rect x={cardX} y={cardY} width={cardW} height={30} rx="6"
              fill="#0a0f1a" stroke={ps.color} strokeWidth="1.2" opacity="0.97"
              style={{ filter: `drop-shadow(0 0 5px ${ps.color}33)` }} />
            <text x={cardX + 8} y={cardY + 13} fill={ps.color} fontSize="11"
              fontWeight="800" fontFamily="Inter, monospace">
              {fmtPnl(journey.cumulativePnl)}
            </text>
            {nextCp && (
              <text x={cardX + 8} y={cardY + 24} fill="#6b7280" fontSize="9"
                fontFamily="Inter, monospace">
                다음까지 -{fmtK(distToNext)}
              </text>
            )}
          </g>
        )
      })()}
    </svg>
  )
}

// ─── Stats Row ──────────────────────────────────────────────────────────────

function StatsRow({ journey, ps }) {
  const items = [
    { label: '누적 PNL', value: fmtPnl(journey.cumulativePnl),
      color: journey.cumulativePnl >= 0 ? '#10B981' : '#EF4444' },
    { label: '다음 체크포인트', value: journey.nextCheckpoint ? `${fmtK(journey.nextCheckpoint)} (−${fmtK(journey.nextCpRemaining)})` : '🏁 완주!',
      color: '#a0a0a0' },
    { label: '목표까지', value: journey.remaining > 0 ? fmtK(journey.remaining) : '달성!',
      color: '#6B7280' },
    { label: '진행률', value: `${journey.progressPercent.toFixed(2)}%`, color: ps.color },
  ]

  return (
    <div style={{ display: 'flex', borderTop: '1px solid #141414' }}>
      {items.map(({ label, value, color }, i) => (
        <div key={label} style={{
          flex: 1, padding: '10px 14px',
          borderRight: i < items.length - 1 ? '1px solid #141414' : 'none',
        }}>
          <div style={{ fontSize: 8.5, color: '#3a3a3a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3, fontFamily: 'Inter, monospace' }}>{label}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: 'Inter, monospace' }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Badge Row ──────────────────────────────────────────────────────────────

function BadgeRow({ journey }) {
  const reached = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp)
  if (reached.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 5, flexWrap: 'wrap',
      padding: '8px 14px', borderTop: '1px solid #141414',
    }}>
      {reached.map(cp => (
        <div key={cp} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 9, fontWeight: 700, fontFamily: 'Inter, monospace',
          color: '#fbbf24',
          background: 'linear-gradient(135deg, #150f00, #1f1500)',
          border: '1px solid #fbbf2455',
          borderRadius: 5, padding: '3px 8px',
          boxShadow: '0 0 6px #fbbf2422',
        }}>
          <span style={{ fontSize: 11 }}>{CP_ICONS[cp]}</span>
          {CP_TITLES[cp]}
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function JourneyRoad({ allTimeAnalytics }) {
  const journey = useMemo(() => computeJourneyState(allTimeAnalytics), [allTimeAnalytics])
  const { phase, briefing } = useMemo(() => getJourneyBriefing(journey, allTimeAnalytics), [journey, allTimeAnalytics])
  const ps = PHASE_STYLE[phase] ?? PHASE_STYLE.BUILD

  const stateLabel = {
    run: '⚡ 달리는 중', wobble: '⚠ 흔들리는 중',
    retreat: '↙ 후퇴 중', idle: '— 대기 중', walk: '',
  }[journey.charState] ?? ''

  return (
    <div style={{
      background: `linear-gradient(180deg, #070a0f 0%, #0d1117 60%, #0a0c10 100%)`,
      border: `1px solid ${ps.color}40`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: `0 0 30px ${ps.color}12, inset 0 1px 0 ${ps.color}18`,
      position: 'relative',
    }}>
      {/* subtle texture */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 40px, ${ps.color}04 40px, ${ps.color}04 41px)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid #14141488',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#4a4a4a', letterSpacing: '0.14em', fontFamily: 'Inter, monospace' }}>
            JOURNEY TO $200K
          </span>
          <span style={{
            fontSize: 9, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: ps.color, background: `${ps.color}15`,
            border: `1px solid ${ps.color}40`, borderRadius: 5,
            padding: '2px 8px', letterSpacing: '0.1em',
          }}>
            {ps.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 11 }}>
          {journey.streak > 0 && (
            <span style={{ color: journey.streakType === 'win' ? '#10B981' : '#EF4444', fontWeight: 600, fontFamily: 'Inter, monospace' }}>
              {journey.streak}연{journey.streakType === 'win' ? '승' : '패'}
            </span>
          )}
          <span style={{ color: '#4a4a4a', fontFamily: 'Inter, monospace' }}>
            <span style={{ color: ps.color, fontWeight: 700 }}>{journey.progressPercent.toFixed(2)}%</span>
          </span>
          {CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length > 0 && (
            <span style={{ fontSize: 9, color: '#fbbf24', fontFamily: 'Inter, monospace' }}>
              {CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length}/{CHECKPOINTS.length} CLEARED
            </span>
          )}
        </div>
      </div>

      {/* SVG Road */}
      <div style={{ padding: '8px 8px 0', position: 'relative', zIndex: 1 }}>
        <SVGRoad journey={journey} ps={ps} />
        {stateLabel && (
          <div style={{ textAlign: 'center', fontSize: 9, color: `${ps.color}60`, marginTop: -4, marginBottom: 4 }}>
            {stateLabel}
          </div>
        )}
      </div>

      {/* Stats */}
      <StatsRow journey={journey} ps={ps} />

      {/* Badges */}
      <BadgeRow journey={journey} />

      {/* Briefing */}
      <div style={{
        padding: '10px 16px 12px', borderTop: '1px solid #141414',
        position: 'relative', zIndex: 1,
      }}>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: `${ps.color}cc`, fontFamily: "'Noto Sans KR', sans-serif" }}>
          {briefing}
        </p>
      </div>

      <style>{`
        .char-walk    { animation: cWalk 1.4s ease-in-out infinite; }
        .char-run     { animation: cRun 0.55s ease-in-out infinite; }
        .char-wobble  { animation: cWobble 0.75s ease-in-out infinite; }
        .char-retreat { animation: cRetreat 1.8s ease-in-out infinite; }
        .char-idle    { opacity: 0.35; }
        @keyframes cWalk   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes cRun    { 0%,100%{transform:translateY(0) scaleY(1)} 30%{transform:translateY(-6px) scaleY(0.92)} }
        @keyframes cWobble { 0%,100%{transform:translateX(0) rotate(0)} 25%{transform:translateX(-3px) rotate(-10deg)} 75%{transform:translateX(3px) rotate(10deg)} }
        @keyframes cRetreat { 0%{transform:translateX(0) rotate(-8deg)} 50%{transform:translateX(-5px) rotate(-14deg)} 100%{transform:translateX(0) rotate(-8deg)} }
      `}</style>
    </div>
  )
}
