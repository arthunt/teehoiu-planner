'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  PriorityWeights,
  DEFAULT_WEIGHTS,
  calculatePriorityScore,
} from '@/lib/priority'
import {
  fetchAllRoadSections,
  fetchAllConditionData,
  updateConditionData,
  deleteConditionData,
  upsertRoadSections,
  upsertConditionData,
} from '@/lib/queries'
import type { RoadSection, ConditionData } from '@/types/database'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return []

  const parseRow = (line: string): string[] => {
    const fields: string[] = []
    let i = 0
    while (i < line.length) {
      if (line[i] === '"') {
        i++ // skip opening quote
        let field = ''
        while (i < line.length) {
          if (line[i] === '"') {
            if (i + 1 < line.length && line[i + 1] === '"') {
              field += '"'
              i += 2
            } else {
              i++ // skip closing quote
              break
            }
          } else {
            field += line[i]
            i++
          }
        }
        // skip comma after quoted field
        if (i < line.length && line[i] === ',') i++
        fields.push(field.trim())
      } else {
        const next = line.indexOf(',', i)
        if (next === -1) {
          fields.push(line.slice(i).trim())
          break
        } else {
          fields.push(line.slice(i, next).trim())
          i = next + 1
        }
      }
    }
    return fields
  }

  const headers = parseRow(lines[0]).map((h) => h.trim())
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i])
    const obj: Record<string, string> = {}
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? ''
    })
    rows.push(obj)
  }
  return rows
}

// ---------------------------------------------------------------------------
// Dark mode toggle (same as main page)
// ---------------------------------------------------------------------------

function DarkModeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 shadow-sm transition hover:bg-gray-100 dark:hover:bg-gray-700"
      title={dark ? 'Hele teema' : 'Tume teema'}
    >
      {dark ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
        </svg>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type Tab = 'weights' | 'data' | 'csv'

const TABS: { key: Tab; label: string }[] = [
  { key: 'weights', label: 'Kaalud' },
  { key: 'data', label: 'Seisukorra andmed' },
  { key: 'csv', label: 'CSV import' },
]

// ---------------------------------------------------------------------------
// Weights tab
// ---------------------------------------------------------------------------

function WeightsTab() {
  const [weights, setWeights] = useState<PriorityWeights>({ ...DEFAULT_WEIGHTS })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('priority_weights')
      if (raw) {
        const parsed = JSON.parse(raw) as PriorityWeights
        setWeights(parsed)
      }
    } catch {
      // ignore
    }
  }, [])

  const sum = weights.iri + weights.defect + weights.traffic + weights.bearing
  const sumPct = Math.round(sum * 100)
  const isValid = sumPct === 100

  const updateWeight = (key: keyof PriorityWeights, pct: number) => {
    setSaved(false)
    setWeights((prev) => ({ ...prev, [key]: pct / 100 }))
  }

  const handleSave = () => {
    localStorage.setItem('priority_weights', JSON.stringify(weights))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setWeights({ ...DEFAULT_WEIGHTS })
    localStorage.removeItem('priority_weights')
    setSaved(false)
  }

  // Preview calculation with a mock condition
  const mockCondition: ConditionData = {
    id: 0,
    road_section_id: 0,
    year: 2024,
    iri_value: 5.0,
    defect_count: 12,
    defect_severity: 'kõrge',
    bearing_capacity: 'nõrk',
    traffic_volume_daily: 3000,
  }
  const previewScore = calculatePriorityScore(mockCondition, weights)

  const sliders: { key: keyof PriorityWeights; label: string }[] = [
    { key: 'iri', label: 'IRI kaal' },
    { key: 'defect', label: 'Defektide kaal' },
    { key: 'traffic', label: 'Liikluse kaal' },
    { key: 'bearing', label: 'Kandevuse kaal' },
  ]

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Prioriteedi kaalud</h2>

        <div className="space-y-5">
          {sliders.map(({ key, label }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-base font-medium text-gray-700 dark:text-gray-300">{label}</label>
                <span className="text-base font-semibold tabular-nums text-gray-900 dark:text-white">
                  {Math.round(weights[key] * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round(weights[key] * 100)}
                onChange={(e) => updateWeight(key, parseInt(e.target.value, 10))}
                className="w-full h-2 rounded-full appearance-none bg-gray-200 dark:bg-slate-600 accent-[#009B8D] cursor-pointer"
              />
            </div>
          ))}
        </div>

        {/* Sum warning */}
        <div className={`mt-4 rounded-lg px-4 py-3 text-base font-medium ${
          isValid
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
        }`}>
          Kaalude summa: {sumPct}%
          {!isValid && ' — peab olema 100%'}
        </div>

        {/* Buttons */}
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            onClick={handleSave}
            className="rounded-lg bg-[#009B8D] px-5 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-[#008577] disabled:opacity-50"
          >
            Salvesta
          </button>
          <button
            onClick={handleReset}
            className="rounded-lg bg-gray-200 dark:bg-slate-600 px-5 py-2.5 text-base font-medium text-gray-700 dark:text-gray-200 shadow-sm transition hover:bg-gray-300 dark:hover:bg-slate-500"
          >
            Taasta vaikeväärtused
          </button>
          {saved && (
            <span className="self-center text-base text-green-600 dark:text-green-400 font-medium">Salvestatud!</span>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Näidisarvutus</h2>
        <p className="text-base text-gray-500 dark:text-gray-400 mb-4">
          Näidis: IRI = 5.0, defekt = kõrge, liiklus = 3000, kandevus = nõrk
        </p>
        <div className="flex items-center gap-3">
          <div className="text-3xl font-bold text-[#009B8D]">{previewScore}</div>
          <div className="text-base text-gray-500 dark:text-gray-400">/ 100 prioriteediskoor</div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Condition data tab
// ---------------------------------------------------------------------------

function ConditionDataTab() {
  const [roadSections, setRoadSections] = useState<RoadSection[]>([])
  const [conditionRows, setConditionRows] = useState<ConditionData[]>([])
  const [loading, setLoading] = useState(true)
  const [dirtyIds, setDirtyIds] = useState<Set<number>>(new Set())
  const [editedRows, setEditedRows] = useState<Map<number, Partial<ConditionData>>>(new Map())
  const [savingId, setSavingId] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sections, conditions] = await Promise.all([
        fetchAllRoadSections(),
        fetchAllConditionData(),
      ])
      setRoadSections(sections)
      setConditionRows(conditions)
    } catch (err) {
      console.error('Failed to load data:', err)
      setMessage({ type: 'error', text: 'Andmete laadimine ebaõnnestus' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const roadNameMap = new Map(roadSections.map((s) => [s.id, s.road_name]))

  const getEdited = (row: ConditionData): ConditionData => {
    const edits = editedRows.get(row.id)
    return edits ? { ...row, ...edits } : row
  }

  const handleFieldChange = (id: number, field: keyof ConditionData, value: string | number) => {
    setEditedRows((prev) => {
      const next = new Map(prev)
      const existing = next.get(id) ?? {}
      next.set(id, { ...existing, [field]: value })
      return next
    })
    setDirtyIds((prev) => new Set(prev).add(id))
  }

  const handleSaveRow = async (row: ConditionData) => {
    const edits = editedRows.get(row.id)
    if (!edits) return
    setSavingId(row.id)
    setMessage(null)
    try {
      await updateConditionData(row.id, edits)
      // Update local state
      setConditionRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, ...edits } : r))
      )
      setDirtyIds((prev) => {
        const next = new Set(prev)
        next.delete(row.id)
        return next
      })
      setEditedRows((prev) => {
        const next = new Map(prev)
        next.delete(row.id)
        return next
      })
      setMessage({ type: 'success', text: 'Rida salvestatud' })
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      console.error('Save failed:', err)
      setMessage({ type: 'error', text: 'Salvestamine ebaõnnestus' })
    } finally {
      setSavingId(null)
    }
  }

  const handleDeleteRow = async (id: number) => {
    if (!confirm('Kas oled kindel, et soovid selle rea kustutada?')) return
    setMessage(null)
    try {
      await deleteConditionData(id)
      setConditionRows((prev) => prev.filter((r) => r.id !== id))
      setDirtyIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setEditedRows((prev) => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
      setMessage({ type: 'success', text: 'Rida kustutatud' })
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      console.error('Delete failed:', err)
      setMessage({ type: 'error', text: 'Kustutamine ebaõnnestus' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#009B8D] border-t-transparent" />
          <p className="text-base text-gray-500 dark:text-gray-400">Laadin andmeid...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className={`rounded-lg px-4 py-3 text-base font-medium ${
          message.type === 'success'
            ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
        }`}>
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tee</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Aasta</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">IRI</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Defektid</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tõsidus</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kandevus</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Liiklus</th>
                <th className="whitespace-nowrap px-3 py-3 text-left text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tegevused</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
              {conditionRows.map((row) => {
                const edited = getEdited(row)
                const isDirty = dirtyIds.has(row.id)
                const isSaving = savingId === row.id
                return (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900 dark:text-white">
                      {roadNameMap.get(row.road_section_id) ?? `#${row.road_section_id}`}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-gray-700 dark:text-gray-300 tabular-nums">
                      {row.year}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <input
                        type="number"
                        step="0.1"
                        value={edited.iri_value}
                        onChange={(e) => handleFieldChange(row.id, 'iri_value', parseFloat(e.target.value) || 0)}
                        className="w-20 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-base text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <input
                        type="number"
                        value={edited.defect_count}
                        onChange={(e) => handleFieldChange(row.id, 'defect_count', parseInt(e.target.value, 10) || 0)}
                        className="w-20 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-base text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <select
                        value={edited.defect_severity}
                        onChange={(e) => handleFieldChange(row.id, 'defect_severity', e.target.value)}
                        className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-base text-gray-900 dark:text-white"
                      >
                        <option value="madal">madal</option>
                        <option value="keskmine">keskmine</option>
                        <option value="kõrge">kõrge</option>
                        <option value="kriitiline">kriitiline</option>
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <select
                        value={edited.bearing_capacity}
                        onChange={(e) => handleFieldChange(row.id, 'bearing_capacity', e.target.value)}
                        className="rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-base text-gray-900 dark:text-white"
                      >
                        <option value="piisav">piisav</option>
                        <option value="nõrk">nõrk</option>
                        <option value="kriitiline">kriitiline</option>
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <input
                        type="number"
                        value={edited.traffic_volume_daily}
                        onChange={(e) => handleFieldChange(row.id, 'traffic_volume_daily', parseInt(e.target.value, 10) || 0)}
                        className="w-24 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1.5 text-base text-gray-900 dark:text-white"
                      />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <div className="flex gap-2">
                        {isDirty && (
                          <button
                            onClick={() => handleSaveRow(row)}
                            disabled={isSaving}
                            className="rounded-lg bg-[#009B8D] px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#008577] disabled:opacity-50"
                          >
                            {isSaving ? '...' : 'Salvesta'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteRow(row.id)}
                          className="rounded-lg bg-red-100 dark:bg-red-900/30 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 shadow-sm transition hover:bg-red-200 dark:hover:bg-red-900/50"
                        >
                          Kustuta
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {conditionRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-base text-gray-500 dark:text-gray-400">
                    Andmeid ei leitud
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CSV import tab
// ---------------------------------------------------------------------------

function CSVImportTab() {
  // Road sections import state
  const [roadCSVRows, setRoadCSVRows] = useState<Record<string, string>[]>([])
  const [roadFileName, setRoadFileName] = useState('')
  const [roadImporting, setRoadImporting] = useState(false)
  const [roadMessage, setRoadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Condition data import state
  const [condCSVRows, setCondCSVRows] = useState<Record<string, string>[]>([])
  const [condFileName, setCondFileName] = useState('')
  const [condImporting, setCondImporting] = useState(false)
  const [condMessage, setCondMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleRoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setRoadFileName(file.name)
    setRoadMessage(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setRoadCSVRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const handleRoadImport = async () => {
    if (roadCSVRows.length === 0) return
    setRoadImporting(true)
    setRoadMessage(null)
    try {
      const sections = roadCSVRows.map((r) => ({
        road_name: r.road_name ?? '',
        section_start_km: parseFloat(r.section_start_km) || 0,
        section_end_km: parseFloat(r.section_end_km) || 0,
        length_km: parseFloat(r.length_km) || 0,
        municipality: r.municipality ?? '',
        road_class: r.road_class ?? '',
        surface_type: r.surface_type ?? '',
      }))
      await upsertRoadSections(sections)
      setRoadMessage({ type: 'success', text: `${sections.length} rida imporditud!` })
      setRoadCSVRows([])
      setRoadFileName('')
    } catch (err) {
      console.error('Road import failed:', err)
      setRoadMessage({ type: 'error', text: `Import ebaõnnestus: ${err instanceof Error ? err.message : 'Tundmatu viga'}` })
    } finally {
      setRoadImporting(false)
    }
  }

  const handleCondFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCondFileName(file.name)
    setCondMessage(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCondCSVRows(parseCSV(text))
    }
    reader.readAsText(file)
  }

  const handleCondImport = async () => {
    if (condCSVRows.length === 0) return
    setCondImporting(true)
    setCondMessage(null)
    try {
      const conditions = condCSVRows.map((r) => ({
        road_section_id: parseInt(r.road_section_id, 10) || 0,
        year: parseInt(r.year, 10) || 0,
        iri_value: parseFloat(r.iri_value) || 0,
        defect_count: parseInt(r.defect_count, 10) || 0,
        defect_severity: r.defect_severity ?? '',
        bearing_capacity: r.bearing_capacity ?? '',
        traffic_volume_daily: parseInt(r.traffic_volume_daily, 10) || 0,
      }))
      await upsertConditionData(conditions)
      setCondMessage({ type: 'success', text: `${conditions.length} rida imporditud!` })
      setCondCSVRows([])
      setCondFileName('')
    } catch (err) {
      console.error('Condition import failed:', err)
      setCondMessage({ type: 'error', text: `Import ebaõnnestus: ${err instanceof Error ? err.message : 'Tundmatu viga'}` })
    } finally {
      setCondImporting(false)
    }
  }

  const previewTable = (rows: Record<string, string>[]) => {
    if (rows.length === 0) return null
    const headers = Object.keys(rows[0])
    const preview = rows.slice(0, 5)
    return (
      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
              {headers.map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-gray-500 dark:text-gray-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
            {preview.map((row, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h} className="whitespace-nowrap px-3 py-2 text-gray-700 dark:text-gray-300">
                    {row[h]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 5 && (
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
            ... ja veel {rows.length - 5} rida
          </div>
        )}
      </div>
    )
  }

  const inputClass = "block w-full rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-base text-gray-900 dark:text-white file:mr-4 file:rounded-lg file:border-0 file:bg-[#009B8D] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#008577] cursor-pointer"

  return (
    <div className="space-y-8">
      {/* Road sections import */}
      <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Teelõikude import</h2>
        <p className="text-base text-gray-500 dark:text-gray-400 mb-4">
          Lae üles CSV fail teelõikude andmetega.
        </p>

        <div className="mb-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 p-3 font-mono text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Näidis CSV formaat:</div>
          road_name,section_start_km,section_end_km,length_km,municipality,road_class,surface_type<br />
          Tallinn-Tartu mnt,0.0,5.2,5.2,Tartu vald,põhimaantee,asfalt
        </div>

        <input
          type="file"
          accept=".csv"
          onChange={handleRoadFile}
          className={inputClass}
        />
        {roadFileName && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Fail: {roadFileName}</p>
        )}

        {previewTable(roadCSVRows)}

        {roadCSVRows.length > 0 && (
          <button
            onClick={handleRoadImport}
            disabled={roadImporting}
            className="mt-4 rounded-lg bg-[#009B8D] px-5 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-[#008577] disabled:opacity-50"
          >
            {roadImporting ? 'Importimine...' : `Impordi ${roadCSVRows.length} rida`}
          </button>
        )}

        {roadMessage && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-base font-medium ${
            roadMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {roadMessage.text}
          </div>
        )}
      </div>

      {/* Condition data import */}
      <div className="rounded-xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Seisukorra andmete import</h2>
        <p className="text-base text-gray-500 dark:text-gray-400 mb-4">
          Lae üles CSV fail seisukorra andmetega.
        </p>

        <div className="mb-4 rounded-lg bg-gray-50 dark:bg-slate-900/50 p-3 font-mono text-sm text-gray-600 dark:text-gray-400 overflow-x-auto">
          <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">Näidis CSV formaat:</div>
          road_section_id,year,iri_value,defect_count,defect_severity,bearing_capacity,traffic_volume_daily<br />
          1,2024,4.5,8,keskmine,nõrk,2500
        </div>

        <input
          type="file"
          accept=".csv"
          onChange={handleCondFile}
          className={inputClass}
        />
        {condFileName && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Fail: {condFileName}</p>
        )}

        {previewTable(condCSVRows)}

        {condCSVRows.length > 0 && (
          <button
            onClick={handleCondImport}
            disabled={condImporting}
            className="mt-4 rounded-lg bg-[#009B8D] px-5 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-[#008577] disabled:opacity-50"
          >
            {condImporting ? 'Importimine...' : `Impordi ${condCSVRows.length} rida`}
          </button>
        )}

        {condMessage && (
          <div className={`mt-4 rounded-lg px-4 py-3 text-base font-medium ${
            condMessage.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {condMessage.text}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main admin page
// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [dark, setDark] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('weights')

  useEffect(() => {
    const saved = localStorage.getItem('theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
  }, [])

  const toggleDark = () => {
    setDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle('dark', next)
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
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
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Administreerimine</h1>
                <p className="text-base text-gray-500 dark:text-gray-400">Kaalude, andmete ja importide haldamine</p>
              </div>
            </div>
            <DarkModeToggle dark={dark} onToggle={toggleDark} />
          </div>

          {/* Back link */}
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-base font-medium text-[#009B8D] hover:text-[#008577] transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              Tagasi planeerijasse
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Tab bar */}
        <div className="mb-6 flex gap-1 rounded-xl bg-white dark:bg-slate-800 p-1 shadow-sm ring-1 ring-gray-200 dark:ring-slate-700">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-base font-medium transition ${
                activeTab === tab.key
                  ? 'bg-[#009B8D] text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'weights' && <WeightsTab />}
        {activeTab === 'data' && <ConditionDataTab />}
        {activeTab === 'csv' && <CSVImportTab />}
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
