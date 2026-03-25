import { useMemo, useState, useEffect } from 'react'
import { computeJourneyState, getJourneyBriefing, JOURNEY_GOAL, CHECKPOINTS } from '../utils/journeyEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const CP_LABELS = {
  1000: '1K', 5000: '5K', 10000: '10K', 25000: '25K',
  50000: '50K', 100000: '100K', 150000: '150K', 200000: '200K',
}

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

// ─── Personal Best Calculation ───────────────────────────────────────────────

function computePersonalBests(allTimeAnalytics) {
  const curve = allTimeAnalytics?.equity_curve ?? []
  if (curve.length === 0) return null

  // Best single day PNL
  let bestDayPnl = 0, bestDayDate = null
  let longestWinStreak = 0, currentWinStreak = 0

  for (let i = 0; i < curve.length; i++) {
    const prev = i > 0 ? curve[i - 1].cumulative_pnl : 0
    const delta = curve[i].cumulative_pnl - prev
    if (delta > bestDayPnl) {
      bestDayPnl = delta
      bestDayDate = curve[i].date
    }
    if (delta > 0) {
      currentWinStreak++
      if (currentWinStreak > longestWinStreak) longestWinStreak = currentWinStreak
    } else if (delta < 0) {
      currentWinStreak = 0
    }
  }

  // Pace estimation
  const firstDate = curve[0]?.date
  const lastDate = curve[curve.length - 1]?.date
  const cumulativePnl = curve[curve.length - 1]?.cumulative_pnl ?? 0
  let estimatedDate = null

  if (firstDate && lastDate && cumulativePnl > 0) {
    const startMs = new Date(firstDate).getTime()
    const endMs = new Date(lastDate).getTime()
    const daysTaken = Math.max(1, (endMs - startMs) / (1000 * 60 * 60 * 24))
    const pnlPerDay = cumulativePnl / daysTaken
    if (pnlPerDay > 0) {
      const remaining = JOURNEY_GOAL - cumulativePnl
      const daysRemaining = remaining / pnlPerDay
      const targetMs = endMs + daysRemaining * 24 * 60 * 60 * 1000
      const targetDate = new Date(targetMs)
      estimatedDate = `${targetDate.getFullYear()}년 ${targetDate.getMonth() + 1}월`
    }
  }

  return {
    bestDayPnl,
    bestDayDate,
    longestWinStreak,
    estimatedDate,
  }
}

// ─── Milestone Tooltip ──────────────────────────────────────────────────────

function MilestoneTooltip({ cp, reached, cumulativePnl, curve }) {
  // Find achievement date
  let achievedDate = null
  if (reached && curve) {
    for (const p of curve) {
      if (p.cumulative_pnl >= cp) {
        achievedDate = p.date
        break
      }
    }
  }
  const remaining = cp - cumulativePnl

  return (
    <div style={{
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 8,
      background: '#1a1a2e',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      padding: '8px 12px',
      whiteSpace: 'nowrap',
      zIndex: 100,
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      fontSize: 11,
      fontFamily: 'Inter, monospace',
    }}>
      <div style={{ fontWeight: 700, color: reached ? '#fbbf24' : '#9ca3af', marginBottom: 2 }}>
        ${CP_LABELS[cp]} {reached ? '✓ 달성' : '🔒 미달성'}
      </div>
      {reached && achievedDate && (
        <div style={{ color: '#6b7280', fontSize: 10 }}>달성일: {achievedDate}</div>
      )}
      {!reached && (
        <div style={{ color: '#6b7280', fontSize: 10 }}>남은 금액: {fmtK(remaining)}</div>
      )}
      <div style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '5px solid rgba(255,255,255,0.1)',
      }} />
    </div>
  )
}

// ─── Reward Checkpoint Component ────────────────────────────────────────────

function RewardCheckpoint({ cp, reached, isNext, ps, cumulativePnl, curve }) {
  const [hovered, setHovered] = useState(false)
  const reward = CP_REWARDS[cp]
  const pct = (cp / JOURNEY_GOAL) * 100

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        left: `${pct}%`,
        top: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        zIndex: reached ? 3 : isNext ? 2 : 1,
        cursor: 'pointer',
      }}
    >
      {/* Tooltip */}
      {hovered && (
        <MilestoneTooltip cp={cp} reached={reached} cumulativePnl={cumulativePnl} curve={curve} />
      )}

      {/* 보상 아이콘 */}
      <div
        className={reached ? 'milestone-reached' : isNext ? 'milestone-next' : ''}
        style={{
          width: reached ? 44 : 34,
          height: reached ? 44 : 34,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: reached ? 22 : 16,
          background: reached
            ? 'radial-gradient(circle, #2a1f00 0%, #151000 100%)'
            : isNext
              ? `radial-gradient(circle, ${ps.color}15 0%, #121220 100%)`
              : '#15151f',
          border: reached
            ? '2px solid #fbbf24'
            : isNext
              ? `2px dashed ${ps.color}66`
              : '1px solid #2a2a3a',
          boxShadow: reached
            ? '0 0 16px #fbbf2466, 0 0 32px #fbbf2422, inset 0 0 8px #fbbf2422'
            : isNext
              ? `0 0 10px ${ps.color}33`
              : 'none',
          transition: 'all 0.3s ease',
          filter: reached ? 'none' : isNext ? 'none' : 'grayscale(1) opacity(0.35)',
          position: 'relative',
        }}
      >
        {reward.icon}
        {/* 달성 체크 */}
        {reached && (
          <div style={{
            position: 'absolute',
            bottom: -2, right: -2,
            width: 14, height: 14,
            borderRadius: '50%',
            background: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 8,
            fontWeight: 900,
            color: '#fff',
            border: '2px solid #121220',
          }}>✓</div>
        )}
        {/* 미달성 잠금 */}
        {!reached && !isNext && (
          <div style={{
            position: 'absolute',
            bottom: -2, right: -2,
            width: 12, height: 12,
            borderRadius: '50%',
            background: '#374151',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 7,
            color: '#6b7280',
          }}>🔒</div>
        )}
      </div>

      {/* 라벨 */}
      <div style={{
        marginTop: 4,
        fontSize: 9,
        fontWeight: 700,
        fontFamily: 'Inter, monospace',
        color: reached ? '#fbbf24' : isNext ? ps.color : '#3a3a4a',
        textAlign: 'center',
        whiteSpace: 'nowrap',
        letterSpacing: '0.05em',
      }}>
        ${CP_LABELS[cp]}
      </div>

      {reached && (
        <div style={{
          fontSize: 7,
          fontWeight: 800,
          fontFamily: 'Inter, monospace',
          color: '#fbbf24',
          textAlign: 'center',
          letterSpacing: '0.08em',
          marginTop: 1,
          textShadow: '0 0 4px #fbbf2466',
        }}>
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
    <div style={{
      position: 'absolute',
      left: `${pct}%`,
      top: '50%',
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 10,
    }}>
      {/* PNL 말풍선 */}
      <div style={{
        background: 'linear-gradient(135deg, #0a0f1a, #121830)',
        border: `1px solid ${ps.color}66`,
        borderRadius: 10,
        padding: '5px 12px',
        marginBottom: 4,
        boxShadow: `0 0 14px ${ps.color}33`,
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: ps.color,
          fontFamily: 'Inter, monospace', textAlign: 'center',
        }}>
          {fmtPnl(cumulativePnl)}
        </div>
        {nextCpRemaining > 0 && (
          <div style={{
            fontSize: 9, color: '#6b7280', fontFamily: 'Inter, monospace', textAlign: 'center',
          }}>
            다음까지 {fmtK(nextCpRemaining)}
          </div>
        )}
      </div>

      {/* 캐릭터 */}
      <div
        className={`char-anim-${charState}`}
        style={{
          fontSize: 28,
          filter: `drop-shadow(0 0 10px ${ps.color}66)`,
          lineHeight: 1,
        }}
      >
        {stateEmoji}
      </div>
    </div>
  )
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ journey, ps, curve }) {
  const pct = Math.min(100, Math.max(0, journey.progressPercent))

  return (
    <div style={{ position: 'relative', height: 140, margin: '0 24px' }}>
      {/* 도로 배경 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: 0, right: 0,
        height: 48,
        transform: 'translateY(-50%)',
        background: 'linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 50%, #0f0f1a 100%)',
        borderRadius: 24,
        border: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}>
        {/* 진행 그라데이션 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #00c853, #69f0ae)',
          borderRadius: 24,
          boxShadow: '0 0 12px rgba(0,200,83,0.4), 0 0 24px rgba(0,200,83,0.2)',
          transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {/* 내부 빛 효과 */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
            borderRadius: 24,
          }} />
          {/* 움직이는 빛 줄무늬 */}
          <div className="progress-shimmer" style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 24,
            overflow: 'hidden',
          }} />
        </div>

        {/* 진행률 텍스트 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          fontWeight: 800,
          fontFamily: 'Inter, monospace',
          color: '#fff',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          letterSpacing: '0.05em',
          zIndex: 5,
        }}>
          {journey.progressPercent.toFixed(2)}%
        </div>
      </div>

      {/* 체크포인트 보상들 */}
      {CHECKPOINTS.map(cp => (
        <RewardCheckpoint
          key={cp}
          cp={cp}
          reached={journey.cumulativePnl >= cp}
          isNext={journey.nextCheckpoint === cp}
          ps={ps}
          cumulativePnl={journey.cumulativePnl}
          curve={curve}
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

// ─── Donut Progress ─────────────────────────────────────────────────────────

function DonutProgress({ percent, size = 48, strokeWidth = 5, color = '#00c853' }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.min(1, percent / 100))

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 4px ${color}66)` }}
      />
    </svg>
  )
}

// ─── Stat Cards ─────────────────────────────────────────────────────────────

function StatCards({ journey, ps }) {
  const cards = [
    {
      icon: '📈',
      label: '누적 PNL',
      value: fmtPnl(journey.cumulativePnl),
      color: journey.cumulativePnl >= 0 ? '#10B981' : '#EF4444',
      type: 'text',
    },
    {
      icon: '🏁',
      label: '다음 체크포인트',
      value: journey.nextCheckpoint
        ? `${fmtK(journey.nextCheckpoint)} (−${fmtK(journey.nextCpRemaining)})`
        : '🏁 완주!',
      color: journey.nextCheckpoint ? '#a0a0a0' : '#fbbf24',
      type: 'text',
    },
    {
      icon: null,
      label: '진행률',
      value: `${journey.progressPercent.toFixed(2)}%`,
      color: ps.color,
      type: 'donut',
      percent: journey.progressPercent,
    },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, padding: '0 16px' }}>
      {cards.map(({ icon, label, value, color, type, percent }) => (
        <div key={label} style={{
          flex: 1,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          padding: '12px 14px',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          {type === 'donut' ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <DonutProgress percent={percent} color={color} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 800, color,
                fontFamily: 'Inter, monospace',
                transform: 'rotate(0deg)',
              }}>
                {percent.toFixed(1)}%
              </div>
            </div>
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${color}12`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>
              {icon}
            </div>
          )}
          <div>
            <div style={{
              fontSize: 9, color: '#6b7280', textTransform: 'uppercase',
              letterSpacing: '0.1em', marginBottom: 3, fontFamily: 'Inter, monospace',
              fontWeight: 600,
            }}>{label}</div>
            <div style={{
              fontSize: 15, fontWeight: 800, color, fontFamily: 'Inter, monospace',
            }}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Streak & Records ───────────────────────────────────────────────────────

function StreakAndRecords({ journey, personalBests, ps }) {
  return (
    <div style={{
      display: 'flex', gap: 8, padding: '0 16px', flexWrap: 'wrap',
    }}>
      {/* 연승/연패 */}
      {journey.streak > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: journey.streakType === 'win'
            ? 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))'
            : 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))',
          border: `1px solid ${journey.streakType === 'win' ? '#10B98133' : '#EF444433'}`,
          borderRadius: 10,
          padding: '8px 14px',
        }}>
          <span style={{ fontSize: 18 }}>{journey.streakType === 'win' ? '🔥' : '❄️'}</span>
          <div>
            <div style={{
              fontSize: 14, fontWeight: 800,
              color: journey.streakType === 'win' ? '#10B981' : '#EF4444',
              fontFamily: 'Inter, monospace',
            }}>
              {journey.streak}연{journey.streakType === 'win' ? '승' : '패'}
            </div>
            <div style={{ fontSize: 9, color: '#6b7280', fontFamily: 'Inter, monospace' }}>
              현재 스트릭
            </div>
          </div>
        </div>
      )}

      {/* 페이스 예측 */}
      {personalBests?.estimatedDate && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10,
          padding: '8px 14px',
        }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#60a5fa',
              fontFamily: 'Inter, monospace',
            }}>
              $200K 도달 예상
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#93c5fd', fontFamily: 'Inter, monospace' }}>
              {personalBests.estimatedDate}
            </div>
          </div>
        </div>
      )}

      {/* Personal Best: 최고 단일 수익 */}
      {personalBests?.bestDayPnl > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 10,
          padding: '8px 14px',
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <div>
            <div style={{
              fontSize: 9, fontWeight: 600, color: '#6b7280', fontFamily: 'Inter, monospace',
              letterSpacing: '0.05em',
            }}>
              BEST DAY
            </div>
            <div style={{
              fontSize: 13, fontWeight: 800, color: '#fbbf24', fontFamily: 'Inter, monospace',
            }}>
              {fmtPnl(personalBests.bestDayPnl)}
            </div>
          </div>
        </div>
      )}

      {/* Personal Best: 최장 연승 */}
      {personalBests?.longestWinStreak >= 2 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(16,185,129,0.02))',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 10,
          padding: '8px 14px',
        }}>
          <span style={{ fontSize: 16 }}>🏆</span>
          <div>
            <div style={{
              fontSize: 9, fontWeight: 600, color: '#6b7280', fontFamily: 'Inter, monospace',
              letterSpacing: '0.05em',
            }}>
              BEST STREAK
            </div>
            <div style={{
              fontSize: 13, fontWeight: 800, color: '#10B981', fontFamily: 'Inter, monospace',
            }}>
              {personalBests.longestWinStreak}연승
            </div>
          </div>
        </div>
      )}

      {/* 클리어 수 */}
      {CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.02))',
          border: '1px solid rgba(251,191,36,0.2)',
          borderRadius: 10,
          padding: '8px 14px',
        }}>
          <span style={{ fontSize: 16 }}>🎖️</span>
          <div>
            <div style={{
              fontSize: 9, fontWeight: 600, color: '#6b7280', fontFamily: 'Inter, monospace',
              letterSpacing: '0.05em',
            }}>
              CLEARED
            </div>
            <div style={{
              fontSize: 13, fontWeight: 800, color: '#fbbf24', fontFamily: 'Inter, monospace',
            }}>
              {CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length}/{CHECKPOINTS.length}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Badge Row ──────────────────────────────────────────────────────────────

function BadgeRow({ journey }) {
  const reached = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp)
  if (reached.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 8, flexWrap: 'wrap',
      padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: '#4a4a5a',
        fontFamily: 'Inter, monospace', letterSpacing: '0.1em',
        alignSelf: 'center', marginRight: 4,
      }}>REWARDS</div>
      {reached.map(cp => {
        const r = CP_REWARDS[cp]
        return (
          <div key={cp} className="badge-earned" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, fontFamily: 'Inter, monospace',
            color: '#fbbf24',
            background: 'linear-gradient(135deg, #1f1800, #151000)',
            border: '1px solid #fbbf2444',
            borderRadius: 8, padding: '4px 10px',
            boxShadow: '0 0 8px #fbbf2418',
          }}>
            <span style={{ fontSize: 14 }}>{r.icon}</span>
            {r.name}
          </div>
        )
      })}
    </div>
  )
}

// ─── Confetti Effect ────────────────────────────────────────────────────────

function ConfettiEffect({ active }) {
  if (!active) return null
  return (
    <div className="confetti-container" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 20,
    }}>
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="confetti-piece"
          style={{
            '--delay': `${Math.random() * 2}s`,
            '--x': `${Math.random() * 100}%`,
            '--rotation': `${Math.random() * 720}deg`,
            '--color': ['#fbbf24', '#10B981', '#3B82F6', '#EF4444', '#a78bfa', '#f472b6'][i % 6],
          }}
        />
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function JourneyRoad({ allTimeAnalytics }) {
  const journey = useMemo(() => computeJourneyState(allTimeAnalytics), [allTimeAnalytics])
  const { phase, briefing } = useMemo(() => getJourneyBriefing(journey, allTimeAnalytics), [journey, allTimeAnalytics])
  const ps = PHASE_STYLE[phase] ?? PHASE_STYLE.BUILD
  const personalBests = useMemo(() => computePersonalBests(allTimeAnalytics), [allTimeAnalytics])
  const curve = allTimeAnalytics?.equity_curve ?? []

  // Confetti when a new milestone is reached (just reached the latest one)
  const [showConfetti, setShowConfetti] = useState(false)
  const reachedCount = CHECKPOINTS.filter(cp => journey.cumulativePnl >= cp).length
  useEffect(() => {
    if (reachedCount > 0) {
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(t)
    }
  }, [reachedCount])

  return (
    <div style={{
      background: 'linear-gradient(180deg, #0d0d1a 0%, #121225 60%, #0d0d1a 100%)',
      border: `1px solid ${ps.color}30`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: `0 0 40px ${ps.color}08, inset 0 1px 0 ${ps.color}12`,
      position: 'relative',
    }}>
      <ConfettiEffect active={showConfetti} />

      {/* 배경 텍스처 */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 40px, ${ps.color}03 40px, ${ps.color}03 41px)`,
        pointerEvents: 'none',
      }} />

      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11, fontWeight: 800, color: '#5a5a6a',
            letterSpacing: '0.14em', fontFamily: 'Inter, monospace',
          }}>
            JOURNEY TO $200K
          </span>
          <span style={{
            fontSize: 10, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: ps.color, background: `${ps.color}12`,
            border: `1px solid ${ps.color}30`, borderRadius: 6,
            padding: '3px 10px', letterSpacing: '0.1em',
          }}>
            {ps.label}
          </span>
        </div>
      </div>

      {/* 프로그레스 바 + 마일스톤 */}
      <div style={{ padding: '20px 8px 12px', position: 'relative', zIndex: 1 }}>
        <ProgressBar journey={journey} ps={ps} curve={curve} />
      </div>

      {/* 스탯 카드 */}
      <div style={{ position: 'relative', zIndex: 1, paddingBottom: 12 }}>
        <StatCards journey={journey} ps={ps} />
      </div>

      {/* 스트릭 & 기록 */}
      <div style={{
        position: 'relative', zIndex: 1,
        paddingBottom: 12,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        paddingTop: 12,
      }}>
        <StreakAndRecords journey={journey} personalBests={personalBests} ps={ps} />
      </div>

      {/* 획득 보상 */}
      <BadgeRow journey={journey} />

      {/* 응원 멘트 */}
      <div style={{
        padding: '12px 16px 14px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        position: 'relative', zIndex: 1,
        background: `linear-gradient(90deg, ${ps.color}06, ${ps.color}03, transparent)`,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#4a4a5a',
          fontFamily: 'Inter, monospace', letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 6,
        }}>
          포포 브리핑
        </div>
        <p style={{
          fontSize: 12.5, lineHeight: 1.7, color: `${ps.color}cc`,
          fontFamily: "'Noto Sans KR', sans-serif",
          margin: 0,
        }}>
          {briefing}
        </p>
      </div>

      <style>{`
        /* 캐릭터 애니메이션 */
        .char-anim-walk    { animation: cWalk 1.4s ease-in-out infinite; }
        .char-anim-run     { animation: cBounce 0.45s ease-in-out infinite; }
        .char-anim-wobble  { animation: cWobble 0.75s ease-in-out infinite; }
        .char-anim-retreat { animation: cRetreat 1.8s ease-in-out infinite; }
        .char-anim-idle    { opacity: 0.4; }

        @keyframes cWalk {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes cBounce {
          0%,100% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-8px) scale(1.05); }
          60% { transform: translateY(-2px) scale(0.98); }
        }
        @keyframes cWobble {
          0%,100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-4px) rotate(-3deg); }
          75% { transform: translateX(4px) rotate(3deg); }
        }
        @keyframes cRetreat {
          0% { transform: translateX(0); }
          50% { transform: translateX(-6px); }
          100% { transform: translateX(0); }
        }

        /* 마일스톤 빛나는 효과 */
        .milestone-reached {
          animation: milestoneGlow 2s ease-in-out infinite;
        }
        .milestone-next {
          animation: milestonePulse 2s ease-in-out infinite;
        }
        @keyframes milestoneGlow {
          0%,100% { box-shadow: 0 0 16px #fbbf2466, 0 0 32px #fbbf2422; }
          50% { box-shadow: 0 0 24px #fbbf2488, 0 0 48px #fbbf2433; }
        }
        @keyframes milestonePulse {
          0%,100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        /* 프로그레스 바 빛 줄무늬 */
        .progress-shimmer::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; right: 0; bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255,255,255,0.1) 40%,
            rgba(255,255,255,0.2) 50%,
            rgba(255,255,255,0.1) 60%,
            transparent 100%
          );
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }

        /* 뱃지 호버 효과 */
        .badge-earned {
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .badge-earned:hover {
          transform: translateY(-2px);
          box-shadow: 0 0 16px #fbbf2433 !important;
        }

        /* 축하 이펙트 (confetti) */
        .confetti-container .confetti-piece {
          position: absolute;
          top: -10px;
          left: var(--x);
          width: 6px;
          height: 6px;
          background: var(--color);
          border-radius: 1px;
          animation: confettiFall 3s var(--delay) ease-out forwards;
          opacity: 0;
        }
        @keyframes confettiFall {
          0% { opacity: 1; transform: translateY(0) rotate(0deg) scale(1); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateY(400px) rotate(var(--rotation)) scale(0.5); }
        }
      `}</style>
    </div>
  )
}
