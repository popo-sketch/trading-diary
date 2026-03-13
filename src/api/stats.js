import apiClient from './client'

export async function getMonthlyStats(year, month) {
  const { data } = await apiClient.get('/stats', { params: { year, month } })
  return data
}
