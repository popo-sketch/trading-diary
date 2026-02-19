import { useState, useEffect, useMemo } from 'react'
import { formatPnl, formatDollarKMB, parseDollarInput, formatDollarInput } from '../utils/format'
import { useToast } from '../contexts/ToastContext'

const TRADE_TYPES = ['Viral', 'Cult', 'KOL / Cabal', 'Political', 'Reversal', 'AI', 'Tech', 'Animal', 'Meta', 'seed', 'ETC']

export default function TradeMemoModal({ trade, onSave, onDelete, onClose }) {
  const { showToast } = useToast()
  const [memo, setMemo] = useState('')
  const [pnl, setPnl] = useState('')
  const [returnPercent, setReturnPercent] = useState('')
  const [tradeType, setTradeType] = useState('')
  const [avgEntryMc, setAvgEntryMc] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (trade) {
      setMemo(trade.memo ?? '')
      const pnlNum = trade.pnl != null ? Number(trade.pnl) : ''
      setPnl(Number.isFinite(pnlNum) ? String(pnlNum) : '')
      const ret = trade.return_percent != null ? Number(trade.return_percent) : ''
      setReturnPercent(Number.isFinite(ret) ? String(ret) : '')
      setTradeType(trade.trade_type ?? '')
      const mc = trade.avg_entry_mc
      setAvgEntryMc(mc != null && Number.isFinite(mc) ? formatDollarInput(mc) : '')
    }
  }, [trade])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const pnlNum = useMemo(() => (pnl === '' ? null : Number(pnl)), [pnl])
  const returnNum = useMemo(() => (returnPercent === '' ? null : Number(returnPercent)), [returnPercent])

  const calculatedEntryAmount = useMemo(() => {
    if (pnlNum == null || returnNum == null || returnNum === 0) return null
    let norm = returnNum
    if ((pnlNum > 0 && returnNum < 0) || (pnlNum < 0 && returnNum > 0)) norm = -Math.abs(returnNum)
    const entry = pnlNum / (norm / 100)
    return entry > 0 ? entry : null
  }, [pnlNum, returnNum])

  const avgEntryMcNum = parseDollarInput(avgEntryMc)
  const exitEntryMc =
    avgEntryMcNum != null && returnNum != null && Number.isFinite(returnNum)
      ? avgEntryMcNum * (1 + returnNum / 100)
      : null

  if (!trade) return null

  const handleSave = async () => {
    if (pnl === '' || returnPercent === '') {
      showToast('Edit PnL ($) and Edit Return (%) are required', 'error')
      return
    }
    const p = Number(pnl)
    const r = Number(returnPercent)
    if (!Number.isFinite(p) || !Number.isFinite(r)) {
      showToast('PnL and Return % must be numbers', 'error')
      return
    }
    if (r === 0) {
      showToast('Return % cannot be 0', 'error')
      return
    }
    setSaving(true)
    try {
      await onSave({
        memo,
        pnl: p,
        return_percent: r,
        trade_type: tradeType || null,
        avg_entry_mc: avgEntryMcNum ?? null,
      })
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

  const handleCopyCa = async (e) => {
    e?.stopPropagation?.()
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

  const displayPnl = pnlNum != null && Number.isFinite(pnlNum) ? pnlNum : trade.pnl
  const displayReturn = returnNum != null && Number.isFinite(returnNum) ? returnNum : trade.return_percent
  const displayEntry = calculatedEntryAmount ?? trade.entry_amount

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-xl"
      >
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold text-white">{trade.ticker}</h2>
          {trade.chain && (
            <span className="px-2 py-0.5 rounded bg-[#2a2a2a] text-xs text-[#a0a0a0]">
              {trade.chain}
            </span>
          )}
          {trade.ca && (
            <button
              type="button"
              onClick={handleCopyCa}
              className="shrink-0 text-lg hover:opacity-70 transition-opacity"
              title="Copy CA"
            >
              ❐
            </button>
          )}
        </div>

        <div className="space-y-2 mb-4">
          <div className={`font-bold ${displayPnl >= 0 ? 'text-profit' : 'text-loss'}`}>
            PnL: {formatPnl(displayPnl)}
          </div>
          {displayEntry != null && (
            <div className="text-sm text-[#a0a0a0]">
              Entry Amount: {formatPnl(displayEntry)}
            </div>
          )}
          {displayReturn != null && displayReturn !== undefined && (
            <div className={`text-sm ${displayReturn >= 0 ? 'text-profit' : 'text-loss'}`}>
              Return: {displayReturn >= 0 ? '+' : ''}{Number(displayReturn).toFixed(2)}%
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">Trade Type</label>
          <select
            value={tradeType}
            onChange={(e) => setTradeType(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white focus:outline-none focus:ring-2 focus:ring-accent"
          >
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">Memo</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="📝 Add Memo"
            className="w-full h-32 px-4 py-3 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-[#6B7280] placeholder:text-center placeholder:italic focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-2">
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Edit PnL ($)</label>
            <input
              type="number"
              step="0.01"
              value={pnl}
              onChange={(e) => setPnl(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Edit Return (%)</label>
            <input
              type="number"
              step="0.01"
              value={returnPercent}
              onChange={(e) => setReturnPercent(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">Calculated Entry Amount</label>
          <input
            type="text"
            readOnly
            value={calculatedEntryAmount != null ? formatPnl(calculatedEntryAmount) : '—'}
            className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white opacity-70 cursor-not-allowed"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Edit Avg. Entry MC ($)</label>
            <input
              type="text"
              inputMode="numeric"
              value={avgEntryMc}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[^0-9]/g, '')
                setAvgEntryMc(cleaned === '' ? '' : formatDollarInput(parseInt(cleaned, 10)))
              }}
              placeholder="0"
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-neutral focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Exit Entry MC</label>
            <input
              type="text"
              readOnly
              value={exitEntryMc != null ? formatDollarKMB(exitEntryMc) : '—'}
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white opacity-70 cursor-not-allowed"
            />
          </div>
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
