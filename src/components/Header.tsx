import type { AppView } from '../types'

interface HeaderProps {
  view: AppView
  onViewChange: (view: AppView) => void
}

export function Header({ view, onViewChange }: HeaderProps) {
  return (
    <header className="px-4 pt-8 pb-4">
      <div className="text-center">
        <div className="mb-2 text-4xl">🍽️</div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-800">今天吃什么</h1>
        <p className="mt-1 text-sm text-stone-500">附近 2km · AI 帮你决定</p>
      </div>

      <div className="mt-4 flex rounded-2xl bg-white p-1 ring-1 ring-stone-100">
        <button
          type="button"
          onClick={() => onViewChange('decide')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            view === 'decide' ? 'bg-brand-500 text-white shadow-sm' : 'text-stone-600'
          }`}
        >
          帮我决定
        </button>
        <button
          type="button"
          onClick={() => onViewChange('calendar')}
          className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
            view === 'calendar' ? 'bg-brand-500 text-white shadow-sm' : 'text-stone-600'
          }`}
        >
          饮食日历
        </button>
      </div>
    </header>
  )
}
