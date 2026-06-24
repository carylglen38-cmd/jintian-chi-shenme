import { useState } from 'react'
import {
  BUDGET_OPTIONS,
  DINING_STYLES,
  FOOD_PRESETS,
  MAX_FOOD_PREFS,
  MOOD_PRESETS,
  NOTE_QUICK_CHIPS,
  type BudgetId,
  type DiningStyleId,
} from '../types'
import { detectLocationInNotes, getBudgetLabel, getSuggestedBudget, summarizePreferences } from '../lib/preferences'

interface PreferenceFormProps {
  diningStyle: DiningStyleId
  foodPrefs: string[]
  budget: BudgetId
  budgetManual: boolean
  moods: string[]
  otherNotes: string
  onDiningStyleChange: (style: DiningStyleId) => void
  onFoodPrefsChange: (v: string[]) => void
  onBudgetChange: (v: BudgetId, manual: boolean) => void
  onMoodsChange: (v: string[]) => void
  onOtherNotesChange: (v: string) => void
}

export function PreferenceForm({
  diningStyle,
  foodPrefs,
  budget,
  budgetManual,
  moods,
  otherNotes,
  onDiningStyleChange,
  onFoodPrefsChange,
  onBudgetChange,
  onMoodsChange,
  onOtherNotesChange,
}: PreferenceFormProps) {
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [foodHint, setFoodHint] = useState('')

  const locationHint = detectLocationInNotes(otherNotes)
  const summary = summarizePreferences(diningStyle, foodPrefs, budget)

  const toggleFood = (item: string) => {
    if (foodPrefs.includes(item)) {
      onFoodPrefsChange(foodPrefs.filter((f) => f !== item))
      setFoodHint('')
      return
    }
    if (foodPrefs.length >= MAX_FOOD_PREFS) {
      setFoodHint(`选 ${MAX_FOOD_PREFS} 个就好，选太多反而难挑`)
      return
    }
    setFoodHint('')
    onFoodPrefsChange([...foodPrefs, item])
  }

  const toggleMood = (label: string) => {
    if (label === '随便') {
      onMoodsChange([])
      return
    }
    onMoodsChange(moods.includes(label) ? [] : [label])
  }

  const appendNoteChip = (chip: string) => {
    const parts = otherNotes.trim() ? otherNotes.trim().split(/\s+/) : []
    if (parts.includes(chip)) {
      onOtherNotesChange(parts.filter((p) => p !== chip).join(' '))
    } else {
      onOtherNotesChange([...parts, chip].join(' '))
    }
    if (!notesOpen) setNotesOpen(true)
  }

  const handleStyleChange = (style: DiningStyleId) => {
    onDiningStyleChange(style)
    if (!budgetManual) {
      onBudgetChange(getSuggestedBudget(style), false)
    }
  }

  return (
    <div className="space-y-3">
      <section className="preference-card">
        <SectionTitle icon="🍽" title="这顿想怎么吃？" hint="选一个就够" />
        <div className="grid grid-cols-2 gap-2">
          {DINING_STYLES.map((s) => {
            const active = diningStyle === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStyleChange(s.id)}
                className={`preference-style-tile ${active ? 'preference-tile-active' : ''}`}
              >
                <span className="text-lg leading-none">{s.emoji}</span>
                <span className="mt-1 text-sm font-semibold">{s.id}</span>
                <span className="mt-0.5 text-[10px] text-stone-400">{s.subtitle}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => setBudgetOpen((v) => !v)}
          className="mt-3 w-full text-left text-xs text-stone-500"
        >
          建议人均 {getBudgetLabel(budget)}
          {budgetManual ? '（已手动调整）' : ''} ·{' '}
          <span className="text-brand-600">{budgetOpen ? '收起' : '点我改'}</span>
        </button>

        {budgetOpen && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BUDGET_OPTIONS.map((b) => {
              const active = budget === b.id
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onBudgetChange(b.id, true)}
                  className={`preference-pill ${active ? 'preference-pill-active' : ''}`}
                >
                  {b.label}
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="preference-card">
        <SectionTitle icon="🤤" title="有点馋…" hint="可不选" />
        <div className="flex flex-wrap gap-1.5">
          {FOOD_PRESETS.map((item) => {
            const active = foodPrefs.includes(item)
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleFood(item)}
                className={`preference-pill ${active ? 'preference-pill-active' : ''}`}
              >
                {item}
              </button>
            )
          })}
        </div>
        {foodHint && <p className="mt-2 text-xs text-amber-600">{foodHint}</p>}
      </section>

      <section className="preference-card">
        <SectionTitle icon="💭" title="今天状态" hint="可选" />
        <div className="flex gap-2">
          {MOOD_PRESETS.map((m) => {
            const active = m.label === '随便' ? moods.length === 0 : moods.includes(m.label)
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => toggleMood(m.label)}
                className={`preference-mood-chip ${active ? 'preference-tile-active' : ''}`}
              >
                <span className="text-lg">{m.emoji}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="preference-card">
        {!notesOpen ? (
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            className="flex w-full items-center gap-2 text-sm text-stone-500"
          >
            <span className="text-base">＋</span>
            <span>补充一句（可选）</span>
            {locationHint && (
              <span className="ml-auto text-xs text-brand-600">将按「{locationHint}」附近推</span>
            )}
          </button>
        ) : (
          <div className="space-y-2">
            <SectionTitle icon="✏️" title="补充一句" hint="可选" />
            <input
              type="text"
              value={otherNotes}
              onChange={(e) => onOtherNotesChange(e.target.value)}
              placeholder="例：中关村附近、要停车、不吃香菜…"
              className="preference-input"
            />
            {locationHint && (
              <p className="text-xs text-brand-600">将按「{locationHint}」附近 3km 内精准推荐</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {NOTE_QUICK_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => appendNoteChip(chip)}
                  className={`preference-pill text-xs ${
                    otherNotes.includes(chip) ? 'preference-pill-active' : ''
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setNotesOpen(false)}
              className="text-xs text-stone-400"
            >
              收起
            </button>
          </div>
        )}
      </section>

      {summary && <p className="px-1 text-center text-xs text-stone-400">{summary}</p>}
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
