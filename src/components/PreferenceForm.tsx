import {
  BUDGET_PRESETS,
  CUISINE_MORE,
  CUISINE_PRESETS,
  MOOD_PRESETS,
  TASTE_PRESETS,
} from '../types'

interface PreferenceFormProps {
  moods: string[]
  tastes: string[]
  cuisines: string[]
  budget: string
  moodCustom: string
  otherNotes: string
  onMoodsChange: (v: string[]) => void
  onTastesChange: (v: string[]) => void
  onCuisinesChange: (v: string[]) => void
  onBudgetChange: (v: string) => void
  onMoodCustomChange: (v: string) => void
  onOtherNotesChange: (v: string) => void
}

function toggleItem(list: string[], item: string, multi = true) {
  if (!multi) return list.includes(item) ? [] : [item]
  return list.includes(item) ? list.filter((s) => s !== item) : [...list, item]
}

export function PreferenceForm({
  moods,
  tastes,
  cuisines,
  budget,
  moodCustom,
  otherNotes,
  onMoodsChange,
  onTastesChange,
  onCuisinesChange,
  onBudgetChange,
  onMoodCustomChange,
  onOtherNotesChange,
}: PreferenceFormProps) {
  const moodLabels = MOOD_PRESETS.map((m) => m.label)
  const effectiveMoods = [
    ...moods.filter((m) => moodLabels.includes(m as (typeof moodLabels)[number])),
    ...(moodCustom.trim() ? [moodCustom.trim()] : []),
  ]

  return (
    <div className="space-y-3">
      <section className="preference-card">
        <SectionTitle icon="💭" title="今天心情" hint="可多选" />
        <div className="grid grid-cols-3 gap-2">
          {MOOD_PRESETS.map((m) => {
            const active = moods.includes(m.label)
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => onMoodsChange(toggleItem(moods, m.label))}
                className={`preference-tile ${active ? 'preference-tile-active' : ''}`}
              >
                <span className="text-xl leading-none">{m.emoji}</span>
                <span className="mt-1 text-xs font-medium">{m.label}</span>
              </button>
            )
          })}
        </div>
        <input
          type="text"
          value={moodCustom}
          onChange={(e) => onMoodCustomChange(e.target.value)}
          placeholder="或自己写…"
          className="preference-input mt-2"
        />
      </section>

      <section className="preference-card">
        <SectionTitle icon="👅" title="口味 & 预算" />
        <div className="flex flex-wrap gap-1.5">
          {TASTE_PRESETS.map((t) => {
            const active = tastes.includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => onTastesChange(toggleItem(tastes, t))}
                className={`preference-pill ${active ? 'preference-pill-active' : ''}`}
              >
                {t}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex gap-1.5">
          {BUDGET_PRESETS.map((b) => {
            const active = budget === b
            return (
              <button
                key={b}
                type="button"
                onClick={() => onBudgetChange(active ? '' : b)}
                className={`preference-pill flex-1 ${active ? 'preference-pill-active' : ''}`}
              >
                {b === '30内' ? '¥30' : b === '50左右' ? '¥50' : b === '100+' ? '¥100+' : '不限'}
              </button>
            )
          })}
        </div>
      </section>

      <section className="preference-card">
        <SectionTitle icon="🍜" title="想吃啥" hint="可多选" />
        <div className="flex flex-wrap gap-1.5">
          {[...CUISINE_PRESETS, ...CUISINE_MORE].map((c) => {
            const active = cuisines.includes(c)
            return (
              <button
                key={c}
                type="button"
                onClick={() => onCuisinesChange(toggleItem(cuisines, c))}
                className={`preference-pill ${active ? 'preference-pill-active' : ''}`}
              >
                {c}
              </button>
            )
          })}
        </div>
      </section>

      <section className="preference-card">
        <SectionTitle icon="✏️" title="其他要求" />
        <textarea
          value={otherNotes}
          onChange={(e) => onOtherNotesChange(e.target.value)}
          placeholder="例：要停车、安静、不吃香菜、打包带走…"
          rows={2}
          className="preference-input resize-none"
        />
      </section>

      {(effectiveMoods.length > 0 || tastes.length > 0 || cuisines.length > 0 || budget || otherNotes) && (
        <p className="px-1 text-center text-xs text-stone-400">
          {[effectiveMoods.join('·'), tastes.join('·'), cuisines.join('·'), budget]
            .filter((s) => s)
            .join('  ')}
        </p>
      )}
    </div>
  )
}

function SectionTitle({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <h3 className="text-sm font-semibold text-stone-700">{title}</h3>
      {hint && <span className="text-xs text-stone-400">{hint}</span>}
    </div>
  )
}
