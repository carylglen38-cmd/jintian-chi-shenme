import {
  BUDGET_OPTIONS,
  DINING_STYLES,
  FOOD_PRESETS,
  type BudgetId,
  type DiningStyleId,
} from '../types'

const TASTE_SET = new Set<string>([
  '辣',
  '不辣',
  '酸',
  '甜',
  '炸的',
  '清淡',
  '重口',
  '鲜',
])

const LOCATION_PATTERNS: RegExp[] = [
  /推荐\s*(.{2,24}?)\s*附近/u,
  /(?:想在|去)\s*(.{2,24}?)\s*(?:附近)?(?:吃|用餐)/u,
  /(.{2,24}?)\s*附近(?:的)?(?:吃|吃啥|推荐)?/u,
  /靠近\s*(.{2,24})/u,
]

function cleanPlaceName(raw: string): string | null {
  let name = raw.trim().replace(/[，。！？、；："'""''\s]+$/u, '')
  name = name.replace(/^(的|在|到|去|吃)/u, '').trim()
  if (name.length < 2 || name.length > 24) return null
  if (/^(不吃|不要|别|安静|打包|停车|香菜)/u.test(name)) return null
  return name
}

export function detectLocationInNotes(notes: string): string | null {
  const text = notes.trim()
  if (!text) return null
  for (const pattern of LOCATION_PATTERNS) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const placeName = cleanPlaceName(match[1])
    if (placeName) return placeName
  }
  return null
}

export function splitFoodPreferences(selected: string[]): { tastes: string[]; cuisines: string[] } {
  return {
    tastes: selected.filter((t) => TASTE_SET.has(t)),
    cuisines: selected.filter((t) => !TASTE_SET.has(t)),
  }
}

export function getSuggestedBudget(styleId: string): BudgetId {
  const style = DINING_STYLES.find((s) => s.id === styleId)
  return style?.budget ?? '不限'
}

export function formatBudgetForPrompt(budgetId: string): string | undefined {
  if (!budgetId || budgetId === '不限') return undefined
  const option = BUDGET_OPTIONS.find((b) => b.id === budgetId)
  return option?.prompt ?? `人均约 ${budgetId}，仅供参考`
}

export function getBudgetLabel(budgetId: string): string {
  const option = BUDGET_OPTIONS.find((b) => b.id === budgetId)
  return option?.label ?? budgetId
}

export function buildMoodPayload(diningStyle: string, moods: string[]): string[] {
  return moods.filter((m) => m !== '随便')
}

export function summarizePreferences(
  diningStyle: string,
  foodPrefs: string[],
  budget: string,
): string {
  const parts: string[] = []
  if (diningStyle && diningStyle !== '随便') parts.push(diningStyle)
  if (foodPrefs.length) parts.push(foodPrefs.join('·'))
  if (budget && budget !== '不限') parts.push(getBudgetLabel(budget))
  return parts.join('  ')
}

export { FOOD_PRESETS }
