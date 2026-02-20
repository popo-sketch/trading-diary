import { useState, useEffect } from 'react'
import { useToast } from '../contexts/ToastContext'
import { formatDollarKMB, parseDollarInput, formatDollarInput } from '../utils/format'

const CHAINS = ['Solana', 'Base', 'Bnb', 'etc']
const TRADE_TYPES = ['Viral', 'Cult', 'KOL / Cabal', 'Political', 'Reversal', 'AI', 'Tech', 'Animal', 'Meta', 'seed', 'ETC']

export default function AddTradeModal({ defaultDate, dateLocked, onCreated, onClose }) {
  const { showToast } = useToast()
  const [date, setDate] = useState(defaultDate ?? '')
  const [ticker, setTicker] = useState('')
  const [chain, setChain] = useState('Solana')
  const [ca, setCa] = useState('')
  const [pnl, setPnl] = useState('')
  const [memo, setMemo] = useState('')
  const [returnPercent, setReturnPercent] = useState('')
  const [tradeType, setTradeType] = useState('')
  const [avgEntryMc, setAvgEntryMc] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      onClose()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Entry Amount 자동 계산: entry_amount = pnl / (return_percent / 100)
  const avgEntryMcNum = parseDollarInput(avgEntryMc)
  const exitEntryMc = (avgEntryMcNum != null && returnPercent !== '' && !isNaN(Number(returnPercent)))
    ? avgEntryMcNum * (1 + Number(returnPercent) / 100)
    : null

  const calculatedEntryAmount = (() => {
    const pnlNum = Number(pnl)
    const returnNum = Number(returnPercent)
    
    if (pnl && returnPercent && !isNaN(pnlNum) && !isNaN(returnNum) && returnNum !== 0) {
      // 부호 일치: pnl과 return_percent의 부호가 다르면 return_percent 부호를 pnl에 맞춤
      let normalizedReturn = returnNum
      if ((pnlNum > 0 && returnNum < 0) || (pnlNum < 0 && returnNum > 0)) {
        normalizedReturn = -Math.abs(returnNum)
      }
      
      const entry = pnlNum / (normalizedReturn / 100)
      return entry > 0 ? entry.toFixed(2) : ''
    }
    return ''
  })()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!date || !ticker) {
      showToast('Date and Ticker are required', 'error')
      return
    }

    // PnL과 Return% 모두 필수
    if (!pnl || !returnPercent) {
      showToast('PnL ($) and PnL (%) are required', 'error')
      return
    }

    const pnlNum = Number(pnl)
    const returnNum = Number(returnPercent)

    if (isNaN(pnlNum) || !Number.isFinite(pnlNum)) {
      showToast('PNL must be a number', 'error')
      return
    }

    if (isNaN(returnNum) || !Number.isFinite(returnNum)) {
      showToast('PnL % must be a number', 'error')
      return
    }

    // return_percent는 0이 될 수 없음
    if (returnNum === 0) {
      showToast('PnL % cannot be 0', 'error')
      return
    }

    // 부호 일치: pnl과 return_percent의 부호가 다르면 return_percent 부호를 pnl에 맞춤
    let normalizedReturn = returnNum
    if ((pnlNum > 0 && returnNum < 0) || (pnlNum < 0 && returnNum > 0)) {
      normalizedReturn = -Math.abs(returnNum)
    }

    setLoading(true)
    try {
      await onCreated({
        date,
        ticker: ticker.startsWith('$') ? ticker : `$${ticker}`,
        chain,
        ca: ca || null,
        pnl: pnlNum,
        memo: memo || null,
        return_percent: normalizedReturn,
        trade_type: tradeType || null,
        avg_entry_mc: avgEntryMcNum ?? null,
      })
      showToast('Trade added successfully')
      onClose()
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || 'Failed to add', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] p-6 shadow-xl">
        <h2 className="text-xl font-bold text-white mb-4">Trading History</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              readOnly={dateLocked}
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              placeholder="name"
              required
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-neutral focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
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
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Chain</label>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {CHAINS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">CA</label>
            <input
              type="text"
              value={ca}
              onChange={(e) => setCa(e.target.value)}
              placeholder="Contract Address"
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-neutral focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0a0] mb-2">PnL ($) *</label>
              <input
                type="number"
                step="0.01"
                value={pnl}
                onChange={(e) => setPnl(e.target.value)}
                required
                placeholder="0"
                className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-neutral focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm text-[#a0a0a0] mb-2">PnL (%) *</label>
              <input
                type="number"
                step="0.01"
                value={returnPercent}
                onChange={(e) => setReturnPercent(e.target.value)}
                required
                placeholder="0"
                className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-neutral focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Calculated Entry Amount</label>
            <input
              type="text"
              value={calculatedEntryAmount || '—'}
              readOnly
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white opacity-70 cursor-not-allowed"
            />
            <p className="text-xs text-[#6B7280] mt-1">
              {calculatedEntryAmount 
                ? `Entry = ${pnl} / (${returnPercent}% / 100) = ${calculatedEntryAmount}` 
                : 'Auto-calculated from PnL and PnL %'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[#a0a0a0] mb-2">Avg. Entry MC ($)</label>
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
              <label className="block text-sm text-[#a0a0a0] mb-2">Avg. Exit MC</label>
              <input
                type="text"
                readOnly
                value={exitEntryMc != null ? formatDollarKMB(exitEntryMc) : '—'}
                className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white opacity-70 cursor-not-allowed"
              />
              <p className="text-xs text-[#6B7280] mt-1">Avg. Entry MC × (1 + PnL% / 100)</p>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#a0a0a0] mb-2">Memo</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-neutral focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#222]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
