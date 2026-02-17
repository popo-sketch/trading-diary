import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTradesByDate, createTrade, updateTrade, deleteTrade } from '../api/trades'
import { formatPnl, formatDateEn } from '../utils/format'
import { useToast } from '../contexts/ToastContext'
import TradeCard from '../components/TradeCard'
import TradeMemoModal from '../components/TradeMemoModal'
import AddTradeModal from '../components/AddTradeModal'

export default function DailyPage() {
  const { date } = useParams()
  const { showToast } = useToast()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setError(null)
    getTradesByDate(date)
      .then(setTrades)
      .catch((err) => {
        const detail = err?.response?.data?.detail
        const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
        setError(msg || err?.message || 'Failed to load')
      })
      .finally(() => setLoading(false))
  }, [date])

  const dailyPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0)
  const wins = trades.filter((t) => t.pnl > 0).length
  const losses = trades.filter((t) => t.pnl < 0).length
  const summary = `${formatPnl(dailyPnl)} (${wins}W - ${losses}L)`

  const handleSaveMemo = async (payload) => {
    if (!selectedTrade) return
    try {
      const updated = await updateTrade(selectedTrade.id, payload)
      setTrades((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      )
      setSelectedTrade(updated)
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || 'Failed to save', 'error')
    }
  }

  const handleDeleteTrade = async () => {
    if (!selectedTrade) return
    try {
      await deleteTrade(selectedTrade.id)
      setTrades((prev) => prev.filter((t) => t.id !== selectedTrade.id))
      setSelectedTrade(null)
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || 'Failed to delete', 'error')
    }
  }

  const handleAddTrade = async (payload) => {
    try {
      const created = await createTrade({ ...payload, date })
      setTrades((prev) => [...prev, created])
      setShowAddModal(false)
    } catch (err) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
      showToast(msg || err?.message || 'Failed to add trade', 'error')
    }
  }

  if (!date) {
    return <div className="p-8 text-white">Invalid date</div>
  }

  return (
    <div className="min-h-screen p-8">
      <Link
        to="/"
        className="mb-4 inline-block cursor-pointer p-2 rounded-lg hover:bg-[#222] transition-colors"
      >
        <span className="text-2xl text-white">←</span>
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">
        {formatDateEn(date)}
      </h1>
      <div
        className={`text-lg font-bold mb-6 ${
          dailyPnl >= 0 ? 'text-profit' : 'text-loss'
        }`}
      >
        Daily Summary: {summary}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-loss/20 text-loss border border-loss/50">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4 mb-8">
          {trades.map((trade) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              onClick={() => setSelectedTrade(trade)}
            />
          ))}
        </div>
      )}

      <button
        onClick={() => setShowAddModal(true)}
        className="px-4 py-2 rounded-lg bg-accent text-white hover:bg-accent/90 cursor-pointer"
      >
        + Add Coin
      </button>

      {selectedTrade && (
        <TradeMemoModal
          trade={selectedTrade}
          onSave={handleSaveMemo}
          onDelete={handleDeleteTrade}
          onClose={() => setSelectedTrade(null)}
        />
      )}

      {showAddModal && (
        <AddTradeModal
          defaultDate={date}
          dateLocked
          onCreated={handleAddTrade}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  )
}
