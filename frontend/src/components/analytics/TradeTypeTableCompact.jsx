import { formatPnl } from '../../utils/format'

function kellyPercent(winRatePct, avgWinPct, avgLossPct) {
  if (avgWinPct <= 0) return 0
  const p = winRatePct / 100
  const q = 1 - p
  const k = (p * avgWinPct - q * Math.abs(avgLossPct)) / avgWinPct
  return k <= 0 ? 0 : k * 100
}

function WinRateBar({ rate }) {
  const color = rate >= 50 ? '#00c853' : '#ff1744'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <span style={{ fontSize: 13, color: '#e0e0e0', fontVariantNumeric: 'tabular-nums' }}>{rate.toFixed(1)}%</span>
      <div style={{ width: '60%', maxWidth: 50, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${Math.min(rate, 100)}%`, height: '100%', borderRadius: 3, background: color, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function pnlHeatmapBg(pnl, maxAbsPnl) {
  if (!maxAbsPnl || maxAbsPnl === 0) return 'transparent'
  const ratio = Math.min(Math.abs(pnl) / maxAbsPnl, 1)
  const alpha = 0.05 + ratio * 0.15
  if (pnl >= 0) return `rgba(0,200,83,${alpha.toFixed(2)})`
  return `rgba(255,23,68,${alpha.toFixed(2)})`
}

const CARD = { background: '#1a1a2e', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: 20, height: '100%', display: 'flex', flexDirection: 'column' }
const TH = { fontSize: 12, color: '#9e9e9e', padding: '8px 6px', fontWeight: 500 }
const TD = { fontSize: 13, color: '#e0e0e0', padding: '8px 6px' }

export default function TradeTypeTableCompact({ stats }) {
  if (stats.length === 0) {
    return (
      <div style={CARD}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 }}>Trade Type Analysis</h3>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9e9e9e', fontSize: 13 }}>No Data</div>
      </div>
    )
  }

  const sortedStats = [...stats].sort((a, b) => (b.total_pnl ?? 0) - (a.total_pnl ?? 0))
  const maxAbsPnl = Math.max(...sortedStats.map((s) => Math.abs(s.total_pnl || 0)), 1)

  return (
    <div style={CARD}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 12 }}>Trade Type Analysis</h3>
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ ...TH, textAlign: 'left' }}>Trade Type</th>
              <th style={{ ...TH, textAlign: 'right' }}>Trades</th>
              <th style={{ ...TH, textAlign: 'right' }}>Win%</th>
              <th style={{ ...TH, textAlign: 'right' }}>Avg Win%</th>
              <th style={{ ...TH, textAlign: 'right' }}>Avg Loss%</th>
              <th style={{ ...TH, textAlign: 'right' }}>EV%</th>
              <th style={{ ...TH, textAlign: 'right' }}>Kelly%</th>
              <th style={{ ...TH, textAlign: 'right' }}>Total PnL$</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((stat, i) => {
              const avgWin = stat.avg_win_percent ?? 0
              const avgLoss = stat.avg_loss_percent ?? 0
              const kelly = kellyPercent(stat.win_rate, avgWin, avgLoss)
              const pnlBg = pnlHeatmapBg(stat.total_pnl, maxAbsPnl)
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#242442'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ ...TD, fontWeight: 600, whiteSpace: 'nowrap' }}>{stat.trade_type}</td>
                  <td style={{ ...TD, textAlign: 'right' }}>{stat.trades}</td>
                  <td style={{ ...TD, textAlign: 'right', padding: '8px 6px' }}>
                    <WinRateBar rate={stat.win_rate} />
                  </td>
                  <td style={{ ...TD, textAlign: 'right', color: '#00c853' }}>{avgWin.toFixed(1)}%</td>
                  <td style={{ ...TD, textAlign: 'right', color: '#ff1744' }}>{Math.abs(avgLoss).toFixed(1)}%</td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: stat.ev_percent >= 0 ? '#00c853' : '#ff1744' }}>
                    {stat.ev_percent.toFixed(1)}%
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: '#42a5f5' }}>
                    {kelly.toFixed(0)}%
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: stat.total_pnl >= 0 ? '#00c853' : '#ff1744', background: pnlBg, borderRadius: 4 }}>
                    {formatPnl(stat.total_pnl)}
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
