'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { fetchPlanSnapshot, fetchAuditLogs, lockPlanSnapshot, insertAuditLog } from '@/lib/queries'
import { buildScoreExplanation } from '@/lib/audit'
import type { PlanSnapshot, AuditLog, RoadWithCondition } from '@/types/database'
import type { PriorityWeights } from '@/lib/priority'
import Navigation from '@/components/Navigation'
import DarkModeToggle from '@/components/DarkModeToggle'
import { useDarkMode } from '@/hooks/useDarkMode'

const fmt = (n: number) => n.toLocaleString('et-EE')

function ConditionBadge({ iri }: { iri: number }) {
  if (iri < 2) return <span className="inline-block rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-semibold text-green-800 dark:text-green-300">Hea</span>
  if (iri < 4) return <span className="inline-block rounded-full bg-yellow-100 dark:bg-yellow-900/40 px-3 py-1 text-sm font-semibold text-yellow-800 dark:text-yellow-300">Rahuldav</span>
  if (iri < 6) return <span className="inline-block rounded-full bg-orange-100 dark:bg-orange-900/40 px-3 py-1 text-sm font-semibold text-orange-800 dark:text-orange-300">Halb</span>
  return <span className="inline-block rounded-full bg-red-100 dark:bg-red-900/40 px-3 py-1 text-sm font-semibold text-red-800 dark:text-red-300">Kriitiline</span>
}

export default function PlanDetailPage() {
  const params = useParams()
  const planId = Number(params.id)
  const { dark, toggleDark } = useDarkMode()

  const [snapshot, setSnapshot] = useState<PlanSnapshot | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [locking, setLocking] = useState(false)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  useEffect(() => {
    if (!planId) return
    Promise.all([
      fetchPlanSnapshot(planId),
      fetchAuditLogs(planId),
    ])
      .then(([snap, logs]) => {
        setSnapshot(snap)
        setAuditLogs(logs)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [planId])

  const handleLock = async () => {
    if (!snapshot || snapshot.locked_at) return
    setLocking(true)
    try {
      await lockPlanSnapshot(snapshot.id)
      await insertAuditLog(snapshot.id, 'locked')
      const [snap, logs] = await Promise.all([
        fetchPlanSnapshot(planId),
        fetchAuditLogs(planId),
      ])
      setSnapshot(snap)
      setAuditLogs(logs)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLocking(false)
    }
  }

  const handlePrint = async () => {
    if (snapshot) {
      try {
        await insertAuditLog(snapshot.id, 'exported')
      } catch {}
    }
    window.print()
  }

  const rows: RoadWithCondition[] = snapshot?.ranked_list_json ?? []
  const weights: PriorityWeights = snapshot?.weights_json
    ? { iri: snapshot.weights_json.iri ?? 0.4, defect: snapshot.weights_json.defect ?? 0.3, traffic: snapshot.weights_json.traffic ?? 0.2, bearing: snapshot.weights_json.bearing ?? 0.1 }
    : { iri: 0.4, defect: 0.3, traffic: 0.2, bearing: 0.1 }
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
              <a href="/plans" className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 shadow-sm transition hover:bg-gray-100 dark:hover:bg-slate-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </a>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {snapshot?.reference_code ?? 'Plaan'}
                </h1>
                <p className="text-base text-gray-500 dark:text-gray-400">
                  {snapshot?.municipality ?? ''} &middot; Eelarve: {snapshot ? fmt(snapshot.budget) : '–'} EUR
                </p>
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
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#009B8D] border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800/50 p-5 mb-6">
            <p className="text-red-800 dark:text-red-300">Viga: {error}</p>
          </div>
        )}

        {!loading && snapshot && (
          <div className="space-y-6">
            {/* Summary card */}
            <div className="rounded-xl bg-[#009B8D] p-5 text-white shadow-md">
              <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-4">
                <div>
                  <div className="text-3xl font-bold">{snapshot.covered_count}</div>
                  <div className="text-base text-white/80">lõiku kaetud</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{fmt(snapshot.total_cost)} EUR</div>
                  <div className="text-base text-white/80">kogumaksumus</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{fmt(snapshot.budget)} EUR</div>
                  <div className="text-base text-white/80">eelarve</div>
                </div>
                <div>
                  <div className="text-3xl font-bold">{rows.length}</div>
                  <div className="text-base text-white/80">teelõiku kokku</div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 no-print">
              {!snapshot.locked_at && (
                <button
                  onClick={handleLock}
                  disabled={locking}
                  className="flex items-center gap-2 rounded-lg bg-[#009B8D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#008577] disabled:opacity-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  {locking ? 'Lukustan...' : 'Lukusta plaan'}
                </button>
              )}
              {snapshot.locked_at && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1.5 text-sm font-semibold text-green-800 dark:text-green-300">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                  Lukustatud {new Date(snapshot.locked_at).toLocaleDateString('et-EE')}
                </span>
              )}
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm transition hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.131H5.25" />
                </svg>
                Ekspordi PDF
              </button>
            </div>

            {/* Weights */}
            <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-6">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Kaalud</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-50 dark:bg-slate-700 p-3 text-center">
                  <div className="text-2xl font-bold text-[#009B8D]">{Math.round(weights.iri * 100)}%</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">IRI</div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-slate-700 p-3 text-center">
                  <div className="text-2xl font-bold text-[#009B8D]">{Math.round(weights.defect * 100)}%</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Defektid</div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-slate-700 p-3 text-center">
                  <div className="text-2xl font-bold text-[#009B8D]">{Math.round(weights.traffic * 100)}%</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Liiklus</div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-slate-700 p-3 text-center">
                  <div className="text-2xl font-bold text-[#009B8D]">{Math.round(weights.bearing * 100)}%</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Kandevus</div>
                </div>
              </div>
            </div>

            {/* Ranked list table */}
            <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 overflow-hidden">
              <div className="p-6 pb-0">
                <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Prioriteedi nimekiri</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-base">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                      <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">#</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tee</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IRI</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Seisukord</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remont</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maksumus</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-right text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Skoor</th>
                      <th className="whitespace-nowrap px-4 py-3.5 text-center text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kaetud</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                    {rows.map((row, i) => {
                      const isCovered = i < snapshot.covered_count
                      const isExpanded = expandedRow === row.id
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                          className={`transition-colors cursor-pointer ${!isCovered ? 'opacity-50' : ''} hover:bg-gray-50 dark:hover:bg-slate-700/30`}
                        >
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-400 dark:text-gray-500 tabular-nums">{i + 1}</td>
                          <td className="px-4 py-3.5">
                            <div className="font-medium text-gray-900 dark:text-white">{row.road_name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {row.section_start_km.toFixed(1)} – {row.section_end_km.toFixed(1)} km
                            </div>
                            {isExpanded && (
                              <div className="mt-2 rounded-lg bg-gray-50 dark:bg-slate-700 p-3 text-xs text-gray-600 dark:text-gray-300 font-mono">
                                {buildScoreExplanation(row, weights)}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{row.condition.iri_value.toFixed(1)}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-center"><ConditionBadge iri={row.condition.iri_value} /></td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-gray-700 dark:text-gray-300">{row.recommended_repair.name}</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{fmt(row.estimated_cost)} &euro;</td>
                          <td className="whitespace-nowrap px-4 py-3.5 text-right text-gray-900 dark:text-gray-200 tabular-nums">{row.priority_score}</td>
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

            {/* Audit log */}
            {auditLogs.length > 0 && (
              <div className="rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-6">
                <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Auditi logi</h2>
                <div className="space-y-2">
                  {auditLogs.map(log => (
                    <div key={log.id} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400 dark:text-gray-500 tabular-nums">
                        {new Date(log.created_at).toLocaleString('et-EE')}
                      </span>
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        log.action === 'locked' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                        log.action === 'exported' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {log.action === 'created' ? 'Loodud' : log.action === 'locked' ? 'Lukustatud' : log.action === 'exported' ? 'Eksporditud' : log.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Print footer */}
            <div className="flex items-center justify-between rounded-xl bg-gray-100 dark:bg-slate-800/50 px-6 py-4 ring-1 ring-gray-200 dark:ring-slate-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Viitekood: {snapshot.reference_code} &middot; Genereeritud: {today} &middot; {snapshot.municipality} &middot; Eelarve: {fmt(snapshot.budget)} EUR
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-12">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Teehoiu Planner &mdash; plaani detail</p>
        </div>
      </footer>
    </div>
  )
}
