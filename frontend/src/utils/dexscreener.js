/**
 * DexScreener API utility — ATH 데이터 조회 + 로컬 캐싱
 *
 * 캐시 유효기간: 24시간
 * Rate limit: 요청 간 300ms 딜레이
 */

const CACHE_KEY = 'dex_ath_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

function saveCache(cache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)) } catch {}
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/**
 * DexScreener에서 토큰 pair 데이터를 가져온다.
 * @param {string} ca — Contract Address
 * @returns {Promise<object|null>} pair 데이터 또는 null
 */
async function fetchTokenPairs(ca) {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`)
  if (!res.ok) return null
  const json = await res.json()
  if (!json.pairs || json.pairs.length === 0) return null
  // 가장 유동성 높은 pair 선택
  const sorted = json.pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
  return sorted[0]
}

/**
 * 단일 CA에 대해 ATH 관련 정보를 조회한다.
 * @param {string} ca
 * @param {boolean} forceRefresh — 캐시 무시
 * @returns {Promise<{priceUsd: number, athUsd: number|null, athDate: string|null, pairAddress: string, baseToken: object, chainId: string} | null>}
 */
export async function fetchTokenATHData(ca, forceRefresh = false) {
  if (!ca) return null

  const cache = loadCache()
  const cached = cache[ca]
  if (!forceRefresh && cached && (Date.now() - cached.ts < CACHE_TTL)) {
    return cached.data
  }

  const pair = await fetchTokenPairs(ca)
  if (!pair) {
    // 캐시에 null 저장 (반복 요청 방지)
    cache[ca] = { ts: Date.now(), data: null }
    saveCache(cache)
    return null
  }

  const data = {
    priceUsd: Number(pair.priceUsd) || 0,
    pairAddress: pair.pairAddress,
    baseToken: pair.baseToken,
    chainId: pair.chainId,
    url: pair.url,
    // DexScreener pair 데이터에서 가져올 수 있는 정보
    priceChange24h: pair.priceChange?.h24 ?? null,
    volume24h: pair.volume?.h24 ?? null,
    fdv: pair.fdv ?? null,
    marketCap: pair.marketCap ?? null,
  }

  cache[ca] = { ts: Date.now(), data }
  saveCache(cache)
  return data
}

/**
 * 여러 CA를 배치로 조회 (300ms 딜레이)
 * @param {string[]} cas — CA 배열
 * @param {boolean} forceRefresh
 * @param {(done: number, total: number) => void} onProgress
 * @returns {Promise<Map<string, object|null>>}
 */
export async function fetchBatchATHData(cas, forceRefresh = false, onProgress) {
  const results = new Map()
  const uniqueCas = [...new Set(cas.filter(Boolean))]

  for (let i = 0; i < uniqueCas.length; i++) {
    const ca = uniqueCas[i]
    try {
      const data = await fetchTokenATHData(ca, forceRefresh)
      results.set(ca, data)
    } catch {
      results.set(ca, null)
    }
    onProgress?.(i + 1, uniqueCas.length)
    if (i < uniqueCas.length - 1) await sleep(300)
  }

  return results
}

/** 캐시 초기화 */
export function clearATHCache() {
  localStorage.removeItem(CACHE_KEY)
}
