import type { RecommendRequest, Recommendation, Restaurant } from './types.js'

const TOP_N = 5
const CANDIDATE_SIZE = 80

const SYSTEM_PROMPT = `你是「今天吃什么」的餐饮推荐助手。用户会提供心情、口味、菜系偏好、历史饮食习惯和附近真实餐厅列表。
你的任务是从列表中选出最合适的 ${TOP_N} 家餐厅，按推荐度排序。

规则：
1. 只能从提供的餐厅列表中选择，禁止编造不存在的店名
2. 优先考虑用户当前选择的菜系和口味，结合历史饮食习惯
3. 距离要分散：300m 以内最多选 1 家；至少 2 家应在 800m 以外；有更远选项时优先包含 1 家 1.5km 以上的店
4. 一周内用户已吃过的店不要推荐
5. 推荐理由要简短口语化，1-2 句话
6. 必须返回合法 JSON：{"recommendations":[{"name":"店名","reason":"理由","score":0.95}]}
7. score 范围 0-1，第一名最高
8. 必须推荐 ${TOP_N} 家（列表足够时），且店名互不重复`

interface DistanceBand {
  match: (r: Restaurant) => boolean
  min: number
  max: number
}

const DISTANCE_BANDS: DistanceBand[] = [
  { match: (r) => r.distance <= 300, min: 0, max: 1 },
  { match: (r) => r.distance > 300 && r.distance <= 1000, min: 1, max: 2 },
  { match: (r) => r.distance > 1000 && r.distance <= 2500, min: 1, max: 2 },
  { match: (r) => r.distance > 2500, min: 1, max: 2 },
]

function scoreRestaurant(r: Restaurant, keywords: string): number {
  const text = `${r.name} ${r.type}`
  let score = 0
  for (const kw of keywords.split(' ')) {
    if (!kw || kw.length < 2) continue
    if (text.includes(kw)) score += 2
  }
  return score
}

function getKeywords(req: RecommendRequest): string {
  const styleHint =
    req.diningStyle && req.diningStyle !== '随便' ? (DINING_STYLE_HINTS[req.diningStyle] ?? '') : ''
  return [styleHint, ...req.cuisines, ...req.tastes, ...req.mood].filter(Boolean).join(' ')
}

const DINING_STYLE_HINTS: Record<string, string> = {
  简单吃吃: '快餐 面食 饺子 便当 小吃 简餐 轻食',
  烟火气: '烧烤 麻辣烫 小吃 大排档 串 火锅 烤肉',
  随便吃吃: '餐厅 美食 吃饭',
  漂亮饭: '西餐 日料 咖啡 轻食 创意菜 环境',
  精致大餐: '西餐 日料 粤菜 火锅 私房菜 正式',
}

const DINING_STYLE_DESC: Record<string, string> = {
  简单吃吃: '（填饱就行，快速省事）',
  烟火气: '（热乎接地气，大排档感）',
  随便吃吃: '（不折腾，好吃就行）',
  漂亮饭: '（环境好，适合拍照）',
  精致大餐: '（值得专程，可以慢慢吃）',
}

function getBlockedNames(req: RecommendRequest): Set<string> {
  return new Set([...(req.excludeNames ?? []), ...(req.cooldownNames ?? [])])
}

function filterPool(req: RecommendRequest): Restaurant[] {
  const blocked = getBlockedNames(req)
  return req.restaurants.filter((r) => !blocked.has(r.name))
}

function sortByPreference(pool: Restaurant[], keywords: string): Restaurant[] {
  return [...pool].sort((a, b) => scoreRestaurant(b, keywords) - scoreRestaurant(a, keywords))
}

function countInBand(picked: Restaurant[], band: DistanceBand): number {
  return picked.filter(band.match).length
}

function selectDiverseTopN(pool: Restaurant[], keywords: string, n: number): Restaurant[] {
  if (pool.length <= n) return sortByPreference(pool, keywords)

  const bandPools = DISTANCE_BANDS.map((band) => ({
    band,
    items: sortByPreference(pool.filter(band.match), keywords),
  }))

  const picked: Restaurant[] = []
  const pickedIds = new Set<string>()

  const add = (r: Restaurant) => {
    if (pickedIds.has(r.id)) return false
    pickedIds.add(r.id)
    picked.push(r)
    return true
  }

  // 先从远到近满足各档最低名额，保证远距离有代表
  for (const { band, items } of [...bandPools].reverse()) {
    let count = countInBand(picked, band)
    for (const r of items) {
      if (picked.length >= n) break
      if (count >= band.min) break
      if (add(r)) count++
    }
  }

  // 按偏好填充，同时遵守各档上限
  const remaining = sortByPreference(
    pool.filter((r) => !pickedIds.has(r.id)),
    keywords,
  )

  for (const r of remaining) {
    if (picked.length >= n) break
    const band = DISTANCE_BANDS.find((b) => b.match(r))
    if (band && countInBand(picked, band) >= band.max) continue
    add(r)
  }

  // 名额未满时只从非近距档补齐，避免近店占满 Top5
  for (const r of remaining) {
    if (picked.length >= n) break
    if (pickedIds.has(r.id)) continue
    if (r.distance <= 300 && countInBand(picked, DISTANCE_BANDS[0]!) >= 1) continue
    add(r)
  }

  return orderForDisplay(picked.slice(0, n), keywords)
}

function orderForDisplay(picked: Restaurant[], keywords: string): Restaurant[] {
  if (picked.length <= 1) return picked

  const sorted = sortByPreference(picked, keywords)
  const farIdx = sorted.findIndex((r) => r.distance > 800)
  if (farIdx > 0 && sorted[0]!.distance <= 300) {
    const reordered = [...sorted]
    const [farPick] = reordered.splice(farIdx, 1)
    reordered.unshift(farPick!)
    return reordered
  }
  return sorted
}

function stratifiedCandidates(pool: Restaurant[], keywords: string, targetSize: number): Restaurant[] {
  if (pool.length <= targetSize) return sortByPreference(pool, keywords)

  const quotas = [
    { match: (r: Restaurant) => r.distance <= 300, ratio: 0.08 },
    { match: (r: Restaurant) => r.distance > 300 && r.distance <= 1000, ratio: 0.22 },
    { match: (r: Restaurant) => r.distance > 1000 && r.distance <= 2500, ratio: 0.35 },
    { match: (r: Restaurant) => r.distance > 2500, ratio: 0.35 },
  ]

  const result: Restaurant[] = []
  const seen = new Set<string>()

  for (const { match, ratio } of quotas) {
    const limit = Math.max(1, Math.round(targetSize * ratio))
    const items = sortByPreference(pool.filter(match), keywords)
    let added = 0
    for (const r of items) {
      if (added >= limit) break
      if (seen.has(r.id)) continue
      seen.add(r.id)
      result.push(r)
      added++
    }
  }

  for (const r of sortByPreference(pool, keywords)) {
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

  const keywords = getKeywords(req)
  const sampled = stratifiedCandidates(pool, keywords, CANDIDATE_SIZE)
  return sampled.length >= 20 ? sampled : sortByPreference(pool, keywords).slice(0, CANDIDATE_SIZE)
}

function formatCandidateList(candidates: Restaurant[]): string {
  const groups = [
    { title: '1.5km 以上', match: (r: Restaurant) => r.distance > 1500 },
    { title: '800m–1.5km', match: (r: Restaurant) => r.distance > 800 && r.distance <= 1500 },
    { title: '300m–800m', match: (r: Restaurant) => r.distance > 300 && r.distance <= 800 },
    { title: '300m 以内（最多选 1 家）', match: (r: Restaurant) => r.distance <= 300 },
  ]

  const lines: string[] = []
  const listed = new Set<string>()

  for (const group of groups) {
    const items = candidates.filter((r) => group.match(r) && !listed.has(r.id))
    if (!items.length) continue
    lines.push(`【${group.title}】`)
    for (const r of items) {
      listed.add(r.id)
      lines.push(`- ${r.name}（${r.type}，${r.distanceText}）`)
    }
  }

  for (const r of candidates) {
    if (listed.has(r.id)) continue
    lines.push(`- ${r.name}（${r.type}，${r.distanceText}）`)
  }

  return lines.join('\n')
}

function buildUserPrompt(req: RecommendRequest): string {
  const candidates = pickCandidates(req)
  const restaurantList = formatCandidateList(candidates)
  const foodPrefs = [...new Set([...req.tastes, ...req.cuisines])]

  const lines: string[] = []

  if (req.locationAnchor) {
    lines.push(
      `用户指定就餐区域：${req.locationAnchor.name}附近（以下距离均相对该地点，优先推荐 3km 内）`,
    )
  }

  if (req.diningStyle && req.diningStyle !== '随便') {
    const desc = DINING_STYLE_DESC[req.diningStyle] ?? ''
    const budgetPart = req.budget ? `，${req.budget}` : ''
    lines.push(`这顿怎么吃：${req.diningStyle}${desc}${budgetPart}`)
  } else {
    lines.push(`这顿怎么吃：随便${req.budget ? `，${req.budget}` : ''}`)
  }

  lines.push(`有点馋：${foodPrefs.length ? foodPrefs.join('、') : '不限'}`)

  const pureMoods = req.mood.filter((m) => m !== req.diningStyle && !DINING_STYLE_DESC[m])
  lines.push(`今天状态：${pureMoods.length ? pureMoods.join('、') : '未选择'}`)

  if (req.otherNotes) lines.push(`其他要求：${req.otherNotes}`)
  if (req.historyHint) lines.push(`历史偏好：${req.historyHint}`)
  if (req.cooldownNames?.length) {
    lines.push(`一周内已吃过请勿推荐：${req.cooldownNames.join('、')}`)
  }
  if (req.excludeNames?.length) {
    lines.push(`不要推荐以下餐厅（用户刚看过）：${req.excludeNames.join('、')}`)
  }

  const distanceLabel = req.locationAnchor
    ? `距${req.locationAnchor.name}`
    : '按距离分段列出候选'

  return `${lines.join('\n')}

附近餐厅（共 ${req.restaurants.length} 家，${distanceLabel}）：
${restaurantList}

请推荐最适合的 ${TOP_N} 家，注意距离分散，返回 JSON。`
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

  const valid = (parsed.recommendations ?? []).filter(
    (rec) => names.has(rec.name) && !blocked?.has(rec.name),
  )

  if (!valid.length) throw new Error('AI 推荐结果无法匹配附近餐厅')
  return valid
}

function finalizeRecommendations(
  aiRecs: Recommendation[] | null,
  req: RecommendRequest,
): Recommendation[] {
  const pool = filterPool(req)
  const keywords = getKeywords(req)
  const selected = selectDiverseTopN(pool, keywords, TOP_N)
  const aiByName = new Map((aiRecs ?? []).map((r) => [r.name, r]))

  return selected.map((r, i) => {
    const ai = aiByName.get(r.name)
    if (ai) return { ...ai, score: ai.score ?? Math.max(0.5, 0.95 - i * 0.08) }
    return {
      name: r.name,
      reason:
        i === 0
          ? `${r.type}，${r.distanceText}，符合你的偏好`
          : `备选：${r.type}，${r.distanceText}`,
      score: Math.round(Math.max(0.5, 0.95 - i * 0.08) * 100) / 100,
    }
  })
}

function fallbackRecommend(req: RecommendRequest): Recommendation[] {
  return finalizeRecommendations(null, req)
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

    const aiRecs = parseRecommendations(content, req.restaurants, blocked)
    return {
      recommendations: finalizeRecommendations(aiRecs, req),
      usedMock: false,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 调用失败'
    console.error('AI 推荐失败，使用规则兜底:', message)
    return { recommendations: fallbackRecommend(req), usedMock: true, fallbackReason: message }
  }
}
