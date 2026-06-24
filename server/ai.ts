import type { RecommendRequest, Recommendation, Restaurant } from './types.js'

const TOP_N = 5
const CANDIDATE_SIZE = 80

const SYSTEM_PROMPT = `你是「今天吃什么」的餐饮推荐助手。用户会提供用餐氛围、口味、菜系偏好、历史饮食习惯和附近真实餐厅列表。
你的任务是从列表中选出最合适的 ${TOP_N} 家餐厅，按推荐度排序。

规则：
1. 只能从提供的餐厅列表中选择，禁止编造不存在的店名
2. Top ${TOP_N} 都必须符合用户的氛围、口味和菜系偏好，禁止用无关店凑数
3. 5 家都应让用户觉得「都可以去」，不要只有第一家合适
4. 距离适度分散：300m 以内最多 1 家，其余优先选匹配度高的
5. 一周内用户已吃过的店不要推荐
6. 推荐理由要简短口语化，1-2 句话，说明为何符合偏好
7. 必须返回合法 JSON：{"recommendations":[{"name":"店名","reason":"理由","score":0.95}]}
8. score 范围 0-1，第一名最高
9. 必须推荐 ${TOP_N} 家（列表足够时），且店名互不重复`

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
  return [...pool].sort((a, b) => {
    const diff = scoreRestaurant(b, keywords) - scoreRestaurant(a, keywords)
    if (diff !== 0) return diff
    return a.distance - b.distance
  })
}

function applyLightDistanceBalance(
  picked: Restaurant[],
  ranked: Restaurant[],
  n: number,
): Restaurant[] {
  const result = [...picked]
  const usedIds = new Set(result.map((r) => r.id))
  let nearCount = result.filter((r) => r.distance <= 300).length

  if (nearCount <= 1) return result.slice(0, n)

  for (let i = result.length - 1; i >= 0 && nearCount > 1; i--) {
    if (result[i]!.distance > 300) continue
    const replacement = ranked.find((r) => !usedIds.has(r.id) && r.distance > 300)
    if (!replacement) continue
    usedIds.delete(result[i]!.id)
    usedIds.add(replacement.id)
    result[i] = replacement
    nearCount--
  }

  return result.slice(0, n)
}

function ensureMinRelevance(
  picked: Restaurant[],
  ranked: Restaurant[],
  keywords: string,
  n: number,
): Restaurant[] {
  if (!keywords.trim()) return picked.slice(0, n)

  const minScore = 1
  const result = [...picked]
  const usedIds = new Set(result.map((r) => r.id))

  for (let i = 0; i < result.length; i++) {
    if (scoreRestaurant(result[i]!, keywords) >= minScore) continue
    const replacement = ranked.find(
      (r) => !usedIds.has(r.id) && scoreRestaurant(r, keywords) >= minScore,
    )
    if (!replacement) continue
    usedIds.delete(result[i]!.id)
    usedIds.add(replacement.id)
    result[i] = replacement
  }

  return result.slice(0, n)
}

function buildReason(r: Restaurant, keywords: string, index: number): Recommendation {
  const relevance = scoreRestaurant(r, keywords)
  const reason =
    relevance > 0
      ? `${r.type}，${r.distanceText}，符合你的偏好`
      : `${r.type}，${r.distanceText}，附近口碑不错的选择`
  return {
    name: r.name,
    reason: index === 0 ? reason : reason.replace('符合你的偏好', '同样值得一试'),
    score: Math.round(Math.max(0.5, 0.95 - index * 0.08) * 100) / 100,
  }
}

function pickRelevanceTopN(ranked: Restaurant[], keywords: string, n: number): Restaurant[] {
  const base = ranked.slice(0, n)
  return applyLightDistanceBalance(base, ranked, n)
}

function finalizeRecommendations(
  aiRecs: Recommendation[] | null,
  req: RecommendRequest,
): Recommendation[] {
  const pool = filterPool(req)
  const keywords = getKeywords(req)
  const ranked = sortByPreference(pool, keywords)
  const poolByName = new Map(pool.map((r) => [r.name, r]))

  let picked: Restaurant[] = []

  if (aiRecs?.length) {
    for (const rec of aiRecs) {
      if (picked.length >= TOP_N) break
      const r = poolByName.get(rec.name)
      if (r && !picked.some((p) => p.id === r.id)) picked.push(r)
    }
  }

  for (const r of ranked) {
    if (picked.length >= TOP_N) break
    if (picked.some((p) => p.id === r.id)) continue
    picked.push(r)
  }

  picked = applyLightDistanceBalance(picked, ranked, TOP_N)
  picked = ensureMinRelevance(picked, ranked, keywords, TOP_N)

  const aiByName = new Map((aiRecs ?? []).map((r) => [r.name, r]))

  return picked.slice(0, TOP_N).map((r, i) => {
    const ai = aiByName.get(r.name)
    if (ai?.reason && !ai.reason.startsWith('备选：')) {
      return { ...ai, score: ai.score ?? Math.max(0.5, 0.95 - i * 0.08) }
    }
    return buildReason(r, keywords, i)
  })
}

function fallbackRecommend(req: RecommendRequest): Recommendation[] {
  const pool = filterPool(req)
  const keywords = getKeywords(req)
  const ranked = sortByPreference(pool, keywords)
  const picked = pickRelevanceTopN(ranked, keywords, TOP_N)
  return picked.map((r, i) => buildReason(r, keywords, i))
}

function pickCandidates(req: RecommendRequest): Restaurant[] {
  const pool = filterPool(req)
  if (!pool.length) return req.restaurants.slice(0, CANDIDATE_SIZE)

  const keywords = getKeywords(req)
  return sortByPreference(pool, keywords).slice(0, CANDIDATE_SIZE)
}

function formatCandidateList(candidates: Restaurant[]): string {
  return candidates.map((r) => `- ${r.name}（${r.type}，${r.distanceText}）`).join('\n')
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

  const distanceLabel = req.locationAnchor ? `距${req.locationAnchor.name}` : '按匹配度排序'

  return `${lines.join('\n')}

附近餐厅（共 ${req.restaurants.length} 家，${distanceLabel}）：
${restaurantList}

请推荐 ${TOP_N} 家都符合偏好的餐厅，返回 JSON。`
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
