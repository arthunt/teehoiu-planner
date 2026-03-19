'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { fetchMunicipalities, fetchRoadSections, fetchConditionData, fetchRepairTypes, insertPlanSnapshot, insertAuditLog, fetchSnapshotCountForMunicipality } from '@/lib/queries'
import { buildPriorityList, DEFAULT_WEIGHTS } from '@/lib/priority'
import type { PriorityWeights } from '@/lib/priority'
import type { RoadWithCondition } from '@/types/database'
import { generateReferenceCode, createSnapshotData } from '@/lib/audit'
import Navigation from '@/components/Navigation'
import DarkModeToggle from '@/components/DarkModeToggle'

const fmt = (n: number) => n.toLocaleString('et-EE')

function ConditionBadge({ iri }: { iri: number }) {
  if (iri < 2) return <span className="inline-block rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-semibold text-green-800 dark:text-green-300">Hea</span>
  if (iri < 4) return <span className="inline-block rounded-full bg-yellow-100 dark:bg-yellow-900/40 px-3 py-1 text-sm font-semibold text-yellow-800 dark:text-yellow-300">Rahuldav</span>
  if (iri < 6) return <span className="inline-block rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-sm font-semibold text-orange-800 dark:text-orange-300">Halb</span>
  return <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-800 dark:text-red-300">Kriitiline</span>
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
        <div className="h-full rounded-full bg-[#009B8D]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-gray-600 dark:text-gray-400 tabular-nums">{score.toFixed(1)}</span>
    </div>
  )
}


export default function Home() {
  const [municipalities, setMunicipalities] = useState<string[]>([])
  const [selectedMunicipality, setSelectedMunicipality] = useState('')
  const [budget, setBudget] = useState(500000)
  const [budgetInput, setBudgetInput] = useState('500 000')
  const [rows, setRows] = useState<RoadWithCondition[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [dark, setDark] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  // Dark mode toggle
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDark = () => {
    setDark(prev => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  // Load custom weights from localStorage
  const getWeights = (): PriorityWeights => {
    try {
      const saved = localStorage.getItem('priority_weights')
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_WEIGHTS
  }

  // Fetch municipalities on mount
  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(console.error)
  }, [])

  // Fetch and calculate priority list when municipality changes
  const loadData = useCallback(async (municipality: string, budgetAmount: number) => {
    if (!municipality) {
      setRows([])
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
      const conditionData = await fetchConditionData(sectionIds)
      const priorityList = buildPriorityList(sections, conditionData, repairTypes, getWeights())
      setRows(priorityList)
      setDataLoaded(true)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(selectedMunicipality, budget)
  }, [selectedMunicipality, budget, loadData])

  // Budget calculations
  let runningTotal = 0
  let budgetCutoffIndex = -1
  for (let i = 0; i < rows.length; i++) {
    runningTotal += rows[i].estimated_cost
    if (runningTotal > budget && budgetCutoffIndex === -1) {
      budgetCutoffIndex = i
    }
  }
  const withinBudgetRows = budgetCutoffIndex === -1 ? rows : rows.slice(0, budgetCutoffIndex)
  const totalKm = withinBudgetRows.reduce((sum, r) => sum + r.length_km, 0)
  const totalCost = withinBudgetRows.reduce((sum, r) => sum + r.estimated_cost, 0)
  const maxScore = rows.length > 0 ? Math.max(...rows.map(r => r.priority_score)) : 0

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

  const handleBudgetBlur = () => {
    if (budget > 0) {
      setBudgetInput(fmt(budget))
    }
  }

  const handleSavePlan = async () => {
    if (!selectedMunicipality || rows.length === 0) return
    setSaving(true)
    setSaveMessage('')
    try {
      const weights = getWeights()
      const count = await fetchSnapshotCountForMunicipality(selectedMunicipality)
      const refCode = generateReferenceCode(selectedMunicipality, count)
      const snapshotData = createSnapshotData(selectedMunicipality, budget, weights, rows, refCode)
      const snapshot = await insertPlanSnapshot(snapshotData)
      await insertAuditLog(snapshot.id, 'created')
      setSaveMessage(`Plaan salvestatud: ${refCode}`)
      setTimeout(() => setSaveMessage(''), 5000)
    } catch (err) {
      setSaveMessage('Viga salvestamisel: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-[var(--font-geist-sans)] transition-colors">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#009B8D]">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Teehoiu Planner</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">Teede hoolduse planeerimise tööriist</p>
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
        <div className="mb-6 rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Municipality select */}
            <div>
              <label htmlFor="municipality" className="mb-1.5 block text-base font-medium text-gray-700 dark:text-gray-300">
                Omavalitsus
              </label>
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

            {/* Budget input */}
            <div>
              <label htmlFor="budget" className="mb-1.5 block text-base font-medium text-gray-700 dark:text-gray-300">
                Aastane eelarve (EUR)
              </label>
              <div className="relative">
                <input
                  id="budget"
                  type="text"
                  inputMode="numeric"
                  value={budgetInput}
                  onChange={e => handleBudgetChange(e.target.value)}
                  onBlur={handleBudgetBlur}
                  className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 pr-12 text-base text-gray-900 dark:text-white shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-base text-gray-400 dark:text-gray-500">
                  EUR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Bar */}
        {dataLoaded && !loading && (
          <div className="sticky top-0 z-10 mb-6 rounded-xl bg-[#009B8D] p-5 text-white shadow-md">
            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <div>
                <div className="text-3xl font-bold">{totalKm.toFixed(1)} km</div>
                <div className="text-base text-white/80">remonditud</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{fmt(totalCost)} EUR</div>
                <div className="text-base text-white/80">kasutatud {fmt(budget)}-st</div>
              </div>
              <div>
                <div className="text-3xl font-bold">{withinBudgetRows.length}</div>
                <div className="text-base text-white/80">lõiku eelarves</div>
              </div>
            </div>
            {/* Budget progress bar */}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white/70 transition-all duration-500"
                style={{ width: `${Math.min((totalCost / budget) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Save plan button */}
        {dataLoaded && !loading && rows.length > 0 && (
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={handleSavePlan}
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#009B8D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#008577] disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              {saving ? 'Salvestan...' : 'Lukusta plaan'}
            </button>
            {saveMessage && (
              <span className={`text-sm font-medium ${saveMessage.startsWith('Viga') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {saveMessage}
              </span>
            )}
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#009B8D] border-t-transparent" />
              <p className="text-base text-gray-500 dark:text-gray-400">Laadin andmeid...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !dataLoaded && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <svg className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
              </svg>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Vali omavalitsus, et näha remondiplaani</p>
            </div>
          </div>
        )}

        {/* Priority Table */}
        {!loading && dataLoaded && rows.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full text-base">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tee</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lõik</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IRI</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seisukord</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remont</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maksumus</th>
                    <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Skoor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                  {rows.map((row, i) => {
                    const isOverBudget = budgetCutoffIndex !== -1 && i >= budgetCutoffIndex
                    const isCutoffRow = i === budgetCutoffIndex

                    return (
                      <Fragment key={row.id}>
                        {isCutoffRow && (
                          <tr>
                            <td colSpan={8} className="px-4 py-2">
                              <div className="flex items-center gap-2 text-sm text-orange-600 dark:text-orange-400">
                                <div className="h-px flex-1 bg-orange-300 dark:bg-orange-600" />
                                <span className="font-medium whitespace-nowrap">Eelarve piir</span>
                                <div className="h-px flex-1 bg-orange-300 dark:bg-orange-600" />
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className={`transition-colors ${isOverBudget ? 'bg-gray-50 dark:bg-slate-800/30 opacity-50' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'}`}>
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-gray-900 dark:text-white">{row.road_name}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-600 dark:text-gray-400 tabular-nums">
                            {row.section_start_km.toFixed(1)} – {row.section_end_km.toFixed(1)} km
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{row.condition.iri_value.toFixed(1)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center">
                            <ConditionBadge iri={row.condition.iri_value} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-700 dark:text-gray-300">{row.recommended_repair.name}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">
                            {fmt(row.estimated_cost)} &euro;
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <ScoreBar score={row.priority_score} maxScore={maxScore} />
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* No data state */}
        {!loading && dataLoaded && rows.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <p className="text-lg text-gray-500 dark:text-gray-400">Selle omavalitsuse kohta andmed puuduvad</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-12">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Teehoiu Planner &mdash; prototüüp</p>
        </div>
      </footer>
    </div>
  )
}
