'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchMunicipalities, fetchRoadSections, fetchConditionData, fetchRepairTypes } from '@/lib/queries'
import { buildPriorityList, DEFAULT_WEIGHTS } from '@/lib/priority'
import type { PriorityWeights } from '@/lib/priority'
import type { RoadWithCondition } from '@/types/database'
import Navigation from '@/components/Navigation'
import DarkModeToggle from '@/components/DarkModeToggle'

const fmt = (n: number) => n.toLocaleString('et-EE')

function ConditionBadge({ iri }: { iri: number }) {
  if (iri < 2) return <span className="inline-block rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-semibold text-green-800 dark:text-green-300">Hea</span>
  if (iri < 4) return <span className="inline-block rounded-full bg-yellow-100 dark:bg-yellow-900/40 px-3 py-1 text-sm font-semibold text-yellow-800 dark:text-yellow-300">Rahuldav</span>
  if (iri < 6) return <span className="inline-block rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-sm font-semibold text-orange-800 dark:text-orange-300">Halb</span>
  return <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-800 dark:text-red-300">Kriitiline</span>
}


// --- Risk category helpers ---

interface RiskCategory {
  label: string
  min: number
  max: number
  color: string
  bgColor: string
  darkBgColor: string
  textColor: string
  darkTextColor: string
  barColor: string
}

const RISK_CATEGORIES: RiskCategory[] = [
  { label: 'Kriitiline', min: 6, max: Infinity, color: 'red', bgColor: 'bg-red-50', darkBgColor: 'dark:bg-red-900/20', textColor: 'text-red-700', darkTextColor: 'dark:text-red-400', barColor: 'bg-red-500' },
  { label: 'Halb', min: 4, max: 6, color: 'orange', bgColor: 'bg-orange-50', darkBgColor: 'dark:bg-orange-900/20', textColor: 'text-orange-700', darkTextColor: 'dark:text-orange-400', barColor: 'bg-orange-500' },
  { label: 'Rahuldav', min: 2, max: 4, color: 'yellow', bgColor: 'bg-yellow-50', darkBgColor: 'dark:bg-yellow-900/20', textColor: 'text-yellow-700', darkTextColor: 'dark:text-yellow-400', barColor: 'bg-yellow-500' },
  { label: 'Hea', min: 0, max: 2, color: 'green', bgColor: 'bg-green-50', darkBgColor: 'dark:bg-green-900/20', textColor: 'text-green-700', darkTextColor: 'dark:text-green-400', barColor: 'bg-green-500' },
]

function getRiskCategory(iri: number): RiskCategory {
  return RISK_CATEGORIES.find(c => iri >= c.min)!
}

interface CategoryStats {
  category: RiskCategory
  roads: RoadWithCondition[]
  totalKm: number
  coveredKm: number
  coveredCost: number
  coveredCount: number
  totalCount: number
}

function computeCategoryStats(rows: RoadWithCondition[], coveredSet: Set<number>): CategoryStats[] {
  return RISK_CATEGORIES.map(category => {
    const roads = rows.filter(r => {
      const iri = r.condition.iri_value
      if (category.max === Infinity) return iri >= category.min
      return iri >= category.min && iri < category.max
    })
    const totalKm = roads.reduce((sum, r) => sum + r.length_km, 0)
    const coveredRoads = roads.filter(r => coveredSet.has(r.id))
    const coveredKm = coveredRoads.reduce((sum, r) => sum + r.length_km, 0)
    const coveredCost = coveredRoads.reduce((sum, r) => sum + r.estimated_cost, 0)
    return {
      category,
      roads,
      totalKm,
      coveredKm,
      coveredCost,
      coveredCount: coveredRoads.length,
      totalCount: roads.length,
    }
  })
}

// --- Main page component ---

export default function DashboardPage() {
  const [municipalities, setMunicipalities] = useState<string[]>([])
  const [selectedMunicipality, setSelectedMunicipality] = useState('')
  const [budget, setBudget] = useState(500000)
  const [budgetInput, setBudgetInput] = useState('500 000')
  const [rows, setRows] = useState<RoadWithCondition[]>([])
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [dark, setDark] = useState(false)

  // Dark mode
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

  const getWeights = (): PriorityWeights => {
    try {
      const saved = localStorage.getItem('priority_weights')
      if (saved) return JSON.parse(saved)
    } catch {}
    return DEFAULT_WEIGHTS
  }

  useEffect(() => {
    fetchMunicipalities().then(setMunicipalities).catch(console.error)
  }, [])

  const loadData = useCallback(async (municipality: string) => {
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
    loadData(selectedMunicipality)
  }, [selectedMunicipality, loadData])

  // Budget coverage calculation
  let runningTotal = 0
  const coveredSet = new Set<number>()
  for (const row of rows) {
    if (runningTotal + row.estimated_cost <= budget) {
      runningTotal += row.estimated_cost
      coveredSet.add(row.id)
    }
  }
  const totalCoveredCost = runningTotal
  const totalCoveredKm = rows.filter(r => coveredSet.has(r.id)).reduce((sum, r) => sum + r.length_km, 0)
  const coveredCount = coveredSet.size

  // Category statistics
  const categoryStats = dataLoaded ? computeCategoryStats(rows, coveredSet) : []
  const totalNetworkKm = rows.reduce((sum, r) => sum + r.length_km, 0)
  const totalRepairCost = rows.reduce((sum, r) => sum + r.estimated_cost, 0)

  // Narrative data
  const criticalStats = categoryStats.find(c => c.category.label === 'Kriitiline')
  const allCriticalCovered = criticalStats ? criticalStats.coveredCount === criticalStats.totalCount : true
  const uncoveredCriticalCount = criticalStats ? criticalStats.totalCount - criticalStats.coveredCount : 0
  const uncoveredCriticalCost = criticalStats
    ? criticalStats.roads.filter(r => !coveredSet.has(r.id)).reduce((sum, r) => sum + r.estimated_cost, 0)
    : 0

  // First uncovered priority road
  const firstUncoveredRoad = rows.find(r => !coveredSet.has(r.id))

  // Top 10 highest risk roads
  const top10 = rows.slice(0, 10)

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

  const today = new Date().toLocaleDateString('et-EE', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-[var(--font-geist-sans)] transition-colors">
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, .min-h-screen { background: white !important; }
          * { color: black !important; border-color: #e5e7eb !important; }
          .dark\\:bg-slate-800, .dark\\:bg-slate-900 { background: white !important; }
        }
      `}</style>

      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 no-print">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#009B8D]">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Riskide ülevaade</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">Teede seisukorra ja eelarve katvuse analüüs</p>
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Vali omavalitsus, et näha riskide ülevaadet</p>
            </div>
          </div>
        )}

        {/* Dashboard content */}
        {!loading && dataLoaded && rows.length > 0 && (
          <div className="space-y-6">

            {/* Section 1: Riskide kokkuvõte */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Riskide kokkuvõte</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {categoryStats.map(stat => {
                  const accentClasses: Record<string, { ring: string; numColor: string; icon: string }> = {
                    'Kriitiline': { ring: 'ring-red-200 dark:ring-red-800/50', numColor: 'text-red-600 dark:text-red-400', icon: 'text-red-500' },
                    'Halb': { ring: 'ring-orange-200 dark:ring-orange-800/50', numColor: 'text-orange-600 dark:text-orange-400', icon: 'text-orange-500' },
                    'Rahuldav': { ring: 'ring-yellow-200 dark:ring-yellow-800/50', numColor: 'text-yellow-600 dark:text-yellow-400', icon: 'text-yellow-500' },
                    'Hea': { ring: 'ring-green-200 dark:ring-green-800/50', numColor: 'text-green-600 dark:text-green-400', icon: 'text-green-500' },
                  }
                  const accent = accentClasses[stat.category.label]
                  return (
                    <div key={stat.category.label} className={`rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ${accent.ring} p-6`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{stat.category.label}</span>
                        <span className={`text-sm font-semibold ${accent.icon}`}>IRI {stat.category.min === 0 ? '<' : '\u2265'}{stat.category.min === 0 ? stat.category.max : stat.category.min}</span>
                      </div>
                      <div className={`text-3xl font-bold ${accent.numColor} tabular-nums`}>{stat.totalCount}</div>
                      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {stat.totalKm.toFixed(1)} km teelõike
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Section 2: Eelarve katvus */}
            <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-6">
              <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">Eelarve katvus</h2>
              <div className="space-y-5">
                {categoryStats.map(stat => {
                  if (stat.totalCount === 0) return null
                  const coveragePct = stat.totalKm > 0 ? (stat.coveredKm / stat.totalKm) * 100 : 0
                  const coverageLabel = coveragePct === 100
                    ? 'Täielik katvus'
                    : coveragePct === 0
                      ? 'Katvus puudub'
                      : `${Math.round(coveragePct)}% katvus`

                  return (
                    <div key={stat.category.label}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${stat.category.barColor}`} />
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{stat.category.label}</span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({stat.coveredCount}/{stat.totalCount} lõiku)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {stat.coveredKm.toFixed(1)}/{stat.totalKm.toFixed(1)} km kaetud
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {fmt(stat.coveredCost)} EUR
                          </span>
                        </div>
                      </div>
                      {/* Bar */}
                      <div className="relative h-6 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700">
                        {/* Covered portion */}
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full ${stat.category.barColor} transition-all duration-500`}
                          style={{ width: `${coveragePct}%` }}
                        />
                        {/* Uncovered portion with striped pattern */}
                        {coveragePct < 100 && (
                          <div
                            className="absolute inset-y-0 right-0 rounded-r-full opacity-20"
                            style={{
                              left: `${coveragePct}%`,
                              background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239,68,68,0.4) 4px, rgba(239,68,68,0.4) 8px)',
                            }}
                          />
                        )}
                      </div>
                      <div className="mt-1 text-right">
                        <span className={`text-xs font-semibold ${coveragePct === 100 ? 'text-green-600 dark:text-green-400' : coveragePct >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {coverageLabel}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* Summary line */}
              <div className="mt-5 flex items-center justify-between border-t border-gray-200 dark:border-slate-700 pt-4">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Kokku kaetud</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {totalCoveredKm.toFixed(1)} / {totalNetworkKm.toFixed(1)} km &middot; {fmt(totalCoveredCost)} / {fmt(budget)} EUR
                </span>
              </div>
            </div>

            {/* Section 3: Otsuste põhjendus */}
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Otsuste põhjendus</h2>
              <div className="space-y-3">
                {/* Critical coverage */}
                {criticalStats && criticalStats.totalCount > 0 && (
                  allCriticalCovered ? (
                    <div className="rounded-xl bg-green-50 dark:bg-green-900/20 ring-1 ring-green-200 dark:ring-green-800/50 p-5">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-green-600 dark:text-green-400 text-xl leading-none">&#10003;</span>
                        <div>
                          <p className="font-semibold text-green-800 dark:text-green-300">
                            Kõik kriitilise seisukorraga teed on remondiplaanis
                          </p>
                          <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                            Eelarve katab {criticalStats.totalCount} kriitilist teelõiku ({criticalStats.totalKm.toFixed(1)} km) &middot; {fmt(criticalStats.coveredCost)} EUR
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800/50 p-5">
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 text-red-600 dark:text-red-400 text-xl leading-none">&#9888;</span>
                        <div>
                          <p className="font-semibold text-red-800 dark:text-red-300">
                            {uncoveredCriticalCount} kriitilist teelõiku jääb eelarvest välja
                          </p>
                          <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                            Eelarve katab {criticalStats.coveredCount} kriitilist teelõiku {criticalStats.totalCount}-st ({Math.round((criticalStats.coveredCount / criticalStats.totalCount) * 100)}%) &middot; Vajalik lisarahastus: {fmt(uncoveredCriticalCost)} EUR
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* Budget vs total cost */}
                <div className="rounded-xl bg-white dark:bg-slate-800 ring-1 ring-gray-200 dark:ring-slate-700 p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 text-[#009B8D] text-xl leading-none">&#8364;</span>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Eelarve katab {coveredCount} teelõiku {rows.length}-st
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                        Kogu remondimaksumus: {fmt(totalRepairCost)} EUR &middot; Eelarve: {fmt(budget)} EUR &middot; {budget >= totalRepairCost ? 'Eelarve katab kõik vajadused' : `Puudujääk: ${fmt(totalRepairCost - budget)} EUR`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* First uncovered road */}
                {firstUncoveredRoad && (
                  <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 ring-1 ring-orange-200 dark:ring-orange-800/50 p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-orange-600 dark:text-orange-400 text-xl leading-none">&#9679;</span>
                      <div>
                        <p className="font-semibold text-orange-800 dark:text-orange-300">
                          Kõige prioriteetsem remontimata lõik
                        </p>
                        <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
                          {firstUncoveredRoad.road_name} (IRI: {firstUncoveredRoad.condition.iri_value.toFixed(1)}, skoor: {firstUncoveredRoad.priority_score}) &middot; Maksumus: {fmt(firstUncoveredRoad.estimated_cost)} EUR
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Riskijaotus — stacked bar chart */}
            <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-6">
              <h2 className="mb-5 text-lg font-semibold text-gray-900 dark:text-white">Teevõrgu seisukord</h2>
              {/* Stacked bar */}
              <div className="h-10 flex overflow-hidden rounded-full">
                {categoryStats.slice().reverse().map(stat => {
                  const pct = totalNetworkKm > 0 ? (stat.totalKm / totalNetworkKm) * 100 : 0
                  if (pct === 0) return null
                  return (
                    <div
                      key={stat.category.label}
                      className={`${stat.category.barColor} transition-all duration-500 flex items-center justify-center`}
                      style={{ width: `${pct}%` }}
                      title={`${stat.category.label}: ${stat.totalKm.toFixed(1)} km (${Math.round(pct)}%)`}
                    >
                      {pct > 8 && (
                        <span className="text-xs font-bold text-white drop-shadow-sm">{Math.round(pct)}%</span>
                      )}
                    </div>
                  )
                })}
              </div>
              {/* Legend */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {categoryStats.slice().reverse().map(stat => {
                  const pct = totalNetworkKm > 0 ? (stat.totalKm / totalNetworkKm) * 100 : 0
                  return (
                    <div key={stat.category.label} className="flex items-center gap-2">
                      <div className={`h-3 w-3 flex-shrink-0 rounded-full ${stat.category.barColor}`} />
                      <div className="text-sm">
                        <span className="font-medium text-gray-900 dark:text-white">{stat.category.label}</span>
                        <span className="text-gray-500 dark:text-gray-400"> {stat.totalKm.toFixed(1)} km ({Math.round(pct)}%)</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Section 5: Top 10 kõrgeima riskiga teed */}
            <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 overflow-hidden">
              <div className="p-6 pb-0">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Top 10 kõrgeima riskiga teed</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                      <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tee</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IRI</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seisukord</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Skoor</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remont</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maksumus</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kaetud</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    {top10.map((row, i) => {
                      const isCovered = coveredSet.has(row.id)
                      return (
                        <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 font-medium text-gray-900 dark:text-white">{row.road_name}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{row.condition.iri_value.toFixed(1)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center">
                            <ConditionBadge iri={row.condition.iri_value} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{row.priority_score}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-700 dark:text-gray-300">{row.recommended_repair.name}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{fmt(row.estimated_cost)} &euro;</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center">
                            {isCovered ? (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-sm font-bold">&#10003;</span>
                            ) : (
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 text-sm font-bold">&#10007;</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 6: Print / Footer info */}
            <div className="flex items-center justify-between rounded-xl bg-gray-100 dark:bg-slate-800/50 px-6 py-4 ring-1 ring-gray-200 dark:ring-slate-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Genereeritud: {today}. Andmed: {selectedMunicipality}. Eelarve: {fmt(budget)} EUR.
              </p>
              <button
                onClick={() => window.print()}
                className="no-print flex items-center gap-2 rounded-lg bg-[#009B8D] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#008577]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.131H5.25" />
                </svg>
                Prindi aruanne
              </button>
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
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Teehoiu Planner &mdash; riskide ülevaade</p>
        </div>
      </footer>
    </div>
  )
}
