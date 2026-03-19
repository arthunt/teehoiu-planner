import { supabase } from './supabase'
import { RoadSection, ConditionData, RepairType } from '../types/database'

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
