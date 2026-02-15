/** 천 단위 콤마 */
export function formatNumber(num) {
  if (num == null || isNaN(num)) return '0'
  return Math.round(num).toLocaleString()
}

/** PNL K 단위 표시 (+$13.8K, -$1.2K) */
export function formatPnl(num) {
  if (num == null || isNaN(num)) return '$0'
  const sign = num >= 0 ? '+' : '-'
  const abs = Math.abs(num)
  if (abs >= 1000) {
    const k = (abs / 1000).toFixed(1).replace(/\.0$/, '')
    return `${sign}$${k}K`
  }
  return `${sign}$${formatNumber(abs)}`
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

/** 날짜 포맷: 2026년 2월 15일 (토) — 로컬 기준 */
export function formatDateKo(dateStr) {
  const d = parseDateLocal(dateStr)
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = getWeekdayKo(dateStr)
  return `${year}년 ${month}월 ${day}일 (${weekday})`
}

/** 월 표시: 2026년 2월 (KST) — 로컬 기준 */
export function formatMonthKst(year, month) {
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
  return `${year}년 ${monthNames[month - 1]} (KST)`
}
