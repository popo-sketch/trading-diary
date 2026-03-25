/**
 * Journey Engine — 20만불 여정 시각화 로직
 * · cumulative PNL 기준 위치 계산
 * · 이서후 여정 브리핑 (2일 단위 자동 교체 + 상황 맞춤)
 */

export const JOURNEY_GOAL = 200_000
export const CHECKPOINTS  = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 150_000, 200_000]

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtK(n) {
  const a = Math.abs(n)
  if (a >= 1_000_000) return `$${(a / 1_000_000).toFixed(1)}M`
  if (a >= 1_000)     return `$${Math.round(a / 1_000)}K`
  return `$${Math.round(a)}`
}

function fmtPct(n) {
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%'
}

function fmtWR(n) {
  return n.toFixed(0) + '%'
}

// ─── Analytics helpers ────────────────────────────────────────────────────────

function getBestCat(analytics) {
  return (analytics?.trade_type_stats ?? [])
    .filter(t => t.trades >= 3 && t.ev_percent > 0)
    .sort((a, b) => b.ev_percent - a.ev_percent)[0] ?? null
}

function getWorstCat(analytics) {
  return (analytics?.trade_type_stats ?? [])
    .filter(t => t.trades >= 2 && t.ev_percent < 0)
    .sort((a, b) => a.ev_percent - b.ev_percent)[0] ?? null
}

function getMostTraded(analytics) {
  return (analytics?.trade_type_stats ?? [])
    .sort((a, b) => b.trades - a.trades)[0] ?? null
}

// ─── Phase computation (from equity_curve only, no trades array) ──────────────

function computePhaseFromCurve(analytics) {
  const curve   = analytics?.equity_curve ?? []
  const evCurve = analytics?.ev_curve ?? []

  if (!curve.length) return 'BUILD'

  // Equity info
  let hwm = 0, maxDdPct = 0
  const currentPnl = curve[curve.length - 1].cumulative_pnl
  for (const p of curve) {
    const v = p.cumulative_pnl
    if (v > hwm) hwm = v
    if (hwm > 0) {
      const dd = (hwm - v) / hwm
      if (dd > maxDdPct) maxDdPct = dd
    }
  }
  const drawdownFromHwm = hwm > 0 ? (hwm - currentPnl) / hwm : 0

  // EV info
  const currentEv = evCurve.length > 0 ? evCurve[evCurve.length - 1].ev_percent : null
  let evTrend = 'UNKNOWN'
  if (evCurve.length >= 3) {
    const delta = evCurve[evCurve.length - 1].ev_percent - evCurve[evCurve.length - 3].ev_percent
    evTrend = delta < -2 ? 'DECLINING' : delta > 2 ? 'RISING' : 'STABLE'
  }

  // Streak from equity_curve deltas
  let consecutiveLosses = 0, consecutiveWins = 0
  for (let i = curve.length - 1; i >= 0; i--) {
    const prev  = i > 0 ? curve[i - 1].cumulative_pnl : 0
    const delta = curve[i].cumulative_pnl - prev
    if (Math.abs(delta) < 0.01) continue
    if (delta < 0) {
      if (consecutiveWins > 0) break
      consecutiveLosses++
    } else {
      if (consecutiveLosses > 0) break
      consecutiveWins++
    }
  }

  const totalTrades = curve.length

  // Priority: RESET > DEFENSE > ATTACK > BUILD
  if (consecutiveLosses >= 3) return 'RESET'
  if (maxDdPct > 0.25)        return 'RESET'

  if (currentPnl > 0 && drawdownFromHwm > 0.15)                   return 'DEFENSE'
  if (consecutiveLosses >= 2)                                      return 'DEFENSE'
  if (currentEv !== null && totalTrades >= 5 && currentEv < 3)    return 'DEFENSE'
  if (evTrend === 'DECLINING' && currentPnl > 0)                  return 'DEFENSE'

  if (
    currentEv !== null && currentEv > 15 &&
    drawdownFromHwm < 0.05 &&
    consecutiveLosses === 0 &&
    totalTrades >= 5
  ) return 'ATTACK'

  return 'BUILD'
}

// ─── Journey State ────────────────────────────────────────────────────────────

export function computeJourneyState(allTimeAnalytics) {
  const curve = allTimeAnalytics?.equity_curve ?? []

  const cumulativePnl = curve.length > 0 ? curve[curve.length - 1].cumulative_pnl : 0
  const progressRaw     = cumulativePnl / JOURNEY_GOAL
  const progressClamped = Math.max(0, Math.min(1, progressRaw))
  const progressPercent = progressClamped * 100

  const reachedCheckpoints  = CHECKPOINTS.filter(cp => cumulativePnl >= cp)
  const nextCheckpoint       = CHECKPOINTS.find(cp => cp > cumulativePnl) ?? null
  const remaining            = JOURNEY_GOAL - cumulativePnl
  const nextCpRemaining      = nextCheckpoint ? nextCheckpoint - cumulativePnl : null

  // Streak from equity_curve deltas (most recent first)
  let streak = 0, streakType = null
  for (let i = curve.length - 1; i >= 0; i--) {
    const prev  = i > 0 ? curve[i - 1].cumulative_pnl : 0
    const delta = curve[i].cumulative_pnl - prev
    if (Math.abs(delta) < 0.01) continue
    const isWin = delta > 0
    if (streakType === null) {
      streakType = isWin ? 'win' : 'loss'
      streak = 1
    } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
      streak++
      if (streak >= 15) break
    } else {
      break
    }
  }

  // Recent delta (last 5 trade-points)
  let recentDelta = 0
  if (curve.length >= 2) {
    const baseIdx = Math.max(0, curve.length - 6)
    const base    = baseIdx > 0 ? curve[baseIdx - 1].cumulative_pnl : 0
    recentDelta   = cumulativePnl - base
  }

  // Character animation state
  let charState = 'idle'
  if (curve.length > 0) {
    charState = 'walk'
    if (streakType === 'win'  && streak >= 3 && recentDelta > 50) charState = 'run'
    if (streakType === 'loss' && streak >= 2)                     charState = 'wobble'
    if (streakType === 'loss' && streak >= 3)                     charState = 'retreat'
    if (cumulativePnl < 0)                                        charState = 'wobble'
  }

  return {
    cumulativePnl,
    progressRaw,
    progressClamped,
    progressPercent,
    reachedCheckpoints,
    nextCheckpoint,
    remaining,
    nextCpRemaining,
    streak,
    streakType,
    recentDelta,
    charState,
    totalTrades: curve.length,
  }
}

// ─── Briefing Message Pools ───────────────────────────────────────────────────
// Each entry is a function: (ctx) => string
// ctx = { journey, best, worst, mostTraded, kelly, ev }

const BUILD_MSGS = [
  ({ journey: { nextCheckpoint, nextCpRemaining } }) =>
    `포포, 아직 초반 구간이다. 다음 목표 ${fmtK(nextCheckpoint)}까지 ${fmtK(nextCpRemaining)} 남았다. 서두르지 말고 그것만 보라.`,

  ({ journey: { progressPercent } }) =>
    `포포, 진행률 ${progressPercent.toFixed(2)}%. 길은 멀다. 지금 필요한 건 속도가 아니라 리듬이다. 쌓는 쪽이 이긴다.`,

  ({ best }) =>
    best
      ? `포포, 데이터를 봤다. ${best.trade_type} EV ${fmtPct(best.ev_percent)}, 승률 ${fmtWR(best.win_rate)}. 좋은 카테고리만 골라라. 나머지는 지금 건들 이유가 없다.`
      : `포포, 아직 데이터가 쌓이는 중이다. 기록부터 쌓아라. 분석은 그 다음이다. 지금은 칩을 쌓듯 길을 만들어가라.`,

  ({ journey: { nextCheckpoint }, kelly }) =>
    kelly && kelly > 5
      ? `포포, Kelly ${kelly.toFixed(1)}%다. 사이즈는 그 기준 안에서 움직여라. 아직 초반은 잃지 않는 게 우선이다. 다음 ${fmtK(nextCheckpoint)}만 보라.`
      : `포포, 다음 체크포인트 ${fmtK(nextCheckpoint)}를 밟으면 다음이 보인다. 지금은 첫 표지판만 봐라. 길은 그렇게 가는 거다.`,

  ({ journey: { totalTrades, progressPercent } }) =>
    `포포, ${totalTrades}번의 거래, ${progressPercent.toFixed(2)}% 진행. 숫자보다 방향이 중요하다. 길 위에 있다는 것 자체가 시작이다.`,

  ({ worst }) =>
    worst
      ? `포포, ${worst.trade_type} 카테고리 EV ${fmtPct(worst.ev_percent)}. 그쪽은 지금 당장 줄여라. 좋은 길만 걸어야 거리를 단축할 수 있다.`
      : `포포, 아직 반환점을 논할 때가 아니다. 지금은 칩을 쌓듯 길을 쌓아라. 20만불은 긴 여정이다.`,

  ({ journey: { nextCpRemaining, nextCheckpoint } }) =>
    `포포, ${fmtK(nextCpRemaining)}만 더 쌓으면 ${fmtK(nextCheckpoint)} 체크포인트를 지난다. 다음 한 번의 대박보다 이 구간이 먼저다.`,

  ({ ev }) =>
    ev != null
      ? `포포, EV ${fmtPct(ev)}. ${ev > 0 ? '양수다. 이 구조를 지켜라. 선택의 기준이 살아있다.' : '아직 음수다. 선택 기준부터 다시 잡아라. 패를 줄여라.'}`
      : `포포, 지금은 무리하면 길에서 쓰러진다. 살아남는 쪽으로 가라. 길은 내일도 있다.`,

  ({ journey: { cumulativePnl, progressPercent } }) =>
    `포포, 누적 ${fmtK(cumulativePnl)}, ${progressPercent.toFixed(2)}% 왔다. 많이 온 것 같아도 아직 갈 길이 남아 있다. 들뜨지 말고 다음 발걸음부터 생각해라.`,

  ({ best, journey: { nextCheckpoint } }) =>
    best
      ? `포포, ${best.trade_type}이 지금 최고 효율 카테고리다. EV ${fmtPct(best.ev_percent)}, 다음 ${fmtK(nextCheckpoint)}까지는 거기서 찬스를 잡아라. 다른 데 눈 돌리지 마라.`
      : `포포, 20만불은 한 번에 잡는 숫자가 아니다. 끝까지 살아남아 도착하는 목표다. 지금 구간은 기반을 다지는 구간이다.`,

  ({ journey: { remaining } }) =>
    `포포, 목표까지 ${fmtK(remaining)} 남았다. 멀다고 느껴지면 다음 체크포인트 하나만 봐라. 길은 그렇게 가는 거다.`,

  ({ kelly, journey: { progressPercent } }) =>
    kelly != null && kelly > 0
      ? `포포, Kelly ${kelly.toFixed(1)}%가 지금 적정 사이즈를 말해준다. 욕심 위에 사이즈 얹지 마라. ${progressPercent.toFixed(2)}% 왔다, 이 리듬을 지켜라.`
      : `포포, ${progressPercent.toFixed(2)}% 왔다. 여기서 무리하면 다시 시작점으로 돌아간다. 보폭부터 잡아라.`,

  ({ mostTraded, best }) =>
    mostTraded && best && mostTraded.trade_type !== best.trade_type
      ? `포포, 가장 많이 거래한 건 ${mostTraded.trade_type}이지만 EV가 가장 좋은 건 ${best.trade_type}다. 빈도보다 선택의 질이 먼저다.`
      : `포포, 다음 체크포인트만 봐라. 멀리 보되, 한 걸음씩 가라. 조급함은 이 구간에서 가장 비싼 감정이다.`,

  ({ journey: { streak, streakType } }) =>
    streak > 0 && streakType
      ? `포포, 최근 ${streak}연${streakType === 'win' ? '승, 리듬이 살아있다. 이 구간을 놓치지 마라. 단, 탐욕만 얹지 마라.' : '패, 흔들리고 있다. 걸음부터 다시 맞춰라. 서두르지 마라.'}`
      : `포포, 지금 이 구간은 쌓는 구간이다. 서두르지 말고 표지판을 하나씩 지나가라.`,

  ({ journey: { reachedCheckpoints } }) =>
    reachedCheckpoints.length > 0
      ? `포포, ${reachedCheckpoints.length}개 체크포인트를 지났다. ${CHECKPOINTS.length - reachedCheckpoints.length}개 남았다. 지금 리듬이 맞다. 유지해라.`
      : `포포, 아직 첫 체크포인트도 밟지 않았다. 괜찮다. 길 위에 있다는 것 자체가 시작이다. 천천히 가라.`,

  ({ ev, best }) =>
    ev != null && best
      ? `포포, EV ${fmtPct(ev)}, ${best.trade_type} EV ${fmtPct(best.ev_percent)}로 에지가 있다. 지금은 이 카테고리에 집중하면서 리듬을 쌓아라.`
      : `포포, 아직 이른 판단이다. 작게 시작하고 확인하면서 가라. 길은 급하게 가는 게 아니다.`,
]

const ATTACK_MSGS = [
  ({ best, journey: { nextCheckpoint } }) =>
    best
      ? `포포, 지금 전진이 허용된다. ${best.trade_type} EV ${fmtPct(best.ev_percent)}, 이 카테고리 위주로 보폭을 넓혀라. 다음 ${fmtK(nextCheckpoint)} 가는 길이다.`
      : `포포, 흐름이 좋다. 하지만 아무 데서나 뛰지는 마라. 확실한 패에서만 들어가라. 좋은 판만 골라라.`,

  ({ ev, kelly }) =>
    ev != null && kelly != null
      ? `포포, EV ${fmtPct(ev)}, Kelly ${kelly.toFixed(1)}%. 시스템이 살아있다. 사이즈를 조금 더 열어도 된다. 단 기준 안에서만.`
      : `포포, 지금은 기회가 열린 구간이다. 속도보다 선택의 질이 먼저다. 확실한 판만 잡아라.`,

  ({ journey: { nextCpRemaining, nextCheckpoint, progressPercent } }) =>
    `포포, ${progressPercent.toFixed(2)}% 왔다. 다음 ${fmtK(nextCheckpoint)}까지 ${fmtK(nextCpRemaining)}. 지금은 리듬이 살아있다. 과속만 하지 마라.`,

  ({ best, worst }) =>
    worst
      ? `포포, 전진 허용이지만 ${worst.trade_type} EV ${fmtPct(worst.ev_percent)}는 지금도 건들지 마라. 에지 있는 판에서만 보폭을 넓혀라.`
      : best
        ? `포포, ${best.trade_type} 승률과 EV가 받쳐준다. 지금은 그 카테고리에서만 보폭을 넓혀라. 분산은 나중이다.`
        : `포포, 속도를 낼 수 있다. 하지만 리듬이 깨지는 순간 바로 줄여라. 긴 길에서 페이스가 속도보다 중요하다.`,

  ({ journey: { streak } }) =>
    streak >= 2
      ? `포포, ${streak}연승 중이다. 좋다. 하지만 좋은 흐름일수록 기준은 더 높여라. 과신이 붙는 순간 독이 된다. 자세부터 지켜라.`
      : `포포, 지금은 전진 구간이다. 하지만 아무 길이나 뛰지 마라. 확실한 길만 골라라. 탐욕과 전진은 다르다.`,

  ({ kelly }) =>
    kelly && kelly > 10
      ? `포포, Kelly ${kelly.toFixed(1)}%, 에지가 충분하다. 구조 안에서 사이즈를 조금 더 열어도 된다. 단, 탐욕은 지금도 금지다.`
      : `포포, 전진은 좋다. 과속만 하지 마라. 긴 길에서는 페이스가 속도보다 중요하다. 리듬을 유지해라.`,

  ({ journey: { reachedCheckpoints, nextCheckpoint } }) =>
    `포포, ${reachedCheckpoints.length}개 밟았다. 다음 ${fmtK(nextCheckpoint)} 구간에서 흐름을 이어가라. 지금이 쌓을 때다. 확실한 판에서만 들어가라.`,

  ({ ev }) =>
    ev != null
      ? `포포, EV ${fmtPct(ev)}로 시스템이 작동 중이다. 이 구조를 지키면서 진입 빈도를 조금 높여도 된다. 하지만 나쁜 판은 그냥 지나쳐라.`
      : `포포, 지금은 전진이 허용된다. 하지만 확실한 길에서만 보폭을 넓혀라. 모든 판이 지금 판이 아니다.`,

  ({ best, journey: { nextCheckpoint } }) =>
    best
      ? `포포, ${best.trade_type} EV ${fmtPct(best.ev_percent)}. 지금 ${fmtK(nextCheckpoint)} 가는 길에서 이 카테고리가 가장 믿을 만한 판이다. 집중해라.`
      : `포포, 흐름은 좋다. 자신감과 과신은 다르다. 기준 안에서만 움직여라.`,

  ({ mostTraded, best }) =>
    best
      ? `포포, 지금 ${best.trade_type}이 에지가 있다. 거래 빈도를 거기에 집중시켜라. 분산은 나중에 에지가 검증된 다음이다.`
      : `포포, 지금은 공격이 허용된 구간이다. 하지만 선택해서 들어가라. 아무 데나 뛰지 마라.`,

  ({ journey: { progressPercent, remaining } }) =>
    `포포, ${progressPercent.toFixed(2)}% 왔다. 아직 ${fmtK(remaining)} 남았다. 지금 속도를 유지하되 함부로 무너지지 마라. 전진은 허용, 탐욕은 금지다.`,

  ({ kelly, ev }) =>
    kelly != null && ev != null
      ? `포포, Kelly ${kelly.toFixed(1)}%, EV ${fmtPct(ev)}. 지금 숫자가 좋다. 이 상태를 유지하는 게 버는 것보다 더 중요하다. 놓치지 마라.`
      : `포포, 전진 구간이다. 속도보다 선택의 질이 먼저다. 확실한 판에서만 사이즈를 열어라.`,

  ({ journey: { recentDelta } }) =>
    recentDelta > 0
      ? `포포, 최근 흐름 +${fmtK(recentDelta)}. 좋다, 이 흐름을 믿되 탐욕은 얹지 마라. 잘 풀리는 날일수록 더 냉정해야 한다.`
      : `포포, 흐름이 주춤했다. 그래도 전진 구간이다. 기준을 다시 잡고 들어가라.`,

  ({ worst }) =>
    worst
      ? `포포, ${worst.trade_type}은 지금도 EV ${fmtPct(worst.ev_percent)}다. 전진할 때도 나쁜 판은 쉰다. 에지 없는 자리는 무조건 패스해라.`
      : `포포, 지금 기회가 있다. 하지만 좋은 흐름일수록 리스크 관리는 더 엄격하게 가라. 탐욕이 붙으면 모든 게 바뀐다.`,

  ({ journey: { streak, totalTrades } }) =>
    `포포, 지금까지 ${totalTrades}번의 거래.${streak > 0 ? ` 최근 ${streak}연승 흐름으로 탄력이 붙어 있다.` : ' 흐름을 타고 있다.'} 잘 풀리는 날엔 더 냉정해야 한다. 그게 긴 길을 가는 사람의 태도다.`,
]

const DEFENSE_MSGS = [
  ({ journey: { progressPercent, nextCpRemaining, nextCheckpoint } }) =>
    `포포, ${progressPercent.toFixed(2)}% 구간이다. 지금은 벌 때가 아니라 지킬 때다. 다음 ${fmtK(nextCheckpoint)}까지 ${fmtK(nextCpRemaining)} 있다. 잃지 않으면 도달한다.`,

  ({ ev }) =>
    ev != null
      ? `포포, EV ${fmtPct(ev)}${ev < 3 ? ', 흐름이 약해졌다. 사이즈부터 줄여라.' : '이지만 흔들리고 있다. 균형이 먼저다. 전진보다 안정이다.'}`
      : `포포, 지금은 전진보다 균형이 먼저다. 흔들리는 구간에서는 버티는 쪽이 이긴다. 살아있어라.`,

  ({ best, worst }) =>
    worst
      ? `포포, ${worst.trade_type} EV ${fmtPct(worst.ev_percent)}. 지금은 이 카테고리를 건들지 마라.${best ? ` ${best.trade_type}만 남겨라.` : ' 확실한 패만 남겨라.'}`
      : best
        ? `포포, ${best.trade_type}만 남겨라. 나머지는 지금 건들 때가 아니다. 방어 구간에서는 집중이 분산보다 낫다.`
        : `포포, 이 구간은 버티는 자가 가져간다. 쓸데없는 진입은 줄여라. 현금이 지금은 포지션이다.`,

  ({ kelly }) =>
    kelly != null
      ? `포포, Kelly ${kelly.toFixed(1)}%. 지금 사이즈는 이 기준의 절반 이하로 가라. 지키는 구간에서는 작게 움직여야 살아남는다.`
      : `포포, 수익은 남아 있다. 탐욕만 얹지 않으면 다음 구간도 갈 수 있다. 지금은 지키는 게 전략이다.`,

  ({ journey: { reachedCheckpoints, remaining } }) =>
    `포포, ${reachedCheckpoints.length}개 체크포인트를 지켰다. ${fmtK(remaining)} 남았다. 지금은 지킨 걸 지키는 구간이다. 뒤로 밀리면 다시 앞으로 나가야 한다.`,

  ({ ev, best }) =>
    ev != null && ev < 3
      ? `포포, EV가 ${fmtPct(ev)}로 약하다. ${best ? `${best.trade_type}만 골라` : '가장 확실한 판만 잡아'} 사이즈를 줄여라. 이 구간은 살아있는 게 목표다.`
      : `포포, 흔들리고 있다. 이런 구간에서는 전진보다 균형이 먼저다. 속도를 줄이고 보폭을 정리해라.`,

  ({ journey: { streak } }) =>
    streak >= 2
      ? `포포, 최근 ${streak}연패. 지금은 복구가 아니라 안정이 먼저다. 급하면 더 멀어진다. 호흡부터 잡아라.`
      : `포포, 많이 온 것 같아도 아직 갈 길이 남아 있다. 들뜨지 말고 보폭부터 정리해라. 지금은 균형이 먼저다.`,

  ({ journey: { nextCheckpoint }, kelly }) =>
    `포포, 다음 ${fmtK(nextCheckpoint)}까지 지금 흐름으로 간다면 충분하다. ${kelly != null ? `Kelly ${kelly.toFixed(1)}% 기준으로` : '작은 사이즈로'} 일단 살아있어라. 살아있으면 다음이 있다.`,

  ({ worst, journey: { progressPercent } }) =>
    worst
      ? `포포, ${progressPercent.toFixed(2)}% 구간에서 ${worst.trade_type} EV ${fmtPct(worst.ev_percent)}가 발목을 잡고 있다. 지금 당장 그 카테고리는 쉬어라.`
      : `포포, 수익을 지키는 것도 전략이다. 탐욕을 얹지 않으면 다음 구간도 간다. 방어도 진격이다.`,

  ({ journey: { recentDelta, cumulativePnl } }) =>
    `포포, 최근 흐름 ${recentDelta >= 0 ? '+' : ''}${fmtK(recentDelta)}, 누적 ${fmtK(cumulativePnl)}. 지금은 더 버는 게 목표가 아니라 잃지 않는 게 목표다. 이 구간을 넘겨라.`,

  ({ ev, kelly }) =>
    `포포, ${ev != null ? `EV ${fmtPct(ev)}, ` : ''}${kelly != null ? `Kelly ${kelly.toFixed(1)}%. ` : ''}지금 숫자가 방향을 잃고 있다. 기준이 흔들릴 때는 진입 횟수부터 줄여라. 쉬는 것도 전략이다.`,

  ({ journey: { totalTrades }, best }) =>
    `포포, ${totalTrades}번의 거래를 쌓았다. ${best ? `${best.trade_type} 카테고리가 지금까지 제일 믿을 만하다.` : '좋은 카테고리에 집중해라.'} 방어 구간에서는 분산보다 집중이다. 좁게 가라.`,

  ({ journey: { nextCpRemaining, nextCheckpoint } }) =>
    `포포, ${fmtK(nextCpRemaining)} 잃지 않으면 ${fmtK(nextCheckpoint)}가 보인다. 지금은 전진이 아니라 방어가 답이다. 지키면 도달한다.`,

  ({ mostTraded }) =>
    mostTraded
      ? `포포, 가장 많이 거래한 카테고리는 ${mostTraded.trade_type}다. 지금은 거래 횟수를 줄이고 질을 높여라. 빈도는 지금 적이다.`
      : `포포, 이 구간은 버티는 자가 가져간다. 쓸데없는 진입은 줄여라. 살아있으면 다음 기회가 있다.`,

  ({ journey: { progressPercent, streak, streakType } }) =>
    `포포, ${progressPercent.toFixed(2)}%. ${streak > 0 && streakType ? `최근 ${streak}연${streakType === 'win' ? '승이지만 방어가 필요한 구간이다. 과신하지 마라.' : '패, 호흡부터 다시 잡아라. 급하면 더 멀어진다.'}` : '지금은 속도보다 리듬이 먼저다. 균형을 잡아라.'}`,
]

const RESET_MSGS = [
  ({ journey: { cumulativePnl, nextCpRemaining, nextCheckpoint } }) =>
    `포포, 누적 ${fmtK(cumulativePnl)}, 조금 밀렸다. 괜찮다. 길에서 밀리는 것과 길을 포기하는 건 다르다. 다음 ${fmtK(nextCheckpoint)} 체크포인트는 도망가지 않는다.`,

  ({ ev }) =>
    ev != null
      ? `포포, EV ${fmtPct(ev)}. 지금 흐름이 음수다. 복구보다 기준 회복이 먼저다. 급해지면 더 멀어진다. 멈추고 다시 잡아라.`
      : `포포, 손실 뒤에 급해지면 길을 더 잃는다. 괜찮다, 다시 쌓으면 된다. 지금은 안정이 먼저다.`,

  ({ journey: { streak } }) =>
    streak >= 3
      ? `포포, ${streak}연패. 지금은 실력 증명이 아니라 통제력 시험이다. 조용히 버텨라. 이 구간을 넘기면 다음이 있다.`
      : `포포, 수익이 줄었다고 길이 끝난 건 아니다. 다시 보폭만 맞추면 된다. 아직 여정은 안 끝났다.`,

  ({ worst, best }) =>
    worst
      ? `포포, ${worst.trade_type}이 지금 발목을 잡고 있다. EV ${fmtPct(worst.ev_percent)}. 당장 그쪽 진입을 끊어라. ${best ? `${best.trade_type}만 가라.` : '확실한 판만 남겨라.'}`
      : `포포, 지금은 되찾는 구간이 아니라 멈춰 세우는 구간이다. 괜찮다, 다시 쌓으면 된다. 발걸음부터 정리해라.`,

  ({ journey: { reachedCheckpoints, remaining } }) =>
    `포포, ${reachedCheckpoints.length}개 체크포인트는 아직 살아있다. ${fmtK(remaining)} 남았다. 지금 있는 걸 지키면 다시 앞으로 간다. 포기는 없다.`,

  ({ kelly }) =>
    kelly != null && kelly > 0
      ? `포포, Kelly ${kelly.toFixed(1)}%가 아직 양수다. 시스템이 완전히 무너진 건 아니다. 사이즈만 줄이고 버텨라. 살아있으면 다음이 있다.`
      : `포포, 발이 꼬인 날엔 더 천천히 가는 게 맞다. 무너지는 것보다 낫다. 오늘은 살아있는 게 목표다.`,

  ({ ev, journey: { cumulativePnl } }) =>
    `포포, 누적 ${fmtK(cumulativePnl)}. ${ev != null ? `EV ${fmtPct(ev)}.` : ''} 지금의 한 번보다 끝까지 가는 구조가 더 중요하다. 무리하지 마라. 길은 내일도 있다.`,

  ({ journey: { streak, nextCheckpoint } }) =>
    `포포, 연패 구간에서는 복구보다 기준 회복이 먼저다. 다음 ${fmtK(nextCheckpoint)} 체크포인트는 쫓지 말고 도달해라. 조급함이 이 구간에서 가장 비싸다.`,

  ({ journey: { recentDelta, progressPercent } }) =>
    `포포, 최근 흐름 ${recentDelta >= 0 ? '+' : ''}${fmtK(recentDelta)}, 현재 ${progressPercent.toFixed(2)}%. 뒤로 밀렸다고 겁먹지 마라. 중요한 건 아직 길 위에 있다는 점이다. 괜찮다.`,

  ({ best }) =>
    best
      ? `포포, ${best.trade_type} EV ${fmtPct(best.ev_percent)}, 이 카테고리만 남겨라. 나쁜 판을 줄이는 것이 지금은 수익보다 중요하다. 선택을 줄여라.`
      : `포포, 20만불은 한 번에 잡는 숫자가 아니다. 끝까지 살아남아 도착하는 목표다. 오늘은 살아남는 것만 생각해라.`,

  ({ journey: { totalTrades }, ev }) =>
    `포포, ${totalTrades}번의 거래를 기록했다. ${ev != null && ev < 0 ? `EV ${fmtPct(ev)}, 지금 시스템이 삐걱거린다. 기준부터 다시 잡아라.` : '지금 흔들리는 것도 기록의 일부다. 괜찮다, 다시 쌓으면 된다.'}`,

  ({ worst, journey: { streak } }) =>
    worst && streak >= 2
      ? `포포, ${streak}연패에 ${worst.trade_type} EV ${fmtPct(worst.ev_percent)}까지. 두 가지가 겹쳤다. 잠깐 멈추고 판단을 다시 해라. 지금 무리는 더 큰 손실이다.`
      : `포포, 뒤로 조금 밀렸다고 끝난 건 아니다. 호흡부터 다시 잡아라. 길은 여전히 앞에 있다.`,

  ({ journey: { nextCpRemaining, nextCheckpoint } }) =>
    `포포, 오늘 길이 꼬였다면 억지로 뚫지 마라. 괜찮다, 다시 바르게 가면 된다.${nextCpRemaining != null ? ` 체크포인트 ${fmtK(nextCheckpoint)}까지 ${fmtK(nextCpRemaining)}, 쫓지 말고 도달해라.` : ''}`,

  ({ kelly, best }) =>
    `포포, ${kelly != null ? `Kelly ${kelly.toFixed(1)}%.` : ''} ${best ? `${best.trade_type}만 남기고` : ''} 지금은 손실을 줄이는 구조를 먼저 만들어라. 회복은 그 다음이다.`.trim(),

  ({ journey: { progressPercent, reachedCheckpoints } }) =>
    `포포, ${progressPercent.toFixed(2)}%, ${reachedCheckpoints.length}개 체크포인트. 흔들렸다. 괜찮다. 중요한 건 지금 길 위에 있다는 것이다. 다시 발걸음부터 맞춰라.`,
]

const WIN_STREAK_MSGS = [
  ({ journey: { streak, nextCheckpoint }, best }) =>
    `포포, ${streak}연승. 흐름은 좋다.${best ? ` ${best.trade_type} EV ${fmtPct(best.ev_percent)},` : ''} 하지만 좋은 흐름일수록 기준은 더 높여라. 과신이 붙는 순간 독이 된다.`,

  ({ journey: { streak, recentDelta, nextCpRemaining, nextCheckpoint } }) =>
    `포포, ${streak}연승, 최근 +${fmtK(recentDelta)}. 좋다. 다음 ${fmtK(nextCheckpoint)}까지 ${fmtK(nextCpRemaining)} 남았다. 지금 페이스로 리듬만 유지해라.`,

  ({ journey: { streak }, kelly }) =>
    kelly != null
      ? `포포, ${streak}연승. Kelly ${kelly.toFixed(1)}% 기준으로 사이즈를 조금 더 열 수 있다. 단, 탐욕은 금지다. 리스크 기준은 지켜라.`
      : `포포, ${streak}연승. 연승 뒤에 무너지는 건 실수보다 태도 때문이다. 자세부터 지켜라. 흥분은 지금 금지다.`,

  ({ journey: { streak }, worst }) =>
    worst
      ? `포포, ${streak}연승 중에도 ${worst.trade_type} EV는 ${fmtPct(worst.ev_percent)}다. 잘 풀릴 때일수록 나쁜 판은 건들지 마라. 선택 기준은 더 높여라.`
      : `포포, ${streak}연승. 연승 뒤에 무너지는 건 실수보다 태도 때문이다. 자세부터 지켜라. 이 리듬을 지켜라.`,

  ({ journey: { streak, progressPercent } }) =>
    `포포, ${streak}연승, ${progressPercent.toFixed(2)}% 구간. 많이 맞히는 것보다 틀릴 때 안 무너지는 게 더 중요하다. 잊지 마라.`,

  ({ ev, kelly }) =>
    ev != null && kelly != null
      ? `포포, EV ${fmtPct(ev)}, Kelly ${kelly.toFixed(1)}%. 시스템이 살아있다. 하지만 수치를 믿는 것과 과신하는 건 다르다. 기준은 더 엄격하게 가라.`
      : `포포, 잘 풀리는 날엔 더 냉정해야 한다. 그게 긴 길을 가는 사람의 태도다. 흥분하지 마라.`,

  ({ journey: { streak, nextCheckpoint } }) =>
    `포포, ${streak}연승. 지금 이 구간이 ${fmtK(nextCheckpoint)} 체크포인트까지 가는 가장 좋은 흐름이다. 하지만 아무 판이나 잡지 마라. 좋은 판만 선택해라.`,

  ({ best, journey: { streak } }) =>
    best
      ? `포포, ${streak}연승에 ${best.trade_type} EV ${fmtPct(best.ev_percent)}. 지금 가장 좋은 카테고리에 집중하면서 흐름을 유지해라. 분산하지 마라.`
      : `포포, 수익은 쌓이고 있다. 좋다, 이제 지킬 줄 아는 쪽이 한 단계 위다. 탐욕만 얹지 마라.`,

  ({ journey: { streak, recentDelta } }) =>
    `포포, ${streak}연승, 최근 +${fmtK(recentDelta)}. 좋은 패를 잡는 능력보다 욕심을 멈추는 능력이 더 어렵다. 지금 그게 시험 중이다. 통과해라.`,

  ({ journey: { streak }, mostTraded, best }) =>
    best && mostTraded && best.trade_type !== mostTraded.trade_type
      ? `포포, ${streak}연승이지만 가장 많이 거래한 건 ${mostTraded.trade_type}이고, 가장 EV 좋은 건 ${best.trade_type}다. 빈도보다 질이다. 집중해라.`
      : `포포, ${streak}연승. 기억해라, 긴 길에서는 한 번의 대박보다 흔들리지 않는 구조가 더 오래 간다. 구조를 지켜라.`,
]

const LOSS_STREAK_MSGS = [
  ({ journey: { streak, nextCpRemaining, nextCheckpoint } }) =>
    `포포, ${streak}연패. 지금은 실력 증명이 아니라 통제력 시험이다. 다음 ${fmtK(nextCheckpoint)} 체크포인트 ${fmtK(nextCpRemaining)}, 쫓지 말고 조용히 버텨라.`,

  ({ journey: { streak }, worst }) =>
    worst
      ? `포포, ${streak}연패에 ${worst.trade_type} EV ${fmtPct(worst.ev_percent)}. 이 카테고리가 지금 손실의 중심일 수 있다. 당장 끊어라. 확실한 판만 남겨라.`
      : `포포, ${streak}연패. 계속 틀리고 있을 땐 판단보다 속도를 줄이는 게 먼저다. 지금은 쉬는 것도 전략이다.`,

  ({ journey: { streak }, ev }) =>
    `포포, ${streak}연패${ev != null ? `, EV ${fmtPct(ev)}` : ''}. 연패 뒤에는 공격 본능이 아니라 생존 본능이 필요하다. 한 박자 쉬어라.`,

  ({ journey: { streak, cumulativePnl } }) =>
    `포포, ${streak}연패. 누적 ${fmtK(cumulativePnl)}. 지금 보이는 기회 중 절반은 조급함이 만든 착시일 수 있다. 한 번 더 생각해라. 착시에 속지 마라.`,

  ({ journey: { streak }, kelly }) =>
    `포포, ${streak}연패. ${kelly != null ? `Kelly ${kelly.toFixed(1)}%` : '사이즈'} 기준으로 지금 노출을 절반 이하로 줄여라. 손실보다 습관이 망가지는 게 더 무섭다.`,

  ({ journey: { streak, progressPercent }, best }) =>
    `포포, ${streak}연패, ${progressPercent.toFixed(2)}% 구간. ${best ? `${best.trade_type}만 남기고` : '가장 확실한 판만 남기고'} 나머지는 오늘 건들지 마라. 살아있는 게 먼저다.`,

  ({ journey: { streak } }) =>
    `포포, ${streak}연패. 오늘 길이 꼬였다면 억지로 뚫지 마라. 괜찮다, 내일 다시 바르게 가면 된다. 지금은 손실을 키우지 않는 게 유일한 목표다.`,

  ({ journey: { streak }, ev, worst }) =>
    `포포, ${streak}연패${ev != null ? `, EV ${fmtPct(ev)}` : ''}. ${worst ? `${worst.trade_type} 카테고리를 당장 닫아라.` : '지금 판단 기준이 흐트러졌을 가능성이 크다. 리셋부터 해라.'}`,

  ({ journey: { streak, reachedCheckpoints } }) =>
    `포포, ${streak}연패. 하지만 ${reachedCheckpoints.length}개 체크포인트는 아직 살아있다. 지금 가진 걸 지키는 것이 복구보다 우선이다. 포기는 없다.`,

  ({ journey: { streak }, best }) =>
    best
      ? `포포, ${streak}연패 중에도 ${best.trade_type} EV는 ${fmtPct(best.ev_percent)}다. 이 카테고리만 남기고 나머지는 지금 당장 멈춰라. 살아있는 게 먼저다.`
      : `포포, ${streak}연패. 계속 어긋날 때는 시장보다 네 리듬이 깨졌을 가능성이 크다. 멈추고 다시 잡아라.`,
]

const RECENT_LOSS_MSGS = [
  ({ journey: { nextCheckpoint, nextCpRemaining } }) =>
    `포포, 조금 밀렸다. 괜찮다. ${fmtK(nextCheckpoint)} 체크포인트 ${fmtK(nextCpRemaining)} 남았다. 길에서 밀리는 것과 포기하는 건 다르다. 다시 발걸음 맞춰라.`,

  ({ ev, kelly }) =>
    `포포, 손실 뒤 첫 반응이 제일 위험하다.${ev != null ? ` EV ${fmtPct(ev)},` : ''}${kelly != null ? ` Kelly ${kelly.toFixed(1)}% 기준으로` : ''} 다시 천천히 들어가라. 급하지 마라.`,

  ({ worst }) =>
    worst
      ? `포포, ${worst.trade_type} EV ${fmtPct(worst.ev_percent)}. 최근 손실이 여기서 나왔을 수 있다. 지금 당장 그쪽 진입은 멈춰라. 확실한 판만 남겨라.`
      : `포포, 손실 났다고 바로 복구하려 들지 마라. 그런 날일수록 더 멀어진다. 기준부터 다시 잡아라.`,

  ({ journey: { recentDelta, cumulativePnl } }) =>
    `포포, 최근 ${fmtK(recentDelta)}, 누적 ${fmtK(cumulativePnl)}. 뒤로 미끄러졌다고 끝난 건 아니다. 호흡부터 다시 잡아라. 아직 길 위에 있다.`,

  ({ best }) =>
    best
      ? `포포, 손실 구간에서는 ${best.trade_type} EV ${fmtPct(best.ev_percent)}, 이 카테고리만 봐라. 넓게 잡지 말고 좁게 집중해라. 선택이 살길이다.`
      : `포포, 지금은 되찾는 구간이 아니라 멈춰 세우는 구간이다. 괜찮다, 다시 쌓으면 된다. 길은 아직 열려있다.`,

  ({ journey: { progressPercent, streak } }) =>
    `포포, ${progressPercent.toFixed(2)}%, 최근 ${streak}연패. 길이 흔들릴수록 걸음을 줄여라. 무너지지 않는 게 우선이다. 살아있어라.`,

  ({ kelly }) =>
    `포포, 손실이 네 실력을 다 말해주진 않는다.${kelly != null ? ` Kelly ${kelly.toFixed(1)}% 기준으로 사이즈를 줄이고` : ' 사이즈를 줄이고'} 다음 행동으로 수준을 드러내라. 다음이 중요하다.`,

  ({ journey: { reachedCheckpoints } }) =>
    `포포, 아직 ${reachedCheckpoints.length}개 체크포인트는 지켰다. 오늘은 덜 가더라도 길 위에 남아 있으면 된다. 살아있으면 내일이 있다.`,
]

// ─── Briefing Generator ───────────────────────────────────────────────────────

const getDayBucket = () => Math.floor(Date.now() / (1000 * 60 * 60 * 48))

/**
 * @param {object} journey - computeJourneyState 결과
 * @param {object} allTimeAnalytics - /api/analytics 전체 데이터
 * @returns {{ phase: string, briefing: string }}
 */
export function getJourneyBriefing(journey, allTimeAnalytics) {
  const phase      = computePhaseFromCurve(allTimeAnalytics)
  const best       = getBestCat(allTimeAnalytics)
  const worst      = getWorstCat(allTimeAnalytics)
  const mostTraded = getMostTraded(allTimeAnalytics)
  const kelly      = allTimeAnalytics?.kelly_percent ?? null
  const evCurve    = allTimeAnalytics?.ev_curve ?? []
  const ev         = evCurve.length > 0 ? evCurve[evCurve.length - 1].ev_percent : null

  const ctx = { journey, best, worst, mostTraded, kelly, ev }

  const dayBucket = getDayBucket()

  // Situation priority: 3+ loss streak > 3+ win streak > 2 loss streak > phase
  let pool
  const { streak, streakType } = journey
  if (streakType === 'loss' && streak >= 3)      pool = LOSS_STREAK_MSGS
  else if (streakType === 'win' && streak >= 3)  pool = WIN_STREAK_MSGS
  else if (streakType === 'loss' && streak >= 2) pool = RECENT_LOSS_MSGS
  else if (phase === 'ATTACK')                   pool = ATTACK_MSGS
  else if (phase === 'DEFENSE')                  pool = DEFENSE_MSGS
  else if (phase === 'RESET')                    pool = RESET_MSGS
  else                                           pool = BUILD_MSGS

  const idx     = dayBucket % pool.length
  const briefing = pool[idx](ctx)

  return { phase, briefing }
}
