import { formatPnl } from '../../utils/format'

export default function TradeTypeTableCompact({ stats }) {
  if (stats.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h3 className="text-sm font-bold text-white mb-3">Trade Type Analysis</h3>
        <div className="text-neutral text-center py-4 text-xs">데이터 없음</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <h3 className="text-sm font-bold text-white mb-3">Trade Type Analysis</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left py-2 px-2 text-[#a0a0a0]">Trade Type</th>
              <th className="text-right py-2 px-2 text-[#a0a0a0]">Trades</th>
              <th className="text-right py-2 px-2 text-[#a0a0a0]">Win%</th>
              <th className="text-right py-2 px-2 text-[#a0a0a0]">EV%</th>
              <th className="text-right py-2 px-2 text-[#a0a0a0]">Total PnL$</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, i) => (
              <tr key={i} className="border-b border-[#2a2a2a] hover:bg-[#222]">
                <td className="py-2 px-2 text-white font-medium">{stat.trade_type}</td>
                <td className="py-2 px-2 text-white text-right">{stat.trades}</td>
                <td className="py-2 px-2 text-white text-right">{stat.win_rate.toFixed(1)}%</td>
                <td className={`py-2 px-2 text-right font-medium ${stat.ev_percent >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {stat.ev_percent.toFixed(2)}%
                </td>
                <td className={`py-2 px-2 text-right font-medium ${stat.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatPnl(stat.total_pnl)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
