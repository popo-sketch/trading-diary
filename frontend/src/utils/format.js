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

/** 한국 시간 기준 날짜 생성 (YYYY-MM-DD → KST 자정) */
export function dateKst(dateStr) {
  return new Date(dateStr + 'T00:00:00+09:00')
}

/** 요일 한국어 */
const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토']

export function getWeekdayKo(dateStr) {
  const d = dateKst(dateStr)
  return WEEKDAY_KO[d.getUTCDay()]
}

/** 날짜 포맷: 2026년 2월 15일 (토) - 한국 시간 기준 */
export function formatDateKo(dateStr) {
  const d = dateKst(dateStr)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth() + 1
  const day = d.getUTCDate()
  const weekday = getWeekdayKo(dateStr)
  return `${year}년 ${month}월 ${day}일 (${weekday})`
}

/** 월 표시: 2026년 2월 (KST) */
export function formatMonthKst(year, month) {
  const d = dateKst(`${year}-${String(month).padStart(2, '0')}-01`)
  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
  return `${d.getUTCFullYear()}년 ${monthNames[d.getUTCMonth()]} (KST)`
}
