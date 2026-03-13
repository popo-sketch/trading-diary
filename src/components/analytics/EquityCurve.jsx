import { formatPnl } from '../../utils/format'

export default function EquityCurve({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
        <h2 className="text-xl font-bold text-white mb-4">Equity Curve</h2>
        <div className="text-neutral text-center py-8">데이터 없음</div>
      </div>
    )
  }

  const maxPnl = Math.max(...data.map((d) => d.cumulative_pnl))
  const minPnl = Math.min(...data.map((d) => d.cumulative_pnl))
  const range = maxPnl - minPnl || 1

  // 간단한 SVG 차트 (recharts 없이)
  const width = 800
  const height = 300
  const padding = 40
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth
    const y = padding + chartHeight - ((d.cumulative_pnl - minPnl) / range) * chartHeight
    return { x, y, ...d }
  })

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-6">
      <h2 className="text-xl font-bold text-white mb-4">Equity Curve</h2>
      <div className="overflow-x-auto">
        <svg width={width} height={height} className="w-full">
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
                  x={padding - 10}
                  y={y + 4}
                  fill="#a0a0a0"
                  fontSize="10"
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
              r="3"
              fill="#3B82F6"
              className="hover:r-5 transition-all"
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
