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

export const MOOD_PRESETS = [
  { label: '开心', emoji: '😊' },
  { label: 'sad', emoji: '😢' },
  { label: 'emo', emoji: '🌧' },
  { label: '累', emoji: '😮‍💨' },
  { label: '馋', emoji: '🤤' },
  { label: '随便', emoji: '🎲' },
] as const

export const TASTE_PRESETS = ['辣', '清淡', '重口', '不辣'] as const

export const CUISINE_PRESETS = [
  '日料', '火锅', '面食', '烧烤', '小吃', '轻食', '川菜', '粤菜',
] as const

export const CUISINE_MORE = ['韩餐', '西餐', '湘菜', '东北菜', '泰餐', '披萨'] as const

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
