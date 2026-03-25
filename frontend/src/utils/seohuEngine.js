/**
 * 이서후 전략 엔진 v2
 * — 이서후의 플레이 철학을 규칙 엔진으로 번역한 실전형 코칭 시스템
 *
 * 핵심 원칙:
 * 1. 작은 흐름에서는 오래 살아남으며 조금씩 쌓는다
 * 2. 유리한 흐름이 확인될 때만 과감하게 들어간다
 * 3. 수익이 나도 먼저 지킨다
 * 4. 큰 손실 후에는 감정 없이 다시 처음부터 쌓는다
 * 5. 목표는 한 번의 대승이 아니라 계속 살아남는 것
 *
 * v2 추가:
 * - 지뢰플레이 감지 (저확률 전략 = 정상 실패 vs 과잉 반복 vs 오버사이징)
 * - 비거래일 브리핑 (2일 단위 로테이션)
 * - oneLiner 메시지 풀 확장 (반복 방지)
 */

const TARGET_GOAL = 200_000

// ─── Raw Data Extractors ─────────────────────────────────────────────────────

function getEquityInfo(equityCurve) {
  if (!equityCurve?.length) return { hwm: 0, current: 0, drawdownFromHwm: 0, maxDdPct: 0 }
  let hwm = 0, maxDdPct = 0, current = 0
  for (const p of equityCurve) {
    const v = p.cumulative_pnl ?? 0
    if (v > hwm) hwm = v
    if (hwm > 0) {
      const dd = (hwm - v) / hwm
      if (dd > maxDdPct) maxDdPct = dd
    }
    current = v
  }
  const drawdownFromHwm = hwm > 0 ? (hwm - current) / hwm : 0
  return { hwm, current, drawdownFromHwm, maxDdPct }
}

function getEvInfo(evCurve) {
  if (!evCurve?.length) return { current: null, trend: 'UNKNOWN' }
  const len = evCurve.length
  const current = evCurve[len - 1].ev_percent
  let trend = 'UNKNOWN'
  if (len >= 3) {
    const delta = evCurve[len - 1].ev_percent - evCurve[len - 3].ev_percent
    trend = delta < -2 ? 'DECLINING' : delta > 2 ? 'RISING' : 'STABLE'
  }
  return { current, trend }
}

function sortedByRecent(trades) {
  return [...(trades ?? [])].sort((a, b) => {
    const d = (b.date || '').localeCompare(a.date || '')
    return d !== 0 ? d : (b.created_at || '').localeCompare(a.created_at || '')
  })
}

function getStreak(sorted) {
  let losses = 0, wins = 0, done = false
  for (const t of sorted) {
    if (done) break
    if (!Number.isFinite(t.pnl)) continue
    if (t.pnl < 0) { if (wins > 0) done = true; else losses++ }
    else            { if (losses > 0) done = true; else wins++ }
  }
  return { consecutiveLosses: losses, consecutiveWins: wins }
}

function getSizeTrendRatio(sorted) {
  const r = sorted.slice(0, 5).filter(t => (t.entry_amount ?? 0) > 0)
  const p = sorted.slice(5, 10).filter(t => (t.entry_amount ?? 0) > 0)
  if (!r.length || !p.length) return 1
  const rAvg = r.reduce((s, t) => s + t.entry_amount, 0) / r.length
  const pAvg = p.reduce((s, t) => s + t.entry_amount, 0) / p.length
  return pAvg > 0 ? rAvg / pAvg : 1
}

function getFreqTrendRatio(sorted) {
  const r = sorted.slice(0, 5)
  const p = sorted.slice(5, 10)
  if (!p.length) return 1
  const rDays = Math.max(new Set(r.map(t => t.date)).size, 1)
  const pDays = Math.max(new Set(p.map(t => t.date)).size, 1)
  return (5 / rDays) / (5 / pDays)
}

// ─── 지뢰플레이 감지 ─────────────────────────────────────────────────────────
//
// 지뢰플레이: 원래 저확률 전략 (승률 30% 이하 카테고리)
// - 한두 번 실패 = 정상. 구조 자체가 그렇다. 비난하지 않는다.
// - 같은 카테고리에서 3회 이상 연속 손실 = 과잉 반복 경고
// - 지뢰플레이에서 사이즈가 평소 대비 50% 이상 증가 = 오버사이징 경고
// - 고확률 셋업에서 실행 미스로 손실 = 실행 오류 (별도 분류)

function detectMinePlays(sorted, tradeTypeStats) {
  const result = {
    detected: false,
    type: null,      // 'normal_fail' | 'repeat' | 'oversize' | 'execution_error'
    category: null,
    detail: '',
    severity: 0,     // 0=없음, 1=정상실패(무시), 2=경고, 3=위험
  }

  if (!sorted.length || !tradeTypeStats?.length) return result

  // 카테고리별 승률 맵
  const winRateMap = {}
  for (const s of tradeTypeStats) {
    if (s.trade_type && Number.isFinite(s.win_rate)) {
      winRateMap[s.trade_type] = s.win_rate
    }
  }

  // 최근 손실 거래 분석
  const recentLosses = sorted.filter(t => Number.isFinite(t.pnl) && t.pnl < 0).slice(0, 10)
  if (recentLosses.length === 0) return result

  // 카테고리별 연속 손실 카운트
  const catLossCount = {}
  for (const t of recentLosses) {
    const cat = t.trade_type || t.category || 'unknown'
    catLossCount[cat] = (catLossCount[cat] || 0) + 1
  }

  // 저확률 카테고리에서의 손실 분석
  for (const [cat, count] of Object.entries(catLossCount)) {
    const wr = winRateMap[cat]
    const isLowProb = wr != null && wr <= 0.35  // 승률 35% 이하 = 지뢰플레이

    if (!isLowProb) {
      // 고확률 카테고리에서 연속 손실 = 실행 오류
      if (wr != null && wr > 0.5 && count >= 2) {
        result.detected = true
        result.type = 'execution_error'
        result.category = cat
        result.detail = `${cat} 승률 ${(wr * 100).toFixed(0)}%인데 최근 ${count}연패. 실행에 문제가 있다.`
        result.severity = 2
        return result
      }
      continue
    }

    // 지뢰플레이 카테고리 확인
    result.detected = true
    result.category = cat

    if (count >= 3) {
      // 3회 이상 연속 → 과잉 반복
      result.type = 'repeat'
      result.detail = `${cat}에서 ${count}연패. 저확률 플레이를 반복하고 있다.`
      result.severity = 2
      return result
    }

    // 사이즈 체크: 지뢰플레이에서 오버사이징?
    const mineTrades = recentLosses.filter(t => (t.trade_type || t.category) === cat && (t.entry_amount ?? 0) > 0)
    const otherTrades = sorted.filter(t => (t.trade_type || t.category) !== cat && (t.entry_amount ?? 0) > 0).slice(0, 10)
    if (mineTrades.length > 0 && otherTrades.length > 0) {
      const mineAvgSize = mineTrades.reduce((s, t) => s + t.entry_amount, 0) / mineTrades.length
      const otherAvgSize = otherTrades.reduce((s, t) => s + t.entry_amount, 0) / otherTrades.length
      if (otherAvgSize > 0 && mineAvgSize / otherAvgSize > 1.5) {
        result.type = 'oversize'
        result.detail = `${cat} 지뢰플레이에 사이즈가 평소 대비 ${Math.round((mineAvgSize / otherAvgSize - 1) * 100)}% 크다.`
        result.severity = 3
        return result
      }
    }

    // 정상 실패 — 지뢰플레이는 원래 이렇다
    result.type = 'normal_fail'
    result.detail = `${cat} 저확률 플레이 ${count}회 실패. 구조적으로 정상 범위.`
    result.severity = 1
  }

  return result
}

// ─── Emotion State Detection ──────────────────────────────────────────────────

function detectEmotion(sorted) {
  const { consecutiveLosses, consecutiveWins } = getStreak(sorted)
  const sizeTrend = getSizeTrendRatio(sorted)
  const freqTrend = getFreqTrendRatio(sorted)

  // 3연패 이상 → 틸트
  if (consecutiveLosses >= 3)
    return { state: 'TILT', detail: `${consecutiveLosses}연패`, consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }

  // 2연패 + 사이즈 30% 이상 증가 → 복구 욕망
  if (consecutiveLosses >= 2 && sizeTrend > 1.3)
    return { state: 'REVENGE', detail: `${consecutiveLosses}연패 + 사이즈 ${Math.round((sizeTrend - 1) * 100)}% 증가`, consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }

  // 3연승 + 진입 빈도 50% 이상 증가 → 과신
  if (consecutiveWins >= 3 && freqTrend > 1.5)
    return { state: 'OVERCONFIDENCE', detail: `${consecutiveWins}연승 + 빈도 ${Math.round((freqTrend - 1) * 100)}% 증가`, consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }

  return { state: 'CALM', detail: '', consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }
}

// ─── Phase Classification ─────────────────────────────────────────────────────

function computePhase({ emotion, equity, ev, totalTrades }) {
  const { consecutiveLosses, consecutiveWins } = emotion
  const { drawdownFromHwm, maxDdPct, current: currentEquity } = equity
  const { current: currentEv, trend: evTrend } = ev

  // RESET
  if (emotion.state === 'REVENGE') return 'RESET'
  if (emotion.state === 'TILT')    return 'RESET'
  if (consecutiveLosses >= 3)      return 'RESET'
  if (maxDdPct > 0.25)             return 'RESET'

  // DEFENSE
  if (emotion.state === 'OVERCONFIDENCE')                         return 'DEFENSE'
  if (currentEquity > 0 && drawdownFromHwm > 0.15)               return 'DEFENSE'
  if (consecutiveLosses >= 2)                                     return 'DEFENSE'
  if (currentEv !== null && totalTrades >= 5 && currentEv < 3)   return 'DEFENSE'
  if (evTrend === 'DECLINING' && currentEquity > 0)              return 'DEFENSE'

  // ATTACK
  if (
    currentEv !== null && currentEv > 15 &&
    drawdownFromHwm < 0.05 &&
    consecutiveLosses === 0 &&
    emotion.state === 'CALM' &&
    totalTrades >= 5
  ) return 'ATTACK'

  return 'BUILD'
}

// ─── Category Grading ─────────────────────────────────────────────────────────

function gradeEv(ev) {
  if (ev > 20) return 'S'
  if (ev > 10) return 'A'
  if (ev > 0)  return 'B'
  return 'C'
}

function categoryPermission(grade, phase) {
  if (grade === 'C') return { permission: '금지', reason: 'EV 없음. 들어갈 이유가 없다.' }

  if (phase === 'RESET') {
    if (grade === 'S') return { permission: '선택적 허용', reason: 'RESET 구간이지만 최강 엣지만 최소 사이즈로 허용.' }
    return { permission: '금지', reason: 'RESET 구간. B등급 이하 전면 정지.' }
  }

  if (phase === 'DEFENSE') {
    if (grade === 'S') return { permission: '선택적 허용', reason: '강한 엣지 확인. 사이즈 줄여서 신중하게 가능.' }
    if (grade === 'A') return { permission: '선택적 허용', reason: '좋은 엣지. 단 사이즈 줄여서 진입.' }
    return { permission: '제한', reason: '약한 엣지. DEFENSE 구간엔 B등급 최소화.' }
  }

  if (phase === 'BUILD') {
    if (grade === 'S') return { permission: '집중 가능', reason: '엣지가 증명됐다. BUILD 구간에서도 집중 허용.' }
    if (grade === 'A') return { permission: '선택적 허용', reason: '좋은 엣지. 적정 사이즈로 접근 가능.' }
    return { permission: '제한', reason: 'BUILD 구간. 약한 엣지는 최소화해야 한다.' }
  }

  // ATTACK
  if (grade === 'S') return { permission: '집중 가능', reason: '최강 엣지. ATTACK 구간에 집중해라.' }
  if (grade === 'A') return { permission: '집중 가능', reason: '강한 엣지. 공격적으로 접근 가능.' }
  return { permission: '선택적 허용', reason: '약한 엣지지만 ATTACK 구간. 사이즈 줄여서 가능.' }
}

// ─── 2일 단위 로테이션 시드 ──────────────────────────────────────────────────
// 같은 메시지가 계속 반복되지 않도록, 2일마다 시드가 바뀐다

function getRotationIndex(poolSize) {
  const today = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  const seed = Math.floor(dayOfYear / 2)  // 2일마다 변경
  return seed % Math.max(poolSize, 1)
}

function pickFromPool(pool) {
  if (!pool.length) return ''
  return pool[getRotationIndex(pool.length)]
}

// ─── Briefing Text Generator ──────────────────────────────────────────────────

function fmt(n, d = 1) { return Number.isFinite(n) ? n.toFixed(d) : '—' }

function buildBriefingText(ctx) {
  const { phase, emotion, equity, ev, totalTrades, categories, minePlay } = ctx
  const { consecutiveLosses, consecutiveWins, sizeTrend } = emotion
  const { current: currentEquity, drawdownFromHwm, maxDdPct } = equity
  const { current: currentEv, trend: evTrend } = ev

  const topCats   = categories.filter(c => c.permission === '집중 가능').map(c => c.trade_type)
  const allowCats = categories.filter(c => ['집중 가능', '선택적 허용'].includes(c.permission))
  const forbidCats = categories.filter(c => c.permission === '금지')

  // ── 이서후 판단 ──────────────────────────────────────────────────────────────
  let judgment = ''

  // 지뢰플레이 관련 판단 (우선순위 높음 — 다른 판단에 삽입)
  let mineJudgment = ''
  if (minePlay.detected) {
    switch (minePlay.type) {
      case 'normal_fail':
        // 정상 실패 — 비난하지 않음
        mineJudgment = `${minePlay.category} 지뢰플레이 실패는 구조적으로 정상이다. 저확률은 원래 이렇다. 사이즈만 관리하면 된다.`
        break
      case 'repeat':
        mineJudgment = `${minePlay.category}에서 반복 진입하고 있다. 지뢰는 한두 번이면 충분하다. 같은 구간에서 계속 파지 마라.`
        break
      case 'oversize':
        mineJudgment = `${minePlay.detail} 지뢰플레이는 소액으로 터뜨리는 구조다. 큰 돈을 넣으면 지뢰가 아니라 자폭이다.`
        break
      case 'execution_error':
        mineJudgment = `${minePlay.detail} 높은 승률에서 연속 손실은 실행에 구멍이 있다는 뜻이다. 셋업이 아니라 진입/청산 타이밍을 점검해라.`
        break
    }
  }

  if (phase === 'RESET') {
    if (emotion.state === 'REVENGE') {
      judgment = `${consecutiveLosses}연패 후 사이즈가 ${Math.round((sizeTrend - 1) * 100)}% 커졌다. 복구 욕망이다. 지금 당장 멈춰라. 이 패턴이 계속되면 목표는 멀어진다.`
    } else if (emotion.state === 'TILT' || consecutiveLosses >= 3) {
      judgment = `${consecutiveLosses}연패다. 흐름이 완전히 꺾였다. 지금은 들어가는 게 아니라 살아남는 게 목표다. 시장은 내일도 있다.`
    } else {
      judgment = `최대 낙폭 ${fmt(maxDdPct * 100)}%. 더 이상 소모하지 마라. 포지션을 최소화하고 상황을 냉정하게 재점검해라.`
    }
  } else if (phase === 'DEFENSE') {
    if (evTrend === 'DECLINING') {
      judgment = `EV가 꺾이고 있다. 흐름이 나쁘지 않아도 지금은 공격이 아니다. 있는 것을 지키는 게 먼저다.`
    } else if (drawdownFromHwm > 0.15) {
      judgment = `고점에서 ${fmt(drawdownFromHwm * 100)}% 빠졌다. 더 빠지면 심리가 흔들린다. 지금은 방어 모드다. 공격은 흐름이 회복된 다음이다.`
    } else if (emotion.state === 'OVERCONFIDENCE') {
      judgment = `${consecutiveWins}연승이지만 진입 빈도가 올라가고 있다. 과신이다. 지금 사이즈를 유지하거나 줄여라. 탐욕은 이 구간에서 가장 비싼 감정이다.`
    } else {
      judgment = `${consecutiveLosses}연패다. 신규 진입은 최소화하고 흐름이 바뀔 때까지 기다려라. 확신이 없을 땐 현금이 포지션이다.`
    }
  } else if (phase === 'ATTACK') {
    const topStr = topCats.length ? topCats.join(', ') : '확인된 카테고리'
    judgment = `EV ${fmt(currentEv)}%, 흐름도 좋다. ${topStr}에 엣지가 있다. 공격은 허용된다. 단, 탐욕으로 기준을 낮추지 마라. 확실한 자리에서만 들어가라.`
  } else {
    // BUILD
    if (totalTrades < 5) {
      judgment = `아직 데이터가 충분하지 않다. 성급한 판단은 금물이다. 작은 사이즈로 패턴을 먼저 확인해라.`
    } else if (currentEquity < 0) {
      judgment = `마이너스 구간이다. 복구하려 들지 마라. 다시 처음부터, 작게, 확실하게 쌓아야 한다. 이게 맞는 길이다.`
    } else {
      judgment = `아직은 축적 단계다. 목표 $${(TARGET_GOAL / 1000).toFixed(0)}K까지 가는 길은 길다. 지금은 잃지 않는 게 버는 것이다.`
    }
  }

  // 지뢰 판단이 있고 severity >= 2면 judgment에 추가
  if (mineJudgment && minePlay.severity >= 2) {
    judgment += ` [지뢰분석] ${mineJudgment}`
  }

  // ── 20만 달러 관점 ───────────────────────────────────────────────────────────
  const targetView = {
    RESET:   `지금 패턴으로는 목표와 멀어진다. RESET하고 냉정하게 다시 쌓는 것만이 $${(TARGET_GOAL / 1000).toFixed(0)}K로 가는 길이다.`,
    BUILD:   `$${(TARGET_GOAL / 1000).toFixed(0)}K는 한 번의 대승이 아니라 잃지 않는 플레이가 쌓여서 만들어진다. 지금 구간이 그 기반이다.`,
    DEFENSE: `손실을 줄이는 것은 수익을 내는 것만큼 목표에 중요하다. 지금 지키는 것이 목표에 맞는 행동이다.`,
    ATTACK:  `EV가 확인된 카테고리에 집중하는 지금의 접근이 목표를 향한 올바른 방향이다. 단, 탐욕으로 흔들리지 마라.`,
  }[phase]

  // ── 지금 해야 할 플레이 ──────────────────────────────────────────────────────
  const playNow = {
    RESET:   `모든 신규 진입 중단${emotion.state === 'REVENGE' ? '. 사이즈 즉시 원복' : ''}. 흐름이 안정될 때까지 관망.`,
    BUILD:   `작은 사이즈로${topCats.length ? ` ${topCats.join(', ')} 카테고리에서만` : ' EV 있는 자리에서만'} 진입. 실수 없이 쌓아라.`,
    DEFENSE: `신규 진입 최소화. 기존 플레이 유지.${allowCats.length ? ` ${allowCats.slice(0, 2).map(c => c.trade_type).join(', ')}만 선택적 허용.` : ''}`,
    ATTACK:  `${topCats.length ? `${topCats.join(', ')} 카테고리` : 'EV 높은 자리'}에 집중. 확실한 자리에서만, 확실한 카테고리에서만.`,
  }[phase]

  // ── 금지 행동 ────────────────────────────────────────────────────────────────
  const forbidden = {
    RESET:   `신규 진입. 사이즈 확대. 손절 미루기. 감정적 복구 시도.`,
    BUILD:   `무분별한 카테고리 탐색. 사이즈 확대. 검증 안 된 자리 진입.`,
    DEFENSE: `신규 카테고리 탐색. 사이즈 확대. 연패 직후 즉각 재진입.`,
    ATTACK:  `탐욕적 오버사이징. EV 없는 카테고리 진입. 흐름에 취해 기준 낮추기.`,
  }[phase]

  // ── 사이즈 전략 ──────────────────────────────────────────────────────────────
  const sizeStrategy = {
    RESET:   `최소 사이즈 또는 거래 중단 — 지금은 지키는 게 먼저다`,
    BUILD:   `보수적 사이즈 유지 — 실수 없이 쌓는 게 목표다`,
    DEFENSE: `기존 사이즈 유지 또는 축소 — 공격이 아닌 방어다`,
    ATTACK:  `확인된 카테고리에 집중 — 분산 말고 엣지 있는 자리에 모아라`,
  }[phase]

  // ── 현재 상태 한 줄 ──────────────────────────────────────────────────────────
  const currentStatus = (() => {
    const parts = []
    if (currentEv !== null) parts.push(`EV ${currentEv >= 0 ? '+' : ''}${fmt(currentEv)}%${evTrend === 'DECLINING' ? ' ↓' : evTrend === 'RISING' ? ' ↑' : ''}`)
    if (drawdownFromHwm > 0.01) parts.push(`낙폭 ${fmt(drawdownFromHwm * 100)}%`)
    if (consecutiveLosses >= 2) parts.push(`${consecutiveLosses}연패`)
    else if (consecutiveWins >= 2) parts.push(`${consecutiveWins}연승`)
    if (emotion.state !== 'CALM') parts.push(emotion.detail)
    if (minePlay.detected && minePlay.severity >= 2) parts.push(`지뢰: ${minePlay.category}`)
    return parts.join(' | ') || '데이터 분석 중'
  })()

  // ── 포포에게 한 줄 브리핑 (메시지 풀 + 2일 로테이션) ───────────────────────────
  const oneLiner = buildOneLiner({ phase, emotion, ev, equity, consecutiveLosses, consecutiveWins, totalTrades, currentEquity, drawdownFromHwm, evTrend, minePlay })

  // ── 지뢰 분석 요약 (UI용) ──────────────────────────────────────────────────
  const mineAnalysis = minePlay.detected ? {
    type: minePlay.type,
    category: minePlay.category,
    detail: minePlay.type === 'normal_fail' ? mineJudgment : (mineJudgment || minePlay.detail),
    severity: minePlay.severity,
  } : null

  return { judgment, targetView, playNow, forbidden, sizeStrategy, currentStatus, oneLiner, mineAnalysis }
}

// ─── oneLiner 메시지 풀 (반복 방지를 위한 2일 로테이션) ──────────────────────

function buildOneLiner({ phase, emotion, ev, equity, consecutiveLosses, consecutiveWins, totalTrades, currentEquity, drawdownFromHwm, evTrend, minePlay }) {
  // 지뢰 오버사이징은 최우선
  if (minePlay.detected && minePlay.type === 'oversize') {
    return `포포, ${minePlay.category} 지뢰플레이에 큰 돈 넣지 마라. 지뢰는 소액으로 터뜨리는 거다.`
  }

  if (phase === 'RESET') {
    const pool = [
      emotion.state === 'REVENGE'
        ? `포포, 복구하려 들면 더 무너진다. 멈춰라.`
        : `포포, 지금은 잃지 않는 게 버는 것이다.`,
      `포포, ${consecutiveLosses}연패다. 이 구간은 버티는 게 이기는 거다.`,
      `포포, 시장은 내일도 열린다. 지금은 숨 쉬어라.`,
      `포포, 이 구간에서 들어가면 더 깊어진다. 멈추는 게 전략이다.`,
      `포포, 칩이 없으면 게임 자체가 끝난다. 지금은 지켜라.`,
    ]
    return pickFromPool(pool)
  }

  if (phase === 'DEFENSE') {
    const pool = [
      evTrend === 'DECLINING'
        ? `포포, 지금은 벌 때가 아니라 지킬 때다.`
        : `포포, 흐름이 좋지 않다. 기다려라.`,
      drawdownFromHwm > 0.15
        ? `포포, 흐름이 꺾이고 있다. 먼저 지켜라.`
        : `포포, 방어는 후퇴가 아니다. 살아남는 자가 이긴다.`,
      `포포, 조급하면 흐름이 와도 못 탄다. 냉정하게 기다려라.`,
      `포포, 지금은 잃는 크기를 줄이는 게 전략이다.`,
      `포포, 벌고 싶은 마음이 제일 위험한 구간이다. 참아라.`,
    ]
    return pickFromPool(pool)
  }

  if (phase === 'ATTACK') {
    const pool = [
      `포포, 공격은 허용된다. 하지만 확실한 자리에서만 들어가라.`,
      `포포, 흐름이 좋다. 엣지 있는 곳에만 집중해라. 나머지는 잡음이다.`,
      `포포, 좋은 흐름에서도 탐욕은 금물이다. 기준을 지켜라.`,
      `포포, 지금이 벌 때다. 단, 기준 밖의 자리에는 들어가지 마라.`,
    ]
    return pickFromPool(pool)
  }

  // BUILD
  const pool = [
    totalTrades < 5
      ? `포포, 아직 이른 판단이다. 작게 시작해라.`
      : `포포, 아직은 쌓는 구간이다. 무리하지 마라.`,
    currentEquity < 0
      ? `포포, 괜찮다. 다시 쌓으면 된다. 서두르지 마라.`
      : `포포, 지금은 속도가 아니라 방향이 중요하다.`,
    `포포, 큰 수익보다 작은 실수 줄이기가 먼저다.`,
    `포포, 이 구간을 잘 지나면 다음이 보인다. 꾸준히 가라.`,
    `포포, 조급함은 이 길에서 가장 비싼 감정이다. 천천히.`,
    `포포, 20만불은 한 달에 가는 게 아니다. 잃지 않으면서 걸어가라.`,
  ]
  return pickFromPool(pool)
}

// ─── 비거래일 브리핑 ─────────────────────────────────────────────────────────

function buildNoTradeBriefing(ctx) {
  const { equity, ev, phase, minePlay } = ctx
  const { current: currentEquity } = equity
  const { current: currentEv } = ev

  const pool = [
    // 일반 휴식
    `포포, 오늘은 거래가 없다. 쉬는 것도 전략이다. 내일의 좋은 판을 위해 에너지를 아껴라.`,
    `포포, 거래 없는 날이다. 복기할 건 복기하고, 나머지는 내려놓아라.`,
    `포포, 시장을 안 보는 날도 성장하는 날이다. 다음 기회는 반드시 온다.`,
    `포포, 오늘은 관망이다. 좋은 판이 올 때까지 칩을 지켜라.`,
    `포포, 안 들어간 날은 진 날이 아니다. 다음 좋은 자리를 위한 준비다.`,
  ]

  // 상황에 따라 추가 메시지
  if (phase === 'RESET') {
    pool.push(
      `포포, 지금은 쉬는 게 맞다. RESET 구간에서 가장 좋은 선택은 안 하는 것이다.`,
      `포포, 거래 안 한 것 자체가 오늘의 승리다. 흐름이 올 때까지 기다려라.`,
    )
  }

  if (phase === 'ATTACK' && currentEv > 0) {
    pool.push(
      `포포, EV가 양수인 구간이다. 좋은 셋업이 오면 그때 들어가면 된다. 서두르지 마라.`,
    )
  }

  if (minePlay.detected && minePlay.type === 'repeat') {
    pool.push(
      `포포, ${minePlay.category} 지뢰에서 쉬고 있는 건 좋은 선택이다. 같은 구간을 반복하지 마라.`,
    )
  }

  return pickFromPool(pool)
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * 이서후 전략 브리핑 생성
 * @param {object} analytics  - /api/analytics 응답
 * @param {array}  trades     - /api/trades 응답 (월별)
 * @returns {object|null}     - 브리핑 결과, 에러 시 null
 */
export function generateSeohuBriefing(analytics, trades) {
  try {
    const equityCurve    = analytics?.equity_curve    ?? []
    const evCurve        = analytics?.ev_curve        ?? []
    const tradeTypeStats = analytics?.trade_type_stats ?? []
    const kelly          = analytics?.kelly_percent   ?? null

    const equity   = getEquityInfo(equityCurve)
    const ev       = getEvInfo(evCurve)
    const sorted   = sortedByRecent(trades)
    const emotion  = detectEmotion(sorted)
    const total    = (trades ?? []).filter(t => Number.isFinite(t.pnl)).length
    const targetProgress = TARGET_GOAL > 0 ? (equity.current / TARGET_GOAL) * 100 : 0

    const phase = computePhase({ emotion, equity, ev, totalTrades: total })

    // 지뢰플레이 감지
    const minePlay = detectMinePlays(sorted, tradeTypeStats)

    const categories = tradeTypeStats
      .filter(t => Number.isFinite(t.ev_percent))
      .map(t => {
        const grade = gradeEv(t.ev_percent)
        const { permission, reason } = categoryPermission(grade, phase)
        return {
          trade_type: t.trade_type,
          ev_percent: t.ev_percent,
          win_rate:   t.win_rate,
          trades:     t.trades,
          grade,
          permission,
          reason,
        }
      })
      .sort((a, b) => b.ev_percent - a.ev_percent)

    const text = buildBriefingText({ phase, emotion, equity, ev, totalTrades: total, categories, minePlay })

    // 비거래일 체크: 오늘 날짜에 거래가 없으면 비거래 브리핑 추가
    const today = new Date().toISOString().slice(0, 10)
    const hasTradesToday = (trades ?? []).some(t => t.date === today)
    const noTradeBriefing = !hasTradesToday
      ? buildNoTradeBriefing({ equity, ev, phase, minePlay })
      : null

    return {
      phase,
      emotion,
      equity,
      ev,
      kelly,
      totalTrades: total,
      targetProgress,
      categories,
      minePlay,
      noTradeBriefing,
      ...text,
    }
  } catch (err) {
    console.warn('[seohuEngine] error:', err)
    return null
  }
}
