/**
 * TradeSidePanel.jsx — 날짜별 트레이드 상세 사이드 패널
 *
 * 달력 날짜 클릭 → 오른쪽 슬라이드인 패널
 * 트레이드 카드 (편집/삭제), 새 매매 등록
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { formatPnl, formatDollarKMB, parseDollarInput, formatDollarInput } from '../utils/format'
import { createTrade, updateTrade, deleteTrade } from '../api/trades'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']
const CHAINS = ['Solana', 'Base', 'Bnb', 'etc']
const TRADE_TYPES = ['Viral', 'Cult', 'KOL / Cabal', 'Political', 'Reversal', 'AI', 'Tech', 'Animal', 'Meta', 'seed', 'Elon', 'CZ', 'HeYi', 'Trump', 'Binance', 'ETC']

function formatDateKr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dayName = DAY_NAMES[d.getDay()]
  return `${y}년 ${m}월 ${day}일 (${dayName})`
}

function formatMcap(value) {
  if (value == null) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

function solBadgeStyle() {
  return {
    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
    background: 'linear-gradient(90deg, #9945FF, #14F195)',
    color: '#ffffff', fontFamily: 'Inter, monospace',
  }
}

function bscBadgeStyle() {
  return {
    fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
    background: 'rgba(243,186,47,0.15)', color: '#f3ba2f',
    fontFamily: 'Inter, monospace',
  }
}

function chainBadge(chain) {
  if (!chain) return null
  if (chain === 'Solana') return <span style={solBadgeStyle()}>SOL</span>
  if (chain === 'BNB' || chain === 'BSC' || chain === 'Bnb') return <span style={bscBadgeStyle()}>BSC</span>
  return <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#9e9e9e', fontFamily: 'Inter, monospace' }}>{chain}</span>
}

/* ─── PnL comma formatter ─────────────────────────────── */
function handlePnlInput(raw) {
  const isNeg = raw.startsWith('-')
  const stripped = raw.replace(/[^0-9.]/g, '')
  if (stripped === '') return isNeg ? '-' : ''
  const parts = stripped.split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return isNeg ? '-' + parts.join('.') : parts.join('.')
}
function parsePnlNum(v) { return Number(String(v).replace(/,/g, '')) }

/* ─── 요약 미니 카드 ──────────────────────────────────────── */
function SummaryCards({ trades }) {
  const total = trades.length
  const wins = trades.filter((t) => t.pnl > 0).length
  const winRate = total > 0 ? ((wins / total) * 100).toFixed(0) : '0'
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const maxWin = trades.length > 0 ? Math.max(...trades.map((t) => t.pnl)) : 0
  const maxLoss = trades.length > 0 ? Math.min(...trades.map((t) => t.pnl)) : 0

  const items = [
    { label: 'Trades', value: total, color: '#e0e0e0' },
    { label: 'Win Rate', value: `${winRate}%`, color: Number(winRate) >= 50 ? '#00c853' : '#ff1744' },
    { label: 'Total PnL', value: formatPnl(totalPnl), color: totalPnl >= 0 ? '#00c853' : '#ff1744' },
    { label: 'Best', value: formatPnl(maxWin), color: '#00c853' },
    { label: 'Worst', value: formatPnl(maxLoss), color: '#ff1744' },
  ]

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {items.map((item) => (
        <div key={item.label} style={{
          flex: 1, background: '#1a1a2e', borderRadius: 8, padding: '8px 10px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: 9, color: '#6b7280', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: 'Inter, monospace' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ─── 새 매매 등록 폼 ───────────────────────────────────── */
function AddTradeForm({ dateStr, onCreated, onCancel }) {
  const [ticker, setTicker] = useState('')
  const [chain, setChain] = useState('Solana')
  const [ca, setCa] = useState('')
  const [pnl, setPnl] = useState('')
  const [returnPercent, setReturnPercent] = useState('')
  const [tradeType, setTradeType] = useState('')
  const [avgEntryMc, setAvgEntryMc] = useState('')
  const [isMine, setIsMine] = useState(false)
  const [tradeStyle, setTradeStyle] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const pnlNum = parsePnlNum(pnl)
  const returnNum = Number(returnPercent)

  const handleSubmit = async () => {
    if (!ticker) { setError('종목명을 입력하세요'); return }
    if (!pnl || pnl === '-' || !returnPercent) { setError('PnL ($)과 PnL (%)을 입력하세요'); return }
    if (isNaN(pnlNum) || !Number.isFinite(pnlNum)) { setError('PnL이 올바르지 않습니다'); return }
    if (isNaN(returnNum) || !Number.isFinite(returnNum) || returnNum === 0) { setError('PnL %가 올바르지 않습니다'); return }

    let normalizedReturn = returnNum
    if ((pnlNum > 0 && returnNum < 0) || (pnlNum < 0 && returnNum > 0)) normalizedReturn = -Math.abs(returnNum)

    setLoading(true)
    setError(null)
    try {
      const entryAmtNum = parsePnlNum(entryAmount)
      await onCreated({
        date: dateStr,
        ticker: ticker.startsWith('$') ? ticker : `$${ticker}`,
        chain,
        ca: ca || null,
        pnl: pnlNum,
        memo: memo || null,
        return_percent: normalizedReturn,
        trade_type: tradeType || null,
        avg_entry_mc: parseDollarInput(avgEntryMc) ?? null,
        is_mine: isMine,
        trade_style: tradeStyle || null,
        entry_amount: (entryAmount && !isNaN(entryAmtNum) && entryAmtNum > 0) ? entryAmtNum : null,
      })
    } catch (e) {
      setError(e?.message || '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  const INP = {
    width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 12,
    background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)',
    color: '#e0e0e0', outline: 'none', fontFamily: 'Inter, monospace',
    boxSizing: 'border-box',
  }
  const LABEL = { fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }

  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12, padding: 16,
      border: '1px solid #42a5f540',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', marginBottom: 12, fontFamily: 'Inter, monospace' }}>
        + 새 매매 등록
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 종목명 + 체인 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 2 }}>
            <div style={LABEL}>종목명 *</div>
            <input value={ticker} onChange={e => setTicker(e.target.value)} placeholder="$TOKEN" style={INP} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={LABEL}>체인</div>
            <select value={chain} onChange={e => setChain(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
              {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* CA */}
        <div>
          <div style={LABEL}>CA</div>
          <input value={ca} onChange={e => setCa(e.target.value)} placeholder="Contract Address" style={INP} />
        </div>

        {/* 카테고리 + 매매스타일 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={LABEL}>카테고리</div>
            <select value={tradeType} onChange={e => setTradeType(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
              <option value="">— 선택 —</option>
              {TRADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={LABEL}>매매 스타일</div>
            <select value={tradeStyle} onChange={e => setTradeStyle(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
              <option value="">— 선택 —</option>
              <option value="계획매매">계획매매</option>
              <option value="뇌동매매">뇌동매매</option>
            </select>
          </div>
        </div>

        {/* 지뢰플레이 */}
        <div>
          <button type="button" onClick={() => setIsMine(!isMine)} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            border: isMine ? '1px solid #ff174450' : '1px solid rgba(255,255,255,0.08)',
            background: isMine ? 'rgba(255,23,68,0.1)' : 'transparent',
            color: isMine ? '#ff1744' : '#6b7280', fontFamily: 'Inter, monospace',
          }}>
            {isMine ? '💣 지뢰 ON' : '지뢰 OFF'}
          </button>
        </div>

        {/* PnL + Return% */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={LABEL}>PnL ($) *</div>
            <input value={pnl} onChange={e => setPnl(handlePnlInput(e.target.value))} placeholder="0" style={INP} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={LABEL}>PnL (%) *</div>
            <input type="number" step="0.01" value={returnPercent} onChange={e => setReturnPercent(e.target.value)} placeholder="0" style={INP} />
          </div>
        </div>

        {/* Entry Amount */}
        <div>
          <div style={LABEL}>Entry Amount ($)</div>
          <input value={entryAmount} onChange={e => {
            const raw = e.target.value
            const stripped = raw.replace(/[^0-9.]/g, '')
            if (stripped === '') { setEntryAmount(''); return }
            const parts = stripped.split('.')
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            setEntryAmount(parts.join('.'))
          }} placeholder="0" style={INP} />
        </div>

        {/* Avg Entry MC */}
        <div>
          <div style={LABEL}>Avg. Entry MC ($)</div>
          <input value={avgEntryMc} onChange={e => {
            const cleaned = e.target.value.replace(/[^0-9]/g, '')
            setAvgEntryMc(cleaned === '' ? '' : formatDollarInput(parseInt(cleaned, 10)))
          }} placeholder="0" style={INP} />
        </div>

        {/* 메모 */}
        <div>
          <div style={LABEL}>메모</div>
          <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} placeholder="트레이드 복기..." style={{
            ...INP, resize: 'vertical', fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.7,
          }} />
        </div>

        {error && <div style={{ fontSize: 11, color: '#ff1744', lineHeight: 1.7 }}>{error}</div>}

        {/* 버튼 */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
            background: 'transparent', color: '#9e9e9e', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, monospace',
          }}>취소</button>
          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#42a5f5', color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            fontFamily: 'Inter, monospace',
          }}>{loading ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

/* ─── 삭제 확인 모달 ─────────────────────────────────────── */
function DeleteConfirmModal({ trade, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1a1a2e', borderRadius: 16,
        border: '1px solid #ff174430', padding: 24,
        maxWidth: 360, width: '90%', textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', marginBottom: 8, fontFamily: 'Inter, monospace' }}>
          이 매매 기록을 삭제하시겠습니까?
        </div>
        <div style={{ fontSize: 12, color: '#9e9e9e', marginBottom: 16, lineHeight: 1.7 }}>
          {trade.ticker} ({formatPnl(Number(trade.pnl || 0))}) — 삭제하면 복구할 수 없습니다.
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{
            padding: '8px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: '#9e9e9e', fontSize: 12, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, monospace',
          }}>취소</button>
          <button onClick={onConfirm} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: '#ff1744', color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'Inter, monospace',
          }}>삭제</button>
        </div>
      </div>
    </div>
  )
}

/* ─── 트레이드 카드 (읽기 + 편집 모드) ─────────────────── */
function TradeCard({ trade, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit state
  const [ticker, setTicker] = useState(trade.ticker || '')
  const [chain, setChain] = useState(trade.chain || 'Solana')
  const [ca, setCa] = useState(trade.ca || '')
  const [pnl, setPnl] = useState(String(trade.pnl || 0))
  const [returnPercent, setReturnPercent] = useState(String(trade.return_percent || 0))
  const [tradeType, setTradeType] = useState(trade.trade_type || '')
  const [avgEntryMc, setAvgEntryMc] = useState(trade.avg_entry_mc ? formatDollarInput(trade.avg_entry_mc) : '')
  const [isMine, setIsMine] = useState(trade.is_mine || false)
  const [tradeStyle, setTradeStyle] = useState(trade.trade_style || '')
  const [entryAmount, setEntryAmount] = useState(trade.entry_amount ? String(Math.round(trade.entry_amount)) : '')
  const [memo, setMemo] = useState(trade.memo || '')

  const resetEdit = () => {
    setTicker(trade.ticker || '')
    setChain(trade.chain || 'Solana')
    setCa(trade.ca || '')
    setPnl(String(trade.pnl || 0))
    setReturnPercent(String(trade.return_percent || 0))
    setTradeType(trade.trade_type || '')
    setAvgEntryMc(trade.avg_entry_mc ? formatDollarInput(trade.avg_entry_mc) : '')
    setIsMine(trade.is_mine || false)
    setTradeStyle(trade.trade_style || '')
    setEntryAmount(trade.entry_amount ? String(Math.round(trade.entry_amount)) : '')
    setMemo(trade.memo || '')
    setEditing(false)
  }

  const handleSave = async () => {
    const pnlNum = parsePnlNum(pnl)
    const returnNum = Number(returnPercent)
    let normalizedReturn = returnNum
    if ((pnlNum > 0 && returnNum < 0) || (pnlNum < 0 && returnNum > 0)) normalizedReturn = -Math.abs(returnNum)

    setSaving(true)
    try {
      const entryAmtNum = parsePnlNum(entryAmount)
      await onUpdate(trade.id, {
        ticker: ticker.startsWith('$') ? ticker : `$${ticker}`,
        chain,
        ca: ca || null,
        pnl: pnlNum,
        memo: memo || null,
        return_percent: normalizedReturn || trade.return_percent,
        trade_type: tradeType || null,
        avg_entry_mc: parseDollarInput(avgEntryMc) ?? null,
        is_mine: isMine,
        trade_style: tradeStyle || null,
        entry_amount: (entryAmount && !isNaN(entryAmtNum) && entryAmtNum > 0) ? entryAmtNum : null,
      })
      setEditing(false)
    } catch (e) {
      console.error('Update failed:', e)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    try {
      await onDelete(trade.id)
    } catch (e) {
      console.error('Delete failed:', e)
    }
    setShowDeleteModal(false)
  }

  const pnlVal = Number(trade.pnl || 0)
  const returnPct = trade.return_percent ?? 0
  const isProfit = pnlVal >= 0
  const direction = returnPct >= 0 ? (pnlVal >= 0 ? 'Long' : 'Short') : (pnlVal >= 0 ? 'Short' : 'Long')

  const INP = {
    width: '100%', padding: '6px 8px', borderRadius: 6, fontSize: 11,
    background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.08)',
    color: '#e0e0e0', outline: 'none', fontFamily: 'Inter, monospace',
    boxSizing: 'border-box',
  }
  const LABEL = { fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }

  if (editing) {
    return (
      <>
        <div style={{
          background: '#1a1a2e', borderRadius: 12, padding: 16,
          border: '2px solid #42a5f5',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* 종목명 + 체인 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 2 }}>
                <div style={LABEL}>종목명</div>
                <input value={ticker} onChange={e => setTicker(e.target.value)} style={INP} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={LABEL}>체인</div>
                <select value={chain} onChange={e => setChain(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
                  {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* CA */}
            <div>
              <div style={LABEL}>CA</div>
              <input value={ca} onChange={e => setCa(e.target.value)} style={INP} />
            </div>

            {/* PnL + Return */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={LABEL}>PnL ($)</div>
                <input value={pnl} onChange={e => setPnl(handlePnlInput(e.target.value))} style={INP} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={LABEL}>PnL (%)</div>
                <input type="number" step="0.01" value={returnPercent} onChange={e => setReturnPercent(e.target.value)} style={INP} />
              </div>
            </div>

            {/* Entry Amount */}
            <div>
              <div style={LABEL}>Entry Amount ($)</div>
              <input value={entryAmount} onChange={e => {
                const raw = e.target.value
                const stripped = raw.replace(/[^0-9.]/g, '')
                if (stripped === '') { setEntryAmount(''); return }
                const parts = stripped.split('.')
                parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                setEntryAmount(parts.join('.'))
              }} placeholder="0" style={INP} />
            </div>

            {/* 카테고리 + 스타일 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={LABEL}>카테고리</div>
                <select value={tradeType} onChange={e => setTradeType(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
                  <option value="">— 없음 —</option>
                  {TRADE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <div style={LABEL}>매매 스타일</div>
                <select value={tradeStyle} onChange={e => setTradeStyle(e.target.value)} style={{ ...INP, cursor: 'pointer' }}>
                  <option value="">— 없음 —</option>
                  <option value="계획매매">계획매매</option>
                  <option value="뇌동매매">뇌동매매</option>
                </select>
              </div>
            </div>

            {/* Avg Entry MC + 지뢰 */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={LABEL}>Avg. Entry MC</div>
                <input value={avgEntryMc} onChange={e => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '')
                  setAvgEntryMc(cleaned === '' ? '' : formatDollarInput(parseInt(cleaned, 10)))
                }} style={INP} />
              </div>
              <button type="button" onClick={() => setIsMine(!isMine)} style={{
                padding: '6px 12px', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                border: isMine ? '1px solid #ff174450' : '1px solid rgba(255,255,255,0.08)',
                background: isMine ? 'rgba(255,23,68,0.1)' : 'transparent',
                color: isMine ? '#ff1744' : '#6b7280', fontFamily: 'Inter, monospace',
                marginBottom: 0, height: 32,
              }}>
                {isMine ? '💣 ON' : '지뢰'}
              </button>
            </div>

            {/* 메모 */}
            <div>
              <div style={LABEL}>메모</div>
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} style={{
                ...INP, resize: 'vertical', fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.7,
              }} />
            </div>

            {/* 버튼 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4 }}>
              <button onClick={() => setShowDeleteModal(true)} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none',
                background: 'rgba(255,23,68,0.1)', color: '#ff1744', fontSize: 11,
                fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, monospace',
              }}>🗑️ 삭제</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={resetEdit} style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'transparent', color: '#9e9e9e', fontSize: 11, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'Inter, monospace',
                }}>취소</button>
                <button onClick={handleSave} disabled={saving} style={{
                  padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: '#42a5f5', color: '#fff', fontSize: 11, fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                  fontFamily: 'Inter, monospace',
                }}>{saving ? '저장 중...' : '저장'}</button>
              </div>
            </div>
          </div>
        </div>
        {showDeleteModal && (
          <DeleteConfirmModal trade={trade} onConfirm={handleDelete} onCancel={() => setShowDeleteModal(false)} />
        )}
      </>
    )
  }

  // ─── 읽기 모드 ───
  const gridItems = [
    { label: 'Entry Amount', value: trade.entry_amount ? `$${trade.entry_amount.toFixed(0)}` : '—' },
    { label: 'Return', value: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`, color: returnPct >= 0 ? '#00c853' : '#ff1744' },
    { label: 'PnL', value: formatPnl(pnlVal), color: pnlVal >= 0 ? '#00c853' : '#ff1744' },
    { label: 'Avg Entry MC', value: formatMcap(trade.avg_entry_mc) },
    { label: 'Chain', badge: true },
    { label: 'Style', value: trade.trade_style || '—', color: trade.trade_style === '뇌동매매' ? '#ff1744' : trade.trade_style === '계획매매' ? '#00c853' : '#9e9e9e' },
  ]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#1a1a2e', borderRadius: 12, padding: 16, position: 'relative',
        border: `1px solid ${isProfit ? 'rgba(0,200,83,0.15)' : 'rgba(255,23,68,0.15)'}`,
        transition: 'border-color 0.2s',
      }}
    >
      {/* 편집 아이콘 */}
      {hovered && (
        <button onClick={() => setEditing(true)} style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(66,165,245,0.1)', border: '1px solid rgba(66,165,245,0.3)',
          borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12,
          color: '#42a5f5', zIndex: 2,
        }}>✏️</button>
      )}

      {/* 상단: 종목명 + 방향 뱃지 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e0e0e0' }}>{trade.ticker}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: direction === 'Long' ? 'rgba(0,200,83,0.15)' : 'rgba(255,23,68,0.15)',
            color: direction === 'Long' ? '#00c853' : '#ff1744',
            border: `1px solid ${direction === 'Long' ? '#00c853' : '#ff1744'}44`,
            fontFamily: 'Inter, monospace',
          }}>
            {direction}
          </span>
          {trade.trade_type && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(66,165,245,0.12)', color: '#42a5f5',
              border: '1px solid rgba(66,165,245,0.3)', fontFamily: 'Inter, monospace',
            }}>
              {trade.trade_type}
            </span>
          )}
          {trade.is_mine && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(255,193,7,0.12)', color: '#ffc107',
              border: '1px solid rgba(255,193,7,0.3)', fontFamily: 'Inter, monospace',
            }}>
              MINE
            </span>
          )}
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: isProfit ? '#00c853' : '#ff1744', fontFamily: 'Inter, monospace' }}>
          {formatPnl(pnlVal)}
        </span>
      </div>

      {/* 중단: 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {gridItems.map((item) => (
          <div key={item.label} style={{ background: '#0d0d1a', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              {item.label}
            </div>
            {item.badge ? (
              <div>{chainBadge(trade.chain)}</div>
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, color: item.color || '#e0e0e0', fontFamily: 'Inter, monospace' }}>
                {item.value}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CA */}
      {trade.ca && (
        <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          CA: {trade.ca}
        </div>
      )}

      {/* 메모 (읽기 전용) */}
      {trade.memo && (
        <div style={{
          padding: '8px 10px', borderRadius: 8, fontSize: 12,
          background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.04)',
          color: '#9e9e9e', fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
        }}>
          {trade.memo}
        </div>
      )}
    </div>
  )
}

/* ─── 메인 사이드 패널 ────────────────────────────────────── */
export default function TradeSidePanel({ dateStr, trades = [], onClose, onRefresh }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true))
  }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

  const handleCreate = async (payload) => {
    await createTrade(payload)
    setShowAddForm(false)
    if (onRefresh) onRefresh()
  }

  const handleUpdate = async (id, payload) => {
    await updateTrade(id, payload)
    if (onRefresh) onRefresh()
  }

  const handleDelete = async (id) => {
    await deleteTrade(id)
    if (onRefresh) onRefresh()
  }

  if (!dateStr) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }}>
      {/* 오버레이 */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute', inset: 0,
          background: isOpen ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0)',
          transition: 'background 0.3s ease',
        }}
      />

      {/* 패널 */}
      <div
        ref={panelRef}
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'clamp(480px, 40%, 640px)',
          background: '#12122a',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
        }}
      >
        {/* 헤더 */}
        <div style={{
          padding: '20px 24px 16px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e0e0e0', margin: 0, fontFamily: "'Noto Sans KR', sans-serif" }}>
              {formatDateKr(dateStr)}
            </h2>
            <button
              onClick={handleClose}
              style={{
                background: 'none', border: 'none', color: '#9e9e9e',
                fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '4px 8px',
              }}
            >
              ✕
            </button>
          </div>

          {/* 요약 카드 */}
          <SummaryCards trades={trades} />

          {/* 새 매매 등록 버튼 */}
          {!showAddForm && (
            <button onClick={() => setShowAddForm(true)} style={{
              width: '100%', padding: '10px 0', borderRadius: 10,
              border: '1px dashed rgba(66,165,245,0.4)',
              background: 'rgba(66,165,245,0.05)',
              color: '#42a5f5', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Inter, monospace',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => e.target.style.background = 'rgba(66,165,245,0.1)'}
              onMouseLeave={e => e.target.style.background = 'rgba(66,165,245,0.05)'}
            >
              + 새 매매 등록
            </button>
          )}
        </div>

        {/* 트레이드 리스트 (스크롤 영역) */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 24px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
          className="trade-panel-scroll"
        >
          {/* 새 매매 등록 폼 */}
          {showAddForm && (
            <AddTradeForm
              dateStr={dateStr}
              onCreated={handleCreate}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {trades.length === 0 && !showAddForm ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#4b5563', fontSize: 13,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              이 날 트레이드가 없습니다
            </div>
          ) : (
            trades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
