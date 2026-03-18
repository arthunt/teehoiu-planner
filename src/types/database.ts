export interface RoadSection {
  id: number
  road_name: string
  section_start_km: number
  section_end_km: number
  length_km: number
  municipality: string
  road_class: string
  surface_type: string
}

export interface ConditionData {
  id: number
  road_section_id: number
  year: number
  iri_value: number
  defect_count: number
  defect_severity: string
  bearing_capacity: string
  traffic_volume_daily: number
}

export interface RepairType {
  id: number
  name: string
  description: string
  cost_per_km_eur: number
  min_iri: number
  typical_lifespan_years: number
}

export interface Feedback {
  id: number
  created_at: string
  rating: number
  comment: string
  user_name: string
}

export interface RoadWithCondition extends RoadSection {
  condition: ConditionData
  priority_score: number
  recommended_repair: RepairType
  estimated_cost: number
}
