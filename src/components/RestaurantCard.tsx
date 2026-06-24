import type { Recommendation, Restaurant } from './types'

interface RestaurantCardProps {
  recommendation: Recommendation
  restaurant?: Restaurant
  selected: boolean
  onSelect: () => void
}

export function RestaurantCard({
  recommendation,
  restaurant,
  selected,
  onSelect,
}: RestaurantCardProps) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`cursor-pointer rounded-2xl p-4 transition-all active:scale-[0.99] ${
        selected
          ? 'ring-2 ring-brand-400 bg-gradient-to-br from-brand-50 to-white shadow-lg shadow-brand-100'
          : 'bg-white ring-1 ring-stone-200 hover:ring-stone-300'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          {selected ? (
            <span className="mb-1 inline-block rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
              就这家
            </span>
          ) : (
            <span className="mb-1 inline-block text-xs font-medium text-stone-400">都很合适</span>
          )}
          <h3 className={`font-bold text-stone-800 ${selected ? 'text-xl' : 'text-lg'}`}>
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

      <p className={`leading-relaxed ${selected ? 'text-stone-700' : 'text-sm text-stone-600'}`}>
        {recommendation.reason}
      </p>
    </article>
  )
}
