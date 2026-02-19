import { useState } from 'react'
import { formatPnl, formatPnlShort } from '../../utils/format'

const CHART_HEIGHT = 200
const GREEN = '#10B981'
const RED = '#EF4444'

function formatEvPercent(num) {
  if (num == null || isNaN(num)) return '0%'
  const sign = num >= 0 ? '+' : ''
  return `${sign}${Number(num).toFixed(1)}%`
}

export default function EquityCurveCompact({ data, evCurve = [] }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [hoveredEvIndex, setHoveredEvIndex] = useState(null)

  const hasEquity = data && data.length > 0
  const hasEv = evCurve && evCurve.length > 0

  if (!hasEquity && !hasEv) {
    return (
      <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
        <h3 className="text-sm font-bold text-white mb-3">Equity Curve</h3>
        <div className="text-neutral text-center py-8 text-xs">No Data</div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] p-4">
      <div className="flex w-full" style={{ minHeight: CHART_HEIGHT + 56 }}>
        {/* 좌측 50%: Equity Curve */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-[#2a2a2a] pr-2">
          {hasEquity ? (
            <EquityChart
              data={data}
              hoveredIndex={hoveredIndex}
              setHoveredIndex={setHoveredIndex}
              height={CHART_HEIGHT}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs text-[#6B7280]">No equity data</span>
            </div>
          )}
        </div>

        {/* 우측 50%: Expected Value Curve */}
        <div className="flex-1 min-w-0 flex flex-col pl-2">
          {hasEv ? (
            <EvChart
              data={evCurve}
              hoveredIndex={hoveredEvIndex}
              setHoveredIndex={setHoveredEvIndex}
              height={CHART_HEIGHT}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <span className="text-xs text-[#6B7280]">No EV data</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EquityChart({ data, hoveredIndex, setHoveredIndex, height }) {
  const maxPnl = Math.max(...data.map((d) => d.cumulative_pnl))
  const minPnl = Math.min(...data.map((d) => d.cumulative_pnl))
  const range = maxPnl - minPnl || 1

  let maxDrawdown = 0
  let peak = data[0]?.cumulative_pnl || 0
  for (let i = 1; i < data.length; i++) {
    const current = data[i].cumulative_pnl
    if (current > peak) peak = current
    const drawdown = peak - current
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }
  const currentEquity = data[data.length - 1]?.cumulative_pnl || 0

  let hwmIndex = 0
  let hwmValue = data[0]?.cumulative_pnl || 0
  for (let i = 1; i < data.length; i++) {
    if (data[i].cumulative_pnl > hwmValue) {
      hwmValue = data[i].cumulative_pnl
      hwmIndex = i
    }
  }

  const width = 500
  const paddingRight = 20
  const paddingTop = 30
  const paddingBottom = 30
  const paddingLeft = 44
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const zeroY = paddingTop + chartHeight - ((0 - minPnl) / range) * chartHeight

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth
    const y = paddingTop + chartHeight - ((d.cumulative_pnl - minPnl) / range) * chartHeight
    return { x, y, ...d, index: i }
  })

  const areaPath = (() => {
    if (points.length === 0) return ''
    const first = points[0]
    const last = points[points.length - 1]
    let path = `M ${first.x} ${zeroY} L ${first.x} ${first.y}`
    points.forEach((p) => { path += ` L ${p.x} ${p.y}` })
    path += ` L ${last.x} ${zeroY} Z`
    return path
  })()

  const lineColor = currentEquity >= 0 ? GREEN : RED

  const yAxisValues = []
  const steps = (minPnl < 0 && maxPnl > 0) ? 5 : 4
  for (let i = 0; i <= steps; i++) {
    yAxisValues.push(minPnl + range * (i / steps))
  }

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">Equity Curve</h3>
        <div className="flex items-center gap-3 text-xs text-[#a0a0a0]">
          <span>Max Drawdown: <span className="text-loss">{formatPnl(-maxDrawdown)}</span></span>
          <span>Current Equity: <span className={currentEquity >= 0 ? 'text-profit' : 'text-loss'}>{formatPnl(currentEquity)}</span></span>
        </div>
      </div>
      <div className="overflow-x-auto relative flex-1 min-h-0">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {minPnl < 0 && maxPnl > 0 && (
            <>
              <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={zeroY - paddingTop} fill={GREEN} fillOpacity="0.1" />
              <rect x={paddingLeft} y={zeroY} width={chartWidth} height={paddingTop + chartHeight - zeroY} fill={RED} fillOpacity="0.1" />
            </>
          )}
          {minPnl >= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={GREEN} fillOpacity="0.1" />}
          {maxPnl <= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={RED} fillOpacity="0.1" />}

          {yAxisValues.map((value) => {
            const y = paddingTop + chartHeight - ((value - minPnl) / range) * chartHeight
            const labelColor = value > 0 ? GREEN : value < 0 ? RED : '#ffffff'
            return (
              <g key={value}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#2a2a2a" strokeWidth="1" />
                <text x={paddingLeft - 6} y={y + 3} fill={labelColor} fontSize="9" textAnchor="end">{formatPnlShort(value)}</text>
              </g>
            )
          })}
          {minPnl <= 0 && maxPnl >= 0 && (
            <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 4" />
          )}
          <path d={areaPath} fill={lineColor} fillOpacity="0.2" />
          <path d={pathData} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 4 : 2}
              fill={p.cumulative_pnl >= 0 ? GREEN : RED}
              onMouseEnter={() => setHoveredIndex(i)}
              className="cursor-pointer transition-all"
            />
          ))}
          {hwmIndex >= 0 && (
            <circle cx={points[hwmIndex]?.x} cy={points[hwmIndex]?.y} r="5" fill="#3B82F6" stroke="#1a1a1a" strokeWidth="2" />
          )}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <g>
              <rect x={points[hoveredIndex].x - 40} y={points[hoveredIndex].y - 30} width="80" height="20" fill="#1a1a1a" stroke={points[hoveredIndex].cumulative_pnl >= 0 ? GREEN : RED} strokeWidth="1" rx="4" />
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 15} fill={points[hoveredIndex].cumulative_pnl >= 0 ? GREEN : RED} fontSize="10" textAnchor="middle" fontWeight="bold">{formatPnl(points[hoveredIndex].cumulative_pnl)}</text>
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 3} fill="#a0a0a0" fontSize="8" textAnchor="middle">{points[hoveredIndex].date}</text>
            </g>
          )}
        </svg>
      </div>
    </>
  )
}

function EvChart({ data, hoveredIndex, setHoveredIndex, height }) {
  const values = data.map((d) => d.ev_percent)
  const minEv = Math.min(...values, 0)
  const maxEv = Math.max(...values, 0)
  const range = maxEv - minEv || 1
  const currentEv = data[data.length - 1]?.ev_percent ?? 0

  const width = 500
  const paddingRight = 20
  const paddingTop = 30
  const paddingBottom = 30
  const paddingLeft = 40
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const zeroY = paddingTop + chartHeight - ((0 - minEv) / range) * chartHeight

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth
    const y = paddingTop + chartHeight - ((d.ev_percent - minEv) / range) * chartHeight
    return { x, y, ...d, index: i }
  })

  const areaPath = (() => {
    if (points.length === 0) return ''
    const first = points[0]
    const last = points[points.length - 1]
    let path = `M ${first.x} ${zeroY} L ${first.x} ${first.y}`
    points.forEach((p) => { path += ` L ${p.x} ${p.y}` })
    path += ` L ${last.x} ${zeroY} Z`
    return path
  })()

  const lineColor = currentEv >= 0 ? GREEN : RED

  const yAxisValues = []
  const steps = (minEv < 0 && maxEv > 0) ? 5 : 4
  for (let i = 0; i <= steps; i++) {
    yAxisValues.push(minEv + range * (i / steps))
  }

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-white">Expected Value Curve</h3>
        <span className={`text-xs ${currentEv >= 0 ? 'text-profit' : 'text-loss'}`}>Current EV: {formatEvPercent(currentEv)}</span>
      </div>
      <div className="overflow-x-auto relative flex-1 min-h-0">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {minEv < 0 && maxEv > 0 && (
            <>
              <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={zeroY - paddingTop} fill={GREEN} fillOpacity="0.1" />
              <rect x={paddingLeft} y={zeroY} width={chartWidth} height={paddingTop + chartHeight - zeroY} fill={RED} fillOpacity="0.1" />
            </>
          )}
          {minEv >= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={GREEN} fillOpacity="0.1" />}
          {maxEv <= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={RED} fillOpacity="0.1" />}

          {yAxisValues.map((value) => {
            const y = paddingTop + chartHeight - ((value - minEv) / range) * chartHeight
            const labelColor = value > 0 ? GREEN : value < 0 ? RED : '#ffffff'
            return (
              <g key={value}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#2a2a2a" strokeWidth="1" />
                <text x={paddingLeft - 6} y={y + 3} fill={labelColor} fontSize="9" textAnchor="end">{value.toFixed(1)}%</text>
              </g>
            )
          })}
          {/* 0% 기준선 점선 */}
          <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 4" />

          <path d={areaPath} fill={lineColor} fillOpacity="0.2" />
          <path d={pathData} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 4 : 2}
              fill={p.ev_percent >= 0 ? GREEN : RED}
              onMouseEnter={() => setHoveredIndex(i)}
              className="cursor-pointer transition-all"
            />
          ))}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <g>
              <rect x={points[hoveredIndex].x - 35} y={points[hoveredIndex].y - 30} width="70" height="20" fill="#1a1a1a" stroke={points[hoveredIndex].ev_percent >= 0 ? GREEN : RED} strokeWidth="1" rx="4" />
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 15} fill={points[hoveredIndex].ev_percent >= 0 ? GREEN : RED} fontSize="10" textAnchor="middle" fontWeight="bold">{formatEvPercent(points[hoveredIndex].ev_percent)}</text>
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 3} fill="#a0a0a0" fontSize="8" textAnchor="middle">{points[hoveredIndex].date}</text>
            </g>
          )}
        </svg>
      </div>
    </>
  )
}
