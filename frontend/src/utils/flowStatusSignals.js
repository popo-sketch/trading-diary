/**
 * Flow Status Module — signal detection and copywriting.
 * Uses: position_size_buckets, trade_type_stats, equity_curve, trades (with entry_amount, avg_entry_mc, return_percent, trade_type, pnl).
 *
 * To change behaviour, edit FLOW_CONFIG and the trigger conditions below.
 */

// ——— Config (change these to tune behaviour) ———
export const FLOW_CONFIG = {
  minTrades: 5,
  minOverallTrades: 10,
  typeLeakEvThreshold: -10,
  tailRiskRatio: 0.35,
  edgeConfirmedKellyMin: 3,
  edgeConfirmedBucketEvMin: 5,
  lastN: 10,
}

const RED = '#ff4d4f'
const BLUE = '#3b82f6'
const WHITE = '#ffffff'

function formatPnlShort(num) {
  if (num == null || isNaN(num)) return '$0'
  const sign = num >= 0 ? '+' : '-'
  const abs = Math.abs(num)
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`
  return `${sign}$${Math.round(abs)}`
}

function getPositionSizeBucket(entryAmount) {
  if (entryAmount == null || entryAmount < 1000) return '< $1K'
  if (entryAmount < 5000) return '$1K-$5K'
  if (entryAmount < 10000) return '$5K-$10K'
  return '> $10K'
}

function getEntryMCBucket(avgEntryMc) {
  if (avgEntryMc == null || isNaN(avgEntryMc)) return null
  if (avgEntryMc < 1e6) return '<$1M'
  if (avgEntryMc < 10e6) return '$1M-$10M'
  if (avgEntryMc < 50e6) return '$10M-$50M'
  return '>$50M'
}

function computeKelly(winRatePct, avgWinPct, avgLossPct) {
  if (avgWinPct == null || avgWinPct <= 0) return 0
  const wr = winRatePct / 100
  const kelly = (wr * avgWinPct - (1 - wr) * Math.abs(avgLossPct || 0)) / avgWinPct
  return Math.max(0, kelly * 100)
}

function aggregateStats(tradesWithReturn) {
  if (!Array.isArray(tradesWithReturn) || !tradesWithReturn.length) return null
  const validTrades = tradesWithReturn.filter(
    (t) => t != null && Number.isFinite(t.pnl) && Number.isFinite(t.return_percent)
  )
  if (!validTrades.length) return null
  const wins = validTrades.filter((t) => (t.pnl ?? 0) > 0)
  const losses = validTrades.filter((t) => (t.pnl ?? 0) <= 0)
  const n = validTrades.length
  const winRate = n > 0 ? (wins.length / n) * 100 : 0
  const avgWinPct =
    wins.length > 0
      ? wins.reduce((s, t) => s + (Number.isFinite(t.return_percent) ? t.return_percent : 0), 0) / wins.length
      : 0
  const avgLossPct =
    losses.length > 0
      ? losses.reduce((s, t) => s + (Number.isFinite(t.return_percent) ? t.return_percent : 0), 0) / losses.length
      : 0
  const evPct = (winRate / 100) * avgWinPct - (1 - winRate / 100) * Math.abs(avgLossPct || 0)
  const totalPnl = validTrades.reduce((s, t) => s + (Number.isFinite(t.pnl) ? t.pnl : 0), 0)
  const kelly = computeKelly(winRate, avgWinPct, avgLossPct)
  return {
    trades: n,
    winRate: Number.isFinite(winRate) ? winRate : 0,
    avgWinPct: Number.isFinite(avgWinPct) ? avgWinPct : 0,
    avgLossPct: Number.isFinite(avgLossPct) ? avgLossPct : 0,
    evPct: Number.isFinite(evPct) ? evPct : 0,
    totalPnl: Number.isFinite(totalPnl) ? totalPnl : 0,
    kelly: Number.isFinite(kelly) ? kelly : 0,
  }
}

function maxDrawdownFromEquity(equityCurve) {
  if (!equityCurve?.length) return 0
  let peak = equityCurve[0]?.cumulative_pnl ?? 0
  let maxDd = 0
  for (let i = 1; i < equityCurve.length; i++) {
    const cur = equityCurve[i]?.cumulative_pnl ?? 0
    if (cur > peak) peak = cur
    const dd = peak - cur
    if (dd > maxDd) maxDd = dd
  }
  return maxDd
}

/**
 * @param {{ position_size_buckets: Array<{ bucket: string, trades: number, win_rate: number, avg_win_percent: number, avg_loss_percent: number, ev_percent: number, total_pnl: number }>, trade_type_stats: Array<{ trade_type: string, trades: number, win_rate: number, avg_win_percent: number, avg_loss_percent: number, ev_percent: number, total_pnl: number }>, equity_curve: Array<{ date: string, cumulative_pnl: number }>, kelly_percent?: number | null }} analytics
 * @param {Array<{ date: string, created_at?: string, pnl: number, return_percent?: number | null, entry_amount?: number | null, avg_entry_mc?: number | null, trade_type?: string | null }} trades
 * @returns {{ line1: string, line2: string, color: string }}
 */
export function computeFlowStatus(analytics, trades) {
  try {
    // API fail or invalid data → return neutral message
    if (!analytics && (!trades || trades.length === 0)) {
      return {
        line1: 'No reliable edge read yet',
        line2: 'Data unavailable. Track consistently and avoid large sizing until signals stabilize. Stabilize.',
        color: WHITE,
      }
    }

    const {
      minTrades,
      minOverallTrades,
      typeLeakEvThreshold,
      tailRiskRatio,
      edgeConfirmedKellyMin,
      edgeConfirmedBucketEvMin,
      lastN,
    } = FLOW_CONFIG

    const buckets = Array.isArray(analytics?.position_size_buckets) ? analytics.position_size_buckets : []
    const typeStats = Array.isArray(analytics?.trade_type_stats) ? analytics.trade_type_stats : []
    const equityCurve = Array.isArray(analytics?.equity_curve) ? analytics.equity_curve : []
    const overallKelly = Number.isFinite(analytics?.kelly_percent) ? analytics.kelly_percent : 0

  const tradesWithReturn = (trades ?? []).filter(
    (t) => t?.return_percent != null && Number.isFinite(t.return_percent)
  )
  const tradesCount = tradesWithReturn.length

  const sortedTrades = [...(trades ?? [])].sort((a, b) => {
    const d = (b.date || '').localeCompare(a.date || '')
    if (d !== 0) return d
    return (b.created_at || '').localeCompare(a.created_at || '')
  })
  const lastNTrades = sortedTrades.slice(0, lastN)

  const overall = aggregateStats(tradesWithReturn)
  const totalPnL = overall?.totalPnl ?? 0
  const winRate = overall?.winRate ?? 0
  const overallEv = overall?.evPct ?? 0
  const maxDrawdown = maxDrawdownFromEquity(equityCurve)

  const bucketWithKelly = buckets.map((b) => ({
    ...b,
    kelly: computeKelly(b.win_rate, b.avg_win_percent, b.avg_loss_percent),
  }))
  const typeWithKelly = typeStats.map((t) => ({
    ...t,
    kelly: computeKelly(t.win_rate, t.avg_win_percent, t.avg_loss_percent),
  }))

  // Entry MC bucket stats from trades
  const entryMCGroups = {}
  tradesWithReturn.forEach((t) => {
    const key = getEntryMCBucket(t.avg_entry_mc)
    if (key) {
      if (!entryMCGroups[key]) entryMCGroups[key] = []
      entryMCGroups[key].push(t)
    }
  })
  const entryMCBucketStats = Object.entries(entryMCGroups).map(([label, list]) => ({
    label,
    ...aggregateStats(list),
  }))

  const worstTrade = sortedTrades.filter((t) => (t.pnl ?? 0) < 0).sort((a, b) => (a.pnl ?? 0) - (b.pnl ?? 0))[0]
  const worstPnL = worstTrade?.pnl ?? 0
  const tailRatio = totalPnL !== 0 && worstPnL < 0 ? Math.abs(worstPnL) / Math.abs(totalPnL) : 0

    // ——— A. Oversizing Negative Edge ———
    const negativeBuckets = bucketWithKelly.filter(
      (b) =>
        Number.isFinite(b.trades) &&
        Number.isFinite(b.ev_percent) &&
        Number.isFinite(b.total_pnl) &&
        b.trades >= minTrades &&
        b.ev_percent < 0 &&
        b.total_pnl < 0
    )
    if (negativeBuckets.length > 0) {
      const byExposure = [...negativeBuckets].sort((a, b) => (a.total_pnl ?? 0) - (b.total_pnl ?? 0))
      const worst = byExposure[0]
      if (worst && worst.bucket && Number.isFinite(worst.ev_percent) && Number.isFinite(worst.trades) && Number.isFinite(worst.total_pnl)) {
        const bucketLabel = worst.bucket === '> $10K' ? '> $10K bucket' : `${worst.bucket || 'Unknown'} bucket`
        return {
          line1: 'Oversizing in negative edge zone',
          line2: `${bucketLabel} EV ${worst.ev_percent.toFixed(1)}% (n=${worst.trades}) with PnL ${formatPnlShort(worst.total_pnl)}. Cut size in this bucket or move exposure to proven buckets. Reduce.`,
          color: RED,
        }
      }
    }

    // ——— B. Type Leak ———
    const leakTypes = typeWithKelly.filter(
      (t) =>
        Number.isFinite(t.trades) &&
        Number.isFinite(t.ev_percent) &&
        Number.isFinite(t.total_pnl) &&
        t.trades >= minTrades &&
        (t.ev_percent <= typeLeakEvThreshold || (t.total_pnl < 0 && t.ev_percent < 0))
    )
    if (leakTypes.length > 0) {
      const worst = [...leakTypes].sort((a, b) => (a.total_pnl ?? 0) - (b.total_pnl ?? 0))[0]
      if (worst && worst.trade_type && Number.isFinite(worst.ev_percent) && Number.isFinite(worst.trades) && Number.isFinite(worst.total_pnl)) {
        const typeLabel = worst.trade_type || 'Unknown'
        return {
          line1: `Leaking PnL in ${typeLabel}`,
          line2: `${typeLabel} EV ${worst.ev_percent.toFixed(1)}% (n=${worst.trades}), PnL ${formatPnlShort(worst.total_pnl)}. Pause this category until edge flips or rules change. Avoid.`,
          color: RED,
        }
      }
    }

    // ——— C. Tail-Risk Day / One Big Hit ———
    if (Number.isFinite(tailRatio) && tailRatio >= tailRiskRatio && Number.isFinite(worstPnL) && worstPnL < 0) {
      const ratioPct = Math.round(tailRatio * 100)
      return {
        line1: 'One trade dominated the drawdown',
        line2: `Worst trade ${formatPnlShort(worstPnL)} is ${ratioPct}% of monthly PnL. Add a hard max-loss and size cap for that setup. Cap.`,
        color: RED,
      }
    }

    // ——— D. Winrate Trap ———
    if (
      Number.isFinite(tradesCount) &&
      Number.isFinite(winRate) &&
      Number.isFinite(overallEv) &&
      tradesCount >= minOverallTrades &&
      winRate >= 40 &&
      overallEv < 0
    ) {
      const avgWin = Number.isFinite(overall?.avgWinPct) ? overall.avgWinPct : 0
      const avgLoss = Number.isFinite(overall?.avgLossPct) ? overall.avgLossPct : 0
      return {
        line1: 'Winrate trap: losses outweigh wins',
        line2: `Win ${winRate.toFixed(0)}% but EV ${overallEv.toFixed(1)}%. Avg loss ${Math.abs(avgLoss).toFixed(1)}% > avg win ${avgWin.toFixed(1)}%. Tighten stops or downsize. Tighten.`,
        color: RED,
      }
    }

    // ——— E. Edge Confirmed ———
    const goodBucket = bucketWithKelly.find(
      (b) =>
        Number.isFinite(b.trades) &&
        Number.isFinite(b.ev_percent) &&
        Number.isFinite(b.kelly) &&
        b.trades >= minTrades &&
        b.ev_percent > edgeConfirmedBucketEvMin &&
        b.kelly > 0
    )
    const goodType = typeWithKelly.find(
      (t) =>
        Number.isFinite(t.trades) &&
        Number.isFinite(t.ev_percent) &&
        Number.isFinite(t.kelly) &&
        t.trades >= minTrades &&
        t.ev_percent > edgeConfirmedBucketEvMin &&
        t.kelly > 0
    )
    const overallEdge = Number.isFinite(overallEv) && Number.isFinite(overallKelly) && overallEv > 0 && overallKelly >= edgeConfirmedKellyMin
    const sliceEv =
      lastNTrades.length >= 5
        ? aggregateStats(lastNTrades.filter((t) => t?.return_percent != null && Number.isFinite(t.return_percent)))?.evPct ?? null
        : null
    const notWorsening = sliceEv == null || (Number.isFinite(sliceEv) && sliceEv >= -5)
    if ((overallEdge || goodBucket || goodType) && notWorsening) {
      const scope = goodBucket && goodBucket.bucket
        ? `${goodBucket.bucket} bucket`
        : goodType && goodType.trade_type
          ? goodType.trade_type
          : 'Overall'
      const ev = Number.isFinite(goodBucket?.ev_percent)
        ? goodBucket.ev_percent
        : Number.isFinite(goodType?.ev_percent)
          ? goodType.ev_percent
          : Number.isFinite(overallEv)
            ? overallEv
            : 0
      const n = Number.isFinite(goodBucket?.trades)
        ? goodBucket.trades
        : Number.isFinite(goodType?.trades)
          ? goodType.trades
          : Number.isFinite(tradesCount)
            ? tradesCount
            : 0
      const kelly = Number.isFinite(goodBucket?.kelly)
        ? goodBucket.kelly
        : Number.isFinite(goodType?.kelly)
          ? goodType.kelly
          : Number.isFinite(overallKelly)
            ? overallKelly
            : 0
      return {
        line1: 'Edge confirmed — controlled aggression',
        line2: `${scope} EV ${ev.toFixed(1)}% (n=${n}) and Kelly ${kelly.toFixed(1)}%. Keep sizing consistent and scale only inside this edge. Keep.`,
        color: BLUE,
      }
    }

    // ——— F. Recovery / Discipline ———
    const lastNWithReturn = lastNTrades.filter((t) => t?.return_percent != null && Number.isFinite(t.return_percent))
    if (lastNWithReturn.length >= 5) {
      const recentStats = aggregateStats(lastNWithReturn)
      const losses = lastNWithReturn.filter((t) => Number.isFinite(t.pnl) && t.pnl <= 0)
      const avgLossSize = losses.length ? losses.reduce((s, t) => s + Math.abs(t.pnl || 0), 0) / losses.length : 0
      const allLosses = tradesWithReturn.filter((t) => Number.isFinite(t.pnl) && t.pnl <= 0)
      const overallAvgLoss = allLosses.length ? allLosses.reduce((s, t) => s + Math.abs(t.pnl || 0), 0) / allLosses.length : 0
      if (
        Number.isFinite(recentStats?.evPct) &&
        recentStats.evPct < 0 &&
        Number.isFinite(avgLossSize) &&
        Number.isFinite(overallAvgLoss) &&
        avgLossSize <= overallAvgLoss * 1.1
      ) {
        return {
          line1: 'Risk tightening detected',
          line2: 'Last 10 trades show smaller losses / less exposure in weak buckets. Continue pruning negatives. Continue.',
          color: BLUE,
        }
      }
    }

    // ——— G. Insufficient Data ———
    if (!Number.isFinite(tradesCount) || tradesCount < minOverallTrades) {
      const safeCount = Number.isFinite(tradesCount) ? tradesCount : 0
      return {
        line1: 'No reliable edge read yet',
        line2: `Sample too small (n=${safeCount}). Track consistently and avoid large sizing until signals stabilize. Stabilize.`,
        color: WHITE,
      }
    }

    // Default neutral
    const safeCount = Number.isFinite(tradesCount) ? tradesCount : 0
    return {
      line1: 'No reliable edge read yet',
      line2: `Sample too small (n=${safeCount}). Track consistently and avoid large sizing until signals stabilize. Stabilize.`,
      color: WHITE,
    }
  } catch (error) {
    // Calculation error → 'Insufficient Data'
    console.warn('Flow status calculation error:', error)
    return {
      line1: 'No reliable edge read yet',
      line2: 'Calculation error. Track consistently and avoid large sizing until signals stabilize. Stabilize.',
      color: WHITE,
    }
  }
}
