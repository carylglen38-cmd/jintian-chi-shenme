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
    radius: '4000',
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
  diningStyle?: string
  budget?: string
  otherNotes?: string
  historyHint?: string
  locationCity?: string
  userLat?: number
  userLng?: number
  excludeNames?: string[]
  cooldownNames?: string[]
  restaurants: Restaurant[]
}

export interface DecidePayload {
  lat: number
  lng: number
  mood: string[]
  tastes: string[]
  cuisines: string[]
  diningStyle?: string
  budget?: string
  otherNotes?: string
  historyHint?: string
  locationCity?: string
}

export async function fetchDecide(payload: DecidePayload): Promise<{
  recommendations: Recommendation[]
  usedMock: boolean
  fallbackReason?: string
  locationAnchor?: { name: string }
  locationAnchorFailed?: boolean
  restaurants: Restaurant[]
  mockMode: boolean
  count: number
}> {
  return fetchJson('/api/decide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function getFreshLocation(
  timeoutMs = 4000,
): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation || !window.isSecureContext) return null
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: timeoutMs,
        maximumAge: 60000,
      })
    })
    return { lat: position.coords.latitude, lng: position.coords.longitude }
  } catch {
    return null
  }
}

export async function fetchRecommendations(
  payload: RecommendPayload,
): Promise<{
  recommendations: Recommendation[]
  usedMock: boolean
  fallbackReason?: string
  locationAnchor?: { name: string }
  locationAnchorFailed?: boolean
  restaurants?: Restaurant[]
}> {
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
): { hasOrigin: boolean } {
  const parts = restaurant.location.split(',')
  const lng = Number(parts[0])
  const lat = Number(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { hasOrigin: false }

  const destName = encodeURIComponent(restaurant.name)
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
  const isMac = /Mac/.test(navigator.userAgent) && !isIOS
  const isAndroid = /Android/i.test(navigator.userAgent)
  const hasOrigin = Boolean(userLocation)

  const amapNav = buildAmapNavUrl(lng, lat, restaurant.name, userLocation)

  if (isMac) {
    const appleNav = userLocation
      ? `https://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}&daddr=${lat},${lng}&q=${destName}&dirflg=w`
      : `https://maps.apple.com/?daddr=${lat},${lng}&q=${destName}&dirflg=w`
    window.open(appleNav, '_blank')
    return { hasOrigin }
  }

  if (isIOS || isAndroid) {
    window.location.href = amapNav
    return { hasOrigin }
  }

  window.open(amapNav, '_blank')
  return { hasOrigin }
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
