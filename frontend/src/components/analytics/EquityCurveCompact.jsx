import { useState, useEffect, useRef, useCallback } from 'react'
import { formatPnl, formatPnlShort } from '../../utils/format'

const CHART_HEIGHT = 200
const MODAL_CHART_HEIGHT = 500
const GREEN = '#00c853'
const RED = '#ff1744'

function formatEvPercent(num) {
  if (num == null || isNaN(num)) return '0%'
  const sign = num >= 0 ? '+' : ''
  return `${sign}${Number(num).toFixed(1)}%`
}

/* ─── 확대 모달 ─────────────────────────────────────────── */
function ChartModal({ type, data, evCurve, kellyPercent, onClose }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [zoomRange, setZoomRange] = useState(null)
  const [dragStart, setDragStart] = useState(null)
  const [dragCurrent, setDragCurrent] = useState(null)
  const svgRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const isEquity = type === 'equity'
  const rawData = isEquity ? data : evCurve
  const slicedData = zoomRange ? rawData.slice(zoomRange[0], zoomRange[1] + 1) : rawData

  const getSvgX = useCallback((clientX) => {
    if (!svgRef.current) return 0
    const rect = svgRef.current.getBoundingClientRect()
    return ((clientX - rect.left) / rect.width) * 1000
  }, [])

  const handleMouseDown = (e) => {
    const x = getSvgX(e.clientX)
    setDragStart(x)
    setDragCurrent(x)
  }

  const handleMouseMove = (e) => {
    if (dragStart != null) {
      setDragCurrent(getSvgX(e.clientX))
    }
  }

  const handleMouseUp = () => {
    if (dragStart != null && dragCurrent != null && Math.abs(dragCurrent - dragStart) > 20) {
      const paddingLeft = 60
      const paddingRight = 30
      const chartWidth = 1000 - paddingLeft - paddingRight
      const startIdx = Math.max(0, Math.round(((Math.min(dragStart, dragCurrent) - paddingLeft) / chartWidth) * (slicedData.length - 1)))
      const endIdx = Math.min(slicedData.length - 1, Math.round(((Math.max(dragStart, dragCurrent) - paddingLeft) / chartWidth) * (slicedData.length - 1)))
      if (endIdx - startIdx >= 2) {
        const baseStart = zoomRange ? zoomRange[0] : 0
        setZoomRange([baseStart + startIdx, baseStart + endIdx])
      }
    }
    setDragStart(null)
    setDragCurrent(null)
  }

  const resetZoom = () => setZoomRange(null)

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a2e', borderRadius: 12, padding: 24,
          width: '100%', maxWidth: 1100, position: 'relative',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 16,
            background: 'none', border: 'none', color: '#9e9e9e',
            fontSize: 20, cursor: 'pointer', lineHeight: 1,
          }}
        >
          ✕
        </button>

        {/* 줌 리셋 */}
        {zoomRange && (
          <button
            onClick={resetZoom}
            style={{
              position: 'absolute', top: 14, right: 50,
              background: '#242442', border: '1px solid rgba(255,255,255,0.1)',
              color: '#9e9e9e', fontSize: 11, cursor: 'pointer',
              borderRadius: 6, padding: '4px 10px',
            }}
          >
            Reset Zoom
          </button>
        )}

        {isEquity ? (
          <ModalEquityChart
            data={slicedData}
            hoveredIndex={hoveredIndex}
            setHoveredIndex={setHoveredIndex}
            svgRef={svgRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            dragStart={dragStart}
            dragCurrent={dragCurrent}
            zoomRange={zoomRange}
          />
        ) : (
          <ModalEvChart
            data={slicedData}
            kellyPercent={kellyPercent}
            hoveredIndex={hoveredIndex}
            setHoveredIndex={setHoveredIndex}
            svgRef={svgRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            dragStart={dragStart}
            dragCurrent={dragCurrent}
            zoomRange={zoomRange}
          />
        )}

        <div style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', marginTop: 8 }}>
          마우스 드래그로 구간 줌인 · {zoomRange ? 'Reset Zoom 버튼으로 초기화' : 'ESC로 닫기'}
        </div>
      </div>
    </div>
  )
}

function ModalEquityChart({ data, hoveredIndex, setHoveredIndex, svgRef, onMouseDown, onMouseMove, onMouseUp, dragStart, dragCurrent }) {
  if (!data || data.length === 0) return null

  const height = MODAL_CHART_HEIGHT
  const maxPnl = Math.max(...data.map((d) => d.cumulative_pnl))
  const minPnl = Math.min(...data.map((d) => d.cumulative_pnl))
  const range = maxPnl - minPnl || 1
  const currentEquity = data[data.length - 1]?.cumulative_pnl || 0

  let maxDrawdown = 0
  let peak = data[0]?.cumulative_pnl || 0
  for (let i = 1; i < data.length; i++) {
    const current = data[i].cumulative_pnl
    if (current > peak) peak = current
    const drawdown = peak - current
    if (drawdown > maxDrawdown) maxDrawdown = drawdown
  }

  const width = 1000
  const paddingRight = 30
  const paddingTop = 50
  const paddingBottom = 40
  const paddingLeft = 60
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const zeroY = paddingTop + chartHeight - ((0 - minPnl) / range) * chartHeight

  const points = data.map((d, i) => {
    const x = paddingLeft + (data.length === 1 ? 0 : (i / (data.length - 1)) * chartWidth)
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
  const steps = (minPnl < 0 && maxPnl > 0) ? 7 : 5
  for (let i = 0; i <= steps; i++) yAxisValues.push(minPnl + range * (i / steps))
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  // X축 날짜 라벨 (간격 조절)
  const xLabelInterval = Math.max(1, Math.floor(data.length / 12))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Equity Curve</h3>
        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#9e9e9e' }}>
          <span>Max Drawdown: <span style={{ color: RED, fontWeight: 700 }}>{formatPnl(-maxDrawdown)}</span></span>
          <span>Current Equity: <span style={{ color: currentEquity >= 0 ? GREEN : RED, fontWeight: 700 }}>{formatPnl(currentEquity)}</span></span>
        </div>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setHoveredIndex(null); onMouseUp?.() }}
        style={{ cursor: dragStart != null ? 'col-resize' : 'crosshair', userSelect: 'none' }}
      >
        {minPnl < 0 && maxPnl > 0 && (
          <>
            <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={zeroY - paddingTop} fill={GREEN} fillOpacity="0.08" />
            <rect x={paddingLeft} y={zeroY} width={chartWidth} height={paddingTop + chartHeight - zeroY} fill={RED} fillOpacity="0.08" />
          </>
        )}
        {minPnl >= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={GREEN} fillOpacity="0.08" />}
        {maxPnl <= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={RED} fillOpacity="0.08" />}

        {yAxisValues.map((value) => {
          const y = paddingTop + chartHeight - ((value - minPnl) / range) * chartHeight
          const labelColor = value > 0 ? GREEN : value < 0 ? RED : '#ffffff'
          return (
            <g key={value}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={paddingLeft - 8} y={y + 4} fill={labelColor} fontSize="11" textAnchor="end" fontFamily="Inter, monospace">{formatPnlShort(value)}</text>
            </g>
          )
        })}

        {/* X축 날짜 라벨 */}
        {points.map((p, i) => {
          if (i % xLabelInterval !== 0 && i !== points.length - 1) return null
          return (
            <text key={i} x={p.x} y={paddingTop + chartHeight + 18} fill="#6b7280" fontSize="9" textAnchor="middle" fontFamily="Inter, monospace">
              {p.date?.slice(5)}
            </text>
          )
        })}

        {minPnl <= 0 && maxPnl >= 0 && (
          <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 4" />
        )}
        <path d={areaPath} fill={lineColor} fillOpacity="0.15" />
        <path d={pathData} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y}
            r={hoveredIndex === i ? 6 : 3}
            fill={p.cumulative_pnl >= 0 ? GREEN : RED}
            onMouseEnter={() => setHoveredIndex(i)}
            style={{ cursor: 'pointer', transition: 'r 0.1s' }}
          />
        ))}

        {/* 드래그 선택 영역 */}
        {dragStart != null && dragCurrent != null && (
          <rect
            x={Math.min(dragStart, dragCurrent)}
            y={paddingTop}
            width={Math.abs(dragCurrent - dragStart)}
            height={chartHeight}
            fill="#42a5f5"
            fillOpacity="0.15"
            stroke="#42a5f5"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        )}

        {/* 호버 툴팁 */}
        {hoveredIndex !== null && points[hoveredIndex] && (() => {
          const p = points[hoveredIndex]
          const prevPnl = hoveredIndex > 0 ? data[hoveredIndex - 1].cumulative_pnl : 0
          const change = p.cumulative_pnl - prevPnl
          const changePct = prevPnl !== 0 ? ((change / Math.abs(prevPnl)) * 100).toFixed(1) : '—'
          return (
            <g>
              <line x1={p.x} y1={paddingTop} x2={p.x} y2={paddingTop + chartHeight} stroke="#ffffff33" strokeWidth="1" strokeDasharray="3 3" />
              <rect x={p.x - 60} y={p.y - 50} width="120" height="40" fill="#0d0d1a" stroke={p.cumulative_pnl >= 0 ? GREEN : RED} strokeWidth="1" rx="6" fillOpacity="0.95" />
              <text x={p.x} y={p.y - 34} fill={p.cumulative_pnl >= 0 ? GREEN : RED} fontSize="13" textAnchor="middle" fontWeight="bold">{formatPnl(p.cumulative_pnl)}</text>
              <text x={p.x} y={p.y - 20} fill="#9e9e9e" fontSize="10" textAnchor="middle">{p.date} · {change >= 0 ? '+' : ''}{formatPnl(change)} ({changePct}%)</text>
            </g>
          )
        })()}
      </svg>
    </>
  )
}

function ModalEvChart({ data, kellyPercent, hoveredIndex, setHoveredIndex, svgRef, onMouseDown, onMouseMove, onMouseUp, dragStart, dragCurrent }) {
  if (!data || data.length === 0) return null

  const height = MODAL_CHART_HEIGHT
  const values = data.map((d) => d.ev_percent)
  const minEv = Math.min(...values, 0)
  const maxEv = Math.max(...values, 0)
  const range = maxEv - minEv || 1
  const currentEv = data[data.length - 1]?.ev_percent ?? 0
  const kellyDisplay = kellyPercent != null && !isNaN(kellyPercent) ? Math.round(kellyPercent) : 0

  const width = 1000
  const paddingRight = 30
  const paddingTop = 50
  const paddingBottom = 40
  const paddingLeft = 60
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const zeroY = paddingTop + chartHeight - ((0 - minEv) / range) * chartHeight

  const points = data.map((d, i) => {
    const x = paddingLeft + (data.length === 1 ? 0 : (i / (data.length - 1)) * chartWidth)
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
  const steps = (minEv < 0 && maxEv > 0) ? 7 : 5
  for (let i = 0; i <= steps; i++) yAxisValues.push(minEv + range * (i / steps))
  const pathData = points.length === 1
    ? `M ${points[0].x} ${zeroY} L ${points[0].x} ${points[0].y}`
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  const xLabelInterval = Math.max(1, Math.floor(data.length / 12))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', margin: 0 }}>Expected Value Curve</h3>
        <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
          <span style={{ color: currentEv >= 0 ? GREEN : RED, fontWeight: 700 }}>Current EV: {formatEvPercent(currentEv)}</span>
          <span style={{ color: '#42a5f5', fontWeight: 700 }}>Kelly: {kellyDisplay}%</span>
        </div>
      </div>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setHoveredIndex(null); onMouseUp?.() }}
        style={{ cursor: dragStart != null ? 'col-resize' : 'crosshair', userSelect: 'none' }}
      >
        {minEv < 0 && maxEv > 0 && (
          <>
            <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={zeroY - paddingTop} fill={GREEN} fillOpacity="0.08" />
            <rect x={paddingLeft} y={zeroY} width={chartWidth} height={paddingTop + chartHeight - zeroY} fill={RED} fillOpacity="0.08" />
          </>
        )}
        {minEv >= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={GREEN} fillOpacity="0.08" />}
        {maxEv <= 0 && <rect x={paddingLeft} y={paddingTop} width={chartWidth} height={chartHeight} fill={RED} fillOpacity="0.08" />}

        {yAxisValues.map((value) => {
          const y = paddingTop + chartHeight - ((value - minEv) / range) * chartHeight
          const labelColor = value > 0 ? GREEN : value < 0 ? RED : '#ffffff'
          return (
            <g key={value}>
              <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              <text x={paddingLeft - 8} y={y + 4} fill={labelColor} fontSize="11" textAnchor="end" fontFamily="Inter, monospace">{value.toFixed(1)}%</text>
            </g>
          )
        })}

        {points.map((p, i) => {
          if (i % xLabelInterval !== 0 && i !== points.length - 1) return null
          return (
            <text key={i} x={p.x} y={paddingTop + chartHeight + 18} fill="#6b7280" fontSize="9" textAnchor="middle" fontFamily="Inter, monospace">
              {p.date?.slice(5)}
            </text>
          )
        })}

        <line x1={paddingLeft} y1={zeroY} x2={width - paddingRight} y2={zeroY} stroke="#6B7280" strokeWidth="1.5" strokeDasharray="4 4" />
        <path d={areaPath} fill={lineColor} fillOpacity="0.15" />
        <path d={pathData} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i} cx={p.x} cy={p.y}
            r={hoveredIndex === i ? 6 : 3}
            fill={p.ev_percent >= 0 ? GREEN : RED}
            onMouseEnter={() => setHoveredIndex(i)}
            style={{ cursor: 'pointer', transition: 'r 0.1s' }}
          />
        ))}

        {dragStart != null && dragCurrent != null && (
          <rect
            x={Math.min(dragStart, dragCurrent)}
            y={paddingTop}
            width={Math.abs(dragCurrent - dragStart)}
            height={chartHeight}
            fill="#42a5f5"
            fillOpacity="0.15"
            stroke="#42a5f5"
            strokeWidth="1"
            strokeDasharray="4 2"
          />
        )}

        {hoveredIndex !== null && points[hoveredIndex] && (() => {
          const p = points[hoveredIndex]
          const prevEv = hoveredIndex > 0 ? data[hoveredIndex - 1].ev_percent : 0
          const change = p.ev_percent - prevEv
          return (
            <g>
              <line x1={p.x} y1={paddingTop} x2={p.x} y2={paddingTop + chartHeight} stroke="#ffffff33" strokeWidth="1" strokeDasharray="3 3" />
              <rect x={p.x - 55} y={p.y - 50} width="110" height="40" fill="#0d0d1a" stroke={p.ev_percent >= 0 ? GREEN : RED} strokeWidth="1" rx="6" fillOpacity="0.95" />
              <text x={p.x} y={p.y - 34} fill={p.ev_percent >= 0 ? GREEN : RED} fontSize="13" textAnchor="middle" fontWeight="bold">{formatEvPercent(p.ev_percent)}</text>
              <text x={p.x} y={p.y - 20} fill="#9e9e9e" fontSize="10" textAnchor="middle">{p.date} · {change >= 0 ? '+' : ''}{change.toFixed(1)}%</text>
            </g>
          )
        })()}
      </svg>
    </>
  )
}

/* ─── 확대 버튼 ──────────────────────────────────────────── */
function ExpandButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#242442', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6, padding: '3px 7px', cursor: 'pointer',
        fontSize: 13, lineHeight: 1, color: '#9e9e9e',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#2e2e4a'}
      onMouseLeave={(e) => e.currentTarget.style.background = '#242442'}
      title="확대 보기"
    >
      ⛶
    </button>
  )
}

/* ─── 메인 컴포넌트 ──────────────────────────────────────── */
export default function EquityCurveCompact({ data, evCurve = [], kellyPercent }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [hoveredEvIndex, setHoveredEvIndex] = useState(null)
  const [modalType, setModalType] = useState(null) // 'equity' | 'ev' | null

  const hasEquity = data && data.length > 0
  const hasEv = evCurve && evCurve.length > 0

  if (!hasEquity && !hasEv) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-dark-card p-5">
        <h3 className="text-[15px] font-semibold text-[#e0e0e0] mb-3">Equity Curve</h3>
        <div className="text-neutral text-center py-8 text-xs">No Data</div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-white/[0.06] bg-dark-card p-5">
        <div className="flex w-full" style={{ minHeight: CHART_HEIGHT + 56 }}>
          {/* 좌측 50%: Equity Curve */}
          <div className="flex-1 min-w-0 flex flex-col border-r border-white/[0.06] pr-2">
            {hasEquity ? (
              <EquityChart
                data={data}
                hoveredIndex={hoveredIndex}
                setHoveredIndex={setHoveredIndex}
                height={CHART_HEIGHT}
                onExpand={() => setModalType('equity')}
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
                kellyPercent={kellyPercent}
                hoveredIndex={hoveredEvIndex}
                setHoveredIndex={setHoveredEvIndex}
                height={CHART_HEIGHT}
                onExpand={() => setModalType('ev')}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-xs text-[#6B7280]">No EV data</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 확대 모달 */}
      {modalType && (
        <ChartModal
          type={modalType}
          data={data}
          evCurve={evCurve}
          kellyPercent={kellyPercent}
          onClose={() => setModalType(null)}
        />
      )}
    </>
  )
}

function EquityChart({ data, hoveredIndex, setHoveredIndex, height, onExpand }) {
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
    const x = paddingLeft + (data.length === 1 ? 0 : (i / (data.length - 1)) * chartWidth)
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
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-[#e0e0e0]">Equity Curve</h3>
          <ExpandButton onClick={onExpand} />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#9e9e9e]">
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
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
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
            <circle cx={points[hwmIndex]?.x} cy={points[hwmIndex]?.y} r="5" fill="#42a5f5" stroke="#1a1a2e" strokeWidth="2" />
          )}
          {hoveredIndex !== null && points[hoveredIndex] && (
            <g>
              <rect x={points[hoveredIndex].x - 40} y={points[hoveredIndex].y - 30} width="80" height="20" fill="#1a1a2e" stroke={points[hoveredIndex].cumulative_pnl >= 0 ? GREEN : RED} strokeWidth="1" rx="4" />
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 15} fill={points[hoveredIndex].cumulative_pnl >= 0 ? GREEN : RED} fontSize="10" textAnchor="middle" fontWeight="bold">{formatPnl(points[hoveredIndex].cumulative_pnl)}</text>
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 3} fill="#a0a0a0" fontSize="8" textAnchor="middle">{points[hoveredIndex].date}</text>
            </g>
          )}
        </svg>
      </div>
    </>
  )
}

function EvChart({ data, kellyPercent, hoveredIndex, setHoveredIndex, height, onExpand }) {
  const values = data.map((d) => d.ev_percent)
  const minEv = Math.min(...values, 0)
  const maxEv = Math.max(...values, 0)
  const range = maxEv - minEv || 1
  const currentEv = data[data.length - 1]?.ev_percent ?? 0
  const kellyDisplay = kellyPercent != null && !isNaN(kellyPercent) ? Math.round(kellyPercent) : 0

  const width = 500
  const paddingRight = 20
  const paddingTop = 30
  const paddingBottom = 30
  const paddingLeft = 40
  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom
  const zeroY = paddingTop + chartHeight - ((0 - minEv) / range) * chartHeight

  const points = data.map((d, i) => {
    const x = paddingLeft + (data.length === 1 ? 0 : (i / (data.length - 1)) * chartWidth)
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

  const pathData = points.length === 1
    ? `M ${points[0].x} ${zeroY} L ${points[0].x} ${points[0].y}`
    : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold text-[#e0e0e0]">Expected Value Curve</h3>
          <ExpandButton onClick={onExpand} />
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={currentEv >= 0 ? 'text-profit' : 'text-loss'}>Current EV: {formatEvPercent(currentEv)}</span>
          <span className="text-info">Kelly: {kellyDisplay}%</span>
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
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x={paddingLeft - 6} y={y + 3} fill={labelColor} fontSize="9" textAnchor="end">{value.toFixed(1)}%</text>
              </g>
            )
          })}
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
              <rect x={points[hoveredIndex].x - 35} y={points[hoveredIndex].y - 30} width="70" height="20" fill="#1a1a2e" stroke={points[hoveredIndex].ev_percent >= 0 ? GREEN : RED} strokeWidth="1" rx="4" />
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 15} fill={points[hoveredIndex].ev_percent >= 0 ? GREEN : RED} fontSize="10" textAnchor="middle" fontWeight="bold">{formatEvPercent(points[hoveredIndex].ev_percent)}</text>
              <text x={points[hoveredIndex].x} y={points[hoveredIndex].y - 3} fill="#a0a0a0" fontSize="8" textAnchor="middle">{points[hoveredIndex].date}</text>
            </g>
          )}
        </svg>
      </div>
    </>
  )
}
