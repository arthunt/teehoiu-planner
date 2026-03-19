import { supabase } from './supabase'
import { RoadSection, ConditionData, RepairType, PlanSnapshot, AuditLog } from '../types/database'

export async function fetchMunicipalities(): Promise<string[]> {
  const { data, error } = await supabase
    .from('road_sections')
    .select('municipality')

  if (error) throw error

  const unique = [...new Set((data ?? []).map((r) => r.municipality))]
  return unique.sort()
}

export async function fetchRoadSections(municipality: string): Promise<RoadSection[]> {
  const { data, error } = await supabase
    .from('road_sections')
    .select('*')
    .eq('municipality', municipality)

  if (error) throw error
  return (data ?? []) as RoadSection[]
}

export async function fetchConditionData(sectionIds: number[]): Promise<ConditionData[]> {
  const { data, error } = await supabase
    .from('condition_data')
    .select('*')
    .in('road_section_id', sectionIds)

  if (error) throw error
  return (data ?? []) as ConditionData[]
}

export async function fetchRepairTypes(): Promise<RepairType[]> {
  const { data, error } = await supabase
    .from('repair_types')
    .select('*')
    .order('min_iri', { ascending: true })

  if (error) throw error
  return (data ?? []) as RepairType[]
}

// --- Admin CRUD functions ---

export async function fetchAllRoadSections(): Promise<RoadSection[]> {
  const { data, error } = await supabase
    .from('road_sections')
    .select('*')
    .order('municipality', { ascending: true })
    .order('road_name', { ascending: true })

  if (error) throw error
  return (data ?? []) as RoadSection[]
}

export async function fetchAllConditionData(): Promise<ConditionData[]> {
  const { data, error } = await supabase
    .from('condition_data')
    .select('*')
    .order('road_section_id', { ascending: true })

  if (error) throw error
  return (data ?? []) as ConditionData[]
}

export async function updateConditionData(id: number, updates: Partial<ConditionData>): Promise<void> {
  const { error } = await supabase
    .from('condition_data')
    .update(updates)
    .eq('id', id)

  if (error) throw error
}

export async function upsertRoadSections(sections: Omit<RoadSection, 'id'>[]): Promise<RoadSection[]> {
  const { data, error } = await supabase
    .from('road_sections')
    .insert(sections)
    .select()

  if (error) throw error
  return (data ?? []) as RoadSection[]
}

export async function upsertConditionData(conditions: Omit<ConditionData, 'id'>[]): Promise<ConditionData[]> {
  const { data, error } = await supabase
    .from('condition_data')
    .insert(conditions)
    .select()

  if (error) throw error
  return (data ?? []) as ConditionData[]
}

export async function deleteRoadSection(id: number): Promise<void> {
  const { error: condError } = await supabase
    .from('condition_data')
    .delete()
    .eq('road_section_id', id)

  if (condError) throw condError

  const { error } = await supabase
    .from('road_sections')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function deleteConditionData(id: number): Promise<void> {
  const { error } = await supabase
    .from('condition_data')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// --- Plan Snapshots ---

export async function fetchPlanSnapshots(): Promise<PlanSnapshot[]> {
  const { data, error } = await supabase
    .from('plan_snapshots')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PlanSnapshot[]
}

export async function fetchPlanSnapshot(id: number): Promise<PlanSnapshot | null> {
  const { data, error } = await supabase
    .from('plan_snapshots')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data as PlanSnapshot | null
}

export async function fetchSnapshotCountForMunicipality(municipality: string): Promise<number> {
  const { count, error } = await supabase
    .from('plan_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('municipality', municipality)

  if (error) throw error
  return count ?? 0
}

export async function insertPlanSnapshot(snapshot: Omit<PlanSnapshot, 'id' | 'created_at' | 'locked_at'>): Promise<PlanSnapshot> {
  const { data, error } = await supabase
    .from('plan_snapshots')
    .insert(snapshot)
    .select()
    .single()

  if (error) throw error
  return data as PlanSnapshot
}

export async function lockPlanSnapshot(id: number): Promise<void> {
  const { error } = await supabase
    .from('plan_snapshots')
    .update({ locked_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

// --- Audit Log ---

export async function insertAuditLog(snapshotId: number, action: string): Promise<AuditLog> {
  const { data, error } = await supabase
    .from('audit_log')
    .insert({ snapshot_id: snapshotId, action })
    .select()
    .single()

  if (error) throw error
  return data as AuditLog
}

export async function fetchAuditLogs(snapshotId: number): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as AuditLog[]
}
