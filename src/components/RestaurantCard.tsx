import type { Recommendation, Restaurant } from '../types'

interface RestaurantCardProps {
  recommendation: Recommendation
  restaurant?: Restaurant
  rank: number
  onNavigate?: () => void
}

const RANK_STYLES = [
  'ring-2 ring-brand-400 bg-gradient-to-br from-brand-50 to-white',
  'bg-white ring-1 ring-stone-200',
  'bg-white ring-1 ring-stone-200',
]

const RANK_LABELS = ['首选', '推荐', '推荐', '推荐', '推荐']

export function RestaurantCard({ recommendation, restaurant, rank, onNavigate }: RestaurantCardProps) {
  const isTop = rank === 0

  return (
    <article
      className={`rounded-2xl p-4 transition-all ${RANK_STYLES[rank] ?? RANK_STYLES[2]} ${
        isTop ? 'shadow-lg shadow-brand-100' : ''
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          {isTop && (
            <span className="mb-1 inline-block rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
              今天就吃这家
            </span>
          )}
          {!isTop && (
            <span className="mb-1 inline-block text-xs font-medium text-stone-400">
              {RANK_LABELS[rank]}
            </span>
          )}
          <h3 className={`font-bold text-stone-800 ${isTop ? 'text-xl' : 'text-lg'}`}>
            {recommendation.name}
          </h3>
        </div>
        {restaurant && (
          <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
            {restaurant.distanceText}
          </span>
        )}
      </div>

      {restaurant && (
        <p className="mb-2 text-sm text-stone-500">
          {restaurant.type} · {restaurant.address}
        </p>
      )}

      <p className={`leading-relaxed ${isTop ? 'text-stone-700' : 'text-sm text-stone-600'}`}>
        {recommendation.reason}
      </p>

      {onNavigate && (
        <button
          type="button"
          onClick={onNavigate}
          className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            isTop
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
          }`}
        >
          去这家！
        </button>
      )}
    </article>
  )
}
