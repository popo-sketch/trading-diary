/**
 * AthAnalysisPage.jsx — ATH 매도 분석 전용 페이지
 */
import { useState, useEffect, useMemo, useCallback } from 'react'
import { getAllTrades } from '../api/trades'
import { fetchBatchATHData, clearATHCache } from '../utils/dexscreener'
import { formatPnl } from '../utils/format'
import NavHeader from '../components/NavHeader'

// ─── Constants ────────────────────────────────────────────────────────────────

const GREEN = '#00c853'
const RED = '#ff1744'
const WARN = '#ffc107'
const INFO = '#42a5f5'

const CARD = {
  background: '#1a1a2e',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.06)',
  padding: 20,
}

const EFFICIENCY_BUCKETS = Array.from({ length: 10 }, (_, i) => ({
  min: i * 10,
  max: (i + 1) * 10,
  label: `${i * 10}-${(i + 1) * 10}%`,
}))

function getBucketColor(min) {
  if (min >= 80) return GREEN
  if (min >= 60) return '#69f0ae'
  if (min >= 40) return WARN
  if (min >= 20) return '#ff6d00'
  return RED
}

// ─── ATH Calculation ─────────────────────────────────────────────────────────

function computeATHAnalysis(trades, dexData) {
  const results = []

  for (const trade of trades) {
    if (!trade.ca) continue
    const dex = dexData.get(trade.ca)
    if (!dex) {
      results.push({ ...trade, athStatus: 'no_data' })
      continue
    }

    const entryAmount = Number(trade.entry_amount) || 0
    const pnl = Number(trade.pnl) || 0
    const returnPct = Number(trade.return_percent) || 0

    if (entryAmount <= 0) {
      results.push({ ...trade, athStatus: 'no_entry', dex })
      continue
    }

    // 실제 매도가 계산: entry_amount + pnl = exit_value, exit_price_ratio = exit_value / entry_amount
    const exitValue = entryAmount + pnl
    const actualReturnMultiple = exitValue / entryAmount // 예: 1.5 = +50%

    // DexScreener에서 현재가, FDV 등을 가져옴
    // ATH는 DexScreener pair 데이터에서 직접 제공하지 않으므로,
    // FDV/MC 기반으로 추정하거나 priceChange 데이터를 활용
    // 여기서는 avg_entry_mc를 활용해 ATH 효율을 계산
    const currentPrice = dex.priceUsd
    const currentMC = dex.marketCap || dex.fdv || 0

    // 매수 시점 MC
    const entryMC = Number(trade.avg_entry_mc) || 0

    // ATH MC = 현재까지 최고 시가총액 (DexScreener가 직접 제공하지 않으므로
    // 현재 MC를 ATH 근사값으로 사용 — 토큰이 이미 하락했으면 실제 ATH > 현재 MC)
    // 최선의 추정: 토큰의 현재 FDV를 사용
    const athMC = currentMC

    // ATH 효율 계산
    // 내가 산 시점 MC → 현재(또는 ATH) MC까지의 배수
    let athMultiple = 1
    if (entryMC > 0 && athMC > 0) {
      athMultiple = athMC / entryMC
    }

    // ATH에서 팔았을 경우의 수익
    const athExitValue = entryAmount * athMultiple
    const athPnl = athExitValue - entryAmount

    // ATH 대비 매도 효율: 실제 수익률 / ATH 수익률
    let athEfficiency = 0
    if (athMultiple > 1) {
      // 효율 = (실제 수익 / ATH 가능 수익) × 100
      const athProfit = athPnl
      const actualProfit = pnl
      if (athProfit > 0) {
        athEfficiency = Math.max(0, Math.min(100, (actualProfit / athProfit) * 100))
      }
    } else if (athMultiple <= 1 && pnl >= 0) {
      // ATH가 매수가 이하인데 수익이면 100% 효율
      athEfficiency = 100
    }

    // 놓친 수익
    const missedProfit = athPnl - pnl

    results.push({
      ...trade,
      athStatus: 'ok',
      dex,
      entryMC,
      athMC,
      athMultiple,
      athPnl,
      athEfficiency: Math.round(athEfficiency * 10) / 10,
      missedProfit: Math.max(0, missedProfit),
      athExitValue,
    })
  }

  return results
}

// ─── Summary Stats ───────────────────────────────────────────────────────────

function SummaryCards({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1)
  if (valid.length === 0) {
    return (
      <div style={{ ...CARD, textAlign: 'center', color: '#9e9e9e', fontSize: 13, padding: '24px 20px' }}>
        ATH 분석 가능한 트레이드가 없습니다
      </div>
    )
  }

  const avgEfficiency = valid.reduce((s, a) => s + a.athEfficiency, 0) / valid.length
  const totalMissed = valid.reduce((s, a) => s + a.missedProfit, 0)
  const best = valid.reduce((best, a) => a.athEfficiency > best.athEfficiency ? a : best)
  const worst = valid.reduce((w, a) => a.athEfficiency < w.athEfficiency ? a : w)

  const cards = [
    {
      label: '평균 ATH 매도 효율',
      value: `${avgEfficiency.toFixed(1)}%`,
      sub: `평균적으로 ATH의 ${avgEfficiency.toFixed(0)}%에서 매도`,
      color: avgEfficiency >= 50 ? GREEN : RED,
    },
    {
      label: '총 놓친 수익',
      value: formatPnl(totalMissed),
      sub: `${valid.length}건 기준`,
      color: RED,
    },
    {
      label: '가장 잘 판 트레이드',
      value: `${best.athEfficiency.toFixed(0)}%`,
      sub: `${best.ticker} — ATH의 ${best.athEfficiency.toFixed(0)}%에서 매도`,
      color: GREEN,
    },
    {
      label: '가장 아쉬운 트레이드',
      value: `${worst.athEfficiency.toFixed(0)}%`,
      sub: `${worst.ticker} — 놓친 수익 ${formatPnl(worst.missedProfit)}`,
      color: RED,
    },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {cards.map(c => (
        <div key={c.label} style={CARD}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#4b5563',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'Inter, monospace', marginBottom: 8,
          }}>{c.label}</div>
          <div style={{
            fontSize: 22, fontWeight: 800, color: c.color,
            fontFamily: 'Inter, monospace', marginBottom: 4,
          }}>{c.value}</div>
          <div style={{
            fontSize: 11, color: '#9e9e9e', lineHeight: 1.7,
            fontFamily: "'Noto Sans KR', sans-serif",
          }}>{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Trade Card ──────────────────────────────────────────────────────────────

function ATHTradeCard({ analysis }) {
  const [expanded, setExpanded] = useState(false)
  const a = analysis
  const pnl = Number(a.pnl) || 0
  const isOk = a.athStatus === 'ok'

  const effColor = isOk
    ? a.athEfficiency >= 70 ? GREEN : a.athEfficiency >= 40 ? WARN : RED
    : '#6b7280'

  return (
    <div style={{
      ...CARD,
      padding: 0,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'border-color 0.2s',
    }}
      onClick={() => setExpanded(v => !v)}
    >
      {/* 접힌 상태: 한 줄 요약 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr 70px 100px 90px 100px 30px',
        alignItems: 'center',
        padding: '12px 16px',
        gap: 8,
        fontSize: 13,
      }}>
        <span style={{ color: '#9e9e9e', fontFamily: 'Inter, monospace', fontSize: 12 }}>{a.date}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: '#e0e0e0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {a.ticker}
          </span>
          {a.chain && (
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
              background: a.chain === 'Solana' ? 'rgba(153,69,255,0.15)' : 'rgba(243,186,47,0.15)',
              color: a.chain === 'Solana' ? '#b794f6' : '#f3ba2f',
              fontFamily: 'Inter, monospace',
            }}>{a.chain === 'Solana' ? 'SOL' : 'BSC'}</span>
          )}
          {a.trade_type && (
            <span style={{
              fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 4,
              background: 'rgba(255,255,255,0.06)', color: '#9e9e9e',
              fontFamily: 'Inter, monospace',
            }}>{a.trade_type}</span>
          )}
        </div>
        <span style={{
          fontWeight: 700, fontFamily: 'Inter, monospace',
          color: pnl >= 0 ? GREEN : RED,
        }}>
          {formatPnl(pnl)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isOk ? (
            <>
              <div style={{
                flex: 1, height: 6, borderRadius: 3,
                background: 'rgba(255,255,255,0.08)', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(a.athEfficiency, 100)}%`, height: '100%',
                  borderRadius: 3, background: effColor,
                  transition: 'width 0.3s',
                }} />
              </div>
              <span style={{
                fontSize: 12, fontWeight: 700, color: effColor,
                fontFamily: 'Inter, monospace', minWidth: 36, textAlign: 'right',
              }}>{a.athEfficiency.toFixed(0)}%</span>
            </>
          ) : (
            <span style={{ fontSize: 11, color: '#6b7280' }}>—</span>
          )}
        </div>
        <span style={{
          fontWeight: 600, fontFamily: 'Inter, monospace', fontSize: 12,
          color: isOk && a.missedProfit > 0 ? RED : '#6b7280',
        }}>
          {isOk && a.missedProfit > 0 ? formatPnl(a.missedProfit) : '—'}
        </span>
        <span style={{
          fontSize: 11, color: '#6b7280', fontFamily: 'Inter, monospace',
        }}>
          {isOk ? `×${a.athMultiple.toFixed(1)}` : a.athStatus === 'no_data' ? 'N/A' : '—'}
        </span>
        <span style={{ fontSize: 10, color: '#4a4a5a' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* 펼친 상태: 상세 */}
      {expanded && isOk && (
        <div style={{
          padding: '0 16px 16px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          paddingTop: 14,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {[
              { label: '진입 금액', value: `$${Math.round(Number(a.entry_amount) || 0).toLocaleString()}` },
              { label: '실제 PnL', value: formatPnl(pnl), color: pnl >= 0 ? GREEN : RED },
              { label: 'ATH 매도 시 PnL', value: formatPnl(a.athPnl), color: GREEN },
              { label: '놓친 수익', value: formatPnl(a.missedProfit), color: a.missedProfit > 0 ? RED : '#6b7280' },
              { label: '진입 MC', value: a.entryMC > 0 ? `$${(a.entryMC / 1000).toFixed(0)}K` : '—' },
              { label: 'ATH MC', value: a.athMC > 0 ? `$${(a.athMC / 1000).toFixed(0)}K` : '—' },
              { label: 'ATH 배수', value: `×${a.athMultiple.toFixed(2)}`, color: INFO },
              { label: 'ATH 효율', value: `${a.athEfficiency.toFixed(1)}%`, color: effColor },
            ].map(item => (
              <div key={item.label} style={{
                background: '#0d0d1a', borderRadius: 8, padding: '8px 10px',
              }}>
                <div style={{
                  fontSize: 9, color: '#4b5563', fontFamily: 'Inter, monospace',
                  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
                }}>{item.label}</div>
                <div style={{
                  fontSize: 14, fontWeight: 700, fontFamily: 'Inter, monospace',
                  color: item.color || '#e0e0e0',
                }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* DexScreener 링크 */}
          {a.dex?.url && (
            <div style={{ marginTop: 10, fontSize: 11 }}>
              <a
                href={a.dex.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                style={{ color: INFO, textDecoration: 'none' }}
              >
                DexScreener에서 보기 →
              </a>
            </div>
          )}
        </div>
      )}

      {/* 데이터 없음 상태 */}
      {expanded && !isOk && (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.04)',
          fontSize: 12, color: '#6b7280',
        }}>
          {a.athStatus === 'no_data' && 'DexScreener에서 토큰 데이터를 찾을 수 없습니다.'}
          {a.athStatus === 'no_entry' && '진입 금액 데이터가 없습니다.'}
          {a.ca && (
            <div style={{ marginTop: 4, fontSize: 10, color: '#4b5563', fontFamily: 'Inter, monospace', wordBreak: 'break-all' }}>
              CA: {a.ca}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Histogram ───────────────────────────────────────────────────────────────

function EfficiencyHistogram({ analyses }) {
  const valid = analyses.filter(a => a.athStatus === 'ok' && a.athMultiple > 1)
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const bucketData = EFFICIENCY_BUCKETS.map(b => {
    const inBucket = valid.filter(a => a.athEfficiency >= b.min && a.athEfficiency < b.max)
    // 100% 효율은 마지막 버킷에 포함
    if (b.max === 100) {
      const exact100 = valid.filter(a => a.athEfficiency >= 100)
      return { ...b, count: inBucket.length + exact100.length }
    }
    return { ...b, count: inBucket.length }
  })

  const maxCount = Math.max(...bucketData.map(b => b.count), 1)

  return (
    <div style={CARD}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', marginBottom: 16 }}>
        ATH 효율 분포
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160 }}>
        {bucketData.map((b, i) => {
          const heightPct = maxCount > 0 ? (b.count / maxCount) * 100 : 0
          const color = getBucketColor(b.min)
          const isHovered = hoveredIdx === i
          return (
            <div
              key={b.label}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', position: 'relative' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {isHovered && b.count > 0 && (
                <div style={{
                  position: 'absolute', bottom: `calc(${Math.max(heightPct, 10)}% + 28px)`,
                  background: '#0d0d1a', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6, padding: '6px 10px', zIndex: 10,
                  whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#e0e0e0' }}>{b.label}</div>
                  <div style={{ fontSize: 9, color: '#9e9e9e' }}>{b.count}건 ({valid.length > 0 ? ((b.count / valid.length) * 100).toFixed(0) : 0}%)</div>
                </div>
              )}
              {b.count > 0 && (
                <div style={{ fontSize: 10, fontWeight: 700, color, marginBottom: 4, fontFamily: 'Inter, monospace' }}>
                  {b.count}
                </div>
              )}
              <div style={{
                width: '100%', minHeight: 4,
                height: `${Math.max(heightPct, b.count > 0 ? 8 : 2)}%`,
                background: color,
                borderRadius: '4px 4px 0 0',
                opacity: isHovered ? 1 : 0.75,
                transition: 'opacity 0.15s, height 0.3s',
              }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 6 }}>
        {bucketData.map(b => (
          <div key={b.label} style={{
            flex: 1, textAlign: 'center', fontSize: 9, color: '#6b7280',
            fontFamily: 'Inter, monospace',
          }}>{b.label}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function FilterBar({ filters, setFilters, tradeTypes }) {
  const btnStyle = (active) => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
    fontFamily: 'Inter, monospace', cursor: 'pointer', border: 'none',
    background: active ? 'rgba(66,165,245,0.15)' : 'rgba(255,255,255,0.04)',
    color: active ? INFO : '#9e9e9e',
    transition: 'all 0.15s',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      {/* 체인 필터 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {['All', 'Solana', 'BNB'].map(chain => (
          <button key={chain} style={btnStyle(filters.chain === chain)} onClick={() => setFilters(f => ({ ...f, chain }))}>
            {chain}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

      {/* 정렬 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { key: 'date', label: '날짜순' },
          { key: 'efficiency', label: '효율순' },
          { key: 'missed', label: '놓친 수익순' },
        ].map(s => (
          <button key={s.key} style={btnStyle(filters.sort === s.key)} onClick={() => setFilters(f => ({ ...f, sort: s.key }))}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

      {/* 기간 필터 */}
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          { key: 'all', label: '전체' },
          { key: 'this_month', label: '이번 달' },
          { key: 'last_month', label: '지난 달' },
        ].map(p => (
          <button key={p.key} style={btnStyle(filters.period === p.key)} onClick={() => setFilters(f => ({ ...f, period: p.key }))}>
            {p.label}
          </button>
        ))}
      </div>

      {/* 카테고리 필터 */}
      {tradeTypes.length > 0 && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
          <select
            value={filters.tradeType}
            onChange={e => setFilters(f => ({ ...f, tradeType: e.target.value }))}
            style={{
              background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '5px 10px', fontSize: 11,
              color: '#e0e0e0', fontFamily: 'Inter, monospace',
              outline: 'none', cursor: 'pointer',
            }}
          >
            <option value="all">All Categories</option>
            {tradeTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </>
      )}
    </div>
  )
}

// ─── List Header ─────────────────────────────────────────────────────────────

function ListHeader() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr 70px 100px 90px 100px 30px',
      padding: '8px 16px', gap: 8,
      fontSize: 10, fontWeight: 700, color: '#4b5563',
      fontFamily: 'Inter, monospace', textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      <span>Date</span>
      <span>Token</span>
      <span>PnL</span>
      <span>ATH 효율</span>
      <span>놓친 수익</span>
      <span>ATH 배수</span>
      <span />
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AthAnalysisPage() {
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [dexLoading, setDexLoading] = useState(false)
  const [dexProgress, setDexProgress] = useState({ done: 0, total: 0 })
  const [dexData, setDexData] = useState(new Map())
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    chain: 'All',
    sort: 'date',
    period: 'all',
    tradeType: 'all',
  })

  // 트레이드 로드
  useEffect(() => {
    (async () => {
      try {
        setLoading(true)
        const data = await getAllTrades()
        setTrades(data)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // CA가 있는 트레이드 필터
  const caTradesRaw = useMemo(() => trades.filter(t => t.ca && t.ca.trim()), [trades])

  // DexScreener 데이터 로드
  const loadDexData = useCallback(async (forceRefresh = false) => {
    if (caTradesRaw.length === 0) return
    const cas = caTradesRaw.map(t => t.ca)
    setDexLoading(true)
    setDexProgress({ done: 0, total: cas.length })
    try {
      const results = await fetchBatchATHData(
        cas,
        forceRefresh,
        (done, total) => setDexProgress({ done, total })
      )
      setDexData(results)
    } catch (e) {
      setError(e.message)
    } finally {
      setDexLoading(false)
    }
  }, [caTradesRaw])

  useEffect(() => {
    if (caTradesRaw.length > 0 && dexData.size === 0) {
      loadDexData(false)
    }
  }, [caTradesRaw, loadDexData, dexData.size])

  // ATH 분석 계산
  const analyses = useMemo(() => computeATHAnalysis(caTradesRaw, dexData), [caTradesRaw, dexData])

  // 트레이드 타입 목록
  const tradeTypes = useMemo(() => {
    const types = new Set(caTradesRaw.map(t => t.trade_type).filter(Boolean))
    return [...types].sort()
  }, [caTradesRaw])

  // 필터 적용
  const filtered = useMemo(() => {
    let result = [...analyses]

    // 체인 필터
    if (filters.chain !== 'All') {
      result = result.filter(a => {
        if (filters.chain === 'Solana') return a.chain === 'Solana'
        if (filters.chain === 'BNB') return a.chain === 'BNB' || a.chain === 'BSC'
        return true
      })
    }

    // 기간 필터
    if (filters.period !== 'all') {
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const lastDate = new Date(now.getFullYear(), now.getMonth(), 0)
      const lastMonth = `${lastDate.getFullYear()}-${String(lastDate.getMonth() + 1).padStart(2, '0')}`

      if (filters.period === 'this_month') {
        result = result.filter(a => a.date?.startsWith(thisMonth))
      } else if (filters.period === 'last_month') {
        result = result.filter(a => a.date?.startsWith(lastMonth))
      }
    }

    // 카테고리 필터
    if (filters.tradeType !== 'all') {
      result = result.filter(a => a.trade_type === filters.tradeType)
    }

    // 정렬
    if (filters.sort === 'date') {
      result.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    } else if (filters.sort === 'efficiency') {
      result.sort((a, b) => (b.athEfficiency || 0) - (a.athEfficiency || 0))
    } else if (filters.sort === 'missed') {
      result.sort((a, b) => (b.missedProfit || 0) - (a.missedProfit || 0))
    }

    return result
  }, [analyses, filters])

  return (
    <div className="min-h-screen p-6 bg-dark-bg text-[#e0e0e0]">
      <div className="max-w-7xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <NavHeader />

      {/* 페이지 제목 + 새로고침 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#ffffff', margin: 0 }}>
            🎯 ATH 매도 분석
          </h2>
          <p style={{ fontSize: 12, color: '#9e9e9e', margin: '4px 0 0', lineHeight: 1.7 }}>
            각 트레이드의 ATH 대비 매도 효율을 분석합니다 (CA 기록 트레이드 대상)
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {dexLoading && (
            <div style={{ fontSize: 11, color: INFO, fontFamily: 'Inter, monospace' }}>
              ⏳ {dexProgress.done}/{dexProgress.total}
            </div>
          )}
          <button
            onClick={() => { clearATHCache(); loadDexData(true) }}
            disabled={dexLoading}
            style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${INFO}40`,
              background: `${INFO}10`, color: INFO,
              fontSize: 12, fontWeight: 600, cursor: dexLoading ? 'wait' : 'pointer',
              fontFamily: 'Inter, monospace',
              opacity: dexLoading ? 0.5 : 1,
            }}
          >
            🔄 새로고침
          </button>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div style={{ ...CARD, background: 'rgba(255,23,68,0.08)', borderColor: 'rgba(255,23,68,0.3)', color: RED, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* 로딩 */}
      {loading ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          <div style={{ color: '#9e9e9e', fontSize: 13 }}>트레이드 로딩 중...</div>
        </div>
      ) : caTradesRaw.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📭</div>
          <div style={{ color: '#9e9e9e', fontSize: 13 }}>CA가 기록된 트레이드가 없습니다</div>
        </div>
      ) : (
        <>
          {/* 요약 통계 */}
          <SummaryCards analyses={analyses} />

          {/* 필터 */}
          <div style={{ ...CARD, padding: '12px 16px' }}>
            <FilterBar filters={filters} setFilters={setFilters} tradeTypes={tradeTypes} />
          </div>

          {/* 트레이드 리스트 */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#e0e0e0', margin: 0 }}>
                트레이드별 ATH 분석
              </h3>
              <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'Inter, monospace' }}>
                {filtered.length}건
              </span>
            </div>
            <ListHeader />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
              {filtered.map(a => (
                <ATHTradeCard key={a.id} analysis={a} />
              ))}
              {filtered.length === 0 && (
                <div style={{ textAlign: 'center', padding: 24, color: '#6b7280', fontSize: 13 }}>
                  필터 조건에 맞는 트레이드가 없습니다
                </div>
              )}
            </div>
          </div>

          {/* 히스토그램 */}
          <EfficiencyHistogram analyses={analyses} />
        </>
      )}
      </div>
    </div>
  )
}
