import { useCallback, useEffect, useState } from 'react'
import { fetchIpLocation, fetchRecommendations, fetchRestaurants, openNavigation } from './api'
import { PreferenceForm } from './components/PreferenceForm'
import { Header } from './components/Header'
import { LoadingState } from './components/LoadingState'
import { MealCalendar } from './components/MealCalendar'
import { RestaurantCard } from './components/RestaurantCard'
import { useGeolocation } from './hooks/useGeolocation'
import { getPreferenceProfile, profileToPromptText, recordMealVisit } from './lib/storage'
import {
  MOOD_PRESETS,
  type AppStep,
  type AppView,
  type Recommendation,
  type Restaurant,
} from './types'

export default function App() {
  const { lat, lng, loading: locating, error: locationError, requestLocation, setLocation } = useGeolocation()

  const [view, setView] = useState<AppView>('decide')
  const [step, setStep] = useState<AppStep>('locating')
  const [error, setError] = useState<string | null>(null)

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantTotal, setRestaurantTotal] = useState(0)
  const [mockMode, setMockMode] = useState(false)

  const [moods, setMoods] = useState<string[]>([])
  const [tastes, setTastes] = useState<string[]>([])
  const [cuisines, setCuisines] = useState<string[]>([])
  const [budget, setBudget] = useState('')
  const [moodCustom, setMoodCustom] = useState('')
  const [otherNotes, setOtherNotes] = useState('')

  const getEffectiveMoods = () => {
    const labels = MOOD_PRESETS.map((m) => m.label)
    return [
      ...moods.filter((m) => labels.includes(m as (typeof labels)[number])),
      ...(moodCustom.trim() ? [moodCustom.trim()] : []),
    ]
  }

  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [usedMockAi, setUsedMockAi] = useState(false)
  const [aiFallbackReason, setAiFallbackReason] = useState<string | null>(null)
  const [locationCity, setLocationCity] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [recordedName, setRecordedName] = useState<string | null>(null)

  const loadRestaurants = useCallback(async (latitude: number, longitude: number) => {
    setLoadingMessage('正在搜索附近餐厅…')
    setStep('loading')
    setError(null)
    try {
      const data = await fetchRestaurants(latitude, longitude)
      setRestaurants(data.restaurants)
      setRestaurantTotal(data.count || data.restaurants.length)
      setMockMode(data.mockMode)
      setStep('preferences')
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      setStep('error')
    }
  }, [])

  useEffect(() => {
    requestLocation()
  }, [requestLocation])

  useEffect(() => {
    if (lat !== null && lng !== null && step === 'locating') {
      loadRestaurants(lat, lng)
    }
  }, [lat, lng, step, loadRestaurants])

  const handleIpLocation = async () => {
    setLoadingMessage('正在用网络定位…')
    setStep('loading')
    setError(null)
    try {
      const location = await fetchIpLocation()
      setLocationCity(location.city)
      setLocation(location.lat, location.lng, 'ip')
      await loadRestaurants(location.lat, location.lng)
    } catch (err) {
      setError(err instanceof Error ? err.message : '网络定位失败')
      setStep('locating')
    }
  }

  const runRecommend = async (excludeNames?: string[]) => {
    setLoadingMessage(excludeNames?.length ? '正在换一批…' : 'AI 正在帮你挑店…')
    setStep('loading')
    setError(null)
    if (!excludeNames?.length) setRecordedName(null)

    const profile = getPreferenceProfile()
    const result = await fetchRecommendations({
      mood: getEffectiveMoods(),
      tastes,
      cuisines,
      budget: budget || undefined,
      otherNotes: otherNotes.trim() || undefined,
      historyHint: profileToPromptText(profile) || undefined,
      excludeNames,
      restaurants,
    })
    setRecommendations(result.recommendations)
    setUsedMockAi(result.usedMock)
    setAiFallbackReason(result.fallbackReason ?? null)
    setStep('results')
  }

  const handleDecide = async () => {
    try {
      await runRecommend()
    } catch (err) {
      setError(err instanceof Error ? err.message : '推荐失败')
      setStep('error')
    }
  }

  const handleGo = (restaurant: Restaurant) => {
    recordMealVisit({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantType: restaurant.type,
      address: restaurant.address,
      mood: getEffectiveMoods(),
      tastes,
      cuisines,
      budget: budget || undefined,
      otherNotes: otherNotes.trim() || undefined,
    })
    setRecordedName(restaurant.name)
    openNavigation(restaurant, lat !== null && lng !== null ? { lat, lng } : null)
  }

  const handleRetry = async () => {
    try {
      await runRecommend(recommendations.map((r) => r.name))
    } catch (err) {
      setError(err instanceof Error ? err.message : '换一批失败')
      setStep('error')
    }
  }

  const handleRefresh = () => {
    if (lat !== null && lng !== null) {
      loadRestaurants(lat, lng)
    }
  }

  const findRestaurant = (name: string) => restaurants.find((r) => r.name === name)

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <Header view={view} onViewChange={setView} />

      <main className="px-4 pb-8 safe-bottom">
        {view === 'calendar' && <MealCalendar />}

        {view === 'decide' && (
          <>
            {mockMode && step !== 'locating' && (
              <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-700 ring-1 ring-amber-200">
                演示模式：未启用高德真实数据
              </div>
            )}

            {step === 'locating' && (
              <LoadingState
                message={
                  locating
                    ? '正在获取你的位置…'
                    : locationError
                      ? locationError
                      : '准备中…'
                }
              />
            )}

            {step === 'locating' && locationError && (
              <div className="mt-4 space-y-3 text-center">
                <p className="text-xs text-stone-400">
                  提示：Mac 室内定位较慢；手机请用 localhost 或 https 访问
                </p>
                <button
                  type="button"
                  onClick={requestLocation}
                  className="block w-full rounded-full bg-brand-500 px-6 py-3 font-semibold text-white shadow-md hover:bg-brand-600"
                >
                  重新定位
                </button>
                <button
                  type="button"
                  onClick={handleIpLocation}
                  className="block w-full rounded-full bg-white px-6 py-3 font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                >
                  使用网络定位（大概位置）
                </button>
              </div>
            )}

            {step === 'preferences' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-r from-brand-50 to-white px-4 py-3 ring-1 ring-brand-100/80">
                  <p className="text-sm text-stone-600">
                    附近 <span className="font-bold text-brand-600">{restaurants.length}</span> 家可选
                    {restaurantTotal > restaurants.length && (
                      <span className="text-stone-400"> / 共{restaurantTotal}家</span>
                    )}
                    {locationCity && <span className="text-stone-400"> · {locationCity}</span>}
                  </p>
                </div>

                <PreferenceForm
                  moods={moods}
                  tastes={tastes}
                  cuisines={cuisines}
                  budget={budget}
                  moodCustom={moodCustom}
                  otherNotes={otherNotes}
                  onMoodsChange={setMoods}
                  onTastesChange={setTastes}
                  onCuisinesChange={setCuisines}
                  onBudgetChange={setBudget}
                  onMoodCustomChange={setMoodCustom}
                  onOtherNotesChange={setOtherNotes}
                />

                <button
                  type="button"
                  onClick={handleDecide}
                  className="sticky bottom-4 w-full rounded-2xl bg-brand-500 py-4 text-lg font-bold text-white shadow-lg shadow-brand-300/40 transition-transform active:scale-[0.98] hover:bg-brand-600"
                >
                  帮我决定！
                </button>
              </div>
            )}

            {step === 'loading' && <LoadingState message={loadingMessage} />}

            {step === 'results' && (
              <div className="space-y-4">
                {usedMockAi && (
                  <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-xs text-blue-700 ring-1 ring-blue-200">
                    {aiFallbackReason && aiFallbackReason !== 'no_key'
                      ? `AI 调用失败（${aiFallbackReason}），已用规则引擎推荐`
                      : '未配置 AI Key，使用规则引擎推荐'}
                  </div>
                )}

                {recordedName && (
                  <div className="rounded-xl bg-green-50 px-3 py-2 text-center text-xs text-green-700 ring-1 ring-green-200">
                    已记录「{recordedName}」，偏好会用于下次推荐 · 可在饮食日历查看
                  </div>
                )}

                {recommendations.map((rec, index) => {
                  const restaurant = findRestaurant(rec.name)
                  return (
                    <RestaurantCard
                      key={rec.name}
                      recommendation={rec}
                      restaurant={restaurant}
                      rank={index}
                      onNavigate={restaurant ? () => handleGo(restaurant) : undefined}
                    />
                  )
                })}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="flex-1 rounded-xl bg-white py-3 font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"
                  >
                    换一批
                  </button>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="flex-1 rounded-xl bg-stone-100 py-3 font-semibold text-stone-600 hover:bg-stone-200"
                  >
                    刷新附近
                  </button>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="py-12 text-center">
                <p className="mb-4 text-stone-600">{error}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (lat !== null && lng !== null) {
                      loadRestaurants(lat, lng)
                    } else {
                      requestLocation()
                      setStep('locating')
                    }
                  }}
                  className="rounded-full bg-brand-500 px-6 py-3 font-semibold text-white"
                >
                  重试
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
