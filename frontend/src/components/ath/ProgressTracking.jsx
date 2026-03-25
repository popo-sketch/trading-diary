/**
 * ProgressTracking.jsx — 성장 추적
 *
 * A) 월별 ATH 효율 추이 차트
 * B) 최근 10건 이동평균 오버레이
 * C) 목표 설정 + 달성률
 */
import { useState, useMemo } from 'react'

const GREEN = '#00c853'
const RED = '#ff1744'
const WARN = '#ffc107'
const INFO = '#42a5f5'

const CARD = {
  background: '#1a1a2e', borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 20,
}

const GOAL_STORAGE_KEY = 'ath_goal_target'

// ─── A+B) 월별 추이 차트 + 이동평균 ─────────────────────────────────────────

function MonthlyTrendChart({ analyses, goal }) {
  const valid = useMemo(() =>
    analyses
      .filter(a => a.athStatus === 'ok' && a.athMultiple > 1 && a.date)
      .sort((a, b) => a.date.localeCompare(b.date))
  , [analyses])

  // 월별 그룹핑
  const monthly = useMemo(() => {
    const groups = {}
    valid.forEach(a => {
      const month = a.date.slice(0, 7) // YYYY-MM
      if (!groups[month]) groups[month] = []
      groups[month].push(a)
    })
    return Object.entries(groups)
      .map(([month, data]) => ({
        month,
        label: month.slice(5) + '월',
        avgEff: data.reduce((s, a) => s + a.athEfficiency, 0) / data.length,
        count: data.length,
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-8) // 최근 8개월
  }, [valid])

  // 10건 이동평균
  const ma10 = useMemo(() => {
    if (valid.length < 2) return []
    const result = []
    for (let i = 0; i < valid.length; i++) {
      const window = valid.slice(Math.max(0, i - 9), i + 1)
      const avg = window.reduce((s, a) => s + a.athEfficiency, 0) / window.length
      result.push({ idx: i, avg, date: valid[i].date })
    }
    return result
  }, [valid])

  // 월별 MA10 평균
  const monthlyMA = useMemo(() => {
    const map = {}
    ma10.forEach(m => {
      const month = m.date.slice(0, 7)
      if (!map[month]) map[month] = []
      map[month].push(m.avg)
    })
    return Object.fromEntries(
      Object.entries(map).map(([k, v]) => [k, v[v.length - 1]])
    )
  }, [ma10])

  if (monthly.length < 2) {
    return (
      <div style={{ color: '#6b7280', fontSize: 12, textAlign: 'center', padding: 20 }}>
        월별 추이를 표시하려면 최소 2개월 이상의 데이터가 필요합니다
      </div>
    )
  }

  const W = 500, H = 180, PL = 44, PR = 20, PT = 16, PB = 30
  const cw = W - PL - PR, ch = H - PT - PB

  const maxEff = Math.max(...monthly.map(m => m.avgEff), goal || 50, 100)
  const minEff = 0

  const xScale = (i) => PL + (i / (monthly.length - 1)) * cw
  const yScale = (v) => PT + ch - ((v - minEff) / (maxEff - minEff)) * ch

  const linePath = monthly.map((m, i) =>
    `${i === 0 ? 'M' : 'L'} ${xScale(i).toFixed(1)} ${yScale(m.avgEff).toFixed(1)}`
  ).join(' ')

  // MA10 라인
  const maLine = monthly.map((m, i) => {
    const maVal = monthlyMA[m.month]
    if (maVal === undefined) return null
    return { x: xScale(i), y: yScale(maVal), val: maVal }
  }).filter(Boolean)

  const maPath = maLine.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  ).join(' ')

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* 목표선 */}
      {goal > 0 && (
        <>
          <line x1={PL} y1={yScale(goal)} x2={W - PR} y2={yScale(goal)}
            stroke={INFO} strokeWidth="1" strokeDasharray="6 3" opacity="0.5" />
          <text x={W - PR + 4} y={yScale(goal) + 3} fill={INFO} fontSize="8"
            fontFamily="Inter, monospace">목표 {goal}%</text>
        </>
      )}

      {/* 그리드 */}
      {[0, 25, 50, 75, 100].filter(v => v <= maxEff).map(v => (
        <g key={v}>
          <line x1={PL} y1={yScale(v)} x2={W - PR} y2={yScale(v)}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
          <text x={PL - 6} y={yScale(v) + 3} fill="#4b5563" fontSize="8"
            textAnchor="end" fontFamily="Inter, monospace">{v}%</text>
        </g>
      ))}

      {/* MA10 라인 */}
      {maPath && (
        <path d={maPath} fill="none" stroke={WARN} strokeWidth="1.5"
          strokeDasharray="4 2" opacity="0.6" />
      )}

      {/* 메인 라인 */}
      <path d={linePath} fill="none" stroke={INFO} strokeWidth="2" strokeLinecap="round" />

      {/* 데이터 포인트 */}
      {monthly.map((m, i) => (
        <g key={m.month}>
          <circle cx={xScale(i)} cy={yScale(m.avgEff)} r={4}
            fill={m.avgEff >= (goal || 50) ? GREEN : m.avgEff >= 25 ? INFO : RED}
            stroke="#0d0d1a" strokeWidth="2" />
          <text x={xScale(i)} y={yScale(m.avgEff) - 8}
            fill="#e0e0e0" fontSize="9" fontWeight="700" textAnchor="middle"
            fontFamily="Inter, monospace">{m.avgEff.toFixed(0)}%</text>
          {/* X축 라벨 */}
          <text x={xScale(i)} y={H - PB + 14}
            fill="#6b7280" fontSize="9" textAnchor="middle"
            fontFamily="Inter, monospace">{m.label}</text>
          <text x={xScale(i)} y={H - PB + 24}
            fill="#4b5563" fontSize="7" textAnchor="middle"
            fontFamily="Inter, monospace">{m.count}건</text>
        </g>
      ))}

      {/* 범례 */}
      <line x1={PL} y1={6} x2={PL + 14} y2={6} stroke={INFO} strokeWidth="2" />
      <text x={PL + 18} y={9} fill="#6b7280" fontSize="8" fontFamily="Inter, monospace">월 평균</text>
      <line x1={PL + 60} y1={6} x2={PL + 74} y2={6} stroke={WARN} strokeWidth="1.5" strokeDasharray="4 2" />
      <text x={PL + 78} y={9} fill="#6b7280" fontSize="8" fontFamily="Inter, monospace">10건 MA</text>
    </svg>
  )
}

// ─── C) 목표 설정 ────────────────────────────────────────────────────────────

function GoalSection({ analyses, goal, setGoal }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState(goal)

  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1)

  // 이번 달 데이터
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthData = valid.filter(a => a.date?.startsWith(thisMonth))
  const currentAvg = thisMonthData.length > 0
    ? thisMonthData.reduce((s, a) => s + a.athEfficiency, 0) / thisMonthData.length
    : 0

  const achieved = goal > 0 && currentAvg >= goal
  const progressPct = goal > 0 ? Math.min(100, (currentAvg / goal) * 100) : 0

  return (
    <div style={{
      padding: '14px 16px', borderRadius: 10,
      background: achieved ? 'rgba(0,200,83,0.05)' : 'rgba(255,255,255,0.02)',
      border: achieved ? `1px solid ${GREEN}25` : '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#4b5563',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'Inter, monospace',
        }}>이번 달 목표</div>

        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number" value={input}
              onChange={e => setInput(Number(e.target.value))}
              style={{
                width: 50, padding: '3px 6px', borderRadius: 4,
                background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.1)',
                color: '#e0e0e0', fontSize: 12, fontFamily: 'Inter, monospace',
                textAlign: 'center', outline: 'none',
              }}
            />
            <span style={{ fontSize: 11, color: '#6b7280' }}>%</span>
            <button
              onClick={() => {
                const val = Math.max(0, Math.min(100, input))
                setGoal(val)
                localStorage.setItem(GOAL_STORAGE_KEY, String(val))
                setEditing(false)
              }}
              style={{
                padding: '3px 8px', borderRadius: 4, border: 'none',
                background: `${INFO}20`, color: INFO, fontSize: 10,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, monospace',
              }}
            >저장</button>
          </div>
        ) : (
          <button
            onClick={() => { setInput(goal); setEditing(true) }}
            style={{
              padding: '3px 10px', borderRadius: 4, border: 'none',
              background: 'rgba(255,255,255,0.04)', color: '#6b7280',
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Inter, monospace',
            }}
          >목표 설정</button>
        )}
      </div>

      {goal > 0 ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#9e9e9e' }}>
              평균 ATH 효율 <span style={{ fontWeight: 700, color: INFO }}>{goal}%</span> 이상
            </span>
            <span style={{
              fontSize: 14, fontWeight: 800, fontFamily: 'Inter, monospace',
              color: achieved ? GREEN : currentAvg >= goal * 0.7 ? WARN : RED,
            }}>
              {currentAvg.toFixed(1)}% {achieved ? '🏆' : ''}
            </span>
          </div>
          <div style={{
            width: '100%', height: 8, borderRadius: 4,
            background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${progressPct}%`, height: '100%', borderRadius: 4,
              background: achieved ? GREEN : progressPct >= 70 ? WARN : INFO,
              transition: 'width 0.5s',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace' }}>
              {thisMonthData.length}건 분석
            </span>
            <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace' }}>
              {progressPct.toFixed(0)}% 달성
            </span>
          </div>
          {achieved && (
            <div style={{
              marginTop: 8, padding: '6px 10px', borderRadius: 6,
              background: `${GREEN}10`, border: `1px solid ${GREEN}25`,
              fontSize: 12, color: GREEN, fontWeight: 600, textAlign: 'center',
            }}>
              🎉 이번 달 목표 달성! 매도 타이밍이 개선되고 있습니다
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
          매도 효율 목표를 설정하면 진행 상황을 추적할 수 있습니다
        </div>
      )}
    </div>
  )
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────

export default function ProgressTracking({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1)
  const [goal, setGoal] = useState(() => {
    const saved = localStorage.getItem(GOAL_STORAGE_KEY)
    return saved ? Number(saved) : 50
  })

  if (valid.length < 3) return null

  return (
    <div style={CARD}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 16 }}>
        성장 추적
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <MonthlyTrendChart analyses={analyses} goal={goal} />
        <GoalSection analyses={analyses} goal={goal} setGoal={setGoal} />
      </div>
    </div>
  )
}
