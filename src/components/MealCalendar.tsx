import { useMemo, useState } from 'react'
import { getMealsByDate, getMealsByMonth } from '../lib/storage'
import { MEAL_LABELS, type MealRecord, type MealType } from '../types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function MealCalendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate] = useState(formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate()))

  const monthMeals = useMemo(() => getMealsByMonth(year, month), [year, month, selectedDate])
  const dayMeals = useMemo(() => getMealsByDate(selectedDate), [selectedDate, monthMeals])

  const mealsByDate = useMemo(() => {
    const map = new Map<string, MealRecord[]>()
    for (const meal of monthMeals) {
      const list = map.get(meal.date) ?? []
      list.push(meal)
      map.set(meal.date, list)
    }
    return map
  }, [monthMeals])

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstWeekday = new Date(year, month - 1, 1).getDay()

  const prevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const monthStats = useMemo(() => {
    const uniqueDays = new Set(monthMeals.map((m) => m.date)).size
    const restaurants = new Set(monthMeals.map((m) => m.restaurantName))
    return { meals: monthMeals.length, days: uniqueDays, restaurants: restaurants.size }
  }, [monthMeals])

  const slots: (MealType | null)[] = ['breakfast', 'lunch', 'dinner', 'snack']
  const dayByType = Object.fromEntries(dayMeals.map((m) => [m.mealType, m])) as Partial<
    Record<MealType, MealRecord>
  >

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-100">
        <div className="flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-50">
            ‹
          </button>
          <h2 className="text-lg font-bold text-stone-800">
            {year} 年 {month} 月
          </h2>
          <button type="button" onClick={nextMonth} className="rounded-lg px-2 py-1 text-stone-500 hover:bg-stone-50">
            ›
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-stone-400">
          本月 {monthStats.days} 天有记录 · {monthStats.meals} 餐 · {monthStats.restaurants} 家店
        </p>
      </div>

      <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-100">
        <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-stone-400">
          {WEEKDAYS.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const date = formatDate(year, month, day)
            const meals = mealsByDate.get(date) ?? []
            const isToday = date === formatDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
            const isSelected = date === selectedDate

            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelectedDate(date)}
                className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                  isSelected
                    ? 'bg-brand-500 text-white'
                    : isToday
                      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-200'
                      : 'text-stone-700 hover:bg-stone-50'
                }`}
              >
                <span className="font-medium">{day}</span>
                {meals.length > 0 && (
                  <span className={`mt-0.5 text-[10px] ${isSelected ? 'text-brand-100' : 'text-brand-500'}`}>
                    {meals.length}餐
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-100">
        <h3 className="mb-3 font-semibold text-stone-800">{selectedDate} 吃了啥</h3>
        <div className="space-y-2">
          {slots.map((type) => {
            if (!type) return null
            const meal = dayByType[type]
            return (
              <div
                key={type}
                className={`rounded-xl px-3 py-2.5 ${meal ? 'bg-brand-50 ring-1 ring-brand-100' : 'bg-stone-50'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-stone-500">{MEAL_LABELS[type]}</span>
                  {meal && <span className="text-xs text-stone-400">{meal.restaurantType}</span>}
                </div>
                {meal ? (
                  <p className="mt-1 font-medium text-stone-800">{meal.restaurantName}</p>
                ) : (
                  <p className="mt-1 text-sm text-stone-400">还没记录</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {monthMeals.length > 0 && (
        <div className="rounded-2xl bg-white p-4 ring-1 ring-stone-100">
          <h3 className="mb-3 font-semibold text-stone-800">本月去哪吃了</h3>
          <ul className="space-y-2">
            {[...new Set(monthMeals.map((m) => m.restaurantName))].slice(0, 15).map((name) => {
              const count = monthMeals.filter((m) => m.restaurantName === name).length
              return (
                <li key={name} className="flex justify-between text-sm">
                  <span className="text-stone-700">{name}</span>
                  <span className="text-stone-400">{count} 次</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
