import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getTradesByDate, createTrade, updateTrade, deleteTrade } from '../api/trades'
import { formatPnl, formatDateKo, formatMonthKst } from '../utils/format'
import TradeCard from '../components/TradeCard'
import TradeMemoModal from '../components/TradeMemoModal'
import AddTradeModal from '../components/AddTradeModal'

export default function DailyPage() {
  const { date } = useParams()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  const year = date ? parseInt(date.slice(0, 4), 10) : 0
  const month = date ? parseInt(date.slice(5, 7), 10) : 0

  useEffect(() => {
    if (!date) return
    setLoading(true)
    setError(null)
    getTradesByDate(date)
      .then(setTrades)
      .catch((err) => {
        const detail = err?.response?.data?.detail
        const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) ? detail.map((d) => d.msg).join(', ') : null)
        setError(msg || err?.message || '로딩 실패')
      })
      .finally(() => setLoading(false))
  }, [date])

  const dailyPnl = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0)
  const wins = trades.filter((t) => t.pnl > 0).length
  const losses = trades.filter((t) => t.pnl < 0).length
  const summary = `${formatPnl(dailyPnl)} (${wins}W - ${losses}L)`

  const handleSaveMemo = async ({ memo, pnl }) => {
    if (!selectedTrade) return
    const updated = await updateTrade(selectedTrade.id, { memo, pnl })
    setTrades((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    )
    setSelectedTrade(updated)
  }

  const handleDeleteTrade = async () => {
    if (!selectedTrade) return
    await deleteTrade(selectedTrade.id)
    setTrades((prev) => prev.filter((t) => t.id !== selectedTrade.id))
    setSelectedTrade(null)
  }

  const handleAddTrade = async (payload) => {
    const created = await createTrade({ ...payload, date }) // 일별 페이지에서는 해당 날짜로 고정
    setTrades((prev) => [...prev, created])
    setShowAddModal(false)
  }

  if (!date) {
    return <div className="p-8 text-white">Invalid date</div>
  }

  return (
    <div className="min-h-screen p-8">
      <Link
        to="/"
        className="text-accent hover:underline mb-4 inline-block cursor-pointer"
      >
        ← Back to {formatMonthKst(year, month)}
      </Link>

      <h1 className="text-2xl font-bold text-white mb-2">
        {formatDateKo(date)}
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
        + 거래 추가하기
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
