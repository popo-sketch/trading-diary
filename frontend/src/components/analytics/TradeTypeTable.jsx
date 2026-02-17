import { formatPnl } from '../../utils/format'

export default function TradeTypeTable({ stats }) {
  if (stats.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-xl font-bold text-white mb-4">Trade Type Analysis</h2>
        <div className="text-neutral text-center py-8">데이터 없음</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <h2 className="text-xl font-bold text-white mb-4">Trade Type Analysis</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th className="text-left py-3 px-4 text-[#a0a0a0]">Trade Type</th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">Trades</th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">Win%</th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">EV%</th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">Total PnL $</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat, i) => (
              <tr key={i} className="border-b border-[#2a2a2a] hover:bg-[#222]">
                <td className="py-3 px-4 text-white font-medium">{stat.trade_type}</td>
                <td className="py-3 px-4 text-white text-right">{stat.trades}</td>
                <td className="py-3 px-4 text-white text-right">{stat.win_rate.toFixed(1)}%</td>
                <td className={`py-3 px-4 text-right font-medium ${stat.ev_percent >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {stat.ev_percent.toFixed(2)}%
                </td>
                <td className={`py-3 px-4 text-right font-medium ${stat.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
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
