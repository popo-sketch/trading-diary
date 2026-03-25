import { useMemo } from 'react'
import { computeJourneyState, getJourneyBriefing, JOURNEY_GOAL, CHECKPOINTS } from '../utils/journeyEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const CP_LABELS = {
  1000: '1K', 5000: '5K', 10000: '10K', 25000: '25K',
  50000: '50K', 100000: '100K', 150000: '150K', 200000: '200K',
}

// 보상 아이콘 — 값어치에 비례
const CP_REWARDS = {
  1000:   { icon: '🍎', name: '사과',       title: 'FIRST 1K' },
  5000:   { icon: '🥇', name: '금메달',     title: 'DISCIPLINE' },
  10000:  { icon: '💎', name: '다이아몬드', title: 'SURVIVOR' },
  25000:  { icon: '👜', name: '명품백',     title: 'STRUCTURE' },
  50000:  { icon: '⌚', name: '롤렉스',     title: 'MOMENTUM' },
  100000: { icon: '🏎️', name: '람보르기니', title: 'HALFWAY' },
  150000: { icon: '🏠', name: '펜트하우스', title: 'ENDGAME' },
  200000: { icon: '👑', name: '레전드',     title: 'LEGEND' },
}

const PHASE_STYLE = {
  BUILD:   { color: '#3B82F6', glow: 'rgba(59,130,246,0.4)', label: 'BUILD' },
  ATTACK:  { color: '#10B981', glow: 'rgba(16,185,129,0.4)', label: 'ATTACK' },
  DEFENSE: { color: '#EAB308', glow: 'rgba(234,179,8,0.4)',  label: 'DEFENSE' },
  RESET:   { color: '#EF4444', glow: 'rgba(239,68,68,0.4)',  label: 'RESET' },
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

// ─── Reward Checkpoint Component ────────────────────────────────────────────

function RewardCheckpoint({ cp, reached, isNext, ps }) {
  const reward = CP_REWARDS[cp]
  const pct = (cp / JOURNEY_GOAL) * 100

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pct}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: reached ? 3 : isNext ? 2 : 1,
      }}
    >
      {/* 보상 아이콘 */}
      <div
        style={{
          width: reached ? 40 : 32,
          height: reached ? 40 : 32,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: reached ? 20 : 15,
          background: reached
            ? 'radial-gradient(circle, #1a1500 0%, #0d0d0d 100%)'
            : isNext
              ? `radial-gradient(circle, ${ps.color}22 0%, #0d0d0d 100%)`
              : '#111',
          border: reached
            ? '2px solid #fbbf24'
            : isNext
              ? `2px solid ${ps.color}66`
              : '1px solid #2a2a2a',
          boxShadow: reached
            ? '0 0 12px #fbbf2466, 0 0 24px #fbbf2422'
            : isNext
              ? `0 0 8px ${ps.color}33`
              : 'none',
          transition: 'all 0.3s ease',
          filter: reached ? 'none' : isNext ? 'none' : 'grayscale(1) opacity(0.35)',
        }}
      >
        {reward.icon}
      </div>

      {/* 라벨 */}
      <div
        style={{
          marginTop: 4,
          fontSize: 8,
          fontWeight: 700,
          fontFamily: 'Inter, monospace',
          color: reached ? '#fbbf24' : isNext ? ps.color : '#333',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          letterSpacing: '0.05em',
        }}
      >
        ${CP_LABELS[cp]}
      </div>

      {/* 달성 시 타이틀 */}
      {reached && (
        <div
          style={{
            fontSize: 7,
            fontWeight: 800,
            fontFamily: 'Inter, monospace',
            color: '#fbbf24',
            textAlign: 'center',
            letterSpacing: '0.08em',
            marginTop: 1,
            textShadow: '0 0 4px #fbbf2466',
          }}
        >
          {reward.title}
        </div>
      )}
    </div>
  )
}

// ─── Character ──────────────────────────────────────────────────────────────

function Character({ pct, charState, ps, cumulativePnl, nextCpRemaining }) {
  const stateEmoji = {
    run: '🏃', walk: '🚶', wobble: '😵', retreat: '😰', idle: '🧍',
  }[charState] ?? '🚶'

  return (
    <div
      style={{
        position: 'absolute',
        left: `${pct}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      {/* PNL 말풍선 */}
      <div
        style={{
          background: '#0a0f1a',
          border: `1px solid ${ps.color}88`,
          borderRadius: 8,
          padding: '4px 10px',
          marginBottom: 4,
          boxShadow: `0 0 10px ${ps.color}33`,
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{
          fontSize: 12, fontWeight: 800, color: ps.color,
          fontFamily: 'Inter, monospace', textAlign: 'center',
        }}>
          {fmtPnl(cumulativePnl)}
        </div>
        {nextCpRemaining > 0 && (
          <div style={{
            fontSize: 8, color: '#6b7280', fontFamily: 'Inter, monospace', textAlign: 'center',
          }}>
            다음까지 {fmtK(nextCpRemaining)}
          </div>
        )}
      </div>

      {/* 캐릭터 */}
      <div
        className={`char-anim-${charState}`}
        style={{
          fontSize: 26,
          filter: `drop-shadow(0 0 8px ${ps.color}66)`,
          lineHeight: 1,
        }}
      >
        {stateEmoji}
      </div>
    </div>
  )
}

// ─── Progress Road ──────────────────────────────────────────────────────────

function ProgressRoad({ journey, ps }) {
  const pct = Math.min(100, Math.max(0, journey.progressPercent))

  return (
    <div style={{ position: 'relative', height: 120, margin: '0 24px' }}>
      {/* 도로 배경 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: 6,
        transform: 'translateY(-50%)',
        background: '#1a1f2e',
        borderRadius: 3,
      }} />

      {/* 진행 바 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        width: `${pct}%`,
        height: 6,
        transform: 'translateY(-50%)',
        background: `linear-gradient(90deg, ${ps.color}44, ${ps.color})`,
        borderRadius: 3,
        boxShadow: `0 0 12px ${ps.color}66`,
        transition: 'width 0.5s ease',
      }} />

      {/* 네온 엣지 (상하) */}
      <div style={{
        position: 'absolute',
        top: 'calc(50% - 4px)',
        left: 0,
        width: `${pct}%`,
        height: 1,
        background: ps.color,
        opacity: 0.5,
        borderRadius: 1,
      }} />
      <div style={{
        position: 'absolute',
        top: 'calc(50% + 3px)',
        left: 0,
        width: `${pct}%`,
        height: 1,
        background: ps.color,
        opacity: 0.3,
        borderRadius: 1,
      }} />

      {/* 체크포인트 보상들 */}
      {CHECKPOINTS.map(cp => (
        <RewardCheckpoint
          key={cp}
          cp={cp}
          reached={journey.cumulativePnl >= cp}
          isNext={journey.nextCheckpoint === cp}
          ps={ps}
        />
      ))}

      {/* 캐릭터 */}
      <Character
        pct={pct}
        charState={journey.charState}
        ps={ps}
        cumulativePnl={journey.cumulativePnl}
        nextCpRemaining={journey.nextCpRemaining}
      />
    </div>
  )
}

// ─── Badge Row (획득한 보상) ─────────────────────────────────────────────────

function BadgeRow({ journey }) {
  const reached = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp)
  if (reached.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap',
      padding: '8px 16px', borderTop: '1px solid #141414',
    }}>
      {reached.map(cp => {
        const r = CP_REWARDS[cp]
        return (
          <div key={cp} style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontWeight: 700, fontFamily: 'Inter, monospace',
            color: '#fbbf24',
            background: 'linear-gradient(135deg, #150f00, #1f1500)',
            border: '1px solid #fbbf2455',
            borderRadius: 6, padding: '3px 8px',
            boxShadow: '0 0 6px #fbbf2422',
          }}>
            <span style={{ fontSize: 12 }}>{r.icon}</span>
            {r.name}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function JourneyRoad({ allTimeAnalytics }) {
  const journey = useMemo(() => computeJourneyState(allTimeAnalytics), [allTimeAnalytics])
  const { phase, briefing } = useMemo(() => getJourneyBriefing(journey, allTimeAnalytics), [journey, allTimeAnalytics])
  const ps = PHASE_STYLE[phase] ?? PHASE_STYLE.BUILD

  return (
    <div style={{
      background: 'linear-gradient(180deg, #070a0f 0%, #0d1117 60%, #0a0c10 100%)',
      border: `1px solid ${ps.color}40`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: `0 0 30px ${ps.color}12, inset 0 1px 0 ${ps.color}18`,
      position: 'relative',
    }}>
      {/* 배경 텍스처 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 40px, ${ps.color}04 40px, ${ps.color}04 41px)`,
        pointerEvents: 'none',
      }} />

      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px', borderBottom: '1px solid #14141488',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#4a4a4a',
            letterSpacing: '0.14em', fontFamily: 'Inter, monospace',
          }}>
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
            <span style={{
              color: journey.streakType === 'win' ? '#10B981' : '#EF4444',
              fontWeight: 600, fontFamily: 'Inter, monospace',
            }}>
              {journey.streak}연{journey.streakType === 'win' ? '승' : '패'}
            </span>
          )}
          <span style={{
            color: ps.color, fontWeight: 700, fontFamily: 'Inter, monospace',
          }}>
            {journey.progressPercent.toFixed(2)}%
          </span>
          {CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length > 0 && (
            <span style={{ fontSize: 9, color: '#fbbf24', fontFamily: 'Inter, monospace' }}>
              {CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length}/{CHECKPOINTS.length} CLEARED
            </span>
          )}
        </div>
      </div>

      {/* 도로 + 보상 */}
      <div style={{ padding: '16px 8px 8px', position: 'relative', zIndex: 1 }}>
        <ProgressRoad journey={journey} ps={ps} />
      </div>

      {/* 간단 통계 */}
      <div style={{ display: 'flex', borderTop: '1px solid #141414' }}>
        {[
          { label: '누적 PNL', value: fmtPnl(journey.cumulativePnl),
            color: journey.cumulativePnl >= 0 ? '#10B981' : '#EF4444' },
          { label: '다음 체크포인트', value: journey.nextCheckpoint ? `${fmtK(journey.nextCheckpoint)} (−${fmtK(journey.nextCpRemaining)})` : '🏁 완주!',
            color: '#a0a0a0' },
          { label: '진행률', value: `${journey.progressPercent.toFixed(2)}%`, color: ps.color },
        ].map(({ label, value, color }, i) => (
          <div key={label} style={{
            flex: 1, padding: '8px 14px',
            borderRight: i < 2 ? '1px solid #141414' : 'none',
          }}>
            <div style={{
              fontSize: 8, color: '#3a3a3a', textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 2, fontFamily: 'Inter, monospace',
            }}>{label}</div>
            <div style={{
              fontSize: 13, fontWeight: 700, color, fontFamily: 'Inter, monospace',
            }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 획득 보상 */}
      <BadgeRow journey={journey} />

      {/* 브리핑 */}
      <div style={{
        padding: '8px 16px 10px', borderTop: '1px solid #141414',
        position: 'relative', zIndex: 1,
      }}>
        <p style={{
          fontSize: 12, lineHeight: 1.6, color: `${ps.color}cc`,
          fontFamily: "'Noto Sans KR', sans-serif",
        }}>
          {briefing}
        </p>
      </div>

      <style>{`
        .char-anim-walk    { animation: cWalk 1.4s ease-in-out infinite; }
        .char-anim-run     { animation: cRun 0.55s ease-in-out infinite; }
        .char-anim-wobble  { animation: cWobble 0.75s ease-in-out infinite; }
        .char-anim-retreat { animation: cRetreat 1.8s ease-in-out infinite; }
        .char-anim-idle    { opacity: 0.4; }
        @keyframes cWalk   { 0%,100%{transform:translate(-50%,-50%) translateY(0)} 50%{transform:translate(-50%,-50%) translateY(-3px)} }
        @keyframes cRun    { 0%,100%{transform:translate(-50%,-50%) translateY(0)} 30%{transform:translate(-50%,-50%) translateY(-6px)} }
        @keyframes cWobble { 0%,100%{transform:translate(-50%,-50%) translateX(0)} 25%{transform:translate(-50%,-50%) translateX(-3px)} 75%{transform:translate(-50%,-50%) translateX(3px)} }
        @keyframes cRetreat { 0%{transform:translate(-50%,-50%) translateX(0)} 50%{transform:translate(-50%,-50%) translateX(-5px)} 100%{transform:translate(-50%,-50%) translateX(0)} }
      `}</style>
    </div>
  )
}
