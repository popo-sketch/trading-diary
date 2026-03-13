import { formatPnl } from '../../utils/format'

function kellyPercent(winRatePct, avgWinPct, avgLossPct) {
  if (avgWinPct <= 0) return 0
  const p = winRatePct / 100
  const q = 1 - p
  const k = (p * avgWinPct - q * Math.abs(avgLossPct)) / avgWinPct
  return k <= 0 ? 0 : k * 100
}

export default function PositionSizeTableCompact({ buckets }) {
  if (buckets.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h3 className="text-sm font-bold text-white mb-3">Position Size Analysis</h3>
        <div className="text-neutral text-center py-4 text-xs">No Data</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <h3 className="text-sm font-bold text-white mb-3">Position Size Analysis</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left py-2 px-1.5 text-[#a0a0a0] whitespace-nowrap">Bucket</th>
              <th className="text-right py-2 px-1.5 text-[#a0a0a0]">Trades</th>
              <th className="text-right py-2 px-1.5 text-[#a0a0a0]">Win%</th>
              <th className="text-right py-2 px-1.5 text-[#a0a0a0]">Avg Win%</th>
              <th className="text-right py-2 px-1.5 text-[#a0a0a0]">Avg Loss%</th>
              <th className="text-right py-2 px-1.5 text-[#a0a0a0]">EV%</th>
              <th className="text-right py-2 px-1.5 text-[#a0a0a0]">Kelly%</th>
              <th className="text-right py-2 px-1.5 text-[#a0a0a0]">Total PnL$</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, i) => {
              const kelly = kellyPercent(bucket.win_rate, bucket.avg_win_percent, bucket.avg_loss_percent)
              return (
                <tr key={i} className="border-b border-[#2a2a2a] hover:bg-[#222]">
                  <td className="py-2 px-1.5 text-white font-medium whitespace-nowrap">{bucket.bucket}</td>
                  <td className="py-2 px-1.5 text-white text-right">{bucket.trades}</td>
                  <td className="py-2 px-1.5 text-white text-right">{bucket.win_rate.toFixed(1)}%</td>
                  <td className="py-2 px-1.5 text-right text-profit">{bucket.avg_win_percent.toFixed(1)}%</td>
                  <td className="py-2 px-1.5 text-right text-loss">{Math.abs(bucket.avg_loss_percent).toFixed(1)}%</td>
                  <td className={`py-2 px-1.5 text-right font-medium ${bucket.ev_percent >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {bucket.ev_percent.toFixed(1)}%
                  </td>
                  <td className="py-2 px-1.5 text-right font-medium" style={{ color: '#3B82F6' }}>
                    {kelly.toFixed(0)}%
                  </td>
                  <td className={`py-2 px-1.5 text-right font-medium ${bucket.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {formatPnl(bucket.total_pnl)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
