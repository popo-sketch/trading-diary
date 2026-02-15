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
      showToast('저장됨!')
      onClose()
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || '저장 실패', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('이 거래를 삭제하시겠습니까?')) return
    setSaving(true)
    try {
      await onDelete()
      showToast('삭제됨!')
      onClose()
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || '삭제 실패', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleCopyCa = () => {
    if (trade.ca) {
      navigator.clipboard.writeText(trade.ca)
      showToast('복사됨!')
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
        <div
          className={`font-bold mb-4 ${
            trade.pnl >= 0 ? 'text-profit' : 'text-loss'
          }`}
        >
          PNL: {formatPnl(trade.pnl)}
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">메모</label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full h-40 px-4 py-3 rounded-lg bg-[#0f0f0f] border border-[#2a2a2a] text-white placeholder:text-neutral focus:outline-none focus:ring-2 focus:ring-accent resize-none"
          />
        </div>

        <div className="mb-4">
          <label className="block text-sm text-[#a0a0a0] mb-2">PNL 수정</label>
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
              삭제
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#2a2a2a] text-[#a0a0a0] hover:bg-[#222]"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
