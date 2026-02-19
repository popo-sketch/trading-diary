/** 천 단위 콤마 */
export function formatNumber(num) {
  if (num == null || isNaN(num)) return '0'
  return Math.round(num).toLocaleString()
}

/** PNL K/M 단위 표시 (+$13.80K, -$1.25M) — K·M는 소수점 둘째자리까지 */
export function formatPnl(num) {
  if (num == null || isNaN(num)) return '$0'
  const sign = num >= 0 ? '+' : '-'
  const abs = Math.abs(num)
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(2)}M`
  }
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(2)}K`
  }
  return `${sign}$${formatNumber(abs)}`
}

/** 차트 Y축용 짧은 PNL (+$10.5K, -$3.0K) — 소수점 1자리, 잘림 방지 */
export function formatPnlShort(num) {
  if (num == null || isNaN(num)) return '$0'
  const sign = num >= 0 ? '+' : '-'
  const abs = Math.abs(num)
  if (abs >= 1_000_000) {
    return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(1)}K`
  }
  return `${sign}$${formatNumber(abs)}`
}

/** MC/금액 표시: $100.0K, $1.5M, $1.2B — 소수점 1자리 (양수만, 부호 없음) */
export function formatDollarKMB(num) {
  if (num == null || isNaN(num) || num < 0) return '$0'
  const abs = Math.abs(num)
  if (abs >= 1_000_000_000) return `$${(abs / 1_000_000_000).toFixed(1)}B`
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}K`
  return `$${abs.toFixed(1)}`
}

/** 입력 필드용: 숫자만 추출 후 파싱 (콤마 제거) */
export function parseDollarInput(str) {
  if (str == null || typeof str !== 'string') return null
  const cleaned = str.replace(/,/g, '').trim()
  if (cleaned === '') return null
  const num = Number(cleaned)
  return Number.isFinite(num) ? num : null
}

/** 입력 필드용: 숫자를 천 단위 콤마 문자열로 표시 */
export function formatDollarInput(num) {
  if (num == null || isNaN(num) || !Number.isFinite(num)) return ''
  const s = Math.abs(num).toString().split('.')
  s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return s.join('.')
}

/**
 * YYYY-MM-DD를 로컬 기준 날짜로만 파싱 (자정 = 로컬 0시).
 * toISOString() 사용 금지 — UTC 변환 시 KST에서 날짜가 하루 밀림.
 */
export function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** 요일 한국어 (로컬 기준) */
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

export function getWeekdayKo(dateStr) {
  const d = parseDateLocal(dateStr)
  return WEEKDAY_KO[d.getDay()]
}

/** 요일 영어 (로컬 기준) */
const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function getWeekdayEn(dateStr) {
  const d = parseDateLocal(dateStr)
  return WEEKDAY_EN[d.getDay()]
}

/** 날짜 포맷: 2026년 2월 15일 (토) — 로컬 기준 */
export function formatDateKo(dateStr) {
  const d = parseDateLocal(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = getWeekdayKo(dateStr)
  return `${year}년 ${month}월 ${day}일 (${weekday})`
}

/** 날짜 포맷: Monday, February 2, 2026 — 로컬 기준 */
export function formatDateEn(dateStr) {
  const d = parseDateLocal(dateStr)
  const weekday = getWeekdayEn(dateStr)
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const month = monthNames[d.getMonth()]
  const day = d.getDate()
  const year = d.getFullYear()
  return `${weekday}, ${month} ${day}, ${year}`
}

/** 월 표시: February 2026 */
export function formatMonthKst(year, month) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${monthNames[month - 1]} ${year}`
}
