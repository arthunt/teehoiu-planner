import type { RoadWithCondition } from '../types/database'

const ROAD_CLASS_MULTIPLIER: Record<string, number> = {
  'põhimaantee': 1.5,
  'tugimaantee': 1.3,
  'kohalik': 1.0,
  'eratee': 0.7,
}

const TRAFFIC_MULTIPLIER_THRESHOLDS = [
  { min: 5000, multiplier: 1.5 },
  { min: 2000, multiplier: 1.2 },
  { min: 0, multiplier: 1.0 },
]

export function getTrafficMultiplier(volume: number): number {
  for (const t of TRAFFIC_MULTIPLIER_THRESHOLDS) {
    if (volume >= t.min) return t.multiplier
  }
  return 1.0
}

export function getRoadClassMultiplier(roadClass: string): number {
  const normalized = roadClass.toLowerCase().trim()
  return ROAD_CLASS_MULTIPLIER[normalized] ?? 1.0
}

export function calculateLiabilityIndex(road: RoadWithCondition): number {
  const classMultiplier = getRoadClassMultiplier(road.road_class)
  const trafficMultiplier = getTrafficMultiplier(road.condition.traffic_volume_daily)
  return Math.round(road.priority_score * classMultiplier * trafficMultiplier)
}

export interface LiabilityRoad extends RoadWithCondition {
  liability_index: number
}

export function buildLiabilityList(roads: RoadWithCondition[]): LiabilityRoad[] {
  return roads
    .map(road => ({
      ...road,
      liability_index: calculateLiabilityIndex(road),
    }))
    .sort((a, b) => b.liability_index - a.liability_index)
}

export function getLiabilityLevel(index: number): { label: string; color: string } {
  if (index >= 100) return { label: 'Väga kõrge', color: 'red' }
  if (index >= 70) return { label: 'Kõrge', color: 'orange' }
  if (index >= 40) return { label: 'Keskmine', color: 'yellow' }
  return { label: 'Madal', color: 'green' }
}
