import { useState, useEffect } from 'react'
import { formatPnl } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

export default function TradeMemoModal({ trade, onSave, onDelete, onClose }) {
  const { showToast } = useToast()
  const [memo, setMemo] = useState('')
  const [pnl, setPnl] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (trade) {
      setMemo(trade.memo ?? '')
      const pnlNum = trade.pnl != null ? Number(trade.pnl) : 0
      setPnl(Number.isFinite(pnlNum) ? pnlNum : 0)
    }
  }, [trade])

  if (!trade) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ memo, pnl })
      showToast('Saved!')
      onClose()
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this trade?')) return
    setSaving(true)
    try {
      await onDelete()
      showToast('Deleted!')
      onClose()
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || 'Failed to delete', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyCa = () => {
    if (trade.ca) {
      navigator.clipboard.writeText(trade.ca)
      showToast('Copied!')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-white mb-4">{trade.ticker}</h2>
        <div className="flex items-center gap-2 text-sm text-[#a0a0a0] mb-2">
          <span>{trade.chain}</span>
          {trade.ca && (
            <>
              <span>|</span>
              <span className="truncate">{trade.ca}</span>
              <button
                onClick={handleCopyCa}
                className="shrink-0 px-2 py-0.5 rounded bg-[#2a2a2a] hover:bg-[#333] text-xs"
              >
                📋 Copy
              </button>
            </>
          )}
        </div>
        <div className="space-y-2 mb-4">
          <div
            className={`font-bold ${
              trade.pnl >= 0 ? 'text-profit' : 'text-loss'
            }`}
          >
            PNL: {formatPnl(trade.pnl)}
          </div>
          {trade.entry_amount && (
            <div className="text-sm text-[#a0a0a0]">
              Entry Amount: {formatPnl(trade.entry_amount)}
            </div>
          )}
          {trade.return_percent !== null && trade.return_percent !== undefined && (
            <div className={`text-sm ${trade.return_percent >= 0 ? 'text-profit' : 'text-loss'}`}>
              Return: {trade.return_percent >= 0 ? '+' : ''}{trade.return_percent.toFixed(2)}%
            </div>
          )}
          {trade.trade_type && (
            <div className="text-sm text-[#a0a0a0]">
              Trade Type: <span className="text-white">{trade.trade_type}</span>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">Memo</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="📝 Add Memo"
            className="w-full h-40 px-4 py-3 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-[#6B7280] placeholder:text-center placeholder:italic focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">Edit PNL</label>
          <input
            type="number"
            value={pnl}
            onChange={(e) => setPnl(Number(e.target.value))}
            className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex gap-3 justify-between">
          {onDelete ? (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-loss text-loss hover:bg-loss/10 disabled:opacity-50"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#222]"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
