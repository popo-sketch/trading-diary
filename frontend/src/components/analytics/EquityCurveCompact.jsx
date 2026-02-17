import { useState } from 'react'
import { formatPnl } from '../../utils/format'

export default function EquityCurveCompact({ data }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  if (!data || data.length === 0) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h3 className="text-sm font-bold text-white mb-3">Equity Curve</h3>
        <div className="text-neutral text-center py-8 text-xs">No Data</div>
      </div>
    )
  }

  const maxPnl = Math.max(...data.map((d) => d.cumulative_pnl))
  const minPnl = Math.min(...data.map((d) => d.cumulative_pnl))
  const range = maxPnl - minPnl || 1

  // Max Drawdown 계산
  let maxDrawdown = 0
  let peak = data[0]?.cumulative_pnl || 0
  for (let i = 1; i < data.length; i++) {
    const current = data[i].cumulative_pnl
    if (current > peak) {
      peak = current
    }
    const drawdown = peak - current
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  // Current Equity (마지막 누적 PnL)
  const currentEquity = data[data.length - 1]?.cumulative_pnl || 0

  // High Water Mark (최고점)
  let hwmIndex = 0
  let hwmValue = data[0]?.cumulative_pnl || 0
  for (let i = 1; i < data.length; i++) {
    if (data[i].cumulative_pnl > hwmValue) {
      hwmValue = data[i].cumulative_pnl
      hwmIndex = i
    }
  }

  const width = 1000
  const height = 200
  const padding = 30
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2

  // 0 기준선 Y 좌표
  const zeroY = padding + chartHeight - ((0 - minPnl) / range) * chartHeight

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * chartWidth
    const y = padding + chartHeight - ((d.cumulative_pnl - minPnl) / range) * chartHeight
    return { x, y, ...d, index: i }
  })

  // 영역 채우기용 path (0 기준선까지)
  const areaPath = (() => {
    if (points.length === 0) return ''
    const first = points[0]
    const last = points[points.length - 1]
    let path = `M ${first.x} ${zeroY} L ${first.x} ${first.y}`
    points.forEach((p) => {
      path += ` L ${p.x} ${p.y}`
    })
    path += ` L ${last.x} ${zeroY} Z`
    return path
  })()

  // 선 색상 결정 (마지막 값 기준)
  const lineColor = currentEquity >= 0 ? '#10B981' : '#EF4444'

  // Y축 그리드 라인 및 레이블
  const yAxisValues = []
  if (minPnl < 0 && maxPnl > 0) {
    // 0 포함
    const steps = 5
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps
      const value = minPnl + range * ratio
      yAxisValues.push(value)
    }
  } else {
    // 0 미포함
    const steps = 4
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps
      const value = minPnl + range * ratio
      yAxisValues.push(value)
    }
  }

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4 relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">Equity Curve</h3>
        <div className="flex items-center gap-4 text-xs text-[#a0a0a0]">
          <span>
            Max Drawdown: <span className="text-loss">{formatPnl(-maxDrawdown)}</span>
          </span>
          <span>
            Current Equity: <span className={currentEquity >= 0 ? 'text-profit' : 'text-loss'}>{formatPnl(currentEquity)}</span>
          </span>
        </div>
      </div>
      <div className="overflow-x-auto relative">
        <svg 
          width={width} 
          height={height} 
          className="w-full" 
          viewBox={`0 0 ${width} ${height}`} 
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* 배경 영역: 0 이상 초록, 0 이하 빨강 */}
          {minPnl < 0 && maxPnl > 0 && (
            <>
              {/* 0 이상 영역 (초록) */}
              <rect
                x={padding}
                y={zeroY}
                width={chartWidth}
                height={padding + chartHeight - zeroY}
                fill="#10B981"
                fillOpacity="0.1"
              />
              {/* 0 이하 영역 (빨강) */}
              <rect
                x={padding}
                y={padding}
                width={chartWidth}
                height={zeroY - padding}
                fill="#EF4444"
                fillOpacity="0.1"
              />
            </>
          )}
          {minPnl >= 0 && (
            <rect
              x={padding}
              y={padding}
              width={chartWidth}
              height={chartHeight}
              fill="#10B981"
              fillOpacity="0.1"
            />
          )}
          {maxPnl <= 0 && (
            <rect
              x={padding}
              y={padding}
              width={chartWidth}
              height={chartHeight}
              fill="#EF4444"
              fillOpacity="0.1"
            />
          )}

          {/* Grid lines */}
          {yAxisValues.map((value) => {
            const y = padding + chartHeight - ((value - minPnl) / range) * chartHeight
            return (
              <g key={value}>
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

          {/* Zero line (항상 표시) */}
          {minPnl <= 0 && maxPnl >= 0 && (
            <line
              x1={padding}
              y1={zeroY}
              x2={width - padding}
              y2={zeroY}
              stroke="#6B7280"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Area fill */}
          <path
            d={areaPath}
            fill={lineColor}
            fillOpacity="0.2"
          />

          {/* Path (동적 색상) */}
          <path
            d={pathData}
            fill="none"
            stroke={lineColor}
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
              r={hoveredIndex === i ? "4" : "2"}
              fill={p.cumulative_pnl >= 0 ? '#10B981' : '#EF4444'}
              onMouseEnter={() => setHoveredIndex(i)}
              className="cursor-pointer transition-all"
            />
          ))}

          {/* High Water Mark */}
          {hwmIndex >= 0 && (
            <circle
              cx={points[hwmIndex]?.x}
              cy={points[hwmIndex]?.y}
              r="5"
              fill="#3B82F6"
              stroke="#1a1a1a"
              strokeWidth="2"
            />
          )}

          {/* Hover tooltip */}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <g>
              <rect
                x={points[hoveredIndex].x - 40}
                y={points[hoveredIndex].y - 30}
                width="80"
                height="20"
                fill="#1a1a1a"
                stroke={points[hoveredIndex].cumulative_pnl >= 0 ? '#10B981' : '#EF4444'}
                strokeWidth="1"
                rx="4"
              />
              <text
                x={points[hoveredIndex].x}
                y={points[hoveredIndex].y - 15}
                fill={points[hoveredIndex].cumulative_pnl >= 0 ? '#10B981' : '#EF4444'}
                fontSize="10"
                textAnchor="middle"
                fontWeight="bold"
              >
                {formatPnl(points[hoveredIndex].cumulative_pnl)}
              </text>
              <text
                x={points[hoveredIndex].x}
                y={points[hoveredIndex].y - 3}
                fill="#a0a0a0"
                fontSize="8"
                textAnchor="middle"
              >
                {points[hoveredIndex].date}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  )
}
