import type { RoadWithCondition, PlanSnapshot } from '../types/database'
import type { PriorityWeights } from './priority'
import { normalizeIRI, normalizeDefectSeverity, normalizeTraffic, normalizeBearing } from './priority'

export function generateReferenceCode(municipality: string, existingCount: number): string {
  const prefix = municipality.toUpperCase().replace(/\s+/g, '-').slice(0, 10)
  const year = new Date().getFullYear()
  const seq = String(existingCount + 1).padStart(3, '0')
  return `${prefix}-${year}-${seq}`
}

export function buildScoreExplanation(
  road: RoadWithCondition,
  weights: PriorityWeights
): string {
  const iriNorm = normalizeIRI(road.condition.iri_value)
  const defNorm = normalizeDefectSeverity(road.condition.defect_severity)
  const trafNorm = normalizeTraffic(road.condition.traffic_volume_daily)
  const bearNorm = normalizeBearing(road.condition.bearing_capacity)

  const iriPart = Math.round(iriNorm * 100)
  const defPart = Math.round(defNorm * 100)
  const trafPart = Math.round(trafNorm * 100)
  const bearPart = Math.round(bearNorm * 100)

  return `IRI ${road.condition.iri_value.toFixed(1)} (${Math.round(weights.iri * 100)}% × ${iriPart}) + defekt ${road.condition.defect_severity} (${Math.round(weights.defect * 100)}% × ${defPart}) + liiklus ${road.condition.traffic_volume_daily} (${Math.round(weights.traffic * 100)}% × ${trafPart}) + kandevus ${road.condition.bearing_capacity} (${Math.round(weights.bearing * 100)}% × ${bearPart}) = skoor ${road.priority_score}`
}

export function createSnapshotData(
  municipality: string,
  budget: number,
  weights: PriorityWeights,
  rankedList: RoadWithCondition[],
  referenceCode: string
): Omit<PlanSnapshot, 'id' | 'created_at' | 'locked_at'> {
  let runningTotal = 0
  let coveredCount = 0
  for (const road of rankedList) {
    if (runningTotal + road.estimated_cost <= budget) {
      runningTotal += road.estimated_cost
      coveredCount++
    }
  }

  return {
    reference_code: referenceCode,
    municipality,
    budget,
    weights_json: weights as unknown as Record<string, number>,
    ranked_list_json: rankedList,
    total_cost: runningTotal,
    covered_count: coveredCount,
    notes: null,
  }
}
