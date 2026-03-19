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
