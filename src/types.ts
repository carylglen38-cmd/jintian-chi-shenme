export interface Restaurant {
  id: string
  name: string
  type: string
  address: string
  distance: number
  distanceText: string
  location: string
  tel?: string
}

export interface Recommendation {
  name: string
  reason: string
  score: number
}

export type DiningStyleId =
  | '简单吃吃'
  | '烟火气'
  | '随便吃吃'
  | '漂亮饭'
  | '精致大餐'
  | '随便'

export type BudgetId = '50以下' | '50-100' | '100-200' | '200+' | '不限'

export const DINING_STYLES = [
  { id: '简单吃吃' as const, emoji: '🍜', subtitle: '填饱就行', budget: '50以下' as const },
  { id: '烟火气' as const, emoji: '🔥', subtitle: '热乎接地气', budget: '50-100' as const },
  { id: '随便吃吃' as const, emoji: '🎲', subtitle: '不折腾', budget: '50-100' as const },
  { id: '漂亮饭' as const, emoji: '✨', subtitle: '环境好拍照', budget: '100-200' as const },
  { id: '精致大餐' as const, emoji: '🥂', subtitle: '值得专程', budget: '200+' as const },
  { id: '随便' as const, emoji: '🤷', subtitle: '你看着办', budget: '不限' as const },
]

export const FOOD_PRESETS = [
  '辣',
  '不辣',
  '酸',
  '甜',
  '炸的',
  '清淡',
  '重口',
  '鲜',
  '火锅',
  '面食',
  '烧烤',
  '小吃',
  '日料',
  '轻食',
  '川菜',
  '韩餐',
  '西餐',
  '粤菜',
] as const

export const BUDGET_OPTIONS = [
  { id: '50以下' as const, label: '¥50 以下', prompt: '人均约 ¥50 以下，仅供参考，不必卡死' },
  { id: '50-100' as const, label: '¥50–100', prompt: '人均约 ¥50–100，仅供参考，不必卡死' },
  { id: '100-200' as const, label: '¥100–200', prompt: '人均约 ¥100–200，仅供参考，不必卡死' },
  { id: '200+' as const, label: '¥200+', prompt: '人均约 ¥200 以上，仅供参考，不必卡死' },
  { id: '不限' as const, label: '不限', prompt: '' },
]

export const MOOD_PRESETS = [
  { label: '开心', emoji: '😊' },
  { label: '馋', emoji: '🤤' },
  { label: '累', emoji: '😮‍💨' },
  { label: '随便', emoji: '🎲' },
] as const

export const NOTE_QUICK_CHIPS = ['要停车', '安静', '打包', '不吃香菜'] as const

export const MAX_FOOD_PREFS = 4

/** @deprecated kept for meal history compatibility */
export const TASTE_PRESETS = ['辣', '清淡', '重口', '不辣'] as const

/** @deprecated kept for meal history compatibility */
export const CUISINE_PRESETS = [
  '日料', '火锅', '面食', '烧烤', '小吃', '轻食', '川菜', '粤菜',
] as const

/** @deprecated kept for meal history compatibility */
export const CUISINE_MORE = ['韩餐', '西餐', '湘菜', '东北菜', '泰餐', '披萨'] as const

/** @deprecated kept for meal history compatibility */
export const BUDGET_PRESETS = ['30内', '50左右', '100+', '不限'] as const

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface MealRecord {
  id: string
  date: string
  mealType: MealType
  restaurantId: string
  restaurantName: string
  restaurantType: string
  address: string
  mood: string[]
  tastes: string[]
  cuisines: string[]
  diningStyle?: string
  budget?: string
  otherNotes?: string
  timestamp: number
}

export interface UserPreferenceProfile {
  topCuisines: string[]
  topTastes: string[]
  topMoods: string[]
  recentRestaurants: string[]
  totalVisits: number
}

export type AppStep = 'locating' | 'preferences' | 'loading' | 'results' | 'error'
export type AppView = 'decide' | 'calendar'

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '夜宵',
}
