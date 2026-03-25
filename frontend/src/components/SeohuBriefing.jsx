import { useMemo, useState } from 'react'
import { generateSeohuBriefing } from '../utils/seohuEngine'

// ─── Style Maps ───────────────────────────────────────────────────────────────

const PHASE_META = {
  BUILD:   { label: 'BUILD',   color: '#3B82F6', border: 'border-blue-500/25',   bg: 'bg-blue-500/4',   badge: 'bg-blue-500/15 text-blue-400 border border-blue-500/40',   dot: 'bg-blue-400' },
  ATTACK:  { label: 'ATTACK',  color: '#10B981', border: 'border-emerald-500/25', bg: 'bg-emerald-500/4', badge: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40', dot: 'bg-emerald-400' },
  DEFENSE: { label: 'DEFENSE', color: '#EAB308', border: 'border-yellow-500/25', bg: 'bg-yellow-500/4', badge: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/40', dot: 'bg-yellow-400' },
  RESET:   { label: 'RESET',   color: '#EF4444', border: 'border-red-500/25',    bg: 'bg-red-500/4',    badge: 'bg-red-500/15 text-loss border border-red-500/40',           dot: 'bg-loss' },
}

const GRADE_STYLE = {
  S: 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/30',
  A: 'text-profit bg-profit/10 border border-profit/30',
  B: 'text-blue-400 bg-blue-400/10 border border-blue-400/30',
  C: 'text-loss bg-loss/10 border border-loss/30',
}

const PERM_COLOR = {
  '집중 가능':   'text-profit',
  '선택적 허용': 'text-yellow-400',
  '제한':       'text-orange-400',
  '금지':       'text-loss',
}

const EMOTION_LABEL = {
  CALM:           { text: '안정',   color: 'text-[#6B7280]' },
  OVERCONFIDENCE: { text: '과신 ⚠', color: 'text-yellow-400' },
  REVENGE:        { text: '복구욕망 ⚠', color: 'text-loss' },
  TILT:           { text: '틸트 ⛔', color: 'text-loss' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PhaseBadge({ phase }) {
  const m = PHASE_META[phase]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold tracking-widest ${m.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

function MetricRow({ label, value, valueClass = 'text-white' }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#6B7280] text-xs">{label}</span>
      <span className={`text-xs font-medium ${valueClass}`}>{value}</span>
    </div>
  )
}

function SectionLabel({ children }) {
  return <p className="text-[10px] font-semibold text-[#4a4a4a] uppercase tracking-widest mb-1.5">{children}</p>
}

function CategoryRow({ cat }) {
  return (
    <div className="flex items-start gap-2 py-1 border-b border-[#1f1f1f] last:border-0">
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${GRADE_STYLE[cat.grade]} shrink-0`}>{cat.grade}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white font-medium">{cat.trade_type}</span>
          <span className={`text-[10px] font-medium ${PERM_COLOR[cat.permission]}`}>{cat.permission}</span>
        </div>
        <p className="text-[10px] text-[#6B7280] leading-snug mt-0.5">{cat.reason}</p>
      </div>
      <div className="text-right shrink-0">
        <span className={`text-[10px] ${cat.ev_percent >= 0 ? 'text-profit' : 'text-loss'}`}>
          EV {cat.ev_percent > 0 ? '+' : ''}{cat.ev_percent.toFixed(1)}%
        </span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SeohuBriefing({ analytics, trades, error }) {
  const [expanded, setExpanded] = useState(true)

  const briefing = useMemo(() => {
    if (error || !analytics) return null
    return generateSeohuBriefing(analytics, trades ?? [])
  }, [analytics, trades, error])

  if (!briefing) return null

  const pm = PHASE_META[briefing.phase]
  const em = EMOTION_LABEL[briefing.emotion?.state ?? 'CALM']

  const evStr = briefing.ev.current !== null
    ? `${briefing.ev.current >= 0 ? '+' : ''}${briefing.ev.current.toFixed(1)}%`
    : '—'
  const ddStr = briefing.equity.drawdownFromHwm > 0.005
    ? `${(briefing.equity.drawdownFromHwm * 100).toFixed(1)}%`
    : '—'

  return (
    <div className={`rounded-xl border ${pm.border} ${pm.bg} overflow-hidden`}>

      {/* ── Header (항상 표시) ─────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[#6B7280] text-xs font-semibold tracking-widest">◈ 이서후</span>
          <PhaseBadge phase={briefing.phase} />
        </div>

        <p
          className="flex-1 text-sm font-medium truncate"
          style={{ color: pm.color }}
        >
          {briefing.oneLiner}
        </p>

        <div className="flex items-center gap-3 shrink-0 text-xs">
          {briefing.ev.current !== null && (
            <span>
              <span className="text-[#6B7280]">EV </span>
              <span className={briefing.ev.current >= 0 ? 'text-profit' : 'text-loss'}>{evStr}</span>
            </span>
          )}
          {briefing.equity.drawdownFromHwm > 0.005 && (
            <span>
              <span className="text-[#6B7280]">DD </span>
              <span className={briefing.equity.drawdownFromHwm > 0.15 ? 'text-loss' : 'text-[#a0a0a0]'}>{ddStr}</span>
            </span>
          )}
          <span className="text-[#4a4a4a] text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── Expanded Content ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-[#1e1e1e] px-4 py-4 grid grid-cols-[200px_1fr_260px] gap-4">

          {/* Left: Metrics */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <SectionLabel>현재 상태</SectionLabel>
              <MetricRow
                label="EV"
                value={`${evStr}${briefing.ev.trend === 'DECLINING' ? ' ↓' : briefing.ev.trend === 'RISING' ? ' ↑' : ''}`}
                valueClass={briefing.ev.current !== null && briefing.ev.current >= 0 ? 'text-profit' : 'text-loss'}
              />
              <MetricRow
                label="낙폭 (HWM 대비)"
                value={ddStr}
                valueClass={briefing.equity.drawdownFromHwm > 0.15 ? 'text-loss' : briefing.equity.drawdownFromHwm > 0.05 ? 'text-yellow-400' : 'text-[#a0a0a0]'}
              />
              {briefing.kelly !== null && (
                <MetricRow label="Kelly" value={`${briefing.kelly.toFixed(1)}%`} valueClass="text-accent" />
              )}
              <MetricRow label="거래 수" value={`${briefing.totalTrades}건`} />
            </div>

            <div className="space-y-1.5">
              <SectionLabel>심리 상태</SectionLabel>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-medium ${em.color}`}>{em.text}</span>
              </div>
              {briefing.emotion?.detail && (
                <p className={`text-[11px] leading-snug ${em.color}`}>{briefing.emotion.detail}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <SectionLabel>목표 진행</SectionLabel>
              <p className="text-[11px] text-[#6B7280] leading-snug">{briefing.targetView}</p>
            </div>
          </div>

          {/* Center: Judgment + Actions */}
          <div className="space-y-3">
            <div>
              <SectionLabel>이서후 판단</SectionLabel>
              <p className="text-sm text-[#d0d0d0] leading-relaxed">{briefing.judgment}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <SectionLabel>지금 해야 할 플레이</SectionLabel>
                <p className="text-xs text-[#a0a0a0] leading-relaxed">{briefing.playNow}</p>
              </div>
              <div>
                <SectionLabel>금지 행동</SectionLabel>
                <p className="text-xs text-loss/80 leading-relaxed">{briefing.forbidden}</p>
              </div>
            </div>

            <div>
              <SectionLabel>사이즈 전략</SectionLabel>
              <p className="text-xs text-[#a0a0a0] leading-relaxed">{briefing.sizeStrategy}</p>
            </div>

            {/* 지뢰 분석 */}
            {briefing.mineAnalysis && (
              <div>
                <SectionLabel>
                  지뢰플레이 분석
                  {briefing.mineAnalysis.severity <= 1 && <span className="text-[#6B7280] ml-1">(정상)</span>}
                  {briefing.mineAnalysis.severity === 2 && <span className="text-yellow-400 ml-1">(주의)</span>}
                  {briefing.mineAnalysis.severity === 3 && <span className="text-loss ml-1">(위험)</span>}
                  {briefing.mineAnalysis.severity >= 4 && <span className="text-loss ml-1">(고위험)</span>}
                </SectionLabel>
                <p className={`text-xs leading-relaxed ${
                  briefing.mineAnalysis.severity <= 1 ? 'text-[#6B7280]' :
                  briefing.mineAnalysis.severity === 2 ? 'text-yellow-400/80' : 'text-loss/80'
                }`}>
                  {briefing.mineAnalysis.detail}
                </p>
              </div>
            )}

            {/* 뇌동매매 분석 */}
            {briefing.tradeStyleAnalysis?.severity >= 1 && (
              <div>
                <SectionLabel>
                  매매 스타일 분석
                  {briefing.tradeStyleAnalysis.severity === 1 && <span className="text-[#6B7280] ml-1">(주시)</span>}
                  {briefing.tradeStyleAnalysis.severity === 2 && <span className="text-yellow-400 ml-1">(주의)</span>}
                  {briefing.tradeStyleAnalysis.severity >= 3 && <span className="text-loss ml-1">(위험)</span>}
                </SectionLabel>
                <p className={`text-xs leading-relaxed ${
                  briefing.tradeStyleAnalysis.severity <= 1 ? 'text-[#6B7280]' :
                  briefing.tradeStyleAnalysis.severity === 2 ? 'text-yellow-400/80' : 'text-loss/80'
                }`}>
                  {briefing.tradeStyleAnalysis.detail}
                </p>
              </div>
            )}

            {/* 최근 흐름 */}
            {briefing.recentFlow && briefing.recentFlow.type !== 'idle' && (
              <div>
                <SectionLabel>최근 흐름</SectionLabel>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${
                    briefing.recentFlow.type === 'hot_streak' ? 'text-profit' :
                    briefing.recentFlow.type === 'cold_streak' ? 'text-loss' :
                    briefing.recentFlow.type === 'winning' ? 'text-profit/70' :
                    briefing.recentFlow.type === 'losing' ? 'text-loss/70' : 'text-[#6B7280]'
                  }`}>
                    {briefing.recentFlow.detail}
                  </span>
                  <span className="text-[10px] text-[#4b5563]">
                    최근 승률 {(briefing.recentFlow.recentWinRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {/* 비거래일 브리핑 */}
            {briefing.noTradeBriefing && (
              <div className="border-t border-[#1e1e1e] pt-2 mt-1">
                <SectionLabel>오늘의 관망 브리핑</SectionLabel>
                <p className="text-xs text-[#9ca3af] leading-relaxed italic">{briefing.noTradeBriefing}</p>
              </div>
            )}
          </div>

          {/* Right: Categories */}
          <div>
            <SectionLabel>카테고리 판단</SectionLabel>
            {briefing.categories.length === 0 ? (
              <p className="text-xs text-[#6B7280]">카테고리 데이터 없음</p>
            ) : (
              <div className="space-y-0">
                {briefing.categories.map(cat => (
                  <CategoryRow key={cat.trade_type} cat={cat} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
