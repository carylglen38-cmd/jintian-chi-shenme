import type { MealRecord, MealType, UserPreferenceProfile } from '../types'

const MEALS_KEY = 'jcs_meals'
const MAX_MEALS = 500

function loadMeals(): MealRecord[] {
  try {
    const raw = localStorage.getItem(MEALS_KEY)
    return raw ? (JSON.parse(raw) as MealRecord[]) : []
  } catch {
    return []
  }
}

function saveMeals(meals: MealRecord[]) {
  localStorage.setItem(MEALS_KEY, JSON.stringify(meals.slice(0, MAX_MEALS)))
}

export function getCurrentMealType(): MealType {
  const hour = new Date().getHours()
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export function recordMealVisit(record: Omit<MealRecord, 'id' | 'timestamp' | 'date' | 'mealType'> & {
  mealType?: MealType
}): MealRecord {
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const meal: MealRecord = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    mealType: record.mealType ?? getCurrentMealType(),
    timestamp: now.getTime(),
    restaurantId: record.restaurantId,
    restaurantName: record.restaurantName,
    restaurantType: record.restaurantType,
    address: record.address,
    mood: record.mood,
    tastes: record.tastes,
    cuisines: record.cuisines,
    budget: record.budget,
    otherNotes: record.otherNotes,
  }

  const meals = loadMeals()
  const sameSlot = meals.findIndex(
    (m) => m.date === date && m.mealType === meal.mealType,
  )
  if (sameSlot >= 0) {
    meals[sameSlot] = meal
  } else {
    meals.unshift(meal)
  }
  saveMeals(meals)
  return meal
}

export function getMealHistory(): MealRecord[] {
  return loadMeals().sort((a, b) => b.timestamp - a.timestamp)
}

export function getMealsByMonth(year: number, month: number): MealRecord[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  return getMealHistory().filter((m) => m.date.startsWith(prefix))
}

export function getMealsByDate(date: string): MealRecord[] {
  return getMealHistory().filter((m) => m.date === date)
}

function topItems(items: string[], limit = 5): string[] {
  const counts = new Map<string, number>()
  for (const item of items) {
    if (!item.trim()) continue
    counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k)
}

export function getPreferenceProfile(): UserPreferenceProfile {
  const meals = getMealHistory()
  return {
    topCuisines: topItems(meals.flatMap((m) => m.cuisines)),
    topTastes: topItems(meals.flatMap((m) => m.tastes)),
    topMoods: topItems(meals.flatMap((m) => m.mood)),
    recentRestaurants: [...new Set(meals.slice(0, 10).map((m) => m.restaurantName))],
    totalVisits: meals.length,
  }
}

export function profileToPromptText(profile: UserPreferenceProfile): string {
  if (profile.totalVisits === 0) return ''
  const parts: string[] = []
  if (profile.topCuisines.length) parts.push(`常吃：${profile.topCuisines.join('、')}`)
  if (profile.topTastes.length) parts.push(`口味倾向：${profile.topTastes.join('、')}`)
  if (profile.recentRestaurants.length) {
    parts.push(`最近去过：${profile.recentRestaurants.slice(0, 5).join('、')}`)
  }
  return parts.join('；')
}
