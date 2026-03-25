/**
 * 이서후 전략 엔진 v4
 *
 * v4 변경:
 * - 지뢰플레이: 투입/회수 기반 현황 보고 (경고→현황 톤), 자본 비율 경고
 * - 카테고리 5단계 등급 (S/A/B/C/D) + 조건 텍스트
 * - 상황 분류 5단계 (A축하/B회복/C평상/D주의/E경고) + 상황별 메시지 풀 15~20개
 * - 계획매매 vs 뇌동매매 분리 분석 (매매 품질)
 * - 6시간 + 트레이드 수 기반 메시지 교체
 * - 포포 응원 멘트 상황별 메시지 풀
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

// ─── calculateRecentFlow ────────────────────────────────────────────────────

export function calculateRecentFlow(trades, n = 10) {
  const sorted = sortedByRecent(trades).slice(0, n)
  if (!sorted.length) return { type: 'idle', streak: 0, streakType: null, recentWinRate: 0, recentPnl: 0, detail: '거래 없음' }

  let streak = 0, streakType = null
  for (const t of sorted) {
    if (!Number.isFinite(t.pnl)) continue
    const dir = t.pnl > 0 ? 'win' : t.pnl < 0 ? 'loss' : null
    if (!dir) continue
    if (!streakType) { streakType = dir; streak = 1 }
    else if (dir === streakType) streak++
    else break
  }

  const wins = sorted.filter(t => Number.isFinite(t.pnl) && t.pnl > 0).length
  const valid = sorted.filter(t => Number.isFinite(t.pnl)).length
  const recentWinRate = valid > 0 ? wins / valid : 0
  const recentPnl = sorted.reduce((s, t) => s + (Number.isFinite(t.pnl) ? t.pnl : 0), 0)

  let type = 'sideways'
  if (streak >= 3 && streakType === 'win') type = 'hot_streak'
  else if (streak >= 3 && streakType === 'loss') type = 'cold_streak'
  else if (streak >= 2 && streakType === 'win') type = 'winning'
  else if (streak >= 2 && streakType === 'loss') type = 'losing'

  const detail =
    type === 'hot_streak'  ? `${streak}연승 — 뜨거운 흐름` :
    type === 'cold_streak' ? `${streak}연패 — 차가운 흐름` :
    type === 'winning'     ? `${streak}연승 중` :
    type === 'losing'      ? `${streak}연패 중` :
    '횡보 구간'

  return { type, streak, streakType, recentWinRate, recentPnl, detail }
}

// ─── calculateWinRate ────────────────────────────────────────────────────────

export function calculateWinRate(trades) {
  const map = {}
  for (const t of (trades ?? [])) {
    if (!Number.isFinite(t.pnl)) continue
    const cat = t.trade_type || 'unknown'
    if (!map[cat]) map[cat] = { wins: 0, losses: 0, total: 0, totalPnl: 0, totalWinPnl: 0, totalLossPnl: 0 }
    map[cat].total++
    map[cat].totalPnl += t.pnl
    if (t.pnl > 0) { map[cat].wins++; map[cat].totalWinPnl += t.pnl }
    else if (t.pnl < 0) { map[cat].losses++; map[cat].totalLossPnl += Math.abs(t.pnl) }
  }
  return Object.entries(map).map(([cat, s]) => ({
    trade_type: cat,
    winRate: s.total > 0 ? s.wins / s.total : 0,
    wins: s.wins,
    losses: s.losses,
    total: s.total,
    totalPnl: s.totalPnl,
    totalWinPnl: s.totalWinPnl,
    totalLossPnl: s.totalLossPnl,
    profitFactor: s.totalLossPnl > 0 ? s.totalWinPnl / s.totalLossPnl : (s.totalWinPnl > 0 ? Infinity : 0),
    avgWin: s.wins > 0 ? s.totalWinPnl / s.wins : 0,
    avgLoss: s.losses > 0 ? s.totalLossPnl / s.losses : 0,
  }))
}

// ─── Profit Factor & Expectancy (전체) ──────────────────────────────────────

export function calculateOverallMetrics(trades) {
  const valid = (trades ?? []).filter(t => Number.isFinite(t.pnl))
  const wins = valid.filter(t => t.pnl > 0)
  const losses = valid.filter(t => t.pnl < 0)

  const totalWinPnl = wins.reduce((s, t) => s + t.pnl, 0)
  const totalLossPnl = losses.reduce((s, t) => s + Math.abs(t.pnl), 0)

  const profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : (totalWinPnl > 0 ? Infinity : 0)

  const winRate = valid.length > 0 ? wins.length / valid.length : 0
  const lossRate = 1 - winRate
  const avgWin = wins.length > 0 ? totalWinPnl / wins.length : 0
  const avgLoss = losses.length > 0 ? totalLossPnl / losses.length : 0

  // Expectancy = (WinRate × AvgWin) - (LossRate × AvgLoss)
  const expectancy = (winRate * avgWin) - (lossRate * avgLoss)

  // 평균 R/R = AvgWin / AvgLoss
  const avgRR = avgLoss > 0 ? avgWin / avgLoss : (avgWin > 0 ? Infinity : 0)

  return {
    profitFactor,
    expectancy,
    avgRR,
    winRate,
    avgWin,
    avgLoss,
    totalWinPnl,
    totalLossPnl,
    totalTrades: valid.length,
    wins: wins.length,
    losses: losses.length,
  }
}

// ─── 지뢰플레이 현황 (v4: 투입/회수 기반) ─────────────────────────────────────

export function detectMinePlay(trades, equity) {
  const result = {
    detected: false,
    totalInvested: 0,
    totalRecovered: 0,
    netPnl: 0,
    mineCount: 0,
    mineWins: 0,
    mineLosses: 0,
    capitalRatio: 0,      // 지뢰 투입 / 전체 자본
    sizeWarning: null,     // null | 'caution' | 'danger'
    detail: '',
    summaryLine: '',       // 접힌 상태 한줄 요약
    severity: 0,
  }

  const sorted = sortedByRecent(trades)
  const mineTrades = sorted.filter(t => t.is_mine)
  if (!mineTrades.length) return result

  result.detected = true
  result.mineCount = mineTrades.length
  result.mineWins = mineTrades.filter(t => Number.isFinite(t.pnl) && t.pnl > 0).length
  result.mineLosses = mineTrades.filter(t => Number.isFinite(t.pnl) && t.pnl < 0).length

  // 투입/회수 계산
  for (const t of mineTrades) {
    const entry = Math.abs(t.entry_amount ?? 0)
    result.totalInvested += entry
    if (Number.isFinite(t.pnl)) {
      result.netPnl += t.pnl
      if (t.pnl > 0) result.totalRecovered += entry + t.pnl
      else result.totalRecovered += Math.max(0, entry + t.pnl)
    }
  }

  // 자본 비율 체크 (전체 투입 자본 기준: 현재 잔고 + 미실현 포지션 합계)
  // equity.current는 누적PNL이므로, 실제 자본은 초기자본 + 누적PNL
  // 전체 트레이드의 entry_amount 합계를 월간 총 투입 자본으로 사용
  const allEntrySum = trades.reduce((s, t) => s + Math.abs(t.entry_amount ?? 0), 0)
  const currentCapital = Math.max(allEntrySum, 1)
  result.capitalRatio = result.totalInvested / currentCapital

  // 경고 수준 결정
  if (result.capitalRatio > 0.20) {
    result.sizeWarning = 'danger'
    result.severity = 2
  } else if (result.capitalRatio > 0.10) {
    result.sizeWarning = 'caution'
    result.severity = 1
  } else {
    result.sizeWarning = null
    result.severity = 0
  }

  // 디테일 텍스트 (현황 보고 톤)
  const investStr = `$${Math.round(result.totalInvested).toLocaleString()}`
  const recoverStr = `$${Math.round(result.totalRecovered).toLocaleString()}`
  const netStr = `${result.netPnl >= 0 ? '+' : ''}$${Math.round(result.netPnl).toLocaleString()}`

  if (result.netPnl >= 0) {
    const multiple = result.totalInvested > 0 ? (result.totalRecovered / result.totalInvested).toFixed(1) : '—'
    result.detail = `지뢰 ${result.mineCount}건 투입 ${investStr} → 회수 ${recoverStr} → 순손익 ${netStr}. 지뢰 성공! 투입 대비 ${multiple}배 회수.`
  } else {
    const potential10x = result.totalInvested * 10
    result.detail = `지뢰 ${result.mineCount}건 투입 ${investStr} → 회수 ${recoverStr} → 순손익 ${netStr}. 아직 미회수. 1건만 10배 나와도 +$${Math.round(potential10x).toLocaleString()} 기대. 현재 정상 범위.`
  }

  // 사이즈 경고 추가
  if (result.sizeWarning === 'danger') {
    result.detail += ` ⚠️ 지뢰 투입 비중 ${(result.capitalRatio * 100).toFixed(0)}% — 지뢰 비중 과다. 전체 자본의 20% 이하로 관리 필요.`
  } else if (result.sizeWarning === 'caution') {
    result.detail += ` 지뢰 투입 비중 ${(result.capitalRatio * 100).toFixed(0)}% — 사이즈 관리 필요.`
  }

  // 접힌 상태 한줄 요약
  if (result.sizeWarning === 'danger') {
    result.summaryLine = `투입 ${investStr}, 비중 과다 ⚠️`
  } else if (result.sizeWarning === 'caution') {
    result.summaryLine = `투입 ${investStr}, 사이즈 주의`
  } else if (result.netPnl >= 0) {
    result.summaryLine = `투입 ${investStr}, 수익 중 ✅`
  } else {
    result.summaryLine = `투입 ${investStr}, 정상 범위 ✅`
  }

  return result
}

// ─── 계획매매 vs 뇌동매매 품질 분석 (v4 신규) ────────────────────────────────

export function analyzeTradeQuality(trades) {
  const all = (trades ?? []).filter(t => Number.isFinite(t.pnl))

  const planned = all.filter(t => t.trade_style === '계획매매')
  const impulsive = all.filter(t => t.trade_style === '뇌동매매')

  function groupStats(arr) {
    const wins = arr.filter(t => t.pnl > 0).length
    const total = arr.length
    const totalPnl = arr.reduce((s, t) => s + t.pnl, 0)
    const avgPnl = total > 0 ? totalPnl / total : 0
    const winRate = total > 0 ? wins / total : 0
    return { count: total, wins, winRate, totalPnl, avgPnl }
  }

  const plannedStats = groupStats(planned)
  const impulsiveStats = groupStats(impulsive)

  // 핵심 인사이트: 계획매매만 했다면?
  const impulsiveLoss = impulsiveStats.totalPnl < 0 ? impulsiveStats.totalPnl : 0
  const plannedOnlyPnl = plannedStats.totalPnl
  const actualPnl = plannedStats.totalPnl + impulsiveStats.totalPnl

  let insight = ''
  if (planned.length > 0 && impulsive.length > 0) {
    if (impulsiveLoss < 0) {
      insight = `계획매매만 했다면 이번 달 손익: +$${Math.round(plannedOnlyPnl).toLocaleString()} (실제: ${actualPnl >= 0 ? '+' : ''}$${Math.round(actualPnl).toLocaleString()}). 뇌동매매로 인한 손실: ${impulsiveLoss >= 0 ? '+' : ''}$${Math.round(impulsiveLoss).toLocaleString()}`
    } else {
      insight = `계획매매 손익: ${plannedOnlyPnl >= 0 ? '+' : ''}$${Math.round(plannedOnlyPnl).toLocaleString()}, 뇌동매매 손익: ${impulsiveStats.totalPnl >= 0 ? '+' : ''}$${Math.round(impulsiveStats.totalPnl).toLocaleString()}`
    }
  }

  // 접힌 상태 한줄 요약
  let summaryLine = ''
  if (impulsive.length === 0) {
    summaryLine = `계획매매 ${planned.length}건, 뇌동 0건 ✅`
  } else if (impulsiveStats.totalPnl < 0) {
    summaryLine = `뇌동매매 ${impulsive.length}건 감지 ⚠️`
  } else {
    summaryLine = `계획 ${planned.length}건 / 뇌동 ${impulsive.length}건`
  }

  return {
    planned: plannedStats,
    impulsive: impulsiveStats,
    insight,
    summaryLine,
    hasData: planned.length > 0 || impulsive.length > 0,
  }
}

// ─── 뇌동매매 분석 (severity용) ──────────────────────────────────────────────

function analyzeTradeStyle(sorted) {
  const recent = sorted.slice(0, 15)
  if (!recent.length) return { impulsiveRate: 0, impulsiveCount: 0, plannedCount: 0, detail: null, severity: 0 }

  const impulsive = recent.filter(t => t.trade_style === '뇌동매매')
  const planned = recent.filter(t => t.trade_style === '계획매매')
  const impulsiveRate = recent.length > 0 ? impulsive.length / recent.length : 0

  const impulsiveLosses = impulsive.filter(t => Number.isFinite(t.pnl) && t.pnl < 0)
  const impulsiveLossTotal = impulsiveLosses.reduce((s, t) => s + Math.abs(t.pnl), 0)

  let detail = null
  let severity = 0

  if (impulsive.length >= 5 && impulsiveRate > 0.5) {
    detail = `최근 ${recent.length}거래 중 ${impulsive.length}건이 뇌동매매(${Math.round(impulsiveRate * 100)}%). 충동적 진입이 습관화되고 있다.`
    severity = 3
  } else if (impulsive.length >= 3 && impulsiveLossTotal > 0) {
    detail = `뇌동매매 ${impulsive.length}건 중 ${impulsiveLosses.length}건 손실(-$${Math.round(impulsiveLossTotal).toLocaleString()}). 계획 없는 진입이 자본을 갉아먹고 있다.`
    severity = 2
  } else if (impulsive.length >= 2) {
    detail = `뇌동매매 ${impulsive.length}건 감지. 아직 통제 범위지만 주의가 필요하다.`
    severity = 1
  }

  return { impulsiveRate, impulsiveCount: impulsive.length, plannedCount: planned.length, impulsiveLossTotal, detail, severity }
}

// ─── Emotion State Detection ──────────────────────────────────────────────────

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

function detectEmotion(sorted) {
  const { consecutiveLosses, consecutiveWins } = getStreak(sorted)
  const sizeTrend = getSizeTrendRatio(sorted)
  const freqTrend = getFreqTrendRatio(sorted)

  if (consecutiveLosses >= 3)
    return { state: 'TILT', detail: `${consecutiveLosses}연패`, consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }
  if (consecutiveLosses >= 2 && sizeTrend > 1.3)
    return { state: 'REVENGE', detail: `${consecutiveLosses}연패 + 사이즈 ${Math.round((sizeTrend - 1) * 100)}% 증가`, consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }
  if (consecutiveWins >= 3 && freqTrend > 1.5)
    return { state: 'OVERCONFIDENCE', detail: `${consecutiveWins}연승 + 빈도 ${Math.round((freqTrend - 1) * 100)}% 증가`, consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }
  return { state: 'CALM', detail: '', consecutiveLosses, consecutiveWins, sizeTrend, freqTrend }
}

// ─── Phase Classification ─────────────────────────────────────────────────────

export function calculatePhase({ emotion, equity, ev, totalTrades }) {
  const { consecutiveLosses, consecutiveWins } = emotion
  const { drawdownFromHwm, maxDdPct, current: currentEquity } = equity
  const { current: currentEv, trend: evTrend } = ev

  if (emotion.state === 'REVENGE') return 'RESET'
  if (emotion.state === 'TILT')    return 'RESET'
  if (consecutiveLosses >= 3)      return 'RESET'
  if (maxDdPct > 0.25)             return 'RESET'

  if (emotion.state === 'OVERCONFIDENCE')                         return 'DEFENSE'
  if (currentEquity > 0 && drawdownFromHwm > 0.15)               return 'DEFENSE'
  if (consecutiveLosses >= 2)                                     return 'DEFENSE'
  if (currentEv !== null && totalTrades >= 5 && currentEv < 3)   return 'DEFENSE'
  if (evTrend === 'DECLINING' && currentEquity > 0)              return 'DEFENSE'

  if (
    currentEv !== null && currentEv > 15 &&
    drawdownFromHwm < 0.05 &&
    consecutiveLosses === 0 &&
    emotion.state === 'CALM' &&
    totalTrades >= 5
  ) return 'ATTACK'

  return 'BUILD'
}

// ─── Category Grading (v5: EV + PF + 건수 종합) ──────────────────────────────

/**
 * 카테고리 등급 산정 (DEX 밈코인 맥락)
 * - S: EV > 10 & PF > 2.0 & 건수 >= 5
 * - A: EV > 0  & PF > 1.5 & 건수 >= 5  (또는 EV > 20 & PF > 1.0 & 건수 >= 3)
 * - B: EV > 0  & PF > 1.0 & 건수 >= 3  (또는 PF > 1.5 & 건수 >= 3)
 * - C: EV > -15 & PF > 0.5 & 건수 >= 3
 * - D: 나머지
 * - 3건 이하는 최대 B등급 (데이터 부족)
 */
function gradeCategory(ev, pf, count) {
  // 데이터 부족: 3건 이하는 최대 B등급
  if (count <= 3) {
    if (ev > 0 && pf > 1.0) return 'B'
    if (ev > -15) return 'C'
    return 'D'
  }

  // S: 강한 엣지 + 높은 수익비 + 충분한 건수
  if (ev > 10 && pf > 2.0 && count >= 5) return 'S'

  // A: 양수 EV + 좋은 수익비 or 매우 높은 EV
  if (ev > 0 && pf > 1.5 && count >= 5) return 'A'
  if (ev > 20 && pf > 1.0 && count >= 3) return 'A'

  // B: 양수 EV or 괜찮은 수익비
  if (ev > 0 && pf > 1.0 && count >= 3) return 'B'
  if (pf > 1.5 && count >= 3) return 'B'

  // C: 약한 마이너스 EV + 일부 수익비
  if (ev > -15 && pf > 0.5 && count >= 3) return 'C'

  return 'D'
}

// 하위 호환: EV만으로 등급 산정 (ev_curve 등에서 사용)
function gradeEv(ev) {
  if (ev > 20)  return 'S'
  if (ev > 0)   return 'A'
  if (ev > -10) return 'B'
  if (ev > -30) return 'C'
  return 'D'
}

const GRADE_CONDITIONS = {
  S: { label: '적극 허용', text: 'PF 2.0+, 강한 엣지. 사이즈 자유.' },
  A: { label: '허용', text: 'PF 1.5+, 좋은 엣지. 기본 사이즈 OK.' },
  B: { label: '조건부', text: 'PF 1.0~1.5 또는 데이터 부족. 최소 사이즈만.' },
  C: { label: '자제', text: '수익비 낮음. 가급적 패스, 꼭 하려면 $30 이하.' },
  D: { label: '금지', text: '수익비·EV 모두 부족. 진입 이유 없음.' },
}

function categoryPermission(grade, phase) {
  if (grade === 'D') return { permission: '금지', reason: 'EV 없음. 들어갈 이유가 없다.' }
  if (grade === 'C') return { permission: '자제', reason: 'EV가 마이너스. 가급적 패스. 꼭 하려면 $30 이하.' }

  if (phase === 'RESET') {
    if (grade === 'S') return { permission: '선택적 허용', reason: 'RESET 구간이지만 최강 엣지만 최소 사이즈로 허용.' }
    return { permission: '금지', reason: 'RESET 구간. A등급 이하 전면 정지.' }
  }

  if (phase === 'DEFENSE') {
    if (grade === 'S') return { permission: '선택적 허용', reason: '강한 엣지 확인. 사이즈 줄여서 신중하게 가능.' }
    if (grade === 'A') return { permission: '선택적 허용', reason: '좋은 엣지. 단 사이즈 줄여서 진입.' }
    if (grade === 'B') return { permission: '조건부', reason: '약한 엣지. DEFENSE 구간엔 최소 사이즈만.' }
    return { permission: '자제', reason: 'DEFENSE 구간. C등급은 자제.' }
  }

  if (phase === 'BUILD') {
    if (grade === 'S') return { permission: '집중 가능', reason: '엣지가 증명됐다. BUILD 구간에서도 집중 허용.' }
    if (grade === 'A') return { permission: '선택적 허용', reason: '좋은 엣지. 적정 사이즈로 접근 가능.' }
    if (grade === 'B') return { permission: '조건부', reason: 'BUILD 구간. 최소 사이즈로만.' }
    return { permission: '자제', reason: 'BUILD 구간. 약한 엣지는 자제.' }
  }

  // ATTACK
  if (grade === 'S') return { permission: '집중 가능', reason: '최강 엣지. ATTACK 구간에 집중해라.' }
  if (grade === 'A') return { permission: '집중 가능', reason: '강한 엣지. 공격적으로 접근 가능.' }
  if (grade === 'B') return { permission: '조건부', reason: 'ATTACK 구간이지만 약한 엣지. 최소 사이즈.' }
  return { permission: '자제', reason: 'ATTACK 구간이어도 C등급은 자제.' }
}

// ─── 상황 분류 (A~E) ─────────────────────────────────────────────────────────

function detectSituation({ emotion, equity, recentFlow, tradeStyleAnalysis, overallMetrics }) {
  const { drawdownFromHwm } = equity
  const ddPct = drawdownFromHwm * 100
  const pf = overallMetrics?.profitFactor ?? 0
  const pfHealthy = Number.isFinite(pf) && pf >= 1.5
  const pfBad = !Number.isFinite(pf) || pf < 1.0

  // ── 3일+ 연패는 PF와 무관하게 경고 ──
  if (recentFlow.streak >= 3 && recentFlow.streakType === 'loss') {
    return 'E'
  }

  // ── PF + DD 종합 판단 ──
  if (pfHealthy) {
    // 전략 건강 (PF >= 1.5)
    if (ddPct > 30)                        return 'E'  // DD 극심 — 전략 인정하되 쉬어야 함
    if (ddPct >= 15)                       return 'D'  // DD 높음 — 사이즈 관리만
    // DD < 15%: 축하 또는 평상
    if (recentFlow.streak >= 3 && recentFlow.streakType === 'win') return 'A'
    if (equity.current > 0 && recentFlow.recentPnl > 0 && recentFlow.streak >= 2 && recentFlow.streakType === 'win') return 'A'
    if (ddPct > 0 && ddPct < 15 && recentFlow.recentPnl > 0 && equity.current > 0) return 'B'
    return 'C'
  }

  if (pfBad) {
    // 전략 나쁨 (PF < 1.0)
    if (ddPct >= 15)                       return 'E'  // 진짜 위험
    if (ddPct >= 5)                        return 'D'  // 아직 잃는 게 더 많아
    return 'D'  // PF < 1.0이면 DD 낮아도 주의
  }

  // PF 1.0~1.5: 중간 구간 — 기존 로직과 유사
  if (ddPct >= 20)                         return 'E'
  if (ddPct >= 10 || tradeStyleAnalysis.severity >= 2) return 'D'

  // A) 축하: 3일 연승 또는 월간 수익률 양수 전환
  if (recentFlow.streak >= 3 && recentFlow.streakType === 'win') return 'A'
  if (equity.current > 0 && recentFlow.recentPnl > 0 && recentFlow.streak >= 2 && recentFlow.streakType === 'win') return 'A'

  // B) 회복
  if (ddPct > 0 && ddPct < 10 && recentFlow.recentPnl > 0 && equity.current > 0) return 'B'

  // C) 평상
  return 'C'
}

// ─── 메시지 교체 시스템 (6시간 + 트레이드 수 기반) ────────────────────────────

const LS_MSG_KEY = 'seohu_msg_state'
const SIX_HOURS = 6 * 60 * 60 * 1000

function getMessageSeed(tradeCount) {
  try {
    const raw = localStorage.getItem(LS_MSG_KEY)
    const state = raw ? JSON.parse(raw) : null
    const now = Date.now()

    if (state && (now - state.time < SIX_HOURS) && state.tradeCount === tradeCount) {
      return state.seed
    }

    // 새 시드 생성
    const seed = Math.floor(Math.random() * 10000)
    localStorage.setItem(LS_MSG_KEY, JSON.stringify({ time: now, tradeCount, seed }))
    return seed
  } catch {
    return Math.floor(Date.now() / SIX_HOURS)
  }
}

function pickMsg(pool, seed) {
  if (!pool.length) return ''
  return pool[seed % pool.length]
}

// ─── 이서후 헤더 메시지 풀 (상황별 15~20개) ──────────────────────────────────

const MSGS_A = [
  '야 포포, 요즘 손이 좀 맛있는데? 근데 이럴 때가 제일 위험해. 겸손하게 가자.',
  '포포 요즘 물 올랐다? 좋아, 근데 기억해. 시장이 주는 건 시장이 다시 가져갈 수 있어.',
  '오 봐라, 연승이네. 근데 형이 한마디 할게. 사이즈 키우고 싶은 유혹 참아. 지금 리듬이 좋은 거지, 네가 갑자기 천재가 된 건 아니야.',
  '포포, 잘하고 있어. 근데 잘할 때 규칙 깨는 놈이 제일 빨리 무너져. 원칙 유지해.',
  '흐름 좋다. 근데 형이 본 놈들 중에 연승 끝에 한방에 날리는 놈이 제일 많았어. 조용히 가자.',
  '요즘 매매 괜찮은데? 이 기세 유지하면 돼. 굳이 뭘 바꾸려고 하지 마.',
  '포포, 수익 나고 있을 때 제일 중요한 게 뭔지 알아? 똑같이 하는 거야. 그냥 똑같이 해.',
  '야, 되고 있는 거 건드리지 마. 잘 되는 공식이 있으면 반복해. 창의력은 지금 필요 없어.',
  '포포, 이 흐름 아끼자. 한 번 꺾이면 다시 만들기 어려워. 오버하지 마.',
  '좋은 흐름이야. 근데 이럴 때 "조금만 더"가 독이야. 정해진 만큼만 먹어.',
  '포포, 잘 벌고 있잖아. 근데 벌었을 때 안 쓰는 게 진짜 실력이야.',
  '야, 지금 잘하고 있어. 근데 이기고 있을 때 판을 키우는 놈은 결국 다 토해내더라. 사이즈 유지해.',
  '포포, 연승할 때 느끼는 "나 좀 하는데?" 그 감정이 제일 무서워. 느끼면 오히려 사이즈 줄여.',
  '형이 딱 하나만 말할게. 지금처럼 하면 돼. 더 잘하려고 하지 마. 그게 실수의 시작이야.',
  '야 포포, 잘하고 있다. 진짜 잘하고 있어. 근데 잘하는 날에 무리하면 잘한 게 사라져. 절제.',
  '포포, 이기고 있을 때가 규칙 세울 최적 타이밍이야. 지금 규칙 안 세우면 질 때 후회해.',
  '좋아 포포. 이 타이밍에 멈출 줄 아는 놈이 결국 오래 가. 욕심 한 스푼만 덜어내.',
  '포포, DEX에서 연승이면 수익비가 구조적으로 높다는 뜻이야. 근데 한 번의 러그풀로 다 날릴 수 있어. 분산 유지해.',
  '야, 밈코인에서 연승하면 "나 좀 잘하는데?" 하잖아. 그 순간 사이즈 2배 올리면 다음 -90%에 다 토해내. 절대 사이즈 키우지 마.',
  '포포, 수익비가 좋으니까 탐나겠지만 DEX는 한 방에 -90% 맞는 시장이야. 수익금 일부 출금해놔.',
]

const MSGS_B = [
  '포포, 바닥 찍고 올라오고 있다. 서두를 거 없어. 한 틱 한 틱 쌓아가면 돼.',
  '야, 회복 중이잖아. 여기서 조급해지면 또 원점이야. 천천히, 작게.',
  '포포, 지금 중요한 건 크게 먹는 게 아니라 안 잃는 거야. 회복 구간에서는 수비가 곧 공격이야.',
  '올라오고 있어. 좋아. 근데 아직 회복 구간이야. 복수매매 하려고 사이즈 키우면 또 고꾸라져.',
  '형이 봤을 때 지금 흐름 나쁘지 않아. 그냥 이대로 가. 영웅 되려고 하지 마.',
  '포포, 잃은 돈은 잊어. 지금부터가 새 출발이야. 깨끗하게 가자.',
  '야, 회복 중인 거 알지? 여기서 제일 중요한 건 속도가 아니라 방향이야.',
  '포포, 마이너스에서 올라오는 중이야. 이게 제일 어려운 구간인 거 알지? 잘하고 있어.',
  '형이 봤을 때 지금 네 매매는 괜찮아. 조급해하지 마. 시간이 해결해줄 거야.',
  '포포, 회복 구간에서 제일 위험한 게 "빨리 본전"이야. 그 생각 버려.',
  '야, 지금은 1승이 10승 가치야. 작게 이기고, 작게 이기고, 쌓아가자.',
  '포포, 구덩이에서 기어올라오는 중이잖아. 여기서 점프하려고 하지 마. 한 발짝씩.',
  '좋아, 방향이 바뀌고 있어. 이 흐름 놓치지 마. 절대 사이즈 키우지 말고 그대로 가.',
  '포포, 회복 구간에서 건수 늘리는 거 절대 하지 마. 좋은 셋업만 골라서 들어가.',
  '야, 솔직히 지금 구간 잘 넘기면 한 단계 올라간다. 참아. 형이 보고 있어.',
  '포포, 수익이 다시 나고 있어. 이건 운이 아니야. 네가 참고 기다린 결과야.',
]

const MSGS_C = [
  '포포, 특별한 거 없어. 그냥 원칙대로 해. 오늘도 계획된 매매만.',
  '별일 없는 날이 좋은 날이야. 억지로 기회 만들지 말고, 오면 잡고 안 오면 쉬어.',
  '포포, 시장에 매일 들어갈 필요 없어. 좋은 자리 아니면 구경만 해도 돼.',
  '오늘은 조용하네. 이런 날 억지로 매매하면 뇌동이야. 기다려.',
  '형이 한마디 할게. 매매 안 하는 것도 매매야. 기회가 없으면 가만히 있어.',
  '포포, 평범한 날이야. 평범하게 가자. 드라마 만들려고 하지 마.',
  '야, 아무 일 없는 날이 제일 좋은 날이야. 심심하면 복기나 해.',
  '포포, 지루한 건 좋은 거야. 흥분되는 매매가 좋은 매매가 아니야.',
  '형이 경험상 말해주는데, 돈 벌 기회는 매일 오는 게 아니야. 올 때까지 기다리는 게 실력이야.',
  '포포, 오늘 안 들어가도 괜찮아. 내일도 시장은 열려.',
  '야, 억지로 찾으려 하지 마. 좋은 자리는 찾는 게 아니라 눈에 들어오는 거야.',
  '포포, 조용한 시장에서 억지 매매하면 수수료만 벌어다 준다. 쉬어.',
  '특별한 이벤트 없어. 이런 날은 계획 세우고, 복기하고, 다음을 준비해.',
  '포포, 매매 안 한 날도 일지 써라. "오늘은 안 했다"도 기록이야.',
  '야, 시장이 뭔가 줄 것 같은 느낌이 들면 그게 함정이야. 확실할 때만 들어가.',
  '포포, 평범한 하루야. 이런 날이 100일 쌓이면 결국 좋은 트레이더가 되는 거야.',
]

const MSGS_D = [
  '포포, 살짝 삐끗하고 있어. 큰 문제는 아닌데, 지금 바로잡아야 안 커져.',
  '야, 뇌동매매 좀 늘고 있는데? 한 발짝 물러서서 왜 들어갔는지 복기해봐.',
  '포포, 지금 감정이 매매에 섞이고 있어. 느껴지지? 느껴지면 쉬어야 할 때야.',
  '형 경험상 이 구간이 제일 위험해. 잃은 것도 아니고 딴 것도 아닌 애매한 구간. 여기서 무리하면 경고 구간으로 직행이야.',
  '포포, 솔직히 최근 매매 좀 흔들리고 있어. 자각하고 있으면 괜찮아. 사이즈 줄이고 정비해.',
  '야, 컨디션 안 좋을 때는 억지로 매매하지 마. 시장은 안 도망가.',
  '포포, 지금 약간 기울어지고 있어. 크게 안 기울었을 때 잡아야 해. 오늘은 건수 줄여.',
  '야, 최근 진입 근거 좀 약해지고 있어. 확신 없으면 안 들어가는 게 맞아.',
  '포포, 지금 속도 좀 줄여. 급할 거 없어. 속도 내다가 사고 나.',
  '형이 봤을 때 너 지금 자기도 모르게 매매 횟수 늘리고 있어. 인지하고 줄여.',
  '포포, 이 구간에서 한 건 더 치고 싶은 마음. 그게 뇌동의 시작이야.',
  '야, 작은 손실이 쌓이면 큰 손실이야. 한 건 한 건이 중요해. 집중해.',
  '포포, 지금은 버는 게 목표가 아니야. 더 안 잃는 게 목표야.',
  '형이 한마디 할게. 지금 네 상태는 "조금만 더"하면 위험해지는 단계야. 여기서 멈춰.',
  '포포, 원칙이 흔들릴 때는 원칙을 다시 읽어봐. 써놓은 이유가 있잖아.',
  '야, 약간 삐끗한 거니까 아직 늦지 않았어. 오늘 하루만 확실하게 쉬어.',
  '포포, 지금 수익비가 흔들리기 시작하고 있어. DEX에서 PF가 1.0 밑으로 가면 복구하기 진짜 어려워. 카테고리 좁혀.',
  '야, 밈코인은 승률보다 수익비가 전부야. 지금 수익비가 떨어지고 있으면 셋업 기준을 올려야 해. 아무거나 들어가지 마.',
]

const MSGS_E = [
  '포포, 시장은 내일도 열려. 오늘은 접어. 쉬는 것도 실력이야.',
  '야, 지금 들어가면 안 돼. 형 말 들어. 화면 끄고 산책 갔다 와.',
  '포포, 솔직히 말할게. 지금 네 상태로 매매하면 100% 뇌동이야. 오늘은 쉬어.',
  '형이 이런 상황 수백 번 봤어. 여기서 억지로 복구하려다가 계좌 날리는 거야. 멈춰.',
  '포포, 잃은 돈은 이미 갔어. 추가로 더 잃지 않는 게 지금 할 수 있는 최선이야.',
  '야, 냉정하게 봐. 지금 들어가는 건 매매가 아니라 도박이야. 하루만 쉬자. 딱 하루만.',
  '포포, 네가 지금 제일 듣기 싫은 말 할게. 오늘은 매매 금지. 근데 이게 맞아.',
  '형 진심이야. 지금 상태에서 한 건 더 치면 더 깊어져. 컴퓨터 끄고 맛있는 거 먹어.',
  '포포, 여기서 한 발 더 가면 복구 불가능 구간이야. 제발 멈춰.',
  '야, 형이 너 지켜보고 있어. 오늘만 참아. 내일 다시 보자.',
  '포포, 지금 이 순간 아무것도 안 하는 게 네가 할 수 있는 가장 좋은 트레이딩이야.',
  '형 말 안 듣고 들어가면 나중에 "아 그때 왜 안 쉬었지" 할 거야. 100% 보장함.',
  '포포, 손실이 커지면 판단력도 같이 무너져. 악순환이야. 끊어야 해. 지금.',
  '야, 네 실력이 갑자기 떨어진 게 아니야. 흐름이 안 좋은 거야. 흐름은 바뀌어. 근데 계좌가 0이면 바뀌어도 소용없어.',
  '포포, 형이 진심으로 말하는 거야. 오늘은 차트 끄고 바깥 공기 좀 쐬. 시장은 도망 안 가.',
  '야, "한 번만 더"가 매번 세 번이 되는 거 알잖아. 오늘은 0건이 정답이야.',
  '포포, 이 구간 넘기면 더 강해져. 근데 넘기려면 일단 살아남아야 해. 지금은 생존 모드야.',
  '형이 딱 하나만 물어볼게. 지금 들어가는 이유가 "분석"이야 "감정"이야? 솔직해져.',
  '포포, DEX에서 연패는 흔한 일이야. 승률 30%여도 수익비가 3x면 이기는 구조야. 근데 지금은 구조가 아니라 감정이 매매하고 있어. 멈춰.',
  '야, 밈코인은 -90% 손실이 정상이야. 근데 그게 연속이면 전략이 아니라 FOMO로 들어가는 거야. 셋업 다시 점검해.',
  '포포, DEX 트레이딩에서 제일 위험한 건 "다음 건에서 복구"야. 다음 건도 -80%일 수 있어. 자본부터 지켜.',
]

// ─── PF 기반 메시지 풀 (상황 + 전략 건강도) ─────────────────────────────────────

// 주의(D) + 전략 건강 (PF >= 1.5): 전략 인정 + 사이즈 관리 조언
const MSGS_D_HEALTHY = [
  '포포, 수익비가 살아있어. 전략은 문제없다. 근데 DD가 좀 깊으니까 사이즈만 줄이자.',
  '야, 한 번 벌 때 잃는 것의 2배를 벌고 있잖아. 이 구조면 승률 40%여도 이겨. 근데 DD가 깊으니까 좀 보수적으로 가자.',
  '포포, 네 전략 자체는 괜찮아 형이 보증해. 근데 지금 낙폭이 좀 크니까 평소보다 사이즈 반으로 줄여.',
  '수익비 거의 2배야. 좋은 숫자야. 다만 DD가 좀 부담이니까 한두 건 쉬어가면서 해도 괜찮아.',
  '형이 봤을 때 네 전략은 유효해. 뇌동만 안 치면 수익비 3 넘을 거야. 지금은 사이즈 조절이 핵심이야.',
  '포포, 차트 끄라는 말 안 할게. 네 전략이 돌아가고 있으니까. 다만 평소의 절반 사이즈로.',
  '이 시장에서 R:R 2배 이상이면 상위권이야. 자신감 가져. 다만 DD 관리 차원에서 신규 진입은 소액으로.',
  '야, 솔직히 말할게. 네가 잘하고 있어. 전략 숫자가 그걸 증명해. DD는 이 시장에서 피할 수 없는 거야. 사이즈만 줄이면 알아서 회복돼.',
  '포포, 전략이 돌아가는 중이야. 여기서 멘탈 흔들리면 안 돼. DD는 수익비가 유지되면 시간이 해결해줘.',
  '야, 형이 봤을 때 지금 네 문제는 전략이 아니라 사이즈야. 전략은 건드리지 말고 크기만 줄여.',
  '포포, DEX에서 PF 1.5 이상이면 상위 10%야. 자기 의심하지 마. 다만 사이즈를 줄여서 DD를 관리하자.',
  '야, 밈코인에서 이 수익비면 장기적으로 무조건 이기는 구조야. 근데 DD가 깊으면 멘탈이 먼저 무너져. 한 박자 쉬어.',
  '포포, 전략 바꾸지 마. 사이즈만 반으로 줄여. 시간이 지나면 DD는 알아서 메워져.',
  '야, 네가 벌 때 잃을 때의 두 배를 가져가는 구조야. 이거 지키는 게 중요해. 사이즈 줄이고 유지해.',
  '포포, 수익비가 좋으니까 매매를 멈출 필요는 없어. 근데 평소의 절반 사이즈로 가. DD가 줄어들 때까지.',
  '야, 형이 딱 한마디만. 전략 OK, 사이즈 반으로. 이것만 지키면 돼.',
  '포포, 낙폭이 좀 있지만 네 전략의 기대값은 양수야. 시간만 주면 돼. 조급해하지 마.',
  '야, 잃을 때보다 벌 때가 크면 결국은 올라가. 근데 그 과정에서 살아남으려면 사이즈 관리가 전부야.',
]

// 경고(E) + 전략 건강 (PF >= 1.5, DD > 30%): 전략 인정하되 쉬라는 톤
const MSGS_E_HEALTHY = [
  '포포, 전략은 인정해. 근데 DD가 30% 넘었어. 전략 바꾸라는 게 아니라, 한 박자 쉬라는 거야.',
  '수익비가 좋아도 DD가 이 정도면 멘탈이 흔들려. 잠깐 쉬는 게 전략을 지키는 거야.',
  '야, 네 수익비는 괜찮아. 근데 DD가 너무 깊어. 전략 유지하되 하루 이틀 쉬면서 회복을 기다려.',
  '포포, 전략은 살아있어. 근데 DD 30% 넘으면 감정이 개입하기 시작해. 쉬는 게 전략을 지키는 거야.',
  '야, PF가 좋아도 DD가 이 수준이면 판단력이 흐려져. 매매는 줄이고 복기에 시간을 써.',
  '포포, 형이 봤을 때 전략 자체는 문제없어. 근데 낙폭이 멘탈을 깎고 있어. 잠깐 쉬어. 시장은 안 도망가.',
  '야, 수익비가 살아있으니까 전략을 바꿀 필요 없어. 다만 DD가 깊으니까 사이즈를 최소화하거나 잠깐 관망해.',
  '포포, 지금 상황은 "전략은 맞는데 운이 안 따르는" 구간이야. 이런 구간에서 살아남는 게 실력이야. 사이즈 줄이고 버텨.',
  '야, DD 30%는 심리적으로 무거워. 전략이 좋아도 감정이 매매를 망치기 시작해. 한두 건 쉬자.',
  '포포, 전략 숫자는 좋아. 시간만 주면 회복돼. 근데 그 시간 동안 추가 손실을 최소화해야 해.',
  '야, 형이 솔직히 말할게. 네 전략은 돈 벌 수 있는 구조야. 근데 지금은 쉬면서 DD를 관리해야 할 때야.',
  '포포, R:R이 좋으니까 희망은 있어. 다만 DD가 깊을 때는 평소보다 훨씬 보수적으로 가야 해.',
]

// 경고(E) + 전략 나쁨 (PF < 1.0): 진짜 경고 톤
const MSGS_E_BAD = [
  '포포, 솔직히 말할게. 지금 수익비도 안 나오고 DD도 깊어. 전략을 점검해야 할 때야.',
  '야, 지금은 진짜 멈춰야 해. 잃는 게 버는 것보다 많아. 전략 자체를 복기하자.',
  '포포, PF가 1.0 밑이야. 이건 전략이 현재 시장에서 안 통하고 있다는 뜻이야. 멈추고 분석해.',
  '야, 형 진심이야. 지금 매매 구조가 돈을 잃는 구조야. 더 치면 더 깊어져. 일단 멈춰.',
  '포포, 수익비가 1.0 미만이면 할수록 잃어. 이건 운이 아니라 구조 문제야. 전략을 바꿔야 해.',
  '야, 네가 듣기 싫겠지만. 지금 방식으로 100번 더 치면 100번 다 마이너스야. 멈추고 복기해.',
  '포포, DD도 깊고 수익비도 안 나와. 이건 "버티면 된다"가 아니야. 근본적으로 뭔가 바꿔야 해.',
  '야, 시장은 내일도 열려. 근데 네 계좌는 지금 줄어들고 있어. 멈추는 게 최선이야.',
  '포포, 형이 수백 번 봤어. PF 1.0 미만에서 억지로 복구하려다 계좌 날리는 사람. 제발 멈춰.',
  '야, 냉정하게 보자. 전략이 안 맞는 거야. 쉬면서 뭐가 잘못됐는지 복기하고 다시 시작하자.',
  '포포, 지금 잃는 게 버는 것보다 많아. 이 구조에서 사이즈 키우면 더 빨리 무너져. 최소 사이즈로.',
  '야, 이 구간에서 살아남으려면 자존심 내려놓고 멈춰야 해. 전략 재점검이 먼저야.',
]

// ─── 포포 응원 메시지 풀 (상황별) ─────────────────────────────────────────────

function buildPopoMsgPool(situation) {
  // 각 메시지는 (ctx) => string 함수. ctx = { recentPnl, progressPercent, equity }
  const A = [
    c => `포포, 최근에 ${fmtDollar(c.recentPnl)} 벌었잖아. 현재 ${c.progressPercent}%. 뒤로 밀렸다고 겁먹지 마라. 중요한 건 아직 길 위에 있다는 점이다.`,
    c => `야 포포, ${fmtDollar(c.recentPnl)} 먹었고 지금 ${c.progressPercent}% 위에 있어. 솔직히 대단한 숫자는 아니야. 근데 마이너스가 아니잖아. 그게 중요한 거야.`,
    c => `포포, 지금 +${fmtDollar(c.recentPnl)}에 진행률 ${c.progressPercent}%. 작아 보이지? 근데 이 길 위에 서있는 것 자체가 대부분 사람들이 못 하는 거야.`,
    c => `야, ${fmtDollar(c.recentPnl)} 수익에 ${c.progressPercent}% 진행. 리듬 좋다. 이대로만 가면 돼.`,
    c => `포포, 현재 누적 ${fmtDollar(c.equity)}. 한 걸음 한 걸음이야. 급할 거 없어.`,
    c => `야 포포, 수익 나고 있잖아. 이 흐름 놓치지 마. 겸손하게, 꾸준하게.`,
    c => `포포, ${c.progressPercent}% 왔다. 아직 갈 길이 멀어 보이지? 근데 시작한 것 자체가 반이야.`,
    c => `야, 잘하고 있어. 형이 보기에 지금 리듬이 좋아. 리듬 깨지 말고 유지해.`,
    c => `포포, 축하해. 근데 여기서 자만하면 끝이야. 다음 매매도 똑같이 신중하게.`,
    c => `최근 ${fmtDollar(c.recentPnl)} 수익이면 나쁘지 않아. 이 페이스 유지하자.`,
    c => `포포, 연승 중이야. 이럴 때 형이 해줄 말은 "그대로 해". 더 잘하려고 하지 마.`,
    c => `야, 지금 흐름이면 목표까지 갈 수 있어. 근데 조건이 있어. 욕심 안 부리는 것.`,
    c => `포포, ${c.progressPercent}% 달성. 작은 숫자지만 방향이 맞으면 언젠간 도착해.`,
    c => `오 봐라, 수익 구간이잖아. 이때 중요한 건 벌어놓은 거 지키는 거야. 기억해.`,
    c => `포포, 잘했어. 근데 잘한 날 다음 날이 제일 위험해. 내일도 원칙대로.`,
  ]

  const B = [
    c => `포포, 현재 누적 ${fmtDollar(c.equity)}, 진행률 ${c.progressPercent}%. 바닥에서 올라오고 있어. 서두르지 마.`,
    c => `야 포포, 아직 회복 중이야. ${c.progressPercent}%밖에 안 됐다고? 괜찮아. 방향이 위를 향하고 있으면 되는 거야.`,
    c => `포포, 어두운 터널 지나고 있어. 출구가 보이기 시작했어. 조금만 더 참아.`,
    c => `야, 마이너스에서 올라오는 중이잖아. 이게 제일 대단한 거야. 대부분은 여기서 포기해.`,
    c => `포포, 회복 중이야. 한 번에 다 돌려받으려 하지 마. 조금씩 쌓아가자.`,
    c => `야 포포, 지금 잘하고 있어. 회복 구간에서 무리 안 하는 게 실력이야.`,
    c => `포포, 현재 ${fmtDollar(c.equity)}. 아직 갈 길 멀지만 방향이 맞으면 도착해.`,
    c => `야, 솔직히 힘들지? 근데 이 구간 넘기면 한 단계 올라간다. 버텨.`,
    c => `포포, 잃은 돈 생각하지 마. 지금부터 버는 돈만 생각해.`,
    c => `야 포포, 회복 속도에 집착하지 마. 방향만 맞으면 언젠간 도착해.`,
    c => `포포, 작은 수익이 쌓이고 있어. 이게 진짜야. 한방은 존재하지 않아.`,
    c => `야, 형이 많이 봤는데 여기서 참는 놈이 결국 이기더라. 넌 지금 이기고 있어.`,
    c => `포포, 아직 본전 못 찾았다고? 본전은 목표가 아니야. 꾸준함이 목표야.`,
    c => `야 포포, 올라오고 있잖아. 이 흐름 소중하게 여겨. 한 건에 다 걸지 마.`,
    c => `포포, 하루에 조금씩이면 충분해. 복리는 시간이 해결해줘.`,
    c => `야, 회복 구간에서 건수 줄이는 게 정답이야. 좋은 것만 골라먹어.`,
  ]

  const C = [
    c => `포포, 현재 ${fmtDollar(c.equity)}, 진행률 ${c.progressPercent}%. 평범한 하루야. 평범하게 가자.`,
    c => `야 포포, 특별한 거 없어. 그냥 원칙대로 하자. 그게 최선이야.`,
    c => `포포, 오늘도 계획된 매매만. 계획 없으면 안 해도 돼.`,
    c => `야, 시장 열려 있다고 매일 들어갈 필요 없어. 좋은 판만 골라.`,
    c => `포포, 지루해도 괜찮아. 지루한 매매가 돈 버는 매매야.`,
    c => `야 포포, 현재 ${c.progressPercent}%. 느려도 방향이 맞으면 그만이야.`,
    c => `포포, 쉬는 것도 전략이야. 억지로 기회 만들지 마.`,
    c => `야, 형이 보기에 오늘은 관망이 답이야. 좋은 자리 아니면 패스.`,
    c => `포포, ${fmtDollar(c.equity)} 지키고 있잖아. 그거면 충분해.`,
    c => `야 포포, 매일 돈 벌 필요 없어. 안 잃는 날이면 이긴 거야.`,
    c => `포포, 조용한 시장에서는 조용히 있어. 시장이 움직일 때 움직여.`,
    c => `야, 오늘 매매 안 해도 되는 거 알지? 기회는 또 와.`,
    c => `포포, 진행률 ${c.progressPercent}%. 느린 것 같아도 전진하고 있어.`,
    c => `야 포포, 오늘은 복기하면서 보내는 것도 좋아. 과거에서 배울 게 있을 거야.`,
    c => `포포, 특별한 날이 아니야. 근데 이런 날이 모여서 특별한 결과가 되는 거야.`,
    c => `야, 차트만 보지 말고 일지도 써. 기록하는 놈이 결국 이겨.`,
  ]

  const D = [
    c => `포포, 현재 ${fmtDollar(c.equity)}, 좀 흔들리고 있어. 사이즈 줄이고 정비하자.`,
    c => `야 포포, 최근 매매 살짝 불안해. 자각하고 있으면 괜찮아. 속도 줄여.`,
    c => `포포, 이 구간에서 무리하면 아래로 갈 수 있어. 조심해.`,
    c => `야, 뇌동매매 좀 보여. 다음 매매는 계획 세우고 들어가자.`,
    c => `포포, 감정이 섞이고 있어. 느껴지면 쉬어야 할 때야.`,
    c => `야 포포, 지금은 버는 게 목표가 아니야. 더 안 잃는 게 목표야.`,
    c => `포포, 원칙 다시 한 번 읽어봐. 흔들릴 때는 기본으로 돌아가자.`,
    c => `야, 이 구간이 제일 애매해. 안 잃은 것도 아니고 딴 것도 아니고. 여기서 참아야 해.`,
    c => `포포, 현재 진행률 ${c.progressPercent}%. 지금 지키는 게 목표에 더 가까워지는 길이야.`,
    c => `야 포포, 최근 좀 삐끗했잖아. 큰 문제는 아니야. 오늘 하루만 확실하게 조심해.`,
    c => `포포, 형이 솔직히 말할게. 지금 네 매매 좀 산만해 보여. 집중력 다시 잡아.`,
    c => `야, 건수 줄여. 좋은 것만 골라. 지금은 양보다 질이야.`,
    c => `포포, 조급해지지 마. 조급한 매매는 100% 후회해.`,
    c => `야 포포, 이 구간 잘 넘기면 더 강해져. 근데 무리하면 아래로 가. 선택은 네 거야.`,
    c => `포포, 오늘은 매매 건수 딱 절반으로 줄여봐. 반만 해도 충분해.`,
    c => `야, 지금은 공격이 아니라 수비 타이밍이야. 수비 잘하는 놈이 결국 이겨.`,
  ]

  const E = [
    c => `포포, 현재 ${fmtDollar(c.equity)}. 힘들지? 근데 여기서 한 건 더 치면 더 힘들어져. 오늘은 쉬어.`,
    c => `야 포포, 형이 진심으로 말하는 거야. 오늘은 매매 금지. 내일 다시 보자.`,
    c => `포포, 시장은 내일도 있어. 계좌가 0이면 내일이 없어. 지금은 생존이 최우선이야.`,
    c => `야, 지금 느끼는 "한 번만 더"는 감정이지 분석이 아니야. 끄고 나가.`,
    c => `포포, 연패 구간이야. 이건 네 실력이 아니라 흐름이야. 흐름은 바뀌어. 근데 살아있어야 탈 수 있어.`,
    c => `야 포포, 오늘은 차트 끄고 운동이나 해. 몸이 피곤하면 판단력도 떨어져.`,
    c => `포포, 형이 수백 번 봤어. 여기서 참는 놈이 살아남아. 안 참는 놈은 계좌가 증발해.`,
    c => `야, 진행률 ${c.progressPercent}%? 숫자 보지 마. 지금은 생존만 생각해.`,
    c => `포포, 여기서 멈추면 돌아올 수 있어. 여기서 안 멈추면 돌아올 게 없어.`,
    c => `야 포포, 형 진심이야. 오늘 매매하면 내일 더 후회해. 딱 하루만 참아.`,
    c => `포포, 잃은 돈은 갔어. 남은 돈을 지키는 게 지금 네가 할 수 있는 최선이야.`,
    c => `야, "복구"라는 단어 머릿속에서 지워. 새로 시작한다고 생각해.`,
    c => `포포, 이 구간에서 살아남으면 진짜 트레이더야. 대부분은 여기서 떠나.`,
    c => `야 포포, 화면 끄고 밥 먹고 와. 배고프면 판단력 더 떨어져.`,
    c => `포포, 형이 딱 한마디만 할게. 멈춰. 그게 지금 최고의 트레이딩이야.`,
    c => `야, 네가 지금 하고 싶은 매매는 분석에서 나온 게 아니라 감정에서 나온 거야. 구분해.`,
  ]

  return { A, B, C, D, E }[situation] || C
}

function fmtDollar(n) {
  if (!Number.isFinite(n)) return '$0'
  const abs = Math.abs(n)
  const sign = n >= 0 ? '+' : '-'
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`
  return `${sign}$${Math.round(abs)}`
}

// ─── Briefing Text Generator ──────────────────────────────────────────────────

function fmt(n, d = 1) { return Number.isFinite(n) ? n.toFixed(d) : '—' }

function buildBriefingText(ctx) {
  const { phase, emotion, equity, ev, totalTrades, categories, minePlay, tradeStyleAnalysis, overallMetrics } = ctx
  const { consecutiveLosses, consecutiveWins, sizeTrend } = emotion
  const { current: currentEquity, drawdownFromHwm, maxDdPct } = equity
  const { current: currentEv, trend: evTrend } = ev

  const topCats   = categories.filter(c => c.permission === '집중 가능').map(c => c.trade_type)
  const allowCats = categories.filter(c => ['집중 가능', '선택적 허용'].includes(c.permission))
  const forbidCats = categories.filter(c => c.permission === '금지')

  // PF 요약 텍스트
  const pf = overallMetrics?.profitFactor ?? 0
  const pfStr = Number.isFinite(pf) ? pf.toFixed(2) : '—'
  const rrStr = overallMetrics?.avgRR != null && Number.isFinite(overallMetrics.avgRR) ? overallMetrics.avgRR.toFixed(2) : '—'

  // ── 이서후 판단 (v5: PF 중심 리스트 형식) ──────────────────────────────────
  const judgmentItems = []

  const ddPctVal = drawdownFromHwm * 100
  const ddStr2 = fmt(ddPctVal)
  const brainCount = tradeStyleAnalysis.impulsiveCount ?? 0

  // 1) 전체 요약: PF + DD 종합 템플릿
  if (totalTrades >= 5 && overallMetrics) {
    if (pf >= 1.5) {
      // 전략 건강: 인정 → DD 관리 조언 → 뇌동 제거 포인트
      judgmentItems.push({ icon: '✅', text: `수익비 ${pfStr}x — 전략은 유효하다. 평균 R:R ${rrStr}로, 이길 때 잃을 때의 ${rrStr}배를 벌고 있다.` })
      if (ddPctVal >= 15) {
        judgmentItems.push({ icon: '📊', text: `다만 낙폭이 ${ddStr2}%로 깊다. 전략을 바꿀 필요는 없지만, 사이즈를 줄여서 DD를 관리하자.` })
      }
      if (brainCount >= 1) {
        judgmentItems.push({ icon: '🧠', text: `뇌동매매 ${brainCount}건이 발목을 잡고 있다. 뇌동만 제거하면 수익비가 더 올라간다.` })
      }
    } else if (pf >= 1.0) {
      judgmentItems.push({ icon: '⚠️', text: `수익비 ${pfStr}x — 간신히 양수다. R:R ${rrStr}. 한 건의 큰 손실로 무너질 수 있는 구조다. 손절 기준을 더 타이트하게 잡아라.` })
      if (ddPctVal >= 10) {
        judgmentItems.push({ icon: '📊', text: `낙폭 ${ddStr2}%. 사이즈를 줄이고 확실한 셋업에서만 진입해라.` })
      }
    } else {
      // PF < 1.0: 전략 점검 필요
      judgmentItems.push({ icon: '⚠️', text: `수익비 ${pfStr}x — 현재 잃는 게 버는 것보다 많다. 전략 점검이 필요하다.` })
      judgmentItems.push({ icon: '📊', text: `낙폭 ${ddStr2}%. 사이즈를 최소화하고 전략을 재점검하자.` })
      if (brainCount >= 1) {
        judgmentItems.push({ icon: '🧠', text: `뇌동매매 ${brainCount}건. 이것부터 제거해야 수익비가 올라간다.` })
      }
    }
  }

  // 2) 페이즈별 판단
  if (phase === 'RESET') {
    if (emotion.state === 'REVENGE') {
      judgmentItems.push({ icon: '🚨', text: `${consecutiveLosses}연패 후 사이즈가 ${Math.round((sizeTrend - 1) * 100)}% 커졌다. 복구 욕망이다. 지금 당장 멈춰라.` })
    } else if (emotion.state === 'TILT' || consecutiveLosses >= 3) {
      judgmentItems.push({ icon: '🚨', text: `${consecutiveLosses}연패다. 흐름이 완전히 꺾였다. 지금은 들어가는 게 아니라 살아남는 게 목표다.` })
    } else {
      judgmentItems.push({ icon: '📉', text: `최대 낙폭 ${fmt(maxDdPct * 100)}%. 더 이상 소모하지 마라. 포지션을 최소화해라.` })
    }
  } else if (phase === 'DEFENSE') {
    if (evTrend === 'DECLINING') {
      judgmentItems.push({ icon: '📉', text: `EV가 꺾이고 있다. 수익비가 무너지기 전에 사이즈를 줄여라.` })
    } else if (drawdownFromHwm > 0.15) {
      judgmentItems.push({ icon: '📉', text: `고점에서 ${fmt(drawdownFromHwm * 100)}% 빠졌다. 방어 모드다. PF가 1.5 이상인 카테고리에서만 진입해라.` })
    } else if (emotion.state === 'OVERCONFIDENCE') {
      judgmentItems.push({ icon: '⚡', text: `${consecutiveWins}연승이지만 빈도가 올라가고 있다. 과신이다. 사이즈를 유지하거나 줄여라.` })
    } else {
      judgmentItems.push({ icon: '🛡️', text: `${consecutiveLosses}연패다. 수익비가 높은 카테고리에서만 최소 사이즈로 기다려라.` })
    }
  } else if (phase === 'ATTACK') {
    const topStr = topCats.length ? topCats.join(', ') : '확인된 카테고리'
    judgmentItems.push({ icon: '🎯', text: `PF ${pfStr}x, 흐름이 좋다. ${topStr}에서 수익비가 확인됐다. 확실한 자리에서만 사이즈를 실어라.` })
  } else {
    if (totalTrades < 5) {
      judgmentItems.push({ icon: '📊', text: `아직 데이터가 충분하지 않다(${totalTrades}건). 작은 사이즈로 수익비 패턴을 먼저 확인해라.` })
    } else if (currentEquity < 0) {
      judgmentItems.push({ icon: '🔄', text: `마이너스 구간이다. 복구하려 들지 마라. 수익비가 검증된 카테고리에서만, 작게, 확실하게 쌓아라.` })
    } else {
      judgmentItems.push({ icon: '🧱', text: `축적 단계다. 수익비 ${pfStr}x. 잃지 않는 게 버는 것이다.` })
    }
  }

  // 3) 카테고리별 핵심 메시지 (수익비 + 최대 단건 + 건수 종합)
  const bestCat = categories.find(c => !c.insufficientData && c.grade === 'S')
  const worstCat = [...categories].reverse().find(c => !c.insufficientData && c.grade === 'D')
  if (bestCat) {
    judgmentItems.push({ icon: '💎', text: `${bestCat.trade_type} — PF ${Number.isFinite(bestCat.profitFactor) ? bestCat.profitFactor.toFixed(1) : '—'}x, EV ${bestCat.ev_percent > 0 ? '+' : ''}${bestCat.ev_percent.toFixed(1)}%. 최강 카테고리다. 여기에 집중해라.` })
  }
  if (worstCat) {
    judgmentItems.push({ icon: '🚫', text: `${worstCat.trade_type} — PF ${Number.isFinite(worstCat.profitFactor) ? worstCat.profitFactor.toFixed(1) : '—'}x, EV ${worstCat.ev_percent > 0 ? '+' : ''}${worstCat.ev_percent.toFixed(1)}%. 돈을 갉아먹는 카테고리다. 즉시 중단.` })
  }

  // 4) 지뢰 판단 추가 (사이즈 경고일 때만)
  if (minePlay.detected && minePlay.sizeWarning) {
    judgmentItems.push({
      icon: '💣',
      text: minePlay.sizeWarning === 'danger'
        ? `지뢰 투입 비중 ${(minePlay.capitalRatio * 100).toFixed(0)}% — 과다. 전체 자본의 20% 이하로 관리 필요.`
        : `지뢰 투입 비중 ${(minePlay.capitalRatio * 100).toFixed(0)}% — 사이즈 관리 필요.`,
    })
  }

  // 5) 뇌동매매 판단 (엄격 유지)
  if (tradeStyleAnalysis.severity >= 2) {
    judgmentItems.push({ icon: '🧠', text: tradeStyleAnalysis.detail })
  } else if (tradeStyleAnalysis.severity === 1) {
    judgmentItems.push({ icon: '🧠', text: `뇌동매매 감지. 수익비와 무관하게 계획 없는 진입은 장기적으로 PF를 깎아먹는다.` })
  }

  const judgment = judgmentItems

  // ── 나머지 텍스트 ────────────────────────────────────────────────────────
  const targetView = {
    RESET:   `지금 패턴으로는 목표와 멀어진다. 냉정하게 RESET하고 다시 쌓는 것만이 $${(TARGET_GOAL / 1000).toFixed(0)}K로 가는 길이다.`,
    BUILD:   `$${(TARGET_GOAL / 1000).toFixed(0)}K는 잃지 않는 플레이가 쌓여서 만들어진다. 지금 구간이 그 기반이다.`,
    DEFENSE: `손실을 줄이는 것은 수익을 내는 것만큼 목표에 중요하다. 지금 지키는 것이 목표에 맞는 행동이다.`,
    ATTACK:  `EV가 확인된 카테고리에 집중하는 지금의 접근이 올바른 방향이다. 탐욕으로 흔들리지 마라.`,
  }[phase]

  // PF + DD 맥락 반영된 플레이/금지
  const pfHealthyFlag = Number.isFinite(pf) && pf >= 1.5
  const pfBadFlag = !Number.isFinite(pf) || pf < 1.0

  let playNow, forbidden

  if (pfHealthyFlag && ddPctVal >= 15) {
    // PF 좋고 DD 높음: 전략 유지 + 사이즈 축소
    playNow = `기존 전략 유지하되 사이즈 50% 축소. 계획매매만.${topCats.length ? ` ${topCats.join(', ')}에 집중.` : ''}`
    forbidden = `뇌동매매. 사이즈 확대. 복수매매. 전략 변경.`
  } else if (pfBadFlag && ddPctVal >= 15) {
    // PF 나쁘고 DD 높음: 전면 중단
    playNow = `모든 신규 진입 중단. 전략 복기 먼저. 매매 일지 재검토.`
    forbidden = `신규 진입. 사이즈 확대. 손절 미루기. "한 번만 더" 진입.`
  } else if (pfBadFlag) {
    // PF 나쁘지만 DD 낮음: 전략 점검 + 최소 사이즈
    playNow = `최소 사이즈로만 진입. 전략 재점검. 뇌동매매 제거 우선.`
    forbidden = `사이즈 확대. 검증 안 된 카테고리 진입. 뇌동매매.`
  } else {
    // 기본: 페이즈별 로직
    playNow = {
      RESET:   `모든 신규 진입 중단${emotion.state === 'REVENGE' ? '. 사이즈 즉시 원복' : ''}. 흐름 안정될 때까지 관망.`,
      BUILD:   `작은 사이즈로${topCats.length ? ` ${topCats.join(', ')}에서만` : ' EV 있는 자리에서만'} 진입.`,
      DEFENSE: `신규 진입 최소화.${allowCats.length ? ` ${allowCats.slice(0, 2).map(c => c.trade_type).join(', ')}만 선택적 허용.` : ''}`,
      ATTACK:  `${topCats.length ? `${topCats.join(', ')}` : 'EV 높은 자리'}에 집중. 확실한 자리에서만.`,
    }[phase]
    forbidden = {
      RESET:   `신규 진입. 사이즈 확대. 손절 미루기. 감정적 복구 시도.`,
      BUILD:   `무분별한 카테고리 탐색. 사이즈 확대. 검증 안 된 자리 진입.`,
      DEFENSE: `신규 카테고리 탐색. 사이즈 확대. 연패 직후 즉각 재진입.`,
      ATTACK:  `탐욕적 오버사이징. EV 없는 카테고리 진입. 기준 낮추기.`,
    }[phase]
  }

  const sizeStrategy = {
    RESET:   `최소 사이즈 또는 거래 중단 — 지금은 지키는 게 먼저다`,
    BUILD:   `보수적 사이즈 유지 — 실수 없이 쌓는 게 목표다`,
    DEFENSE: `기존 사이즈 유지 또는 축소 — 공격이 아닌 방어다`,
    ATTACK:  `확인된 카테고리에 집중 — 엣지 있는 자리에 모아라`,
  }[phase]

  // 지뢰 분석 UI
  const mineAnalysis = minePlay.detected ? {
    detail: minePlay.detail,
    severity: minePlay.severity,
    summaryLine: minePlay.summaryLine,
    sizeWarning: minePlay.sizeWarning,
    totalInvested: minePlay.totalInvested,
    totalRecovered: minePlay.totalRecovered,
    netPnl: minePlay.netPnl,
    mineCount: minePlay.mineCount,
    mineWins: minePlay.mineWins,
    mineLosses: minePlay.mineLosses,
    capitalRatio: minePlay.capitalRatio,
  } : null

  return { judgment, targetView, playNow, forbidden, sizeStrategy, mineAnalysis }
}

// ─── 비거래일 브리핑 ─────────────────────────────────────────────────────────

function buildNoTradeBriefing(ctx) {
  const { phase, minePlay, tradeStyleAnalysis } = ctx
  const { current: currentEv } = ctx.ev

  const pool = [
    `포포, 오늘은 거래가 없다. 쉬는 것도 전략이다. 내일의 좋은 판을 위해 에너지를 아껴라.`,
    `포포, 거래 없는 날이다. 복기할 건 복기하고, 나머지는 내려놓아라.`,
    `포포, 시장을 안 보는 날도 성장하는 날이다. 다음 기회는 반드시 온다.`,
    `포포, 오늘은 관망이다. 좋은 판이 올 때까지 칩을 지켜라.`,
    `포포, 안 들어간 날은 진 날이 아니다. 다음 좋은 자리를 위한 준비다.`,
  ]

  if (phase === 'RESET') {
    pool.push(
      `포포, 지금은 쉬는 게 맞다. RESET 구간에서 가장 좋은 선택은 안 하는 것이다.`,
      `포포, 거래 안 한 것 자체가 오늘의 승리다.`,
    )
  }

  if (phase === 'ATTACK' && currentEv > 0) {
    pool.push(
      `포포, EV가 양수인 구간이다. 좋은 셋업이 오면 그때 들어가면 된다.`,
    )
  }

  if (minePlay.detected && minePlay.sizeWarning) {
    pool.push(
      `포포, 지뢰에서 쉬고 있는 건 좋은 선택이다. 사이즈 관리하면서 기다려라.`,
    )
  }

  if (tradeStyleAnalysis.severity >= 2) {
    pool.push(
      `포포, 뇌동매매가 많았다. 오늘 쉬면서 다음 플레이를 계획으로 정리해봐라.`,
    )
  }

  const seed = getMessageSeed((pool.length * 7) + phase.length)
  return pickMsg(pool, seed)
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export { GRADE_CONDITIONS }

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

    const phase = calculatePhase({ emotion, equity, ev, totalTrades: total })

    // 지뢰플레이 현황 (v4: 투입/회수 기반)
    const minePlay = detectMinePlay(trades, equity)

    // 뇌동매매 분석
    const tradeStyleAnalysis = analyzeTradeStyle(sorted)

    // 매매 품질 분석 (계획 vs 뇌동)
    const tradeQuality = analyzeTradeQuality(trades)

    // 최근 흐름
    const recentFlow = calculateRecentFlow(trades, 10)

    // 상황 분류 (A~E)
    const situation = detectSituation({ emotion, equity, recentFlow, tradeStyleAnalysis, overallMetrics })

    // 트레이드별 PF 계산 (카테고리별)
    const catWinRateData = calculateWinRate(trades)
    const catPfMap = {}
    for (const c of catWinRateData) {
      catPfMap[c.trade_type] = { pf: c.profitFactor, avgWin: c.avgWin, avgLoss: c.avgLoss, totalWinPnl: c.totalWinPnl, totalLossPnl: c.totalLossPnl }
    }

    // 전체 PF/Expectancy/R:R
    const overallMetrics = calculateOverallMetrics(trades)

    const categories = tradeTypeStats
      .filter(t => Number.isFinite(t.ev_percent))
      .map(t => {
        const pfData = catPfMap[t.trade_type] || { pf: 0, avgWin: 0, avgLoss: 0 }
        const pf = Number.isFinite(pfData.pf) ? pfData.pf : 0
        const grade = gradeCategory(t.ev_percent, pf, t.trades ?? 0)
        const { permission, reason } = categoryPermission(grade, phase)
        const condition = GRADE_CONDITIONS[grade]
        const insufficientData = (t.trades ?? 0) <= 3
        return {
          trade_type: t.trade_type,
          ev_percent: t.ev_percent,
          win_rate:   t.win_rate,
          trades:     t.trades,
          profitFactor: pf,
          avgWin: pfData.avgWin,
          avgLoss: pfData.avgLoss,
          grade,
          permission,
          reason,
          conditionLabel: condition.label,
          conditionText: insufficientData ? `(데이터 부족 — ${t.trades}건) ${condition.text}` : condition.text,
          insufficientData,
        }
      })
      .sort((a, b) => {
        // PF 기반 정렬 (Infinity 처리)
        const pfA = Number.isFinite(a.profitFactor) ? a.profitFactor : 999
        const pfB = Number.isFinite(b.profitFactor) ? b.profitFactor : 999
        return pfB - pfA || b.ev_percent - a.ev_percent
      })

    const text = buildBriefingText({ phase, emotion, equity, ev, totalTrades: total, categories, minePlay, tradeStyleAnalysis, overallMetrics })

    // 메시지 시드 (6시간 + 트레이드 수 기반)
    const msgSeed = getMessageSeed(total)

    // 이서후 헤더 메시지 (상황별 풀)
    // PF 기반 메시지 풀 분기
    const pfHealthy = Number.isFinite(overallMetrics?.profitFactor) && overallMetrics.profitFactor >= 1.5
    const pfBad = !Number.isFinite(overallMetrics?.profitFactor) || overallMetrics.profitFactor < 1.0
    let headerPool
    if (situation === 'D' && pfHealthy) {
      headerPool = MSGS_D_HEALTHY
    } else if (situation === 'E' && pfHealthy) {
      headerPool = MSGS_E_HEALTHY
    } else if (situation === 'E' && pfBad) {
      headerPool = MSGS_E_BAD
    } else {
      headerPool = { A: MSGS_A, B: MSGS_B, C: MSGS_C, D: MSGS_D, E: MSGS_E }[situation] || MSGS_C
    }
    const oneLiner = pickMsg(headerPool, msgSeed)

    // 포포 응원 메시지 (상황별 풀, 동적 데이터 삽입)
    const popoPool = buildPopoMsgPool(situation)
    const popoCtx = {
      recentPnl: recentFlow.recentPnl,
      progressPercent: targetProgress.toFixed(2),
      equity: equity.current,
    }
    const popoMsgTemplate = popoPool[msgSeed % popoPool.length]
    const popoBriefing = typeof popoMsgTemplate === 'function' ? popoMsgTemplate(popoCtx) : ''

    // 비거래일 체크
    const today = new Date().toISOString().slice(0, 10)
    const hasTradesToday = (trades ?? []).some(t => t.date === today)
    const noTradeBriefing = !hasTradesToday
      ? buildNoTradeBriefing({ equity, ev, phase, minePlay, tradeStyleAnalysis })
      : null

    return {
      phase,
      situation,
      emotion,
      equity,
      ev,
      kelly,
      totalTrades: total,
      targetProgress,
      categories,
      minePlay,
      tradeStyleAnalysis,
      tradeQuality,
      recentFlow,
      noTradeBriefing,
      oneLiner,
      popoBriefing,
      overallMetrics,
      ...text,
    }
  } catch (err) {
    console.warn('[seohuEngine] error:', err)
    return null
  }
}
