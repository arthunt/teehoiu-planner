'use client'

import { useState, useEffect } from 'react'
import { fetchMunicipalities, fetchRoadSections, fetchConditionData, fetchRepairTypes } from '@/lib/queries'
import { buildPriorityList, DEFAULT_WEIGHTS } from '@/lib/priority'
import type { PriorityWeights } from '@/lib/priority'
import type { RoadWithCondition } from '@/types/database'
import { aggregateByRepairType, aggregateByMunicipality } from '@/lib/pipeline'
import type { PipelineAggregate, MunicipalityAggregate } from '@/lib/pipeline'
import Navigation from '@/components/Navigation'
import DarkModeToggle from '@/components/DarkModeToggle'
import { useDarkMode } from '@/hooks/useDarkMode'

const fmt = (n: number) => n.toLocaleString('et-EE')

export default function PipelinePage() {
  const { dark, toggleDark } = useDarkMode()
  const [loading, setLoading] = useState(true)
  const [repairAggregates, setRepairAggregates] = useState<PipelineAggregate[]>([])
  const [municipalityAggregates, setMunicipalityAggregates] = useState<MunicipalityAggregate[]>([])
  const [allRoads, setAllRoads] = useState<RoadWithCondition[]>([])
  const [filterRepairType, setFilterRepairType] = useState('')
  const [filterMunicipality, setFilterMunicipality] = useState('')
  const [municipalities, setMunicipalities] = useState<string[]>([])
  const [view, setView] = useState<'repair' | 'municipality'>('repair')

  useEffect(() => {
    const loadAll = async () => {
      try {
        const [allMunicipalities, repairTypes] = await Promise.all([
          fetchMunicipalities(),
          fetchRepairTypes(),
        ])
        setMunicipalities(allMunicipalities)

        const getWeights = (): PriorityWeights => {
          try {
            const saved = localStorage.getItem('priority_weights')
            if (saved) return JSON.parse(saved)
          } catch {}
          return DEFAULT_WEIGHTS
        }

        const weights = getWeights()
        const allResults: RoadWithCondition[] = []

        for (const municipality of allMunicipalities) {
          const sections = await fetchRoadSections(municipality)
          const sectionIds = sections.map(s => s.id)
          if (sectionIds.length === 0) continue
          const conditions = await fetchConditionData(sectionIds)
          const priorityList = buildPriorityList(sections, conditions, repairTypes, weights)
          allResults.push(...priorityList)
        }

        setAllRoads(allResults)
        setRepairAggregates(aggregateByRepairType(allResults))
        setMunicipalityAggregates(aggregateByMunicipality(allResults))
      } catch (err) {
        console.error('Failed to load pipeline data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadAll()
  }, [])

  // Apply filters
  const filteredRoads = allRoads.filter(r => {
    if (filterRepairType && r.recommended_repair.name !== filterRepairType) return false
    if (filterMunicipality && r.municipality !== filterMunicipality) return false
    return true
  })

  const filteredRepairAgg = aggregateByRepairType(filteredRoads)
  const filteredMunicipalityAgg = aggregateByMunicipality(filteredRoads)

  const totalKm = filteredRoads.reduce((sum, r) => sum + r.length_km, 0)
  const totalCost = filteredRoads.reduce((sum, r) => sum + r.estimated_cost, 0)
  const repairTypeNames = [...new Set(allRoads.map(r => r.recommended_repair.name))].sort()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-[var(--font-geist-sans)] transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#009B8D]">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hankeplaan</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">Agregeeritud remondivajaduste pipeline tee-ehitusfirmadele</p>
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
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#009B8D] border-t-transparent" />
              <p className="text-base text-gray-500 dark:text-gray-400">Laadin kõigi omavalitsuste andmeid...</p>
            </div>
          </div>
        )}

        {!loading && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="rounded-xl bg-[#009B8D] p-5 text-white shadow-md">
              <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-4">
                <div>
                  <div className="text-3xl font-bold">{municipalities.length}</div>
                  <div className="text-base text-white/80">omavalitsust</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{filteredRoads.length}</div>
                  <div className="text-base text-white/80">teelõiku</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{totalKm.toFixed(1)} km</div>
                  <div className="text-base text-white/80">remonti vajav</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{fmt(totalCost)} EUR</div>
                  <div className="text-base text-white/80">hinnanguline maksumus</div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl bg-white dark:bg-slate-800 p-4 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Remonditüüp</label>
                  <select
                    value={filterRepairType}
                    onChange={e => setFilterRepairType(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-base text-gray-900 dark:text-white shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
                  >
                    <option value="">Kõik remonditüübid</option>
                    {repairTypeNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Omavalitsus</label>
                  <select
                    value={filterMunicipality}
                    onChange={e => setFilterMunicipality(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-base text-gray-900 dark:text-white shadow-sm transition focus:border-[#009B8D] focus:ring-2 focus:ring-[#009B8D]/20 focus:outline-none"
                  >
                    <option value="">Kõik omavalitsused</option>
                    {municipalities.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Vaade</label>
                  <div className="flex rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden">
                    <button
                      onClick={() => setView('repair')}
                      className={`flex-1 py-2.5 text-sm font-medium transition ${view === 'repair' ? 'bg-[#009B8D] text-white' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                    >
                      Remonditüübi järgi
                    </button>
                    <button
                      onClick={() => setView('municipality')}
                      className={`flex-1 py-2.5 text-sm font-medium transition ${view === 'municipality' ? 'bg-[#009B8D] text-white' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-600'}`}
                    >
                      Omavalitsuse järgi
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Aggregate table — by repair type */}
            {view === 'repair' && (
              <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 overflow-hidden">
                <div className="p-6 pb-0">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Remonditüübi kokkuvõte</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remonditüüp</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lõike</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">km</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maksumus</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Omavalitsused</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                      {filteredRepairAgg.map(agg => (
                        <tr key={agg.repairType} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-gray-900 dark:text-white">{agg.repairType}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{agg.sectionCount}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{agg.totalKm.toFixed(1)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-200 tabular-nums">{fmt(agg.totalCost)} &euro;</td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {agg.municipalities.map(m => (
                                <span key={m} className="inline-block rounded-full bg-gray-100 dark:bg-slate-700 px-2 py-0.5 text-xs text-gray-600 dark:text-gray-400">{m}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50">
                        <td className="whitespace-nowrap px-4 py-3.5 font-bold text-gray-900 dark:text-white">Kokku</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{filteredRoads.length}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{totalKm.toFixed(1)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{fmt(totalCost)} &euro;</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Aggregate table — by municipality */}
            {view === 'municipality' && (
              <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 overflow-hidden">
                <div className="p-6 pb-0">
                  <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Omavalitsuste kokkuvõte</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Omavalitsus</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Lõike</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">km</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maksumus</th>
                        <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remonditüübid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                      {filteredMunicipalityAgg.map(agg => (
                        <tr key={agg.municipality} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-gray-900 dark:text-white">{agg.municipality}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{agg.sectionCount}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{agg.totalKm.toFixed(1)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right font-semibold text-gray-900 dark:text-gray-200 tabular-nums">{fmt(agg.totalCost)} &euro;</td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1">
                              {agg.repairTypes.map(rt => (
                                <span key={rt} className="inline-block rounded-full bg-[#009B8D]/10 dark:bg-[#009B8D]/20 px-2 py-0.5 text-xs font-medium text-[#009B8D] dark:text-[#5EEAD4]">{rt}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50">
                        <td className="whitespace-nowrap px-4 py-3.5 font-bold text-gray-900 dark:text-white">Kokku</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{filteredRoads.length}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{totalKm.toFixed(1)}</td>
                        <td className="whitespace-nowrap px-4 py-3.5 text-right font-bold text-gray-900 dark:text-white tabular-nums">{fmt(totalCost)} &euro;</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-12">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Teehoiu Planner &mdash; hankeplaan</p>
        </div>
      </footer>
    </div>
  )
}
