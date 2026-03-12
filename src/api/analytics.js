import apiClient from './client'

export async function getAnalytics(year, month, bucketFilter) {
  const params = {}
  if (year) params.year = year
  if (month) params.month = month
  if (bucketFilter) params.bucket_filter = bucketFilter
  
  const { data } = await apiClient.get('/analytics', { params })
  return data
}
