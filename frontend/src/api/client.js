import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

/** API 에러에서 메시지 추출 (FastAPI validation 등) */
export function getErrorMessage(err) {
  const detail = err?.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
  }
  if (typeof detail === 'string') return detail
  return err?.message || 'Request failed'
}

export default apiClient
