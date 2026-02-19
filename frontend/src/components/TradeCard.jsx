import { formatPnl, formatDollarKMB } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

function shortenCa(ca) {
  if (!ca) return ''
  if (ca.length <= 12) return ca
  return `${ca.slice(0, 6)}...${ca.slice(-4)}`
}

export default function TradeCard({ trade, onClick }) {
  const { showToast } = useToast()

  const handleCopyCa = async (e) => {
    e.stopPropagation()
    if (!trade.ca) return
    
    // Modern clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(trade.ca)
        showToast('Copied!')
        return
      } catch (err) {
        console.warn('Clipboard API failed, trying fallback:', err)
      }
    }
    
    // Fallback: use textarea method
    try {
      const textarea = document.createElement('textarea')
      textarea.value = trade.ca
      textarea.style.position = 'fixed'
      textarea.style.left = '-999999px'
      textarea.style.top = '-999999px'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      const successful = document.execCommand('copy')
      document.body.removeChild(textarea)
      
      if (successful) {
        showToast('Copied!')
      } else {
        showToast('Failed to copy', 'error')
      }
    } catch (err) {
      console.error('Copy failed:', err)
      showToast('Failed to copy', 'error')
    }
  }

  const memoLines = trade.memo ? trade.memo.split('\n').filter(line => line.trim()) : []
  const memoPreview = memoLines.length > 0
    ? memoLines.slice(0, 5).join('\n') + (memoLines.length > 5 ? '...' : '')
    : null

  return (
    <div
      onClick={() => onClick(trade)}
      className="p-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#222] cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-xl font-bold text-white">{trade.ticker}</div>
            {trade.chain && (
              <span className="px-2 py-0.5 rounded bg-[#2a2a2a] text-xs text-[#a0a0a0]">
                {trade.chain}
              </span>
            )}
            {trade.ca && (
              <button
                onClick={handleCopyCa}
                className="shrink-0 text-lg hover:opacity-70 transition-opacity"
                title="Copy CA"
              >
                ❐
              </button>
            )}
          </div>
          <div className={`text-sm mb-2 ${memoPreview ? 'text-[#a0a0a0] whitespace-pre-line line-clamp-5' : 'text-[#6B7280] text-center italic'}`}>
            {memoPreview || '📝 Add Memo'}
          </div>
          {(trade.entry_amount || trade.return_percent || trade.trade_type) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] mt-2">
              {trade.entry_amount && (
                <span>Entry: {formatPnl(trade.entry_amount)}</span>
              )}
              {trade.return_percent !== null && trade.return_percent !== undefined && (
                <span className={trade.return_percent >= 0 ? 'text-profit' : 'text-loss'}>
                  Return: {trade.return_percent >= 0 ? '+' : ''}{trade.return_percent.toFixed(2)}%
                </span>
              )}
              {trade.trade_type && (
                <span className="px-2 py-0.5 rounded bg-[#2a2a2a] text-[#a0a0a0]">
                  {trade.trade_type}
                </span>
              )}
            </div>
          )}
          {trade.avg_entry_mc != null && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0 text-xs text-[#6B7280] mt-1">
              <span>Avg. Entry: {formatDollarKMB(trade.avg_entry_mc)}</span>
              {trade.return_percent != null && (
                <span>Exit Entry: {formatDollarKMB(trade.avg_entry_mc * (1 + trade.return_percent / 100))}</span>
              )}
            </div>
          )}
        </div>
        <div
          className={`flex items-center gap-2 font-bold shrink-0 ${
            trade.pnl >= 0 ? 'text-profit' : 'text-loss'
          }`}
        >
          {trade.pnl >= 0 ? '✓' : '✗'}{' '}
          {formatPnl(trade.pnl)}
        </div>
      </div>
    </div>
  )
}
