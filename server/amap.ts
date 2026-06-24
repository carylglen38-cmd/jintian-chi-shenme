import type { Restaurant } from './types.js'

const MOCK_NAMES = [
  { name: '老地方兰州拉面', type: '面食' },
  { name: '川味小馆', type: '川菜' },
  { name: '寿司の屋', type: '日料' },
  { name: '黄焖鸡米饭', type: '快餐' },
  { name: '潮汕牛肉火锅', type: '火锅' },
  { name: '轻食沙拉工坊', type: '轻食' },
  { name: '东北饺子馆', type: '面食' },
  { name: '湘味小炒', type: '湘菜' },
  { name: '泰式料理', type: '东南亚菜' },
  { name: '披萨意面屋', type: '西餐' },
  { name: '麻辣烫', type: '小吃' },
  { name: '粤式茶餐厅', type: '粤菜' },
  { name: '韩式烤肉', type: '韩餐' },
  { name: '沙县小吃', type: '快餐' },
  { name: '云南过桥米线', type: '面食' },
  { name: '港式烧腊', type: '粤菜' },
  { name: '重庆小面', type: '面食' },
  { name: '日式咖喱饭', type: '日料' },
  { name: '新疆大盘鸡', type: '西北菜' },
  { name: '素食小厨', type: '素食' },
]

function randomOffset(): number {
  return (Math.random() - 0.5) * 0.02
}

export function getMockRestaurants(lat: number, lng: number): Restaurant[] {
  return MOCK_NAMES.map((item, index) => {
    const distance = Math.floor(100 + Math.random() * 1900)
    const offsetLat = lat + randomOffset()
    const offsetLng = lng + randomOffset()

    return {
      id: `mock-${index}`,
      name: item.name,
      type: item.type,
      address: `模拟地址 · 距离约 ${distance}m`,
      distance,
      distanceText: distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`,
      location: `${offsetLng},${offsetLat}`,
    }
  }).sort((a, b) => a.distance - b.distance)
}

interface AmapPoi {
  id: string
  name: string
  type: string
  address: string
  distance: string
  location: string
  tel?: string
}

function mapPoi(poi: AmapPoi): Restaurant {
  const distance = Number(poi.distance) || 0
  const typeParts = poi.type.split(';')
  const type = typeParts[typeParts.length - 1] || '餐饮'

  return {
    id: poi.id,
    name: poi.name,
    type,
    address: poi.address || '地址未知',
    distance,
    distanceText: formatDistanceText(distance),
    location: poi.location,
    tel: Array.isArray(poi.tel) ? poi.tel[0] : poi.tel,
  }
}

export function formatDistanceText(distance: number): string {
  return distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(1)}km`
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

export function withDistancesFromPoint(
  restaurants: Restaurant[],
  lat: number,
  lng: number,
): Restaurant[] {
  return restaurants
    .map((r) => {
      const parts = r.location.split(',')
      const rLng = Number(parts[0])
      const rLat = Number(parts[1])
      if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) return r
      const distance = haversineMeters(lat, lng, rLat, rLng)
      return { ...r, distance, distanceText: formatDistanceText(distance) }
    })
    .sort((a, b) => a.distance - b.distance)
}

export async function geocodePlace(
  placeName: string,
  apiKey: string,
  cityHint?: string,
): Promise<{ lat: number; lng: number; name: string } | null> {
  const url = new URL('https://restapi.amap.com/v3/geocode/geo')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('address', placeName)
  if (cityHint) {
    const city = cityHint.replace(/市$/u, '')
    url.searchParams.set('city', city)
  }

  const response = await fetch(url)
  const data = (await response.json()) as {
    status: string
    geocodes?: Array<{ location: string; formatted_address?: string }>
  }

  if (data.status !== '1' || !data.geocodes?.[0]?.location) return null

  const [lng, lat] = data.geocodes[0].location.split(',').map(Number)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return {
    lat,
    lng,
    name: data.geocodes[0].formatted_address?.split(',')[0] || placeName,
  }
}

async function fetchAroundPage(
  lat: number,
  lng: number,
  radius: number,
  apiKey: string,
  page: number,
): Promise<{ pois: AmapPoi[]; total: number }> {
  const url = new URL('https://restapi.amap.com/v3/place/around')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('location', `${lng},${lat}`)
  url.searchParams.set('radius', String(radius))
  url.searchParams.set('types', '050000')
  url.searchParams.set('offset', '25')
  url.searchParams.set('page', String(page))
  url.searchParams.set('extensions', 'all')

  const response = await fetch(url)
  const data = (await response.json()) as {
    status: string
    info: string
    count?: string
    pois?: AmapPoi[]
  }

  if (data.status !== '1') {
    throw new Error(data.info || '高德 POI 查询失败')
  }

  return {
    pois: data.pois ?? [],
    total: Number(data.count) || 0,
  }
}

export async function fetchNearbyRestaurants(
  lat: number,
  lng: number,
  radius: number,
  apiKey: string,
): Promise<{ restaurants: Restaurant[]; total: number }> {
  const allPois: AmapPoi[] = []
  const seen = new Set<string>()
  let total = 0
  const maxPages = 12

  for (let page = 1; page <= maxPages; page++) {
    const { pois, total: count } = await fetchAroundPage(lat, lng, radius, apiKey, page)
    if (page === 1) total = count

    for (const poi of pois) {
      if (!seen.has(poi.id)) {
        seen.add(poi.id)
        allPois.push(poi)
      }
    }

    if (!pois.length) break
    if (allPois.length >= total) break

    const mapped = allPois.map(mapPoi)
    if (page >= 3 && hasDiverseDistancePool(mapped)) break
    if (allPois.length >= 120) break
  }

  if (!allPois.length) {
    throw new Error('未找到附近餐厅')
  }

  const restaurants = buildDiversifiedPool(allPois.map(mapPoi), 80)

  return {
    restaurants,
    total: total || allPois.length,
  }
}

const POOL_BUCKETS = [
  { min: 0, max: 400, quota: 10 },
  { min: 400, max: 1200, quota: 20 },
  { min: 1200, max: 2500, quota: 25 },
  { min: 2500, max: Infinity, quota: 25 },
] as const

function countInPoolBucket(restaurants: Restaurant[], min: number, max: number): number {
  return restaurants.filter((r) => r.distance >= min && r.distance < max).length
}

function hasDiverseDistancePool(restaurants: Restaurant[]): boolean {
  return (
    countInPoolBucket(restaurants, 1200, Infinity) >= 8 &&
    countInPoolBucket(restaurants, 400, 1200) >= 8 &&
    countInPoolBucket(restaurants, 0, 400) >= 5
  )
}

function buildDiversifiedPool(restaurants: Restaurant[], maxTotal: number): Restaurant[] {
  const sorted = [...restaurants].sort((a, b) => a.distance - b.distance)
  const result: Restaurant[] = []
  const used = new Set<string>()

  for (const bucket of POOL_BUCKETS) {
    const inBucket = sorted.filter((r) => r.distance >= bucket.min && r.distance < bucket.max)
    let added = 0
    for (const r of inBucket) {
      if (added >= bucket.quota) break
      if (used.has(r.id)) continue
      used.add(r.id)
      result.push(r)
      added++
    }
  }

  for (const r of sorted) {
    if (result.length >= maxTotal) break
    if (!used.has(r.id)) {
      used.add(r.id)
      result.push(r)
    }
  }

  return result.slice(0, maxTotal)
}

const CITY_CENTERS: Record<string, { lat: number; lng: number; name: string }> = {
  '110000': { lat: 39.9042, lng: 116.4074, name: '北京市' },
  '310000': { lat: 31.2304, lng: 121.4737, name: '上海市' },
  '440100': { lat: 23.1291, lng: 113.2644, name: '广州市' },
  '440300': { lat: 22.5431, lng: 114.0579, name: '深圳市' },
  '330100': { lat: 30.2741, lng: 120.1551, name: '杭州市' },
  '510100': { lat: 30.5728, lng: 104.0668, name: '成都市' },
  '420100': { lat: 30.5928, lng: 114.3055, name: '武汉市' },
  '320100': { lat: 32.0603, lng: 118.7969, name: '南京市' },
  '500000': { lat: 29.563, lng: 106.5516, name: '重庆市' },
  '120000': { lat: 39.3434, lng: 117.3616, name: '天津市' },
}

export async function fetchIpLocation(
  apiKey?: string,
  clientIp?: string,
): Promise<{
  lat: number
  lng: number
  city: string
}> {
  const hasAmapKey = Boolean(apiKey && !apiKey.startsWith('your_'))
  const ip = clientIp?.replace(/^::ffff:/, '')

  if (hasAmapKey && ip) {
    try {
      const url = new URL('https://restapi.amap.com/v3/ip')
      url.searchParams.set('key', apiKey!)
      url.searchParams.set('ip', ip)
      const response = await fetch(url)
      const data = (await response.json()) as {
        status: string
        province?: string
        city?: string
        rectangle?: string
      }

      if (data.status === '1' && data.rectangle) {
        const [sw, ne] = data.rectangle.split(';')
        const [swLng, swLat] = sw.split(',').map(Number)
        const [neLng, neLat] = ne.split(',').map(Number)

        return {
          lat: (swLat + neLat) / 2,
          lng: (swLng + neLng) / 2,
          city: data.city || data.province || '当前城市',
        }
      }
    } catch {
      // fall through
    }
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const ipApiUrl = ip
      ? `http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN`
      : 'http://ip-api.com/json/?lang=zh-CN'
    const response = await fetch(ipApiUrl, {
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (response.ok) {
      const data = (await response.json()) as {
        lat?: number
        lon?: number
        city?: string
        status?: string
      }

      if (data.status === 'success' && data.lat && data.lon) {
        return {
          lat: data.lat,
          lng: data.lon,
          city: data.city || '当前城市',
        }
      }
    }
  } catch {
    // fall through
  }

  try {
    const response = await fetch('https://whois.pconline.com.cn/ipJson.jsp?json=true')
    if (response.ok) {
      const raw = await response.text()
      const cityCode = raw.match(/"cityCode":"(\d+)"/)?.[1]
      const proCode = raw.match(/"proCode":"(\d+)"/)?.[1]
      const code = cityCode && cityCode !== '0' ? cityCode : proCode

      if (code && CITY_CENTERS[code]) {
        const center = CITY_CENTERS[code]
        return { lat: center.lat, lng: center.lng, city: center.name }
      }

      const cityName = raw.match(/"city":"([^"]+)"/)?.[1] || raw.match(/"pro":"([^"]+)"/)?.[1]
      if (cityName && hasAmapKey) {
        const geoUrl = new URL('https://restapi.amap.com/v3/geocode/geo')
        geoUrl.searchParams.set('key', apiKey!)
        geoUrl.searchParams.set('address', cityName)
        const geoRes = await fetch(geoUrl)
        const geoData = (await geoRes.json()) as {
          status: string
          geocodes?: Array<{ location: string }>
        }

        if (geoData.status === '1' && geoData.geocodes?.[0]?.location) {
          const [lng, lat] = geoData.geocodes[0].location.split(',').map(Number)
          return { lat, lng, city: cityName }
        }
      }
    }
  } catch {
    // fall through
  }

  throw new Error('网络定位失败，请检查网络后重试')
}

