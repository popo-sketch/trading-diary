/**
 * MonthlyReplay.jsx — 월간 복기 극장
 *
 * 이번 달 거래 흐름을 "여정 스토리" 타임라인으로 보여준다.
 * 숫자가 아닌 이벤트 서사로 한 달을 되돌아본다.
 */
import { useMemo } from 'react'
import { CHECKPOINTS } from '../utils/journeyEngine'

// CHECKPOINTS는 숫자 배열이므로 milestone 객체로 변환
const MILESTONES = CHECKPOINTS.map((value) => {
  const label = value >= 1000 ? `$${value / 1000}K` : `$${value}`
  return { value, label, code: `CP_${value}` }
})

const EVENT_STYLES = {
  checkpoint:  { icon: '🏁', color: '#fbbf24', label: '체크포인트 돌파' },
  streak_win:  { icon: '🔥', color: '#4ade80', label: '연승 구간' },
  streak_loss: { icon: '💀', color: '#ef4444', label: '연패 구간' },
  big_win:     { icon: '⚡', color: '#60a5fa', label: '최고 수익일' },
  big_loss:    { icon: '🩸', color: '#f87171', label: '최대 손실일' },
  giveback:    { icon: '↩️', color: '#f59e0b', label: '수익 반납' },
  rest:        { icon: '🛏️', color: '#9ca3af', label: '휴식 구간' },
  phase_shift: { icon: '🔄', color: '#a78bfa', label: 'Phase 전환' },
}

function buildEvents(trades = [], equityCurve = []) {
  const events = []

  // 날짜별 PNL
  const dayPnl = {}
  trades.forEach((t) => {
    dayPnl[t.date] = (dayPnl[t.date] ?? 0) + Number(t.pnl || 0)
  })
  const sortedDays = Object.entries(dayPnl).sort(([a], [b]) => a.localeCompare(b))

  if (sortedDays.length === 0) return events

  // 누적 PNL 추적
  let cumPnl = 0
  let peakPnl = 0
  const reachedMs = new Set()

  // equity curve에서 시작 cumPnl 결정 (이전 달 누적)
  const firstCurve = equityCurve.find((p) => p.date === sortedDays[0]?.[0])
  const startCum = firstCurve
    ? (firstCurve.cumulative_pnl ?? 0) - (dayPnl[sortedDays[0][0]] ?? 0)
    : 0
  cumPnl = startCum

  for (const [date, pnl] of sortedDays) {
    cumPnl += pnl

    // 체크포인트 돌파
    for (const ms of MILESTONES) {
      if (!reachedMs.has(ms.code) && cumPnl >= ms.value && cumPnl - pnl < ms.value) {
        reachedMs.add(ms.code)
        events.push({
          date, type: 'checkpoint',
          desc: `${ms.label} 돌파`,
        })
      }
    }

    // 고점 갱신 후 반납
    if (cumPnl > peakPnl) peakPnl = cumPnl
    if (peakPnl > 500 && cumPnl < peakPnl * 0.85) {
      const existing = events.find((e) => e.type === 'giveback')
      if (!existing) {
        events.push({
          date, type: 'giveback',
          desc: `고점 $${Math.round(peakPnl).toLocaleString()} 대비 수익 반납 중`,
        })
      }
    }
  }

  // 최고 수익일 / 최대 손실일
  if (sortedDays.length > 0) {
    const best  = sortedDays.reduce((a, b) => (b[1] > a[1] ? b : a))
    const worst = sortedDays.reduce((a, b) => (b[1] < a[1] ? b : a))
    if (best[1] > 0) {
      events.push({
        date: best[0], type: 'big_win',
        desc: `+$${Math.round(best[1]).toLocaleString()} — 이번 달 최고 수익`,
      })
    }
    if (worst[1] < 0) {
      events.push({
        date: worst[0], type: 'big_loss',
        desc: `-$${Math.abs(Math.round(worst[1])).toLocaleString()} — 이번 달 최대 손실`,
      })
    }
  }

  // 연승·연패 구간
  let streak = 0
  let streakType = null
  for (let i = 0; i < sortedDays.length; i++) {
    const [, pnl] = sortedDays[i]
    const dir = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : null
    if (dir === streakType) {
      streak++
    } else {
      if (streak >= 3 && streakType) {
        events.push({
          date: sortedDays[i - 1][0],
          type: streakType === 'win' ? 'streak_win' : 'streak_loss',
          desc: `${streak}일 연${streakType === 'win' ? '승' : '패'} 구간`,
        })
      }
      streak = 1
      streakType = dir
    }
  }
  if (streak >= 3 && streakType) {
    events.push({
      date: sortedDays[sortedDays.length - 1][0],
      type: streakType === 'win' ? 'streak_win' : 'streak_loss',
      desc: `${streak}일 연${streakType === 'win' ? '승' : '패'} 구간`,
    })
  }

  // 휴식 구간 (2일 이상 연속 비거래)
  const tradeDates = new Set(Object.keys(dayPnl))
  if (sortedDays.length >= 2) {
    const firstDate = new Date(sortedDays[0][0])
    const lastDate  = new Date(sortedDays[sortedDays.length - 1][0])
    let restStart = null
    let restCount = 0
    for (let d = new Date(firstDate); d <= lastDate; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().slice(0, 10)
      if (!tradeDates.has(ds)) {
        if (!restStart) restStart = ds
        restCount++
      } else {
        if (restCount >= 2) {
          events.push({
            date: restStart, type: 'rest',
            desc: `${restCount}일 연속 비거래 — 휴식 구간`,
          })
        }
        restStart = null
        restCount = 0
      }
    }
    if (restCount >= 2 && restStart) {
      events.push({
        date: restStart, type: 'rest',
        desc: `${restCount}일 연속 비거래 — 휴식 구간`,
      })
    }
  }

  // 날짜 정렬
  events.sort((a, b) => a.date.localeCompare(b.date))
  return events
}

export default function MonthlyReplay({ trades = [], analytics }) {
  const equityCurve = analytics?.equity_curve ?? []
  const events = useMemo(() => buildEvents(trades, equityCurve), [trades, equityCurve])

  if (events.length === 0) {
    return (
      <div style={{
        background: '#0d0d0d',
        border: '1px solid #1f293744',
        borderRadius: '12px',
        padding: '16px',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#6b7280',
          fontFamily: 'Inter, monospace', letterSpacing: '0.12em',
          textTransform: 'uppercase', marginBottom: 8,
        }}>
          월간 리플레이
        </div>
        <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'center', padding: '16px 0' }}>
          아직 이벤트가 없다
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: '#0d0d0d',
      border: '1px solid #1f293744',
      borderRadius: '12px',
      padding: '16px',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: '#6b7280',
        fontFamily: 'Inter, monospace', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 14,
      }}>
        월간 리플레이 — {events.length} events
      </div>

      <div style={{ position: 'relative', paddingLeft: 20 }}>
        {/* 타임라인 세로선 */}
        <div style={{
          position: 'absolute', left: 6, top: 4, bottom: 4,
          width: 2, background: '#1f2937', borderRadius: 1,
        }} />

        {events.map((ev, i) => {
          const style = EVENT_STYLES[ev.type] ?? EVENT_STYLES.phase_shift
          return (
            <div key={i} style={{
              position: 'relative',
              marginBottom: i < events.length - 1 ? 14 : 0,
            }}>
              {/* 타임라인 도트 */}
              <div style={{
                position: 'absolute', left: -17, top: 3,
                width: 10, height: 10, borderRadius: '50%',
                background: style.color,
                border: '2px solid #0d0d0d',
                boxShadow: `0 0 6px ${style.color}66`,
              }} />

              {/* 날짜 */}
              <div style={{
                fontSize: 9, color: '#4b5563',
                fontFamily: 'Inter, monospace',
                marginBottom: 2,
              }}>
                {ev.date}
              </div>

              {/* 이벤트 카드 */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                background: '#111',
                border: `1px solid ${style.color}33`,
                borderRadius: 8,
                padding: '8px 10px',
              }}>
                <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{style.icon}</span>
                <div>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: style.color,
                    fontFamily: 'Inter, monospace',
                    marginBottom: 2,
                  }}>
                    {style.label}
                  </div>
                  <div style={{
                    fontSize: 11, color: '#9ca3af',
                    lineHeight: 1.5,
                    fontFamily: "'Noto Sans KR', '맑은 고딕', sans-serif",
                  }}>
                    {ev.desc}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
