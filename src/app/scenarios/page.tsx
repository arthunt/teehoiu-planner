'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchMunicipalities, fetchRoadSections, fetchConditionData, fetchRepairTypes } from '@/lib/queries'
import { buildPriorityList, DEFAULT_WEIGHTS } from '@/lib/priority'
import type { PriorityWeights } from '@/lib/priority'
import type { RoadWithCondition } from '@/types/database'
import { compareScenarios, getScenarioCoveredStats } from '@/lib/scenarios'
import type { Scenario } from '@/lib/scenarios'
import Navigation from '@/components/Navigation'
import DarkModeToggle from '@/components/DarkModeToggle'
import { useDarkMode } from '@/hooks/useDarkMode'

const fmt = (n: number) => n.toLocaleString('et-EE')

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 w-14">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="flex-1 h-1.5 rounded-full accent-[#009B8D]"
      />
      <span className="text-xs font-mono text-gray-700 dark:text-gray-300 w-10 text-right">{Math.round(value * 100)}%</span>
    </div>
  )
}

interface ScenarioConfig {
  name: string
  budget: number
  budgetInput: string
  weights: PriorityWeights
}

const DEFAULT_SCENARIOS: ScenarioConfig[] = [
  { name: 'Stsenaarium A', budget: 500000, budgetInput: '500 000', weights: { ...DEFAULT_WEIGHTS } },
  { name: 'Stsenaarium B', budget: 750000, budgetInput: '750 000', weights: { ...DEFAULT_WEIGHTS } },
]

export default function ScenariosPage() {
  const { dark, toggleDark } = useDarkMode()
  const [municipalities, setMunicipalities] = useState<string[]>([])
  const [selectedMunicipality, setSelectedMunicipality] = useState('')
  const [scenarios, setScenarios] = useState<ScenarioConfig[]>(DEFAULT_SCENARIOS)
  const [results, setResults] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(false)
  const [baseData, setBaseData] = useState<{ sections: ReturnType<typeof fetchRoadSections> extends Promise<infer T> ? T : never; conditions: ReturnType<typeof fetchConditionData> extends Promise<infer T> ? T : never; repairTypes: ReturnType<typeof fetchRepairTypes> extends Promise<infer T> ? T : never } | null>(null)

  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(console.error)
  }, [])

  // Load saved scenarios from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scenarios')
      if (saved) {
        const parsed = JSON.parse(saved) as ScenarioConfig[]
        if (Array.isArray(parsed) && parsed.length >= 2) {
          setScenarios(parsed)
        }
      }
    } catch {}
  }, [])

  const saveScenarios = (updated: ScenarioConfig[]) => {
    setScenarios(updated)
    localStorage.setItem('scenarios', JSON.stringify(updated))
  }

  const loadData = useCallback(async (municipality: string) => {
    if (!municipality) {
      setBaseData(null)
      setResults([])
      return
    }
    setLoading(true)
    try {
      const [sections, repairTypes] = await Promise.all([
        fetchRoadSections(municipality),
        fetchRepairTypes(),
      ])
      const sectionIds = sections.map(s => s.id)
      const conditions = await fetchConditionData(sectionIds)
      setBaseData({ sections, conditions, repairTypes })
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedMunicipality)
  }, [selectedMunicipality, loadData])

  // Recalculate scenarios whenever base data or scenario config changes
  useEffect(() => {
    if (!baseData) {
      setResults([])
      return
    }
    const newResults: Scenario[] = scenarios.map((sc, i) => {
      const rows = buildPriorityList(baseData.sections, baseData.conditions, baseData.repairTypes, sc.weights)
      return { id: String(i), name: sc.name, budget: sc.budget, weights: sc.weights, rows }
    })
    setResults(newResults)
  }, [baseData, scenarios])

  const updateScenario = (index: number, update: Partial<ScenarioConfig>) => {
    const updated = scenarios.map((s, i) => i === index ? { ...s, ...update } : s)
    saveScenarios(updated)
  }

  const handleBudgetChange = (index: number, value: string) => {
    const raw = value.replace(/\s/g, '').replace(/[^\d]/g, '')
    const num = parseInt(raw, 10)
    if (!isNaN(num)) {
      updateScenario(index, { budget: num, budgetInput: fmt(num) })
    } else if (raw === '') {
      updateScenario(index, { budgetInput: '' })
    }
  }

  const addScenario = () => {
    if (scenarios.length >= 3) return
    const newSc: ScenarioConfig = {
      name: `Stsenaarium ${String.fromCharCode(65 + scenarios.length)}`,
      budget: 1000000,
      budgetInput: '1 000 000',
      weights: { ...DEFAULT_WEIGHTS },
    }
    saveScenarios([...scenarios, newSc])
  }

  const removeScenario = (index: number) => {
    if (scenarios.length <= 2) return
    saveScenarios(scenarios.filter((_, i) => i !== index))
  }

  // Compute diffs between adjacent scenarios
  const diffs = results.length >= 2
    ? results.slice(0, -1).map((r, i) => compareScenarios(r, results[i + 1]))
    : []

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-[var(--font-geist-sans)] transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#009B8D]">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Stsenaariumid</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">Võrdle erinevaid eelarve- ja kaalustsenaariume</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Navigation />
              <DarkModeToggle dark={dark} onToggle={toggleDark} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Municipality selector */}
        <div className="mb-6 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 sm:p-6">
          <label htmlFor="municipality" className="mb-1.5 block text-base font-medium text-gray-700 dark:text-gray-300">
            Omavalitsus
          </label>
          <select
            id="municipality"
            value={selectedMunicipality}
            onChange={e => setSelectedMunicipality(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-base text-gray-900 dark:text-white shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
          >
            <option value="">Vali omavalitsus...</option>
            {municipalities.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#009B8D] border-t-transparent" />
          </div>
        )}

        {!loading && !selectedMunicipality && (
          <div className="flex items-center justify-center py-24">
            <p className="text-lg text-gray-500 dark:text-gray-400">Vali omavalitsus stsenaariumide võrdlemiseks</p>
          </div>
        )}

        {!loading && selectedMunicipality && results.length > 0 && (
          <div className="space-y-6">
            {/* Scenario configs side by side */}
            <div className="flex items-end gap-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Stsenaariumid</h2>
              {scenarios.length < 3 && (
                <button
                  onClick={addScenario}
                  className="rounded-lg border border-dashed border-gray-300 dark:border-slate-600 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:border-[#009B8D] hover:text-[#009B8D] transition"
                >
                  + Lisa stsenaarium
                </button>
              )}
            </div>

            <div className={`grid gap-4 ${scenarios.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
              {scenarios.map((sc, i) => {
                const result = results[i]
                const stats = result ? getScenarioCoveredStats(result.rows, result.budget) : null
                return (
                  <div key={i} className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <input
                        type="text"
                        value={sc.name}
                        onChange={e => updateScenario(i, { name: e.target.value })}
                        className="text-lg font-semibold text-gray-900 dark:text-white bg-transparent border-none outline-none p-0 focus:ring-0 w-full"
                      />
                      {scenarios.length > 2 && (
                        <button onClick={() => removeScenario(i)} className="text-gray-400 hover:text-red-500 transition">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Budget */}
                    <div className="mb-4">
                      <label className="mb-1 block text-sm text-gray-500 dark:text-gray-400">Eelarve (EUR)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={sc.budgetInput}
                        onChange={e => handleBudgetChange(i, e.target.value)}
                        onBlur={() => { if (sc.budget > 0) updateScenario(i, { budgetInput: fmt(sc.budget) }) }}
                        className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-base text-gray-900 dark:text-white shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
                      />
                    </div>

                    {/* Weight sliders */}
                    <div className="space-y-2 mb-4">
                      <WeightSlider label="IRI" value={sc.weights.iri} onChange={v => updateScenario(i, { weights: { ...sc.weights, iri: v } })} />
                      <WeightSlider label="Defekt" value={sc.weights.defect} onChange={v => updateScenario(i, { weights: { ...sc.weights, defect: v } })} />
                      <WeightSlider label="Liiklus" value={sc.weights.traffic} onChange={v => updateScenario(i, { weights: { ...sc.weights, traffic: v } })} />
                      <WeightSlider label="Kandevus" value={sc.weights.bearing} onChange={v => updateScenario(i, { weights: { ...sc.weights, bearing: v } })} />
                    </div>

                    {/* Results summary */}
                    {stats && (
                      <div className="rounded-lg bg-[#009B8D]/10 dark:bg-[#009B8D]/20 p-3 space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Kaetud lõike</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{stats.count} / {result.rows.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Kaetud km</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{stats.km.toFixed(1)} km</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Maksumus</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{fmt(stats.cost)} EUR</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Katvus</span>
                          <span className="font-semibold text-[#009B8D]">
                            {result.rows.length > 0 ? Math.round((stats.count / result.rows.length) * 100) : 0}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Diff section */}
            {diffs.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Erinevused</h2>
                {diffs.map((diff, i) => (
                  <div key={i} className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-6">
                    <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">
                      {scenarios[i].name} vs {scenarios[i + 1].name}
                    </h3>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[#009B8D]">{diff.coveredKmB.toFixed(1)} km</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">vs {diff.coveredKmA.toFixed(1)} km</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[#009B8D]">{Math.round(diff.coveragePctB)}%</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">vs {Math.round(diff.coveragePctA)}% katvus</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${diff.addedRoads.length > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>+{diff.addedRoads.length}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">teed lisandunud</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-2xl font-bold ${diff.removedRoads.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>-{diff.removedRoads.length}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">teed eemaldunud</div>
                      </div>
                    </div>

                    {diff.addedRoads.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-1">Lisandunud teed:</h4>
                        <div className="flex flex-wrap gap-2">
                          {diff.addedRoads.map(r => (
                            <span key={r.id} className="inline-block rounded-full bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:text-green-300">
                              {r.road_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {diff.removedRoads.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Eemaldunud teed:</h4>
                        <div className="flex flex-wrap gap-2">
                          {diff.removedRoads.map(r => (
                            <span key={r.id} className="inline-block rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:text-red-300">
                              {r.road_name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-12">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Teehoiu Planner &mdash; stsenaariumid</p>
        </div>
      </footer>
    </div>
  )
}
