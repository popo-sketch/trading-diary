import { formatPnl } from '../utils/format'

export default function StatsPanel({ stats, isLoading }) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] flex items-center justify-center"
          >
            <div className="animate-pulse text-neutral">로딩 중...</div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h3 className="text-sm font-medium text-[#a0a0a0] mb-4">Overview</h3>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-[#6B7280]">Total PNL</div>
            <div
              className={`text-lg font-bold ${
                stats.total_pnl >= 0 ? 'text-profit' : 'text-loss'
              }`}
            >
              {formatPnl(stats.total_pnl)}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#6B7280]">Win Rate</div>
            <div className="text-lg font-bold text-white">
              {(stats.win_rate * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-[#6B7280]">Trades</div>
            <div className="text-lg font-bold text-white">
              {stats.total_trades}
            </div>
          </div>
          {stats.best_day && (
            <div>
              <div className="text-xs text-[#6B7280]">Best Day</div>
              <div className="text-sm text-profit">
                {stats.best_day.date} {formatPnl(stats.best_day.pnl)}
              </div>
            </div>
          )}
          {stats.worst_day && (
            <div>
              <div className="text-xs text-[#6B7280]">Worst Day</div>
              <div className="text-sm text-loss">
                {stats.worst_day.date} {formatPnl(stats.worst_day.pnl)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h3 className="text-sm font-medium text-[#a0a0a0] mb-4">Top 3 Wins</h3>
        <div className="space-y-2">
          {stats.top_wins?.length > 0 ? (
            stats.top_wins.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0"
              >
                <div>
                  <span className="text-neutral text-xs mr-2">#{i + 1}</span>
                  <span className="font-medium text-white">{t.ticker}</span>
                  <span className="text-xs text-[#a0a0a0] ml-2">{t.date}</span>
                </div>
                <span className="text-profit font-medium">↗ {formatPnl(t.pnl)}</span>
              </div>
            ))
          ) : (
            <div className="text-neutral text-sm py-4">데이터 없음</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h3 className="text-sm font-medium text-[#a0a0a0] mb-4">Top 3 Losses</h3>
        <div className="space-y-2">
          {stats.top_losses?.length > 0 ? (
            stats.top_losses.map((t, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-[#2a2a2a] last:border-0"
              >
                <div>
                  <span className="text-neutral text-xs mr-2">#{i + 1}</span>
                  <span className="font-medium text-white">{t.ticker}</span>
                  <span className="text-xs text-[#a0a0a0] ml-2">{t.date}</span>
                </div>
                <span className="text-loss font-medium">↘ {formatPnl(t.pnl)}</span>
              </div>
            ))
          ) : (
            <div className="text-neutral text-sm py-4">데이터 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}
