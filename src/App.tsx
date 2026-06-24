import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchDecide,
  fetchIpLocation,
  fetchRecommendations,
  getFreshLocation,
  openNavigation,
} from './api'
import { PreferenceForm } from './components/PreferenceForm'
import { Header } from './components/Header'
import { LoadingState } from './components/LoadingState'
import { MealCalendar } from './components/MealCalendar'
import { RestaurantCard } from './components/RestaurantCard'
import { useGeolocation } from './hooks/useGeolocation'
import {
  buildMoodPayload,
  formatBudgetForPrompt,
  splitFoodPreferences,
} from './lib/preferences'
import { getPreferenceProfile, getRecentlyVisitedNames, profileToPromptText, recordMealVisit } from './lib/storage'
import {
  type AppStep,
  type AppView,
  type BudgetId,
  type DiningStyleId,
  type Recommendation,
  type Restaurant,
} from './types'

export default function App() {
  const { lat, lng, loading: locating, error: locationError, requestLocation, setLocation } = useGeolocation()

  const [view, setView] = useState<AppView>('decide')
  const [step, setStep] = useState<AppStep>('preferences')
  const [error, setError] = useState<string | null>(null)

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [restaurantTotal, setRestaurantTotal] = useState(0)
  const [mockMode, setMockMode] = useState(false)

  const [diningStyle, setDiningStyle] = useState<DiningStyleId>('随便')
  const [foodPrefs, setFoodPrefs] = useState<string[]>([])
  const [budget, setBudget] = useState<BudgetId>('不限')
  const [budgetManual, setBudgetManual] = useState(false)
  const [moods, setMoods] = useState<string[]>([])
  const [otherNotes, setOtherNotes] = useState('')

  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [usedMockAi, setUsedMockAi] = useState(false)
  const [aiFallbackReason, setAiFallbackReason] = useState<string | null>(null)
  const [locationCity, setLocationCity] = useState<string | null>(null)
  const [locationAnchorName, setLocationAnchorName] = useState<string | null>(null)
  const [locationAnchorFailed, setLocationAnchorFailed] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [recordedName, setRecordedName] = useState<string | null>(null)
  const [navHint, setNavHint] = useState<string | null>(null)
  const [sessionExcludedNames, setSessionExcludedNames] = useState<string[]>([])
  const [poolExhausted, setPoolExhausted] = useState(false)

  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const countAvailableRestaurants = useCallback(
    (excluded: string[]) => {
      const blocked = new Set([...excluded, ...getRecentlyVisitedNames(7)])
      return restaurants.filter((r) => !blocked.has(r.name)).length
    },
    [restaurants],
  )

  const buildPayloadBase = useCallback(() => {
    const { tastes, cuisines } = splitFoodPreferences(foodPrefs)
    const profile = getPreferenceProfile()
    return {
      mood: buildMoodPayload(diningStyle, moods),
      tastes,
      cuisines,
      diningStyle: diningStyle !== '随便' ? diningStyle : undefined,
      budget: formatBudgetForPrompt(budget),
      otherNotes: otherNotes.trim() || undefined,
      historyHint: profileToPromptText(profile) || undefined,
      locationCity: locationCity ?? undefined,
    }
  }, [foodPrefs, diningStyle, moods, budget, otherNotes, locationCity])

  const applyRecommendResult = useCallback(
    (
      result: {
        recommendations: Recommendation[]
        usedMock: boolean
        fallbackReason?: string
        locationAnchor?: { name: string }
        locationAnchorFailed?: boolean
        restaurants?: Restaurant[]
        mockMode?: boolean
        count?: number
      },
      excludeNames?: string[],
    ) => {
      setRecommendations(result.recommendations)
      setSelectedName(result.recommendations[0]?.name ?? null)
      setUsedMockAi(result.usedMock)
      setAiFallbackReason(result.fallbackReason ?? null)
      setLocationAnchorName(result.locationAnchor?.name ?? null)
      setLocationAnchorFailed(Boolean(result.locationAnchorFailed))
      if (result.restaurants?.length) {
        setRestaurants(result.restaurants)
        setRestaurantTotal(result.count ?? result.restaurants.length)
      }
      if (result.mockMode !== undefined) setMockMode(result.mockMode)
      const pool = result.restaurants ?? restaurants
      const cooldownNames = getRecentlyVisitedNames(7)
      setPoolExhausted(
        pool.filter((r) => ![...new Set([...(excludeNames ?? []), ...cooldownNames])].includes(r.name))
          .length < 5,
      )
      setStep('results')
    },
    [restaurants],
  )

  useEffect(() => {
    fetch('/api/health').catch(() => {})
    requestLocation()
  }, [requestLocation])

  useEffect(() => {
    if (selectedName) {
      cardRefs.current.get(selectedName)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [selectedName])

  const resolveCoordinates = async (): Promise<{ lat: number; lng: number }> => {
    if (lat !== null && lng !== null) return { lat, lng }
    const ip = await fetchIpLocation()
    setLocationCity(ip.city)
    setLocation(ip.lat, ip.lng, 'ip')
    return { lat: ip.lat, lng: ip.lng }
  }

  const handleIpLocation = async () => {
    try {
      const location = await fetchIpLocation()
      setLocationCity(location.city)
      setLocation(location.lat, location.lng, 'ip')
    } catch {
      setError('网络定位失败')
    }
  }

  const runDecide = async () => {
    setLoadingMessage('正在根据你的选择找店…')
    setStep('loading')
    setError(null)
    setRecordedName(null)
    setNavHint(null)

    const coords = await resolveCoordinates()
    const result = await fetchDecide({ ...buildPayloadBase(), ...coords })
    applyRecommendResult(result)
  }

  const runRecommend = async (excludeNames?: string[]) => {
    setLoadingMessage(excludeNames?.length ? '正在换一批…' : 'AI 正在帮你挑店…')
    setStep('loading')
    setError(null)
    if (!excludeNames?.length) setRecordedName(null)

    const cooldownNames = getRecentlyVisitedNames(7)
    const result = await fetchRecommendations({
      ...buildPayloadBase(),
      userLat: lat ?? undefined,
      userLng: lng ?? undefined,
      excludeNames,
      cooldownNames,
      restaurants,
    })

    applyRecommendResult(result, excludeNames)
  }

  const handleDecide = async () => {
    try {
      setSessionExcludedNames([])
      setPoolExhausted(false)
      await runDecide()
    } catch (err) {
      setError(err instanceof Error ? err.message : '推荐失败')
      setStep('error')
    }
  }

  const handleGo = async () => {
    const restaurant = selectedName ? findRestaurant(selectedName) : undefined
    if (!restaurant) return

    const { tastes, cuisines } = splitFoodPreferences(foodPrefs)
    recordMealVisit({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantType: restaurant.type,
      address: restaurant.address,
      mood: buildMoodPayload(diningStyle, moods),
      tastes,
      cuisines,
      diningStyle: diningStyle !== '随便' ? diningStyle : undefined,
      budget: budget !== '不限' ? budget : undefined,
      otherNotes: otherNotes.trim() || undefined,
    })
    setRecordedName(restaurant.name)

    const fresh = await getFreshLocation(4000)
    const origin = fresh ?? (lat !== null && lng !== null ? { lat, lng } : null)
    const { hasOrigin } = openNavigation(restaurant, origin)
    setNavHint(hasOrigin ? null : '未获取到起点，已在地图中打开终点')
  }

  const handleRetry = async () => {
    const newExcluded = [...sessionExcludedNames, ...recommendations.map((r) => r.name)]
    if (countAvailableRestaurants(newExcluded) < 5) {
      setPoolExhausted(true)
      return
    }

    try {
      setSessionExcludedNames(newExcluded)
      await runRecommend(newExcluded)
    } catch (err) {
      setError(err instanceof Error ? err.message : '换一批失败')
      setStep('error')
    }
  }

  const handleClearExclusions = async () => {
    try {
      setSessionExcludedNames([])
      setPoolExhausted(false)
      await runRecommend()
    } catch (err) {
      setError(err instanceof Error ? err.message : '推荐失败')
      setStep('error')
    }
  }

  const handleRefresh = () => {
    setStep('preferences')
    setRecommendations([])
    setSelectedName(null)
    setSessionExcludedNames([])
    setPoolExhausted(false)
  }

  const handleBudgetChange = (value: BudgetId, manual: boolean) => {
    setBudget(value)
    setBudgetManual(manual)
  }

  const findRestaurant = (name: string) => restaurants.find((r) => r.name === name)

  const locationBannerText = locating
    ? '正在定位…（可先选偏好，点决定后再找店）'
    : lat !== null && lng !== null
      ? `已定位${locationCity ? ` · ${locationCity}` : ''}`
      : locationError
        ? '定位未完成 · 点决定时将尝试网络定位'
        : '准备定位…'

  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <Header view={view} onViewChange={setView} />

      <main className="px-4 pb-8 safe-bottom">
        {view === 'calendar' && <MealCalendar />}

        {view === 'decide' && (
          <>
            {mockMode && step === 'results' && (
              <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-700 ring-1 ring-amber-200">
                演示模式：未启用高德真实数据
              </div>
            )}

            {step === 'preferences' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-gradient-to-r from-brand-50 to-white px-4 py-3 ring-1 ring-brand-100/80">
                  <p className="text-sm text-stone-600">{locationBannerText}</p>
                  {locationError && (
                    <button
                      type="button"
                      onClick={handleIpLocation}
                      className="mt-2 text-xs font-medium text-brand-600"
                    >
                      使用网络定位
                    </button>
                  )}
                </div>

                <PreferenceForm
                  diningStyle={diningStyle}
                  foodPrefs={foodPrefs}
                  budget={budget}
                  budgetManual={budgetManual}
                  moods={moods}
                  otherNotes={otherNotes}
                  onDiningStyleChange={setDiningStyle}
                  onFoodPrefsChange={setFoodPrefs}
                  onBudgetChange={handleBudgetChange}
                  onMoodsChange={setMoods}
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
              <div className="space-y-4 pb-24">
                <div className="rounded-2xl bg-gradient-to-r from-brand-50 to-white px-4 py-3 ring-1 ring-brand-100/80">
                  <p className="text-sm text-stone-600">
                    找到 <span className="font-bold text-brand-600">{restaurants.length}</span> 家，
                    推荐 Top5 · 都很合适，挑一家
                  </p>
                </div>

                {locationAnchorName && (
                  <div className="rounded-xl bg-brand-50 px-3 py-2 text-center text-xs text-brand-800 ring-1 ring-brand-200">
                    已按「{locationAnchorName}」附近 3km 内调整推荐
                  </div>
                )}

                {locationAnchorFailed && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 ring-1 ring-amber-200">
                    没认出备注里的地点，仍按当前位置推荐
                  </div>
                )}

                {usedMockAi && (
                  <div className="rounded-xl bg-blue-50 px-3 py-2 text-center text-xs text-blue-700 ring-1 ring-blue-200">
                    {aiFallbackReason && aiFallbackReason !== 'no_key'
                      ? `AI 调用失败（${aiFallbackReason}），已用规则引擎推荐`
                      : '未配置 AI Key，使用规则引擎推荐'}
                  </div>
                )}

                {recordedName && (
                  <div className="rounded-xl bg-green-50 px-3 py-2 text-center text-xs text-green-700 ring-1 ring-green-200">
                    已记录「{recordedName}」· 可在饮食日历查看
                  </div>
                )}

                {navHint && (
                  <div className="rounded-xl bg-stone-100 px-3 py-2 text-center text-xs text-stone-600">
                    {navHint}
                  </div>
                )}

                {poolExhausted && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-center text-xs text-amber-800 ring-1 ring-amber-200">
                    附近符合条件的店快看完了，可「重新选择」或「清空排除再来」
                  </div>
                )}

                {recommendations.map((rec) => {
                  const restaurant = findRestaurant(rec.name)
                  return (
                    <div
                      key={rec.name}
                      ref={(el) => {
                        if (el) cardRefs.current.set(rec.name, el)
                        else cardRefs.current.delete(rec.name)
                      }}
                    >
                      <RestaurantCard
                        recommendation={rec}
                        restaurant={restaurant}
                        selected={selectedName === rec.name}
                        onSelect={() => setSelectedName(rec.name)}
                      />
                    </div>
                  )
                })}

                <div className="flex flex-col gap-3 pt-2">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={poolExhausted}
                      className="flex-1 rounded-xl bg-white py-3 font-semibold text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      换一批
                    </button>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="flex-1 rounded-xl bg-stone-100 py-3 font-semibold text-stone-600 hover:bg-stone-200"
                    >
                      重新选择
                    </button>
                  </div>
                  {poolExhausted && (
                    <button
                      type="button"
                      onClick={handleClearExclusions}
                      className="w-full rounded-xl bg-brand-50 py-3 font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-100"
                    >
                      清空排除再来
                    </button>
                  )}
                </div>

                {selectedName && (
                  <div className="fixed bottom-0 left-0 right-0 z-10 mx-auto max-w-lg border-t border-stone-200/80 bg-cream/95 px-4 py-3 backdrop-blur safe-bottom">
                    <button
                      type="button"
                      onClick={handleGo}
                      className="w-full rounded-2xl bg-brand-500 py-4 text-lg font-bold text-white shadow-lg shadow-brand-300/40 hover:bg-brand-600"
                    >
                      去「{selectedName}」！
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 'error' && (
              <div className="py-12 text-center">
                <p className="mb-2 text-stone-600">{error}</p>
                <p className="mb-4 text-xs text-stone-400">
                  免费服务器休眠后首次打开较慢，多等几秒再试
                </p>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setStep('preferences')
                    }}
                    className="block w-full rounded-full bg-brand-500 px-6 py-3 font-semibold text-white"
                  >
                    返回重试
                  </button>
                  <button
                    type="button"
                    onClick={handleIpLocation}
                    className="block w-full rounded-full bg-white px-6 py-3 font-semibold text-stone-700 ring-1 ring-stone-200"
                  >
                    使用网络定位
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
