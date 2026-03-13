import { useState, useMemo } from 'react'
import { formatPnl } from '../../utils/format'

export default function PositionSizeTable({ buckets }) {
  const [sortBy, setSortBy] = useState('ev_dollar')
  const [sortOrder, setSortOrder] = useState('desc')

  const sortedBuckets = useMemo(() => {
    const sorted = [...buckets]
    sorted.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'ev_dollar':
          aVal = a.ev_dollar
          bVal = b.ev_dollar
          break
        case 'ev_percent':
          aVal = a.ev_percent
          bVal = b.ev_percent
          break
        case 'win_rate':
          aVal = a.win_rate
          bVal = b.win_rate
          break
        case 'trades':
          aVal = a.trades
          bVal = b.trades
          break
        case 'total_pnl':
          aVal = a.total_pnl
          bVal = b.total_pnl
          break
        default:
          return 0
      }
      if (sortOrder === 'asc') return aVal - bVal
      return bVal - aVal
    })
    return sorted
  }, [buckets, sortBy, sortOrder])

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return null
    return sortOrder === 'asc' ? '↑' : '↓'
  }

  if (buckets.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-xl font-bold text-white mb-4">Position Size Analysis</h2>
        <div className="text-neutral text-center py-8">데이터 없음</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <h2 className="text-xl font-bold text-white mb-4">Position Size Analysis</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a2a]">
              <th
                className="text-left py-3 px-4 text-[#a0a0a0] cursor-pointer hover:text-white"
                onClick={() => handleSort('bucket')}
              >
                Bucket
              </th>
              <th
                className="text-right py-3 px-4 text-[#a0a0a0] cursor-pointer hover:text-white"
                onClick={() => handleSort('trades')}
              >
                Trades <SortIcon column="trades" />
              </th>
              <th
                className="text-right py-3 px-4 text-[#a0a0a0] cursor-pointer hover:text-white"
                onClick={() => handleSort('win_rate')}
              >
                Win% <SortIcon column="win_rate" />
              </th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">Avg Win %</th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">Avg Loss %</th>
              <th
                className="text-right py-3 px-4 text-[#a0a0a0] cursor-pointer hover:text-white"
                onClick={() => handleSort('ev_percent')}
              >
                EV% <SortIcon column="ev_percent" />
              </th>
              <th
                className="text-right py-3 px-4 text-[#a0a0a0] cursor-pointer hover:text-white"
                onClick={() => handleSort('total_pnl')}
              >
                Total PnL $ <SortIcon column="total_pnl" />
              </th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">Avg Win $</th>
              <th className="text-right py-3 px-4 text-[#a0a0a0]">Avg Loss $</th>
              <th
                className="text-right py-3 px-4 text-[#a0a0a0] cursor-pointer hover:text-white"
                onClick={() => handleSort('ev_dollar')}
              >
                EV$ <SortIcon column="ev_dollar" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedBuckets.map((bucket, i) => (
              <tr key={i} className="border-b border-[#2a2a2a] hover:bg-[#222]">
                <td className="py-3 px-4 text-white font-medium">{bucket.bucket}</td>
                <td className="py-3 px-4 text-white text-right">{bucket.trades}</td>
                <td className="py-3 px-4 text-white text-right">{bucket.win_rate.toFixed(1)}%</td>
                <td className="py-3 px-4 text-white text-right">{bucket.avg_win_percent.toFixed(2)}%</td>
                <td className="py-3 px-4 text-white text-right">{bucket.avg_loss_percent.toFixed(2)}%</td>
                <td className={`py-3 px-4 text-right font-medium ${bucket.ev_percent >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {bucket.ev_percent.toFixed(2)}%
                </td>
                <td className={`py-3 px-4 text-right font-medium ${bucket.total_pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatPnl(bucket.total_pnl)}
                </td>
                <td className="py-3 px-4 text-profit text-right">{formatPnl(bucket.avg_win_dollar)}</td>
                <td className="py-3 px-4 text-loss text-right">{formatPnl(bucket.avg_loss_dollar)}</td>
                <td className={`py-3 px-4 text-right font-medium ${bucket.ev_dollar >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatPnl(bucket.ev_dollar)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
