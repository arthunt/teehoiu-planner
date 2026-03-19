'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import { fetchMunicipalities, fetchRoadSections, fetchConditionData, fetchRepairTypes } from '@/lib/queries'
import { buildPriorityList } from '@/lib/priority'
import type { RoadWithCondition } from '@/types/database'

const fmt = (n: number) => n.toLocaleString('et-EE')

function ConditionBadge({ iri }: { iri: number }) {
  if (iri < 2) return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Hea</span>
  if (iri < 4) return <span className="inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">Rahuldav</span>
  if (iri < 6) return <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">Halb</span>
  return <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Kriitiline</span>
}

function ScoreBar({ score, maxScore }: { score: number; maxScore: number }) {
  const pct = maxScore > 0 ? Math.min((score / maxScore) * 100, 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full bg-[#009B8D]" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-600 tabular-nums">{score.toFixed(1)}</span>
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

  // Fetch municipalities on mount
  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(console.error)
  }, [])

  // Fetch and calculate priority list when municipality or budget changes
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
      const priorityList = buildPriorityList(sections, conditionData, repairTypes)
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

  return (
    <div className="min-h-screen bg-gray-50 font-[var(--font-geist-sans)]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#009B8D]">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teehoiu Planner</h1>
              <p className="text-sm text-gray-500">Teede hoolduse planeerimise tööriist</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Controls */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Municipality select */}
            <div>
              <label htmlFor="municipality" className="mb-1.5 block text-sm font-medium text-gray-700">
                Omavalitsus
              </label>
              <select
                id="municipality"
                value={selectedMunicipality}
                onChange={e => setSelectedMunicipality(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
              >
                <option value="">Vali omavalitsus...</option>
                {municipalities.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Budget input */}
            <div>
              <label htmlFor="budget" className="mb-1.5 block text-sm font-medium text-gray-700">
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
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 pr-10 text-sm text-gray-900 shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  EUR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Bar */}
        {dataLoaded && !loading && (
          <div className="sticky top-0 z-10 mb-6 rounded-xl bg-[#009B8D] p-4 text-white shadow-md">
            <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-3">
              <div>
                <div className="text-2xl font-bold">{totalKm.toFixed(1)} km</div>
                <div className="text-sm text-white/80">remonditud</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{fmt(totalCost)} EUR</div>
                <div className="text-sm text-white/80">kasutatud {fmt(budget)}-st</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{withinBudgetRows.length}</div>
                <div className="text-sm text-white/80">lõiku eelarves</div>
              </div>
            </div>
            {/* Budget progress bar */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-white/70 transition-all duration-500"
                style={{ width: `${Math.min((totalCost / budget) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#009B8D] border-t-transparent" />
              <p className="text-sm text-gray-500">Laadin andmeid...</p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !dataLoaded && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
              </svg>
              <p className="mt-3 text-gray-500">Vali omavalitsus, et näha remondiplaani</p>
            </div>
          </div>
        )}

        {/* Priority Table */}
        {!loading && dataLoaded && rows.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tee</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lõik</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">IRI</th>
                    <th className="whitespace-nowrap px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Seisukord</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Remont</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Maksumus</th>
                    <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Skoor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => {
                    const isOverBudget = budgetCutoffIndex !== -1 && i >= budgetCutoffIndex
                    const isCutoffRow = i === budgetCutoffIndex

                    return (
                      <Fragment key={row.id}>
                        {isCutoffRow && (
                          <tr>
                            <td colSpan={8} className="px-3 py-2">
                              <div className="flex items-center gap-2 text-xs text-orange-600">
                                <div className="h-px flex-1 bg-orange-300" />
                                <span className="font-medium whitespace-nowrap">Eelarve piir</span>
                                <div className="h-px flex-1 bg-orange-300" />
                              </div>
                            </td>
                          </tr>
                        )}
                        <tr className={`transition-colors ${isOverBudget ? 'bg-gray-50 opacity-50' : 'hover:bg-gray-50'}`}>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-400 tabular-nums">{i + 1}</td>
                          <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-900">{row.road_name}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-600 tabular-nums">
                            {row.section_start_km.toFixed(1)} – {row.section_end_km.toFixed(1)} km
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-gray-900 tabular-nums">{row.condition.iri_value.toFixed(1)}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-center">
                            <ConditionBadge iri={row.condition.iri_value} />
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-gray-700">{row.recommended_repair.name}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-right text-gray-900 tabular-nums">
                            {fmt(row.estimated_cost)} &euro;
                          </td>
                          <td className="whitespace-nowrap px-3 py-3">
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
            <p className="text-gray-500">Selle omavalitsuse kohta andmed puuduvad</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-gray-400">Teehoiu Planner &mdash; prototüüp</p>
        </div>
      </footer>
    </div>
  )
}
