import type {
  ConditionData,
  RepairType,
  RoadSection,
  RoadWithCondition,
} from '../types/database'

// --- Weight configuration for priority score ---

export interface PriorityWeights {
  iri: number
  defect: number
  traffic: number
  bearing: number
}

export const DEFAULT_WEIGHTS: PriorityWeights = { iri: 0.4, defect: 0.3, traffic: 0.2, bearing: 0.1 }

// --- Normalization helpers (all return 0–1) ---

const IRI_MIN = 1.0
const IRI_MAX = 8.0

/**
 * Normalize IRI value to a 0–1 scale.
 * IRI ranges from ~1.0 (smooth) to 8.0+ (dangerous).
 * Values are clamped to [1, 8] before scaling.
 */
export function normalizeIRI(iri: number): number {
  const clamped = Math.min(Math.max(iri, IRI_MIN), IRI_MAX)
  return (clamped - IRI_MIN) / (IRI_MAX - IRI_MIN)
}

const DEFECT_SEVERITY_MAP: Record<string, number> = {
  madal: 0.25,
  keskmine: 0.5,
  kõrge: 0.75,
  kriitiline: 1.0,
}

/**
 * Map Estonian defect severity strings to a 0–1 score.
 * "madal" (low) = 0.25, "keskmine" (medium) = 0.5,
 * "kõrge" (high) = 0.75, "kriitiline" (critical) = 1.0
 */
export function normalizeDefectSeverity(severity: string): number {
  return DEFECT_SEVERITY_MAP[severity] ?? 0
}

const TRAFFIC_MIN = 300
const TRAFFIC_MAX = 9000

/**
 * Normalize daily traffic volume to a 0–1 scale.
 * Range: 300–9000 vehicles/day, clamped.
 */
export function normalizeTraffic(volume: number): number {
  const clamped = Math.min(Math.max(volume, TRAFFIC_MIN), TRAFFIC_MAX)
  return (clamped - TRAFFIC_MIN) / (TRAFFIC_MAX - TRAFFIC_MIN)
}

const BEARING_CAPACITY_MAP: Record<string, number> = {
  piisav: 0.0,
  nõrk: 0.5,
  kriitiline: 1.0,
}

/**
 * Map Estonian bearing capacity strings to a 0–1 score.
 * "piisav" (sufficient) = 0, "nõrk" (weak) = 0.5, "kriitiline" (critical) = 1.0
 */
export function normalizeBearing(capacity: string): number {
  return BEARING_CAPACITY_MAP[capacity] ?? 0
}

// --- Core calculations ---

/**
 * Calculate the priority score for a road section based on its condition data.
 * Returns a value from 0 to 100 (higher = more urgent).
 *
 * Weights: IRI 40%, defect severity 30%, traffic 20%, bearing capacity 10%.
 */
export function calculatePriorityScore(
  condition: ConditionData,
  weights: PriorityWeights = DEFAULT_WEIGHTS
): number {
  const iri = normalizeIRI(condition.iri_value)
  const defect = normalizeDefectSeverity(condition.defect_severity)
  const traffic = normalizeTraffic(condition.traffic_volume_daily)
  const bearing = normalizeBearing(condition.bearing_capacity)

  const weighted =
    iri * weights.iri +
    defect * weights.defect +
    traffic * weights.traffic +
    bearing * weights.bearing

  return Math.round(weighted * 100)
}

/**
 * Match the best repair type for a given IRI value.
 * Sorts repair types by min_iri descending and picks the first where
 * iri >= min_iri. Falls back to the cheapest repair type if none match.
 */
export function matchRepairType(
  iriValue: number,
  repairTypes: RepairType[]
): RepairType {
  const sorted = [...repairTypes].sort((a, b) => b.min_iri - a.min_iri)

  const match = sorted.find((rt) => iriValue >= rt.min_iri)
  if (match) {
    return match
  }

  // Fallback: cheapest repair type
  return [...repairTypes].sort(
    (a, b) => a.cost_per_km_eur - b.cost_per_km_eur
  )[0]
}

/**
 * Calculate the estimated repair cost for a road section.
 */
export function calculateEstimatedCost(
  lengthKm: number,
  repairType: RepairType
): number {
  return Math.round(lengthKm * repairType.cost_per_km_eur)
}

/**
 * Build a prioritized repair list by joining road sections with their
 * latest condition data, calculating priority scores, matching repair types,
 * and sorting by priority (highest first).
 */
export function buildPriorityList(
  sections: RoadSection[],
  conditions: ConditionData[],
  repairTypes: RepairType[],
  weights?: PriorityWeights
): RoadWithCondition[] {
  // Index conditions by road_section_id for fast lookup.
  // If multiple years exist for a section, keep the most recent.
  const conditionMap = new Map<number, ConditionData>()
  for (const c of conditions) {
    const existing = conditionMap.get(c.road_section_id)
    if (!existing || c.year > existing.year) {
      conditionMap.set(c.road_section_id, c)
    }
  }

  const results: RoadWithCondition[] = []

  for (const section of sections) {
    const condition = conditionMap.get(section.id)
    if (!condition) {
      continue
    }

    const priorityScore = calculatePriorityScore(condition, weights)
    const recommendedRepair = matchRepairType(condition.iri_value, repairTypes)
    const estimatedCost = calculateEstimatedCost(
      section.length_km,
      recommendedRepair
    )

    results.push({
      ...section,
      condition,
      priority_score: priorityScore,
      recommended_repair: recommendedRepair,
      estimated_cost: estimatedCost,
    })
  }

  // Sort by priority score descending (most urgent first)
  results.sort((a, b) => b.priority_score - a.priority_score)

  return results
}
