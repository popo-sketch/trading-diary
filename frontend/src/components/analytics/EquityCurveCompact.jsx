import { formatPnl } from '../../utils/format'

export default function EquityCurveCompact({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h3 className="text-sm font-bold text-white mb-3">Equity Curve</h3>
        <div className="text-neutral text-center py-8 text-xs">데이터 없음</div>
      </div>
    )
  }

  const maxPnl = Math.max(...data.map((d) => d.cumulative_pnl))
  const minPnl = Math.min(...data.map((d) => d.cumulative_pnl))
  const range = maxPnl - minPnl || 1

  const width = 1000
  const height = 200
  const padding = 30
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth
    const y = padding + chartHeight - ((d.cumulative_pnl - minPnl) / range) * chartHeight
    return { x, y, ...d }
  })

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <h3 className="text-sm font-bold text-white mb-3">Equity Curve</h3>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding + chartHeight * (1 - ratio)
            const value = minPnl + range * ratio
            return (
              <g key={ratio}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="#2a2a2a"
                  strokeWidth="1"
                />
                <text
                  x={padding - 8}
                  y={y + 3}
                  fill="#6B7280"
                  fontSize="9"
                  textAnchor="end"
                >
                  {formatPnl(value)}
                </text>
              </g>
            )
          })}

          {/* Zero line */}
          {minPnl < 0 && maxPnl > 0 && (
            <line
              x1={padding}
              y1={padding + chartHeight - ((0 - minPnl) / range) * chartHeight}
              x2={width - padding}
              y2={padding + chartHeight - ((0 - minPnl) / range) * chartHeight}
              stroke="#6B7280"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )}

          {/* Path */}
          <path
            d={pathData}
            fill="none"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="2"
              fill="#3B82F6"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
