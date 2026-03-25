/**
 * TradeSidePanel.jsx — 날짜별 트레이드 상세 사이드 패널
 *
 * 달력 날짜 클릭 → 오른쪽 슬라이드인 패널
 * 트레이드 카드, 감정 태그, 규칙 준수 체크, 메모, 스크린샷 업로드
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { formatPnl } from '../utils/format'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

const EMOTION_TAGS = [
  { label: '침착', type: 'positive' },
  { label: '자신감', type: 'positive' },
  { label: '조급', type: 'negative' },
  { label: 'FOMO', type: 'negative' },
  { label: '복수매매', type: 'negative' },
  { label: '과신', type: 'negative' },
  { label: '불안', type: 'negative' },
  { label: '무계획', type: 'negative' },
]

const RULES = [
  '좋은 판에만 앉기',
  '잃지 않는 구조 우선',
  '흥분은 잡음, 냉정하게',
  '현금은 옵션이다',
  '복구 욕망 금지',
]

const TAG_COLORS = {
  positive: { bg: 'rgba(0,200,83,0.15)', border: '#00c853', color: '#00c853' },
  negative: { bg: 'rgba(255,23,68,0.15)', border: '#ff1744', color: '#ff1744' },
  custom: { bg: 'rgba(66,165,245,0.15)', border: '#42a5f5', color: '#42a5f5' },
}

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

/* ─── 감정 태그 ──────────────────────────────────────────── */
function EmotionTags({ selected, onToggle, customTags, onAddCustom }) {
  const [adding, setAdding] = useState(false)
  const [newTag, setNewTag] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus()
  }, [adding])

  const allTags = [...EMOTION_TAGS, ...customTags.map((t) => ({ label: t, type: 'custom' }))]

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        감정 태그
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {allTags.map((tag) => {
          const isSelected = selected.includes(tag.label)
          const colors = TAG_COLORS[tag.type]
          return (
            <button
              key={tag.label}
              onClick={() => onToggle(tag.label)}
              style={{
                padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${colors.border}`,
                background: isSelected ? colors.bg : 'transparent',
                color: isSelected ? colors.color : '#6b7280',
                transition: 'all 0.15s',
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              {tag.label}
            </button>
          )
        })}
        {adding ? (
          <form onSubmit={(e) => {
            e.preventDefault()
            if (newTag.trim()) { onAddCustom(newTag.trim()); setNewTag(''); setAdding(false) }
          }} style={{ display: 'inline-flex' }}>
            <input
              ref={inputRef}
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onBlur={() => { if (!newTag.trim()) setAdding(false) }}
              placeholder="태그명"
              style={{
                width: 70, padding: '4px 8px', borderRadius: 12, fontSize: 11,
                border: '1px solid #42a5f5', background: 'transparent', color: '#e0e0e0',
                outline: 'none',
              }}
            />
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: '1px dashed #4b5563', background: 'transparent', color: '#6b7280',
            }}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}

/* ─── 규칙 준수 체크박스 ──────────────────────────────────── */
function RuleChecklist({ checked, onToggle }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        규칙 준수
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {RULES.map((rule, i) => (
          <label
            key={i}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '4px 6px', borderRadius: 6,
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#242442'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{
              width: 16, height: 16, borderRadius: 4, flexShrink: 0,
              border: checked[i] ? '2px solid #00c853' : '2px solid #4b5563',
              background: checked[i] ? 'rgba(0,200,83,0.15)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
              onClick={(e) => { e.preventDefault(); onToggle(i) }}
            >
              {checked[i] && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5L4 7L8 3" stroke="#00c853" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span style={{ fontSize: 11, color: checked[i] ? '#e0e0e0' : '#6b7280', fontFamily: "'Noto Sans KR', sans-serif" }}>
              {rule}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

/* ─── 스크린샷 업로드 ─────────────────────────────────────── */
function ScreenshotUpload({ images, onAdd }) {
  const fileRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFiles = (files) => {
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => onAdd(e.target.result)
      reader.readAsDataURL(file)
    })
  }

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        스크린샷
      </div>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        style={{
          border: `1px dashed ${dragOver ? '#42a5f5' : '#4b5563'}`,
          borderRadius: 8, padding: '12px 16px', textAlign: 'center',
          cursor: 'pointer', transition: 'border-color 0.15s',
          background: dragOver ? 'rgba(66,165,245,0.05)' : 'transparent',
        }}
      >
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <span style={{ fontSize: 11, color: '#6b7280' }}>클릭 또는 드래그하여 이미지 업로드</span>
      </div>
      {images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {images.map((src, i) => (
            <img key={i} src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── 트레이드 카드 ───────────────────────────────────────── */
function TradeCard({ trade, onMemoUpdate }) {
  const [memo, setMemo] = useState(trade.memo || '')
  const [memoSaving, setMemoSaving] = useState(false)
  const [emotions, setEmotions] = useState([])
  const [customTags, setCustomTags] = useState([])
  const [ruleChecks, setRuleChecks] = useState([false, false, false, false, false])
  const [screenshots, setScreenshots] = useState([])
  const memoTimer = useRef(null)

  const pnl = Number(trade.pnl || 0)
  const returnPct = trade.return_percent ?? 0
  const isProfit = pnl >= 0
  const direction = returnPct >= 0 ? (pnl >= 0 ? 'Long' : 'Short') : (pnl >= 0 ? 'Short' : 'Long')

  const handleMemoChange = (value) => {
    setMemo(value)
    if (memoTimer.current) clearTimeout(memoTimer.current)
    memoTimer.current = setTimeout(() => {
      setMemoSaving(true)
      onMemoUpdate(trade.id, value).finally(() => setMemoSaving(false))
    }, 1000)
  }

  const toggleEmotion = (tag) => {
    setEmotions((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
  }

  const toggleRule = (idx) => {
    setRuleChecks((prev) => { const next = [...prev]; next[idx] = !next[idx]; return next })
  }

  const gridItems = [
    { label: 'Entry Amount', value: trade.entry_amount ? `$${trade.entry_amount.toFixed(0)}` : '—' },
    { label: 'Return', value: `${returnPct >= 0 ? '+' : ''}${returnPct.toFixed(1)}%`, color: returnPct >= 0 ? '#00c853' : '#ff1744' },
    { label: 'PnL', value: formatPnl(pnl), color: pnl >= 0 ? '#00c853' : '#ff1744' },
    { label: 'Avg Entry MC', value: formatMcap(trade.avg_entry_mc) },
    { label: 'Chain', value: trade.chain || '—' },
    { label: 'Style', value: trade.trade_style || '—', color: trade.trade_style === '뇌동매매' ? '#ff1744' : trade.trade_style === '계획매매' ? '#00c853' : '#9e9e9e' },
  ]

  return (
    <div style={{
      background: '#1a1a2e', borderRadius: 12, padding: 16,
      border: `1px solid ${isProfit ? 'rgba(0,200,83,0.15)' : 'rgba(255,23,68,0.15)'}`,
    }}>
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
              border: '1px solid rgba(66,165,245,0.3)',
              fontFamily: 'Inter, monospace',
            }}>
              {trade.trade_type}
            </span>
          )}
          {trade.is_mine && (
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(255,193,7,0.12)', color: '#ffc107',
              border: '1px solid rgba(255,193,7,0.3)',
              fontFamily: 'Inter, monospace',
            }}>
              MINE
            </span>
          )}
        </div>
        <span style={{ fontSize: 16, fontWeight: 800, color: isProfit ? '#00c853' : '#ff1744', fontFamily: 'Inter, monospace' }}>
          {formatPnl(pnl)}
        </span>
      </div>

      {/* 중단: 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {gridItems.map((item) => (
          <div key={item.label} style={{ background: '#0d0d1a', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>
              {item.label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: item.color || '#e0e0e0', fontFamily: 'Inter, monospace' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {/* CA 주소 (있을 때만) */}
      {trade.ca && (
        <div style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace', marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          CA: {trade.ca}
        </div>
      )}

      {/* 메모 */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={memo}
          onChange={(e) => handleMemoChange(e.target.value)}
          placeholder="트레이드 복기 메모..."
          rows={2}
          style={{
            width: '100%', background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '8px 10px', color: '#e0e0e0', fontSize: 12,
            fontFamily: "'Noto Sans KR', sans-serif", resize: 'vertical',
            outline: 'none', lineHeight: 1.5, boxSizing: 'border-box',
          }}
          onFocus={(e) => e.target.style.borderColor = '#42a5f5'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
        />
        {memoSaving && (
          <span style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 9, color: '#42a5f5' }}>저장 중...</span>
        )}
      </div>

      {/* 스크린샷 업로드 */}
      <ScreenshotUpload images={screenshots} onAdd={(src) => setScreenshots((prev) => [...prev, src])} />

      {/* 감정 태그 */}
      <EmotionTags
        selected={emotions}
        onToggle={toggleEmotion}
        customTags={customTags}
        onAddCustom={(tag) => setCustomTags((prev) => [...prev, tag])}
      />

      {/* 규칙 준수 체크 */}
      <RuleChecklist checked={ruleChecks} onToggle={toggleRule} />
    </div>
  )
}

/* ─── 메인 사이드 패널 ────────────────────────────────────── */
export default function TradeSidePanel({ dateStr, trades = [], onClose, onMemoUpdate }) {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)

  // 마운트 시 슬라이드인
  useEffect(() => {
    requestAnimationFrame(() => setIsOpen(true))
  }, [])

  // ESC 키
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleClose = useCallback(() => {
    setIsOpen(false)
    setTimeout(onClose, 300)
  }, [onClose])

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
        </div>

        {/* 트레이드 리스트 (스크롤 영역) */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 24px 24px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
          className="trade-panel-scroll"
        >
          {trades.length === 0 ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#4b5563', fontSize: 13,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}>
              이 날 트레이드가 없습니다
            </div>
          ) : (
            trades.map((trade) => (
              <TradeCard key={trade.id} trade={trade} onMemoUpdate={onMemoUpdate} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
