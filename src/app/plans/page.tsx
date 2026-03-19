'use client'

import { useState, useEffect } from 'react'
import { fetchPlanSnapshots } from '@/lib/queries'
import type { PlanSnapshot } from '@/types/database'
import Navigation from '@/components/Navigation'
import DarkModeToggle from '@/components/DarkModeToggle'
import { useDarkMode } from '@/hooks/useDarkMode'

const fmt = (n: number) => n.toLocaleString('et-EE')

export default function PlansPage() {
  const { dark, toggleDark } = useDarkMode()
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPlanSnapshots()
      .then(setSnapshots)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 font-[var(--font-geist-sans)] transition-colors">
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#009B8D]">
                <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Plaanid</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">Salvestatud remondiplaanide ajalugu</p>
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
              <p className="text-base text-gray-500 dark:text-gray-400">Laadin plaane...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-800/50 p-5">
            <p className="text-red-800 dark:text-red-300">Viga plaanide laadimisel: {error}</p>
          </div>
        )}

        {!loading && !error && snapshots.length === 0 && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <svg className="mx-auto h-16 w-16 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">Salvestatud plaane pole</p>
              <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Lukusta plaan planeerija lehelt, et see siia ilmuks</p>
            </div>
          </div>
        )}

        {!loading && snapshots.length > 0 && (
          <div className="space-y-4">
            {snapshots.map(snap => (
              <a
                key={snap.id}
                href={`/plans/${snap.id}`}
                className="block rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700 p-6 transition hover:shadow-md hover:ring-[#009B8D]/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="inline-block rounded-md bg-[#009B8D]/10 dark:bg-[#009B8D]/20 px-2.5 py-1 text-sm font-mono font-semibold text-[#009B8D] dark:text-[#5EEAD4]">
                        {snap.reference_code}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{snap.municipality}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Eelarve: {fmt(snap.budget)} EUR &middot; {snap.covered_count} lõiku kaetud &middot; Maksumus: {fmt(snap.total_cost)} EUR
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {snap.locked_at && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/40 px-3 py-1 text-sm font-semibold text-green-800 dark:text-green-300">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                        </svg>
                        Lukustatud
                      </span>
                    )}
                    <span className="text-sm text-gray-400 dark:text-gray-500">
                      {new Date(snap.created_at).toLocaleDateString('et-EE')}
                    </span>
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 mt-12">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400 dark:text-gray-500">Teehoiu Planner &mdash; plaanid</p>
        </div>
      </footer>
    </div>
  )
}
