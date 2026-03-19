import type { RoadWithCondition } from '../types/database'
import type { PriorityWeights } from './priority'

export interface Scenario {
  id: string
  name: string
  budget: number
  weights: PriorityWeights
  rows: RoadWithCondition[]
}

export interface ScenarioDiff {
  addedRoads: RoadWithCondition[]
  removedRoads: RoadWithCondition[]
  coveragePctA: number
  coveragePctB: number
  coveredKmA: number
  coveredKmB: number
  costA: number
  costB: number
}

function getCoveredSet(rows: RoadWithCondition[], budget: number): Set<number> {
  const covered = new Set<number>()
  let total = 0
  for (const row of rows) {
    if (total + row.estimated_cost <= budget) {
      total += row.estimated_cost
      covered.add(row.id)
    }
  }
  return covered
}

function getCoveredStats(rows: RoadWithCondition[], budget: number) {
  let cost = 0
  let km = 0
  let count = 0
  for (const row of rows) {
    if (cost + row.estimated_cost <= budget) {
      cost += row.estimated_cost
      km += row.length_km
      count++
    }
  }
  return { cost, km, count }
}

export function compareScenarios(a: Scenario, b: Scenario): ScenarioDiff {
  const coveredA = getCoveredSet(a.rows, a.budget)
  const coveredB = getCoveredSet(b.rows, b.budget)

  const statsA = getCoveredStats(a.rows, a.budget)
  const statsB = getCoveredStats(b.rows, b.budget)

  const totalKmA = a.rows.reduce((sum, r) => sum + r.length_km, 0)
  const totalKmB = b.rows.reduce((sum, r) => sum + r.length_km, 0)

  const addedRoads = b.rows.filter(r => coveredB.has(r.id) && !coveredA.has(r.id))
  const removedRoads = a.rows.filter(r => coveredA.has(r.id) && !coveredB.has(r.id))

  return {
    addedRoads,
    removedRoads,
    coveragePctA: totalKmA > 0 ? (statsA.km / totalKmA) * 100 : 0,
    coveragePctB: totalKmB > 0 ? (statsB.km / totalKmB) * 100 : 0,
    coveredKmA: statsA.km,
    coveredKmB: statsB.km,
    costA: statsA.cost,
    costB: statsB.cost,
  }
}

export function getScenarioCoveredStats(rows: RoadWithCondition[], budget: number) {
  return getCoveredStats(rows, budget)
}
