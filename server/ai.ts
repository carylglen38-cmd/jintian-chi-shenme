import type { RecommendRequest, Recommendation, Restaurant } from './types.js'

const TOP_N = 5
const CANDIDATE_SIZE = 80

const SYSTEM_PROMPT = `你是「今天吃什么」的餐饮推荐助手。用户会提供心情、口味、菜系偏好、历史饮食习惯和附近真实餐厅列表。
你的任务是从列表中选出最合适的 ${TOP_N} 家餐厅，按推荐度排序。

规则：
1. 只能从提供的餐厅列表中选择，禁止编造不存在的店名
2. 优先考虑用户当前选择的菜系和口味，结合历史饮食习惯
3. 不要只推荐最近的店；在符合口味的前提下兼顾不同距离，可包含 1-2 家稍远但更值得去的店
4. 一周内用户已吃过的店不要推荐
5. 推荐理由要简短口语化，1-2 句话
6. 必须返回合法 JSON：{"recommendations":[{"name":"店名","reason":"理由","score":0.95}]}
7. score 范围 0-1，第一名最高
8. 必须推荐 ${TOP_N} 家（列表足够时），且店名互不重复`

function scoreRestaurant(r: Restaurant, keywords: string): number {
  const text = `${r.name} ${r.type}`
  let score = 0
  for (const kw of keywords.split(' ')) {
    if (!kw || kw.length < 2) continue
    if (text.includes(kw)) score += 2
  }
  return score
}

function getBlockedNames(req: RecommendRequest): Set<string> {
  return new Set([...(req.excludeNames ?? []), ...(req.cooldownNames ?? [])])
}

function filterPool(req: RecommendRequest): Restaurant[] {
  const blocked = getBlockedNames(req)
  return req.restaurants.filter((r) => !blocked.has(r.name))
}

function stratifiedByDistance(ranked: Restaurant[], targetSize: number): Restaurant[] {
  if (ranked.length <= targetSize) return ranked

  const near = ranked.filter((r) => r.distance <= 800)
  const mid = ranked.filter((r) => r.distance > 800 && r.distance <= 2000)
  const far = ranked.filter((r) => r.distance > 2000)

  const nNear = Math.round(targetSize * 0.3)
  const nMid = Math.round(targetSize * 0.4)
  const nFar = targetSize - nNear - nMid

  const result: Restaurant[] = []
  const seen = new Set<string>()

  const addFrom = (arr: Restaurant[], limit: number) => {
    let left = limit
    for (const r of arr) {
      if (left <= 0) break
      if (seen.has(r.id)) continue
      seen.add(r.id)
      result.push(r)
      left--
    }
  }

  addFrom(near, nNear)
  addFrom(mid, nMid)
  addFrom(far, nFar)

  for (const r of ranked) {
    if (result.length >= targetSize) break
    if (!seen.has(r.id)) {
      seen.add(r.id)
      result.push(r)
    }
  }

  return result
}

function pickCandidates(req: RecommendRequest): Restaurant[] {
  const pool = filterPool(req)
  if (!pool.length) return req.restaurants.slice(0, CANDIDATE_SIZE)

  const keywords = [...req.cuisines, ...req.tastes, ...req.mood].join(' ')
  const ranked = pool
    .map((r) => ({
      r,
      score: scoreRestaurant(r, keywords) - r.distance / 6000,
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.r)

  const sampled = stratifiedByDistance(ranked, CANDIDATE_SIZE)
  return sampled.length >= 20 ? sampled : pool.slice(0, CANDIDATE_SIZE)
}

function buildUserPrompt(req: RecommendRequest): string {
  const candidates = pickCandidates(req)
  const restaurantList = candidates
    .map((r) => `- ${r.name}（${r.type}，${r.distanceText}）`)
    .join('\n')

  const lines = [
    `心情：${req.mood.length ? req.mood.join('、') : '随便'}`,
    `口味：${req.tastes.length ? req.tastes.join('、') : '不限'}`,
    `想吃：${req.cuisines.length ? req.cuisines.join('、') : '不限'}`,
    `预算：${req.budget || '不限'}`,
  ]
  if (req.otherNotes) lines.push(`其他要求：${req.otherNotes}`)
  if (req.historyHint) lines.push(`历史偏好：${req.historyHint}`)
  if (req.cooldownNames?.length) {
    lines.push(`一周内已吃过请勿推荐：${req.cooldownNames.join('、')}`)
  }
  if (req.excludeNames?.length) {
    lines.push(`不要推荐以下餐厅（用户刚看过）：${req.excludeNames.join('、')}`)
  }

  return `${lines.join('\n')}

附近餐厅（共 ${req.restaurants.length} 家，以下是候选）：
${restaurantList}

请推荐最适合的 ${TOP_N} 家，返回 JSON。`
}

function parseRecommendations(
  content: string,
  restaurants: RecommendRequest['restaurants'],
  blocked?: Set<string>,
): Recommendation[] {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('AI 返回格式异常')

  const parsed = JSON.parse(jsonMatch[0]) as { recommendations?: Recommendation[] }
  const names = new Set(restaurants.map((r) => r.name))

  const valid = (parsed.recommendations ?? [])
    .filter((rec) => names.has(rec.name) && !blocked?.has(rec.name))
    .slice(0, TOP_N)

  if (!valid.length) throw new Error('AI 推荐结果无法匹配附近餐厅')
  return valid
}

function fallbackRecommend(req: RecommendRequest): Recommendation[] {
  const pool = filterPool(req)
  const keywords = [...req.cuisines, ...req.tastes, ...req.mood].join(' ')

  const scored = pool.map((r) => {
    let score = Math.max(0.3, 1 - r.distance / 5000) + scoreRestaurant(r, keywords) * 0.15
    const text = `${r.name} ${r.type}`
    if (keywords.includes('不辣') && /川|湘|麻辣|辣/.test(text)) score -= 0.5
    if (keywords.includes('辣') && /川|湘|麻辣|辣/.test(text)) score += 0.3
    if (keywords.includes('日料') && /日|寿司|拉面/.test(text)) score += 0.4
    if (keywords.includes('面食') && /面|饺|粉/.test(text)) score += 0.4
    if (keywords.includes('火锅') && /火锅/.test(text)) score += 0.4
    if (keywords.includes('烧烤') && /烧烤|烤肉|烤/.test(text)) score += 0.4
    if (keywords.includes('小吃') && /小吃|麻辣烫|串/.test(text)) score += 0.3
    if (keywords.includes('清淡') && /轻食|沙拉|粥/.test(text)) score += 0.3
    return { restaurant: r, score: Math.max(0, score) }
  })

  scored.sort((a, b) => b.score - a.score)

  const ranked = scored.map((s) => s.restaurant)
  const diversified = stratifiedByDistance(ranked, TOP_N * 4)

  return diversified.slice(0, TOP_N).map((restaurant, i) => ({
    name: restaurant.name,
    reason:
      i === 0
        ? `距离 ${restaurant.distanceText}，${restaurant.type}，符合你的偏好`
        : `备选：${restaurant.type}，${restaurant.distanceText}`,
    score: Math.round((scored.find((s) => s.restaurant.id === restaurant.id)?.score ?? 0) * 100) / 100,
  }))
}

export async function getRecommendations(
  req: RecommendRequest,
  apiKey: string | undefined,
  baseUrl: string,
  model: string,
): Promise<{ recommendations: Recommendation[]; usedMock: boolean; fallbackReason?: string }> {
  if (!apiKey || apiKey.startsWith('your_')) {
    return { recommendations: fallbackRecommend(req), usedMock: true, fallbackReason: 'no_key' }
  }

  const blocked = getBlockedNames(req)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: req.excludeNames?.length ? 0.85 : 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(req) },
        ],
      }),
    })

    if (!response.ok) {
      throw new Error(`AI API 错误: ${response.status}`)
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('AI 无返回内容')

    return {
      recommendations: parseRecommendations(content, req.restaurants, blocked),
      usedMock: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 调用失败'
    console.error('AI 推荐失败，使用规则兜底:', message)
    return { recommendations: fallbackRecommend(req), usedMock: true, fallbackReason: message }
  }
}
