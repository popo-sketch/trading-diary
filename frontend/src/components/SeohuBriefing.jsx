import { useMemo, useState } from 'react'
import { generateSeohuBriefing, GRADE_CONDITIONS } from '../utils/seohuEngine'
import { formatPnl } from '../utils/format'

// ─── Style Maps ───────────────────────────────────────────────────────────────

const PHASE_META = {
  BUILD:   { label: 'BUILD',   color: '#42a5f5', bg: '#3B82F610', headerBg: 'linear-gradient(135deg, rgba(59,130,246,0.06), transparent)' },
  ATTACK:  { label: 'ATTACK',  color: '#00c853', bg: '#10B98110', headerBg: 'linear-gradient(135deg, rgba(16,185,129,0.06), transparent)' },
  DEFENSE: { label: 'DEFENSE', color: '#ffc107', bg: '#EAB30810', headerBg: 'linear-gradient(135deg, rgba(234,179,8,0.06), transparent)' },
  RESET:   { label: 'RESET',   color: '#ff1744', bg: '#EF444410', headerBg: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(239,68,68,0.02))' },
}

const SITUATION_BG = {
  A: 'rgba(0,200,83,0.03)',
  B: 'rgba(66,165,245,0.03)',
  C: 'transparent',
  D: 'rgba(255,193,7,0.03)',
  E: 'rgba(255,23,68,0.03)',
}

const GRADE_META = {
  S: { color: '#fbbf24', bg: '#fbbf2415', border: '#fbbf2440' },
  A: { color: '#00c853', bg: '#10B98115', border: '#10B98140' },
  B: { color: '#42a5f5', bg: '#3B82F615', border: '#3B82F640' },
  C: { color: '#f97316', bg: '#f9731615', border: '#f9731640' },
  D: { color: '#ff1744', bg: '#EF444415', border: '#EF444440' },
}

const PERM_META = {
  '집중 가능':   { color: '#00c853', bg: '#10B98118' },
  '적극 허용':   { color: '#00c853', bg: '#10B98118' },
  '선택적 허용': { color: '#fbbf24', bg: '#fbbf2418' },
  '허용':       { color: '#69f0ae', bg: '#69f0ae18' },
  '조건부':     { color: '#42a5f5', bg: '#42a5f518' },
  '자제':       { color: '#f97316', bg: '#f9731618' },
  '제한':       { color: '#f97316', bg: '#f9731618' },
  '금지':       { color: '#ff1744', bg: '#EF444418' },
}

const EMOTION_EMOJI = {
  CALM:           { emoji: '😌', text: '안정',     color: '#6B7280' },
  OVERCONFIDENCE: { emoji: '😐', text: '과신 주의', color: '#ffc107' },
  REVENGE:        { emoji: '😰', text: '복구욕망',  color: '#ff1744' },
  TILT:           { emoji: '🔥', text: '틸트',     color: '#ff1744' },
}

// ─── Info Tooltip ─────────────────────────────────────────────────────────────

function InfoTooltip({ text }) {
  const [show, setShow] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  const handleEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const tooltipW = 280
    let left = rect.left + rect.width / 2
    let top = rect.top - 8

    // 화면 밖 방지
    if (left - tooltipW / 2 < 8) left = tooltipW / 2 + 8
    if (left + tooltipW / 2 > window.innerWidth - 8) left = window.innerWidth - tooltipW / 2 - 8

    setPos({ top, left })
    setShow(true)
  }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{ fontSize: 12, opacity: 0.5, marginLeft: 3 }}>ℹ️</span>
      {show && (
        <div style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, -100%)',
          zIndex: 9999,
          background: '#2a2a4a',
          color: '#e0e0e0',
          borderRadius: 8,
          padding: '12px 16px',
          fontSize: 13,
          lineHeight: 1.7,
          maxWidth: 280,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          fontFamily: "'Noto Sans KR', sans-serif",
          whiteSpace: 'pre-line',
          animation: 'seohuFadeIn 0.15s ease',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

// ─── Mini Gauge Bar ─────────────────────────────────────────────────────────

function GaugeBar({ value, max, color, danger = false }) {
  const pct = Math.min(100, Math.max(0, (Math.abs(value) / max) * 100))
  return (
    <div style={{
      width: '100%', height: 4, borderRadius: 2,
      background: 'rgba(255,255,255,0.06)', marginTop: 4, overflow: 'hidden',
    }}>
      <div style={{
        width: `${pct}%`, height: '100%', borderRadius: 2,
        background: color,
        boxShadow: danger ? `0 0 8px ${color}66` : 'none',
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

// ─── Metric Mini Card ───────────────────────────────────────────────────────

function MetricCard({ label, value, color, icon, gauge, dangerBlink, subLabel, tooltip }) {
  return (
    <div style={{
      flex: 1,
      background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10,
      padding: '10px 12px',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#6b7280',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          fontFamily: 'Inter, monospace',
        }}>{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
        {dangerBlink && (
          <span className="seohu-blink" style={{ fontSize: 12, color: '#ff1744' }}>⚠</span>
        )}
      </div>
      <div style={{
        fontSize: 20, fontWeight: 800, color,
        fontFamily: 'Inter, monospace',
      }}>
        {value}
      </div>
      {subLabel && (
        <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2, fontFamily: 'Inter, monospace' }}>
          {subLabel}
        </div>
      )}
      {gauge && <GaugeBar value={gauge.value} max={gauge.max} color={color} danger={gauge.danger} />}
    </div>
  )
}

// ─── Accordion Section (v4: 접힌 상태 한줄 요약) ─────────────────────────────

function AccordionSection({ title, severity, summaryLine, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const sevColor = severity >= 2 ? '#ffc107' : '#6B7280'

  return (
    <div style={{
      border: `1px solid ${severity >= 2 ? sevColor + '30' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 8,
      overflow: 'hidden',
      background: severity >= 2 ? 'rgba(255,193,7,0.02)' : 'transparent',
    }}>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{
            fontSize: 12, fontWeight: 700, color: sevColor,
            fontFamily: 'Inter, monospace', textTransform: 'uppercase',
            letterSpacing: '0.1em', flexShrink: 0,
          }}>
            {title}
          </span>
          {!open && summaryLine && (
            <span style={{
              fontSize: 13, color: '#6b7280', fontFamily: 'Inter, monospace',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginLeft: 4,
            }}>
              — {summaryLine}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#4a4a5a', flexShrink: 0, marginLeft: 8 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{
          padding: '0 12px 10px', fontSize: 14, lineHeight: 1.7,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Keyword Chip Highlighter (v4: 컬러 칩) ─────────────────────────────────

const CHIP_STYLES = {
  지뢰: { emoji: '💣', background: 'rgba(66,165,245,0.12)', color: '#42a5f5', border: '1px solid rgba(66,165,245,0.25)' },
  뇌동: { emoji: '🧠', background: 'rgba(249,115,22,0.12)', color: '#fb923c', border: '1px solid rgba(249,115,22,0.25)' },
  주의: { emoji: '⚠️', background: 'rgba(234,179,8,0.12)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.25)' },
  좋음: { emoji: '✅', background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.25)' },
  위험: { emoji: '🚨', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' },
  금지: { emoji: '🚫', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' },
  틸트: { emoji: '🔥', background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' },
}

function highlightKeywords(text) {
  if (!text) return text
  const regex = new RegExp(`(${Object.keys(CHIP_STYLES).join('|')})`, 'g')
  const parts = text.split(regex)
  return parts.map((part, i) => {
    const chip = CHIP_STYLES[part]
    if (chip) {
      return (
        <span key={i} style={{
          background: chip.background, color: chip.color, border: chip.border,
          borderRadius: 4, padding: '0px 5px', fontSize: 12, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 2,
        }}>
          <span style={{ fontSize: 12 }}>{chip.emoji}</span>{part}
        </span>
      )
    }
    return part
  })
}

// ─── Category Card (v4: 5등급 + 조건 텍스트) ──────────────────────────────────

function CategoryCard({ cat }) {
  const [hovered, setHovered] = useState(false)
  const gm = GRADE_META[cat.grade] ?? GRADE_META.C
  const pm = PERM_META[cat.permission] ?? PERM_META['제한']
  const evPct = Math.min(100, Math.max(0, (Math.abs(cat.ev_percent) / 30) * 100))

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '10px 12px',
        position: 'relative',
        transition: 'border-color 0.2s ease',
        borderColor: hovered ? `${gm.color}40` : 'rgba(255,255,255,0.06)',
      }}
    >
      {hovered && cat.reason && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%',
          transform: 'translateX(-50%)', marginBottom: 6,
          background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 12px',
          zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          fontSize: 13, color: '#9ca3af', maxWidth: 240, lineHeight: 1.7,
          fontFamily: "'Noto Sans KR', sans-serif",
          whiteSpace: 'normal',
        }}>
          {cat.reason}
          <div style={{
            position: 'absolute', top: '100%', left: '50%',
            transform: 'translateX(-50%)',
            width: 0, height: 0,
            borderLeft: '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop: '5px solid rgba(255,255,255,0.1)',
          }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 900,
            color: gm.color, background: gm.bg,
            border: `2px solid ${gm.border}`,
            fontFamily: 'Inter, monospace',
            boxShadow: cat.grade === 'S' ? '0 0 8px #fbbf2433' : 'none',
          }}>
            {cat.grade}
          </div>
          <InfoTooltip text={{
            S: "S등급 — 최상위\nEV +10% 이상 AND 수익비 2.0 이상 AND 5건+\n사이즈 자유.",
            A: "A등급 — 양호\nEV 양수 AND 수익비 1.5 이상 AND 5건+\n기본 사이즈 OK.",
            B: "B등급 — 조건부\nPF 1.0~1.5 또는 데이터 부족.\n최소 사이즈만.",
            C: "C등급 — 자제\n수익비 낮음.\n가급적 패스, 꼭 하려면 $30 이하.",
            D: "D등급 — 금지\n수익비·EV 모두 부족.\n진입 이유 없음.",
          }[cat.grade] || ''} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 16, fontWeight: 700, color: '#e8e8e8',
            fontFamily: 'Inter, monospace',
          }}>
            {cat.trade_type}
          </div>
          <span style={{
            display: 'inline-block', marginTop: 2,
            fontSize: 12, fontWeight: 700, padding: '2px 8px',
            borderRadius: 4, color: pm.color, background: pm.bg,
            fontFamily: 'Inter, monospace',
          }}>
            {cat.conditionLabel || cat.permission}
          </span>
        </div>
      </div>

      {/* 조건 텍스트 */}
      <div style={{
        fontSize: 13, color: '#6b7280', lineHeight: 1.7, marginBottom: 6,
        fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
      }}>
        {cat.conditionText}
      </div>

      {/* PF + EV 프로그레스 바 */}
      <div>
        {/* PF 표시 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Inter, monospace', display: 'flex', alignItems: 'center' }}>PF<InfoTooltip text={"이 카테고리에서의 수익비.\n총 수익 ÷ 총 손실.\n1.0 이상이면 번 게 잃은 것보다 많음."} /></span>
          <span style={{
            fontSize: 14, fontWeight: 800,
            color: cat.profitFactor >= 2.0 ? '#00c853' : cat.profitFactor >= 1.5 ? '#42a5f5' : cat.profitFactor >= 1.0 ? '#ffc107' : '#ff1744',
            fontFamily: 'Inter, monospace',
          }}>
            {Number.isFinite(cat.profitFactor) ? `${cat.profitFactor.toFixed(2)}x` : '—'}
          </span>
        </div>
        <div style={{
          width: '100%', height: 5, borderRadius: 3,
          background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          marginBottom: 6,
        }}>
          <div style={{
            width: `${Math.min(100, (Math.min(Number.isFinite(cat.profitFactor) ? cat.profitFactor : 0, 4) / 4) * 100)}%`,
            height: '100%', borderRadius: 3,
            background: cat.profitFactor >= 1.5
              ? 'linear-gradient(90deg, #10B981, #34d399)'
              : cat.profitFactor >= 1.0
                ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                : 'linear-gradient(90deg, #EF4444, #f87171)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        {/* EV 표시 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 12, color: '#6b7280', fontFamily: 'Inter, monospace', display: 'flex', alignItems: 'center' }}>EV<InfoTooltip text={"이 카테고리의 기대값.\n한 건당 평균 수익률.\n양수면 이 카테고리에서 평균적으로 수익."} /></span>
          <span style={{
            fontSize: 13, fontWeight: 700,
            color: cat.ev_percent >= 0 ? '#00c853' : '#ff1744',
            fontFamily: 'Inter, monospace',
          }}>
            {cat.ev_percent > 0 ? '+' : ''}{cat.ev_percent.toFixed(1)}%
          </span>
        </div>
        <div style={{
          width: '100%', height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
        }}>
          <div style={{
            width: `${evPct}%`, height: '100%', borderRadius: 2,
            background: cat.ev_percent >= 0
              ? 'linear-gradient(90deg, #10B981, #34d399)'
              : 'linear-gradient(90deg, #EF4444, #f87171)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* 데이터 부족 표시 */}
      {cat.insufficientData && (
        <div style={{
          marginTop: 6, fontSize: 12, color: '#6b7280', fontStyle: 'italic',
          fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
        }}>
          ※ {cat.trades}건 — 데이터 부족
        </div>
      )}
    </div>
  )
}

// ─── 매매 품질 비교 카드 (v4 신규: 계획 vs 뇌동) ──────────────────────────────

function TradeQualityCards({ tradeQuality }) {
  if (!tradeQuality?.hasData) return null

  const { planned, impulsive, insight } = tradeQuality

  function StatBox({ label, stats, borderColor }) {
    return (
      <div style={{
        flex: 1,
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 10,
        borderTop: `3px solid ${borderColor}`,
        padding: '12px 14px',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: borderColor,
          fontFamily: 'Inter, monospace', marginBottom: 8,
        }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>건수</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e0e0e0', fontFamily: 'Inter, monospace' }}>
              {stats.count}건
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>승률</div>
            <div style={{
              fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
              color: stats.winRate >= 0.5 ? '#00c853' : stats.count > 0 ? '#ff1744' : '#6b7280',
            }}>
              {stats.count > 0 ? `${(stats.winRate * 100).toFixed(0)}%` : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>총 손익</div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'Inter, monospace',
              color: stats.totalPnl >= 0 ? '#00c853' : '#ff1744',
            }}>
              {stats.count > 0 ? formatPnl(stats.totalPnl) : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>평균 손익</div>
            <div style={{
              fontSize: 14, fontWeight: 700, fontFamily: 'Inter, monospace',
              color: stats.avgPnl >= 0 ? '#00c853' : '#ff1744',
            }}>
              {stats.count > 0 ? formatPnl(stats.avgPnl) : '—'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
        <StatBox label="계획매매" stats={planned} borderColor="#00c853" />
        <StatBox label="뇌동매매" stats={impulsive} borderColor="#ff1744" />
      </div>
      {insight && (
        <div style={{
          padding: '10px 14px', borderRadius: 10,
          background: 'linear-gradient(135deg, rgba(255,193,7,0.08), rgba(255,193,7,0.03))',
          border: '1px solid rgba(255,193,7,0.2)',
        }}>
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.7,
            color: '#fbbf24', fontWeight: 700,
            fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
          }}>
            💡 {insight.split(/(손실.*?원)/).map((part, i) =>
              /^손실/.test(part)
                ? <span key={i} style={{ color: '#ff1744', fontWeight: 800 }}>{part}</span>
                : part
            )}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── 지뢰플레이 현황 콘텐츠 (v4: 투입/회수 기반) ──────────────────────────────

function MinePlayContent({ mine }) {
  return (
    <div>
      {/* 투입/회수 요약 카드 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{
          flex: 1, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(59,130,246,0.06)',
        }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>총 투입</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa', fontFamily: 'Inter, monospace' }}>
            ${Math.round(mine.totalInvested).toLocaleString()}
          </div>
        </div>
        <div style={{
          flex: 1, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(59,130,246,0.06)',
        }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>총 회수</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#60a5fa', fontFamily: 'Inter, monospace' }}>
            ${Math.round(mine.totalRecovered).toLocaleString()}
          </div>
        </div>
        <div style={{
          flex: 1, padding: '8px 10px', borderRadius: 8,
          background: mine.netPnl >= 0 ? 'rgba(0,200,83,0.06)' : 'rgba(255,255,255,0.03)',
        }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>순손익</div>
          <div style={{
            fontSize: 16, fontWeight: 800, fontFamily: 'Inter, monospace',
            color: mine.netPnl >= 0 ? '#00c853' : '#ff1744',
          }}>
            {mine.netPnl >= 0 ? '+' : ''}${Math.round(mine.netPnl).toLocaleString()}
          </div>
        </div>
      </div>

      {/* 건수 정보 */}
      <div style={{
        display: 'flex', gap: 12, fontSize: 13, color: '#6b7280',
        fontFamily: 'Inter, monospace', marginBottom: 8,
      }}>
        <span>전체 {mine.mineCount}건</span>
        <span style={{ color: '#00c853' }}>수익 {mine.mineWins}건</span>
        <span style={{ color: '#ff1744' }}>손실 {mine.mineLosses}건</span>
        <span>비중 {(mine.capitalRatio * 100).toFixed(1)}%</span>
      </div>

      {/* 인사이트 */}
      <p style={{
        margin: 0, fontSize: 14, lineHeight: 1.7,
        color: '#9ca3af',
        fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
      }}>
        {highlightKeywords(mine.detail)}
      </p>

      {/* 하단 톤 메시지 */}
      <p style={{
        margin: '6px 0 0', fontSize: 13, color: '#4b5563', fontStyle: 'italic',
        fontFamily: "'Noto Sans KR', sans-serif", lineHeight: 1.7, letterSpacing: '0.3px',
      }}>
        지뢰는 원래 많이 잃고 한 번에 크게 먹는 전략. 사이즈 관리만 잘하면 OK.
      </p>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SeohuBriefing({ analytics, trades, error }) {
  const [expanded, setExpanded] = useState(true)
  const [judgmentExpanded, setJudgmentExpanded] = useState(false)

  const briefing = useMemo(() => {
    if (error || !analytics) return null
    return generateSeohuBriefing(analytics, trades ?? [])
  }, [analytics, trades, error])

  if (!briefing) return null

  const pm = PHASE_META[briefing.phase]
  const em = EMOTION_EMOJI[briefing.emotion?.state ?? 'CALM']
  const sitBg = SITUATION_BG[briefing.situation] || 'transparent'

  const evVal = briefing.ev.current
  const evStr = evVal !== null
    ? `${evVal >= 0 ? '+' : ''}${evVal.toFixed(1)}%`
    : '—'
  const ddVal = briefing.equity.drawdownFromHwm
  const ddPct = ddVal * 100
  const ddStr = ddVal > 0.005 ? `${ddPct.toFixed(1)}%` : '—'

  // 상황 기반 EV/DD 뱃지 색상 강조
  const sitEvHighlight = briefing.situation === 'A'
  const sitDdHighlight = briefing.situation === 'E'

  // 상황 기반 플레이/금지 박스 강조
  const highlightPlay = briefing.situation === 'D'
  const highlightForbid = briefing.situation === 'E'

  return (
    <div style={{
      background: '#16162a',
      border: `1px solid ${pm.color}25`,
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: `0 0 30px ${pm.color}08`,
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        onClick={() => setExpanded(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', cursor: 'pointer', userSelect: 'none',
          background: sitBg,
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.04)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 13, fontWeight: 800, color: '#7a7a8a',
            letterSpacing: '0.12em', fontFamily: 'Inter, monospace',
          }}>◈ 이서후</span>
          <span style={{
            fontSize: 12, fontWeight: 800,
            color: pm.color, background: pm.bg,
            border: `1px solid ${pm.color}30`,
            borderRadius: 5, padding: '2px 8px',
            fontFamily: 'Inter, monospace', letterSpacing: '0.08em',
          }}>
            {pm.label}
          </span>
        </div>

        <p style={{
          flex: 1, margin: 0,
          fontSize: 16, fontWeight: 700, color: pm.color,
          fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {briefing.oneLiner}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {evVal !== null && (
            <div style={{
              padding: '4px 10px', borderRadius: 6,
              background: sitEvHighlight
                ? 'rgba(0,200,83,0.2)'
                : evVal >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              border: `1px solid ${sitEvHighlight ? '#00c85340' : evVal >= 0 ? '#10B98140' : '#EF444440'}`,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#6b7280',
                fontFamily: 'Inter, monospace',
              }}>EV </span>
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: evVal >= 0 ? '#00c853' : '#ff1744',
                fontFamily: 'Inter, monospace',
              }}>{evStr}</span>
            </div>
          )}
          {ddVal > 0.005 && (
            <div style={{
              padding: '4px 10px', borderRadius: 6,
              background: sitDdHighlight
                ? 'rgba(255,23,68,0.2)'
                : ddVal > 0.15 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${sitDdHighlight ? '#ff174440' : ddVal > 0.15 ? '#EF444440' : 'rgba(255,255,255,0.08)'}`,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color: '#6b7280',
                fontFamily: 'Inter, monospace',
              }}>DD </span>
              <span style={{
                fontSize: 14, fontWeight: 800,
                color: ddVal > 0.15 ? '#ff1744' : ddVal > 0.05 ? '#ffc107' : '#a0a0a0',
                fontFamily: 'Inter, monospace',
              }}>{ddStr}</span>
            </div>
          )}
          <span style={{ fontSize: 12, color: '#4a4a5a' }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* ── 포포 응원 멘트 (v4: 상황별 메시지 풀) ─────────────────────── */}
      {briefing.popoBriefing && (
        <div style={{
          padding: '8px 18px',
          background: briefing.situation === 'E' ? 'rgba(255,23,68,0.05)'
                    : briefing.situation === 'D' ? 'rgba(255,193,7,0.04)'
                    : briefing.situation === 'A' ? 'rgba(0,200,83,0.05)'
                    : 'rgba(66,165,245,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>🐾</span>
          <p style={{
            margin: 0, fontSize: 14, lineHeight: 1.7, letterSpacing: '0.3px',
            color: briefing.situation === 'E' ? '#ff6d6dcc'
                 : briefing.situation === 'D' ? '#fbbf24cc'
                 : briefing.situation === 'A' ? '#69f0aecc'
                 : '#90caf9cc',
            fontFamily: "'Noto Sans KR', sans-serif",
          }}>
            {briefing.popoBriefing}
          </p>
        </div>
      )}

      {/* ── Expanded Content ──────────────────────────────────────────── */}
      {expanded && (
        <div style={{ padding: 20 }}>

          {/* ── 상단: 현재 상태 미니 카드 ─── */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <MetricCard
              label="수익비 (PF)" icon="⚖️"
              tooltip={"수익비 (Profit Factor)\n총 번 돈 ÷ 총 잃은 돈.\n1.0 = 본전, 1.5 이상 = 양호, 2.0 이상 = 우수.\n예: PF 2.0이면 $1 잃을 때마다 $2를 번다는 뜻."}
              value={briefing.overallMetrics?.profitFactor != null && Number.isFinite(briefing.overallMetrics.profitFactor) ? `${briefing.overallMetrics.profitFactor.toFixed(2)}x` : '—'}
              color={briefing.overallMetrics?.profitFactor >= 2.0 ? '#00c853' : briefing.overallMetrics?.profitFactor >= 1.5 ? '#42a5f5' : briefing.overallMetrics?.profitFactor >= 1.0 ? '#ffc107' : '#ff1744'}
              subLabel={briefing.overallMetrics?.profitFactor >= 2.0 ? '강한 엣지' : briefing.overallMetrics?.profitFactor >= 1.5 ? '양수 구조' : briefing.overallMetrics?.profitFactor >= 1.0 ? '손익 분기점' : briefing.totalTrades >= 5 ? '적자 구조' : null}
              gauge={briefing.overallMetrics ? { value: Math.min(Number.isFinite(briefing.overallMetrics.profitFactor) ? briefing.overallMetrics.profitFactor : 0, 4), max: 4, danger: briefing.overallMetrics.profitFactor < 1.0 } : null}
            />
            <MetricCard
              label="평균 R:R" icon="🎯"
              tooltip={"평균 Risk/Reward\n수익 건의 평균 금액 ÷ 손실 건의 평균 금액.\n2.0 이상이면 한 번 이길 때 잃을 때의 2배를 번다는 뜻.\n승률이 낮아도 R:R이 높으면 수익 가능."}
              value={briefing.overallMetrics?.avgRR != null && Number.isFinite(briefing.overallMetrics.avgRR) ? `${briefing.overallMetrics.avgRR.toFixed(2)}` : '—'}
              color={briefing.overallMetrics?.avgRR >= 2.0 ? '#00c853' : briefing.overallMetrics?.avgRR >= 1.0 ? '#42a5f5' : '#ffc107'}
              subLabel={briefing.overallMetrics?.avgRR >= 2.0 ? '평균 수익 > 2배 손실' : briefing.overallMetrics?.avgRR >= 1.0 ? '수익 ≥ 손실' : briefing.totalTrades >= 5 ? '손실이 수익보다 큼' : null}
            />
            <MetricCard
              label="EV" icon="📊"
              tooltip={"기대값 (Expected Value)\n한 건당 평균적으로 얼마를 벌거나 잃는지.\n(승률 × 평균수익) - (패률 × 평균손실)로 계산.\n양수면 장기적으로 수익, 음수면 장기적으로 손실."}
              value={evStr}
              color={evVal !== null && evVal >= 0 ? '#00c853' : '#ff1744'}
              subLabel={briefing.ev.trend === 'DECLINING' ? '↓ 하락 추세' : briefing.ev.trend === 'RISING' ? '↑ 상승 추세' : null}
              gauge={evVal !== null ? { value: Math.abs(evVal), max: 30, danger: evVal < -3 } : null}
            />
            <MetricCard
              label="낙폭 (HWM)" icon="📉"
              tooltip={"낙폭 / 드로우다운 (Drawdown)\n최고점(HWM) 대비 현재까지 얼마나 떨어졌는지.\n예: 최고 $10,000에서 현재 $7,170이면 DD 28.3%.\nDEX 시장에서 20~30%는 흔히 발생."}
              value={ddStr}
              color={ddVal > 0.15 ? '#ff1744' : ddVal > 0.05 ? '#ffc107' : '#6B7280'}
              dangerBlink={ddVal > 0.15}
              gauge={ddVal > 0.005 ? { value: ddPct, max: 30, danger: ddVal > 0.15 } : null}
            />
            <MetricCard
              label="거래 수" icon="📋"
              tooltip={"이번 달 총 트레이드 수.\n데이터가 많을수록 PF, EV 등 지표의 신뢰도가 올라감.\n최소 20건 이상이어야 통계적으로 의미 있음."}
              value={`${briefing.totalTrades}건`}
              color="#a0a0a0"
            />
            <MetricCard
              label="심리 상태" icon={em.emoji}
              tooltip={"현재 매매 패턴으로 추정한 심리 상태.\n안정: 계획매매 위주, 일정한 사이즈\n주의: 뇌동매매 증가 또는 사이즈 변동\n위험: 연속 손실 + 사이즈 확대 패턴"}
              value={em.text}
              color={em.color}
              subLabel={briefing.emotion?.detail || null}
            />
          </div>

          {/* ── 메인 영역: 좌측(판단) + 우측(카테고리) ─── */}
          <div style={{ display: 'flex', gap: 16 }}>

            {/* 좌측: 이서후 판단 (60-65%) */}
            <div style={{ flex: '0 0 62%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 이서후 판단 (v4: 리스트 형식) */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '12px 14px',
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: '#4a4a5a',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  fontFamily: 'Inter, monospace', marginBottom: 8,
                }}>이서후 판단</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Array.isArray(briefing.judgment) ? (
                    <>
                      {(judgmentExpanded ? briefing.judgment : briefing.judgment.slice(0, 3)).map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
                          <p style={{
                            fontSize: 15, lineHeight: 1.8, color: '#d0d0d0', margin: 0,
                            fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
                          }}>
                            {highlightKeywords(item.text)}
                          </p>
                        </div>
                      ))}
                      {briefing.judgment.length > 3 && (
                        <button
                          onClick={() => setJudgmentExpanded(v => !v)}
                          style={{
                            fontSize: 12, color: '#6b7280', cursor: 'pointer',
                            padding: '4px 0', background: 'none', border: 'none',
                            textAlign: 'left', fontFamily: "'Noto Sans KR', sans-serif",
                          }}
                        >
                          {judgmentExpanded ? '접기 ▲' : '더보기 ▼'}
                        </button>
                      )}
                    </>
                  ) : (
                    <p style={{
                      fontSize: 15, lineHeight: 1.8, color: '#d0d0d0', margin: 0,
                      fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
                    }}>
                      {highlightKeywords(briefing.judgment)}
                    </p>
                  )}
                </div>
              </div>

              {/* 지금 해야 할 플레이 + 금지 행동 */}
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  flex: highlightForbid ? '0 0 40%' : highlightPlay ? '0 0 60%' : 1,
                  background: highlightPlay ? 'rgba(255,193,7,0.06)' : 'rgba(16,185,129,0.03)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: `3px solid ${highlightPlay ? '#fbbf24' : '#00c853'}`,
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: highlightPlay ? '#fbbf24' : '#00c853',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    fontFamily: 'Inter, monospace', marginBottom: 6,
                  }}>✅ 지금 해야 할 플레이</div>
                  <p style={{
                    fontSize: 15, lineHeight: 1.7, color: '#9ca3af', margin: 0,
                    fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
                  }}>{briefing.playNow}</p>
                </div>
                <div style={{
                  flex: highlightForbid ? '0 0 60%' : highlightPlay ? '0 0 40%' : 1,
                  background: highlightForbid ? 'rgba(255,23,68,0.08)' : 'rgba(239,68,68,0.03)',
                  border: '1px solid rgba(255,255,255,0.04)',
                  borderLeft: `3px solid ${highlightForbid ? '#ff1744' : '#ef444480'}`,
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: '#ff1744',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    fontFamily: 'Inter, monospace', marginBottom: 6,
                  }}>🚫 금지 행동</div>
                  <p style={{
                    fontSize: 15, lineHeight: 1.7, color: '#f87171aa', margin: 0,
                    fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
                  }}>{briefing.forbidden}</p>
                </div>
              </div>

              {/* 사이즈 전략 */}
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: '10px 12px',
              }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: '#4a4a5a',
                  textTransform: 'uppercase', letterSpacing: '0.12em',
                  fontFamily: 'Inter, monospace', marginBottom: 6,
                }}>사이즈 전략</div>
                <p style={{
                  fontSize: 15, lineHeight: 1.7, color: '#9ca3af', margin: 0,
                  fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
                }}>{briefing.sizeStrategy}</p>
              </div>

              {/* 아코디언 분석 섹션들 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* 지뢰플레이 현황 */}
                {briefing.mineAnalysis && (
                  <AccordionSection
                    title="💣 지뢰플레이 현황"
                    severity={briefing.mineAnalysis.severity}
                    summaryLine={briefing.mineAnalysis.summaryLine}
                    defaultOpen={false}
                  >
                    <MinePlayContent mine={briefing.mineAnalysis} />
                  </AccordionSection>
                )}

                {/* 매매 품질 분석 (계획 vs 뇌동) */}
                {briefing.tradeQuality?.hasData && (
                  <AccordionSection
                    title="🧠 매매 품질 분석"
                    severity={briefing.tradeStyleAnalysis?.severity >= 2 ? 2 : 0}
                    summaryLine={briefing.tradeQuality.summaryLine}
                    defaultOpen={false}
                  >
                    <TradeQualityCards tradeQuality={briefing.tradeQuality} />
                  </AccordionSection>
                )}

                {/* 최근 흐름 */}
                {briefing.recentFlow && briefing.recentFlow.type !== 'idle' && (
                  <AccordionSection
                    title="📈 최근 흐름"
                    severity={0}
                    summaryLine={briefing.recentFlow.detail}
                    defaultOpen={false}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{
                        fontSize: 14, fontWeight: 700,
                        color: briefing.recentFlow.type === 'hot_streak' ? '#00c853' :
                               briefing.recentFlow.type === 'cold_streak' ? '#ff1744' :
                               briefing.recentFlow.type === 'winning' ? '#10B981aa' :
                               briefing.recentFlow.type === 'losing' ? '#EF4444aa' : '#6b7280',
                        fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
                      }}>
                        {briefing.recentFlow.detail}
                      </span>
                      <span style={{
                        fontSize: 13, color: '#4b5563', fontFamily: 'Inter, monospace',
                      }}>
                        최근 승률 {(briefing.recentFlow.recentWinRate * 100).toFixed(0)}%
                      </span>
                    </div>
                  </AccordionSection>
                )}
              </div>

              {/* 목표 진행 */}
              <div style={{
                fontSize: 13, color: '#6b7280', lineHeight: 1.7,
                fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
              }}>
                {briefing.targetView}
              </div>

              {/* 비거래일 브리핑 */}
              {briefing.noTradeBriefing && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: '10px 12px',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700, color: '#4a4a5a',
                    textTransform: 'uppercase', letterSpacing: '0.12em',
                    fontFamily: 'Inter, monospace', marginBottom: 6,
                  }}>오늘의 관망 브리핑</div>
                  <p style={{
                    fontSize: 14, lineHeight: 1.7, color: '#9ca3af', margin: 0,
                    fontStyle: 'italic',
                    fontFamily: "'Noto Sans KR', sans-serif", letterSpacing: '0.3px',
                  }}>{briefing.noTradeBriefing}</p>
                </div>
              )}
            </div>

            {/* 우측: 카테고리 판단 (35-40%) */}
            <div style={{ flex: '0 0 36%', minWidth: 0 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: '#4a4a5a',
                textTransform: 'uppercase', letterSpacing: '0.12em',
                fontFamily: 'Inter, monospace', marginBottom: 10,
              }}>카테고리 판단</div>

              {briefing.categories.length === 0 ? (
                <p style={{ fontSize: 14, color: '#6b7280' }}>카테고리 데이터 없음</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {briefing.categories.map(cat => (
                    <CategoryCard key={cat.trade_type} cat={cat} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .seohu-blink {
          animation: seohuBlink 1s ease-in-out infinite;
        }
        @keyframes seohuBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes seohuFadeIn {
          from { opacity: 0; transform: translate(-50%, -100%) translateY(4px); }
          to { opacity: 1; transform: translate(-50%, -100%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
