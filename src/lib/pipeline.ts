import type { RoadWithCondition } from '../types/database'

export interface PipelineAggregate {
  repairType: string
  municipalities: string[]
  totalKm: number
  totalCost: number
  sectionCount: number
}

export interface MunicipalityAggregate {
  municipality: string
  totalKm: number
  totalCost: number
  sectionCount: number
  repairTypes: string[]
}

export function aggregateByRepairType(allRoads: RoadWithCondition[]): PipelineAggregate[] {
  const map = new Map<string, { municipalities: Set<string>; totalKm: number; totalCost: number; sectionCount: number }>()

  for (const road of allRoads) {
    const key = road.recommended_repair.name
    const existing = map.get(key) || { municipalities: new Set(), totalKm: 0, totalCost: 0, sectionCount: 0 }
    existing.municipalities.add(road.municipality)
    existing.totalKm += road.length_km
    existing.totalCost += road.estimated_cost
    existing.sectionCount++
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([repairType, data]) => ({
      repairType,
      municipalities: Array.from(data.municipalities).sort(),
      totalKm: data.totalKm,
      totalCost: data.totalCost,
      sectionCount: data.sectionCount,
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}

export function aggregateByMunicipality(allRoads: RoadWithCondition[]): MunicipalityAggregate[] {
  const map = new Map<string, { totalKm: number; totalCost: number; sectionCount: number; repairTypes: Set<string> }>()

  for (const road of allRoads) {
    const key = road.municipality
    const existing = map.get(key) || { totalKm: 0, totalCost: 0, sectionCount: 0, repairTypes: new Set() }
    existing.totalKm += road.length_km
    existing.totalCost += road.estimated_cost
    existing.sectionCount++
    existing.repairTypes.add(road.recommended_repair.name)
    map.set(key, existing)
  }

  return Array.from(map.entries())
    .map(([municipality, data]) => ({
      municipality,
      totalKm: data.totalKm,
      totalCost: data.totalCost,
      sectionCount: data.sectionCount,
      repairTypes: Array.from(data.repairTypes).sort(),
    }))
    .sort((a, b) => b.totalCost - a.totalCost)
}
