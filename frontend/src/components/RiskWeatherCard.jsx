/**
 * RiskWeatherCard.jsx — EV / Kelly 행동 번역 카드
 *
 * 숫자 지표를 "리스크 날씨"로 번역해 직관적으로 보여준다.
 * - 날씨 상태: 쾌청 / 맑음 / 흐림 / 비 / 폭풍
 * - 공격 적합도 / 권장 사이즈 / 짧은 해석
 */

const WEATHER_MAP = {
  // kelly >= 8 && ev >= 3
  storm_clear: {
    icon: '☀️',
    status: '쾌청',
    statusEn: 'CLEAR SKY',
    color: '#4ade80',
    borderColor: '#22c55e',
    aggression: '높음',
    sizing: '정상~약간 공격적',
    interpretation: '통계적 우위가 확보된 상태. 좋은 셋업이 오면 정상 크기로 진입해도 좋다.',
  },
  // kelly 3~8 && ev >= 0
  fair: {
    icon: '🌤️',
    status: '맑음',
    statusEn: 'FAIR',
    color: '#60a5fa',
    borderColor: '#3b82f6',
    aggression: '보통',
    sizing: '정상',
    interpretation: '나쁘지 않은 상태. 기본 전략을 유지하되 욕심은 금물.',
  },
  // kelly 0~3 || ev 약간 양수
  cloudy: {
    icon: '☁️',
    status: '흐림',
    statusEn: 'CLOUDY',
    color: '#9ca3af',
    borderColor: '#6b7280',
    aggression: '낮음',
    sizing: '축소',
    interpretation: '우위가 불분명하다. 크기를 줄이고 판 선별을 강화해라.',
  },
  // kelly 음수 || ev 음수
  rain: {
    icon: '🌧️',
    status: '비',
    statusEn: 'RAIN',
    color: '#f59e0b',
    borderColor: '#d97706',
    aggression: '최소',
    sizing: '최소 사이즈만',
    interpretation: '통계적 우위가 없다. 진입을 최소화하고 관망 우선.',
  },
  // kelly << 음수 || 연패 + ev 음수
  storm: {
    icon: '⛈️',
    status: '폭풍',
    statusEn: 'STORM',
    color: '#ef4444',
    borderColor: '#dc2626',
    aggression: '금지',
    sizing: '진입 금지 권장',
    interpretation: '지금은 매매할 조건이 아니다. 즉시 멈추고 복기부터 해라.',
  },
}

function getWeather(kellyPercent = 0, currentEv = 0, streakLoss = 0) {
  if (kellyPercent < -5 || (streakLoss >= 5 && currentEv < 0)) return WEATHER_MAP.storm
  if (kellyPercent < 0 || currentEv < -2)                       return WEATHER_MAP.rain
  if (kellyPercent < 3 || currentEv < 1)                        return WEATHER_MAP.cloudy
  if (kellyPercent >= 8 && currentEv >= 3)                       return WEATHER_MAP.storm_clear
  return WEATHER_MAP.fair
}

export default function RiskWeatherCard({ analytics, trades = [] }) {
  const kellyPercent = analytics?.kelly_percent ?? 0
  const evCurve      = analytics?.ev_curve ?? []
  const currentEv    = evCurve.length > 0 ? (evCurve[evCurve.length - 1]?.ev_percent ?? 0) : 0

  // 연패 계산
  const dayPnl = {}
  trades.forEach((t) => { dayPnl[t.date] = (dayPnl[t.date] ?? 0) + Number(t.pnl || 0) })
  const sortedDays = Object.entries(dayPnl).sort(([a], [b]) => b.localeCompare(a))
  let streakLoss = 0
  for (const [, pnl] of sortedDays) {
    if (pnl < 0) streakLoss++
    else break
  }

  const w = getWeather(kellyPercent, currentEv, streakLoss)

  return (
    <div style={{
      background: '#0d0d0d',
      border: `1px solid ${w.borderColor}44`,
      borderRadius: '12px',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 좌측 장식선 */}
      <div style={{
        position: 'absolute', top: 0, left: 0,
        width: '3px', height: '100%',
        background: w.borderColor,
        opacity: 0.7,
        borderRadius: '12px 0 0 12px',
      }} />

      {/* 헤더 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12, paddingLeft: 8,
      }}>
        <span style={{
          fontSize: 9, fontWeight: 700, color: '#6b7280',
          fontFamily: 'Inter, monospace', letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          리스크 날씨
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700,
          fontFamily: 'Inter, monospace',
          color: w.color,
          background: `${w.color}18`,
          border: `1px solid ${w.color}44`,
          borderRadius: 4, padding: '2px 7px',
          letterSpacing: '0.08em',
        }}>
          {w.statusEn}
        </span>
      </div>

      {/* 메인 날씨 표시 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        paddingLeft: 8, marginBottom: 14,
      }}>
        <span style={{ fontSize: 36 }}>{w.icon}</span>
        <div>
          <div style={{
            fontSize: 18, fontWeight: 800, color: w.color,
            fontFamily: 'Inter, monospace',
          }}>
            {w.status}
          </div>
          <div style={{ fontSize: 10, color: '#6b7280', fontFamily: 'Inter, monospace' }}>
            Kelly {kellyPercent >= 0 ? '+' : ''}{Math.round(kellyPercent)}% · EV {currentEv >= 0 ? '+' : ''}{currentEv.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* 지표 그리드 */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
        paddingLeft: 8, marginBottom: 12,
      }}>
        <WeatherStat label="공격 적합도" value={w.aggression} color={w.color} />
        <WeatherStat label="권장 사이즈" value={w.sizing} color={w.color} />
      </div>

      {/* 해석 */}
      <div style={{
        paddingLeft: 8,
        borderTop: '1px solid #1f2937',
        paddingTop: 10,
        fontSize: 11, color: '#9ca3af',
        lineHeight: 1.6,
        fontFamily: "'Noto Sans KR', '맑은 고딕', sans-serif",
      }}>
        {w.interpretation}
      </div>
    </div>
  )
}

function WeatherStat({ label, value, color }) {
  return (
    <div style={{ background: '#111', borderRadius: 8, padding: '8px 10px' }}>
      <div style={{
        fontSize: 9, color: '#4b5563',
        fontFamily: 'Inter, monospace', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 12, fontWeight: 700, color,
        fontFamily: 'Inter, monospace',
      }}>
        {value}
      </div>
    </div>
  )
}
