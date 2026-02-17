import { formatPnl } from '../../utils/format'

export default function Overview({ data }) {
  const totalTrades = data.position_size_buckets.reduce((sum, b) => sum + b.trades, 0)
  const totalPnl = data.position_size_buckets.reduce((sum, b) => sum + b.total_pnl, 0)
  const totalWins = data.position_size_buckets.reduce((sum, b) => {
    return sum + Math.round(b.trades * (b.win_rate / 100))
  }, 0)
  const winRate = totalTrades > 0 ? (totalWins / totalTrades * 100) : 0

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="text-xs text-[#a0a0a0] mb-1">Total Trades</div>
        <div className="text-2xl font-bold text-white">{totalTrades}</div>
      </div>
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="text-xs text-[#a0a0a0] mb-1">Win Rate</div>
        <div className="text-2xl font-bold text-white">{winRate.toFixed(1)}%</div>
      </div>
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="text-xs text-[#a0a0a0] mb-1">Total PnL</div>
        <div className={`text-2xl font-bold ${totalPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
          {formatPnl(totalPnl)}
        </div>
      </div>
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <div className="text-xs text-[#a0a0a0] mb-1">Trade Types</div>
        <div className="text-2xl font-bold text-white">{data.trade_type_stats.length}</div>
      </div>
    </div>
  )
}
