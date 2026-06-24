import type { Recommendation, Restaurant } from './types'

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 45000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const data = await response.json()
    if (!response.ok) {
      throw new Error((data as { error?: string }).error || '请求失败')
    }
    return data as T
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求超时，服务可能正在唤醒，请重试')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function fetchIpLocation(): Promise<{ lat: number; lng: number; city: string }> {
  return fetchJson('/api/location/ip')
}

export async function fetchRestaurants(lat: number, lng: number): Promise<{
  restaurants: Restaurant[]
  mockMode: boolean
  count: number
}> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: '2000',
  })

  const url = `/api/restaurants?${params}`
  try {
    return await fetchJson(url)
  } catch (firstError) {
    await new Promise((r) => setTimeout(r, 2000))
    return fetchJson(url)
  }
}

export interface RecommendPayload {
  mood: string[]
  tastes: string[]
  cuisines: string[]
  budget?: string
  otherNotes?: string
  historyHint?: string
  excludeNames?: string[]
  restaurants: Restaurant[]
}

export async function fetchRecommendations(
  payload: RecommendPayload,
): Promise<{ recommendations: Recommendation[]; usedMock: boolean; fallbackReason?: string }> {
  const response = await fetch('/api/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.error || 'AI 推荐失败')
  }

  return data
}

export function openNavigation(
  restaurant: Restaurant,
  userLocation?: { lat: number; lng: number } | null,
) {
  const parts = restaurant.location.split(',')
  const lng = Number(parts[0])
  const lat = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return

  const destName = encodeURIComponent(restaurant.name)
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isMac = /Mac/.test(navigator.userAgent) && !isIOS

  const amapNav = buildAmapNavUrl(lng, lat, restaurant.name, userLocation)

  // Mac 上优先 Apple 地图路线（步行导航到终点）
  if (isMac) {
    const appleNav = userLocation
      ? `https://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}&daddr=${lat},${lng}&q=${destName}&dirflg=w`
      : `https://maps.apple.com/?daddr=${lat},${lng}&q=${destName}&dirflg=w`
    window.open(appleNav, '_blank')
    return
  }

  // 手机 / 其他：高德路线规划（callnative=1 会尝试唤起 App 并设好终点）
  if (isIOS) {
    window.location.href = amapNav
    return
  }

  window.open(amapNav, '_blank')
}

function buildAmapNavUrl(
  lng: number,
  lat: number,
  name: string,
  from?: { lat: number; lng: number } | null,
) {
  const params = [
    `to=${lng},${lat},${encodeURIComponent(name)}`,
    'mode=walk',
    'coordinate=gaode',
    'callnative=1',
  ]
  if (from) {
    params.push(`from=${from.lng},${from.lat},${encodeURIComponent('我的位置')}`)
  }
  return `https://uri.amap.com/navigation?${params.join('&')}`
}

export type { Recommendation, Restaurant }
