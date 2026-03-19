'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchMunicipalities, fetchRoadSections, fetchConditionData, fetchRepairTypes } from '@/lib/queries'
import { buildPriorityList, DEFAULT_WEIGHTS } from '@/lib/priority'
import type { PriorityWeights } from '@/lib/priority'
import { buildLiabilityList, getLiabilityLevel } from '@/lib/liability'
import type { LiabilityRoad } from '@/lib/liability'
import Navigation from '@/components/Navigation'
import DarkModeToggle from '@/components/DarkModeToggle'
import { useDarkMode } from '@/hooks/useDarkMode'

const fmt = (n: number) => n.toLocaleString('et-EE')

function LiabilityBadge({ index }: { index: number }) {
  const level = getLiabilityLevel(index)
  const classes: Record<string, string> = {
    red: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300',
    orange: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300',
    green: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  }
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${classes[level.color]}`}>
      {level.label}
    </span>
  )
}

export default function LiabilityPage() {
  const { dark, toggleDark } = useDarkMode()
  const [municipalities, setMunicipalities] = useState<string[]>([])
  const [selectedMunicipality, setSelectedMunicipality] = useState('')
  const [budget, setBudget] = useState(500000)
  const [budgetInput, setBudgetInput] = useState('500 000')
  const [liabilityRoads, setLiabilityRoads] = useState<LiabilityRoad[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(console.error)
  }, [])

  const getWeights = (): PriorityWeights => {
    try {
      const saved = localStorage.getItem('priority_weights')
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_WEIGHTS
  }

  const loadData = useCallback(async (municipality: string) => {
    if (!municipality) {
      setLiabilityRoads([])
      setDataLoaded(false)
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
      const priorityList = buildPriorityList(sections, conditions, repairTypes, getWeights())
      const liability = buildLiabilityList(priorityList)
      setLiabilityRoads(liability)
      setDataLoaded(true)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedMunicipality)
  }, [selectedMunicipality, loadData])

  const handleBudgetChange = (value: string) => {
    const raw = value.replace(/\s/g, '').replace(/[^\d]/g, '')
    const num = parseInt(raw, 10)
    if (!isNaN(num)) {
      setBudget(num)
      setBudgetInput(fmt(num))
    } else if (raw === '') {
      setBudgetInput('')
    }
  }

  // Critical roads: liability_index >= 70
  const criticalRoads = liabilityRoads.filter(r => r.liability_index >= 70)
  const criticalCost = criticalRoads.reduce((sum, r) => sum + r.estimated_cost, 0)
  const additionalFunding = Math.max(0, criticalCost - budget)
  const today = new Date().toLocaleDateString('et-EE', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-[var(--font-geist-sans)] transition-colors">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, .min-h-screen { background: white !important; }
          * { color: black !important; border-color: #e5e7eb !important; }
        }
      `}</style>

      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 no-print">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-600">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Vastutuse kaart</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">Vastutusriski hindamine ja riskihoiatuse genereerimine</p>
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
        {/* Controls */}
        <div className="mb-6 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 sm:p-6 no-print">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="municipality" className="mb-1.5 block text-base font-medium text-gray-700 dark:text-gray-300">Omavalitsus</label>
              <select
                id="municipality"
                value={selectedMunicipality}
                onChange={e => setSelectedMunicipality(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-base text-gray-900 dark:text-white shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
              >
                <option value="">Vali omavalitsus...</option>
                {municipalities.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="budget" className="mb-1.5 block text-base font-medium text-gray-700 dark:text-gray-300">Aastane eelarve (EUR)</label>
              <div className="relative">
                <input
                  id="budget"
                  type="text"
                  inputMode="numeric"
                  value={budgetInput}
                  onChange={e => handleBudgetChange(e.target.value)}
                  onBlur={() => { if (budget > 0) setBudgetInput(fmt(budget)) }}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 pr-12 text-base text-gray-900 dark:text-white shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-gray-400 dark:text-gray-500">EUR</span>
              </div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#009B8D] border-t-transparent" />
          </div>
        )}

        {!loading && !dataLoaded && (
          <div className="flex items-center justify-center py-24">
            <p className="text-lg text-gray-500 dark:text-gray-400">Vali omavalitsus vastutuskaardi vaatamiseks</p>
          </div>
        )}

        {!loading && dataLoaded && liabilityRoads.length > 0 && (
          <div className="space-y-6">
            {/* Risk warning summary */}
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800/50 p-6">
              <h2 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Riskihoiatus</h2>
              <p className="text-red-700 dark:text-red-400 mb-3">
                {criticalRoads.length} teelõiku vastutusindeksiga &ge;70 vajavad kohest tähelepanu. Kriitiliste lõikude remondi kogumaksumus: {fmt(criticalCost)} EUR.
              </p>
              {additionalFunding > 0 && (
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                  Soovitan lisarahastust {fmt(additionalFunding)} EUR kriitiliste lõikude katmiseks.
                </p>
              )}
            </div>

            {/* Formal risk document for printing */}
            <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-8">
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">RISKIHOIATUS</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{today} &middot; {selectedMunicipality}</p>
              </div>

              <p className="text-base text-gray-700 dark:text-gray-300 mb-6">
                Käesolevaga teavitan, et järgmised teelõigud kujutavad ohutusriski ja vajavad kohest remonti:
              </p>

              {/* Liability table */}
              <div className="overflow-x-auto mb-8">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                      <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tee</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IRI</th>
                      <th className="whitespace-nowrap px-4 py-3 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vastutus</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Indeks</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remont</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maksumus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    {liabilityRoads.map((road, i) => (
                      <tr key={road.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">{road.road_name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{road.section_start_km.toFixed(1)} – {road.section_end_km.toFixed(1)} km &middot; {road.road_class}</div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900 dark:text-gray-200 tabular-nums">{road.condition.iri_value.toFixed(1)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-center"><LiabilityBadge index={road.liability_index} /></td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-200 tabular-nums">{road.liability_index}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700 dark:text-gray-300">{road.recommended_repair.name}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-gray-900 dark:text-gray-200 tabular-nums">{fmt(road.estimated_cost)} &euro;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {additionalFunding > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 mb-8">
                  <p className="text-base font-semibold text-red-800 dark:text-red-300">
                    Soovitan lisarahastust {fmt(additionalFunding)} EUR kriitiliste lõikude katmiseks.
                  </p>
                </div>
              )}

              {/* Signature area */}
              <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t border-gray-200 dark:border-slate-700">
                <div>
                  <div className="border-b border-gray-400 dark:border-gray-600 mb-2 h-10" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Allkiri</p>
                </div>
                <div>
                  <div className="border-b border-gray-400 dark:border-gray-600 mb-2 h-10" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">Kuupäev</p>
                </div>
              </div>
            </div>

            {/* Print button */}
            <div className="flex items-center justify-between rounded-xl bg-gray-100 dark:bg-slate-800/50 px-6 py-4 ring-1 ring-gray-200 dark:ring-slate-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedMunicipality} &middot; Eelarve: {fmt(budget)} EUR &middot; {today}
              </p>
              <button
                onClick={() => window.print()}
                className="no-print flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.131H5.25" />
                </svg>
                Prindi riskihoiatus
              </button>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-12">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Teehoiu Planner &mdash; vastutuse kaart</p>
        </div>
      </footer>
    </div>
  )
}
