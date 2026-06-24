import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import { fetchIpLocation, fetchNearbyRestaurants, getMockRestaurants } from './amap.js'
import { getRecommendations } from './ai.js'
import { prepareRecommendRequest } from './recommendPrep.js'
import type { DecideRequest, RecommendRequest } from './types.js'

dotenv.config({ override: false })

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

const app = express()
const PORT = Number(process.env.PORT) || 3001

app.use(cors())
app.use(express.json())

const AMAP_KEY = process.env.AMAP_KEY
const AI_API_KEY = process.env.AI_API_KEY
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1'
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat'
const MOCK_MODE =
  process.env.MOCK_MODE === 'true' ||
  !AMAP_KEY ||
  AMAP_KEY.startsWith('your_')

function getClientIp(req: express.Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]?.trim()
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(',')[0]?.trim()
  }
  return req.socket.remoteAddress?.replace(/^::ffff:/, '')
}

app.set('trust proxy', true)

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mockMode: MOCK_MODE,
    hasAmapKey: Boolean(AMAP_KEY),
    hasAiKey: Boolean(AI_API_KEY),
  })
})

app.get('/api/location/ip', async (req, res) => {
  try {
    const location = await fetchIpLocation(AMAP_KEY, getClientIp(req))
    res.json(location)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'IP 定位失败'
    res.status(500).json({ error: message })
  }
})

app.get('/api/restaurants', async (req, res) => {
  const lat = Number(req.query.lat)
  const lng = Number(req.query.lng)
  const radius = Number(req.query.radius) || 4000

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: '请提供有效的 lat 和 lng 参数' })
    return
  }

  try {
    if (MOCK_MODE) {
      const restaurants = getMockRestaurants(lat, lng)
      res.json({ restaurants, mockMode: true, count: restaurants.length })
      return
    }

    const { restaurants, total } = await fetchNearbyRestaurants(lat, lng, radius, AMAP_KEY!)
    res.json({ restaurants, mockMode: false, count: total })
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取餐厅失败'
    res.status(500).json({ error: message })
  }
})

async function runRecommendPipeline(body: RecommendRequest) {
  const { req, locationAnchor, locationAnchorFailed } = await prepareRecommendRequest(body, {
    amapKey: AMAP_KEY,
    mockMode: MOCK_MODE,
    userLat: body.userLat,
    userLng: body.userLng,
  })

  if (!req.restaurants.length) {
    const err = new Error(
      locationAnchor
        ? `「${locationAnchor.name}」3km 内没有找到足够餐厅，试试换个地点描述`
        : '没有可用的餐厅列表',
    ) as Error & { status?: number }
    err.status = 400
    throw err
  }

  const result = await getRecommendations(
    {
      mood: req.mood || [],
      tastes: req.tastes || [],
      cuisines: req.cuisines || [],
      diningStyle: req.diningStyle,
      budget: req.budget,
      otherNotes: req.otherNotes,
      historyHint: req.historyHint,
      locationAnchor: req.locationAnchor,
      excludeNames: req.excludeNames,
      cooldownNames: req.cooldownNames,
      restaurants: req.restaurants,
    },
    AI_API_KEY,
    AI_BASE_URL,
    AI_MODEL,
  )

  return { ...result, locationAnchor, locationAnchorFailed, restaurants: req.restaurants }
}

app.post('/api/decide', async (req, res) => {
  const body = req.body as DecideRequest
  const lat = Number(body.lat)
  const lng = Number(body.lng)

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: '需要位置信息才能找店，请允许定位或使用网络定位' })
    return
  }

  try {
    let restaurants
    let mockMode = MOCK_MODE
    let count = 0

    if (MOCK_MODE) {
      restaurants = getMockRestaurants(lat, lng)
      count = restaurants.length
    } else {
      const fetched = await fetchNearbyRestaurants(lat, lng, 4000, AMAP_KEY!)
      restaurants = fetched.restaurants
      count = fetched.total
    }

    const result = await runRecommendPipeline({
      mood: body.mood || [],
      tastes: body.tastes || [],
      cuisines: body.cuisines || [],
      diningStyle: body.diningStyle,
      budget: body.budget,
      otherNotes: body.otherNotes,
      historyHint: body.historyHint,
      locationCity: body.locationCity,
      userLat: lat,
      userLng: lng,
      restaurants,
    })

    res.json({ ...result, mockMode, count })
  } catch (error) {
    const message = error instanceof Error ? error.message : '推荐失败'
    const status = (error as Error & { status?: number }).status ?? 500
    res.status(status).json({ error: message })
  }
})

app.post('/api/recommend', async (req, res) => {
  const body = req.body as RecommendRequest

  if (!body.restaurants?.length) {
    res.status(400).json({ error: '餐厅列表不能为空' })
    return
  }

  try {
    const result = await runRecommendPipeline(body)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : '推荐失败'
    const status = (error as Error & { status?: number }).status ?? 500
    res.status(status).json({ error: message })
  }
})

if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🍜 今天吃什么 → http://0.0.0.0:${PORT}`)
  console.log(`   高德: ${MOCK_MODE ? '模拟数据' : '真实 POI'} | AI: ${AI_API_KEY && !AI_API_KEY.startsWith('your_') ? '已配置' : '规则兜底'}`)
})
