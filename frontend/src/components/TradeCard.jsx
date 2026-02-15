import { formatPnl } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

function shortenCa(ca) {
  if (!ca) return ''
  if (ca.length <= 12) return ca
  return `${ca.slice(0, 6)}...${ca.slice(-4)}`
}

export default function TradeCard({ trade, onClick }) {
  const { showToast } = useToast()

  const handleCopyCa = (e) => {
    e.stopPropagation()
    if (trade.ca) {
      navigator.clipboard.writeText(trade.ca)
      showToast('복사됨!')
    }
  }

  const memoPreview = trade.memo
    ? trade.memo.split('\n')[0].slice(0, 50)
    : '메모 작성하기'

  return (
    <div
      onClick={() => onClick(trade)}
      className="p-4 rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#222] cursor-pointer transition-colors"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xl font-bold text-white mb-2">{trade.ticker}</div>
          <div className="flex items-center gap-2 text-sm text-[#a0a0a0] mb-2">
            <span>{trade.chain}</span>
            {trade.ca && (
              <>
                <span>|</span>
                <span className="truncate">{shortenCa(trade.ca)}</span>
                <button
                  onClick={handleCopyCa}
                  className="shrink-0 px-2 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#333] text-xs"
                >
                  📋 Copy
                </button>
              </>
            )}
          </div>
          <div className="text-sm text-[#a0a0a0]">{memoPreview}</div>
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
