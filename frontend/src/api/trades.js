import apiClient, { getErrorMessage } from './client'

export { getErrorMessage }

export async function getTradesByMonth(year, month) {
  const { data } = await apiClient.get('/trades', { params: { year, month } })
  return data
}

export async function getTradesByDate(date) {
  const { data } = await apiClient.get('/trades/daily', { params: { date } })
  return data
}

export async function createTrade(payload) {
  const { data } = await apiClient.post('/trades', payload)
  return data
}

export async function updateTrade(id, payload) {
  const { data } = await apiClient.put(`/trades/${id}`, payload)
  return data
}

export async function deleteTrade(id) {
  await apiClient.delete(`/trades/${id}`)
}
