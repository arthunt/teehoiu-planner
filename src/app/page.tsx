"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type {
  RoadSection,
  ConditionData,
  RepairType,
  RoadWithCondition,
} from "@/types/database";

function formatEur(value: number): string {
  return new Intl.NumberFormat("et-EE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getIriColor(iri: number): { bg: string; text: string; label: string } {
  if (iri < 2) return { bg: "bg-green-100", text: "text-green-800", label: "Hea" };
  if (iri < 4) return { bg: "bg-yellow-100", text: "text-yellow-800", label: "Rahuldav" };
  if (iri < 6) return { bg: "bg-orange-100", text: "text-orange-800", label: "Halb" };
  return { bg: "bg-red-100", text: "text-red-800", label: "Kriitiline" };
}

function calculatePriorityScore(condition: ConditionData): number {
  // IRI normalized (0-1 where 8.5 is max): weight 40%
  const iriNorm = Math.min(condition.iri_value / 8.5, 1.0);

  // Defect severity: weight 30%
  const severityMap: Record<string, number> = {
    kriitiline: 1.0,
    "kõrge": 0.75,
    keskmine: 0.5,
    madal: 0.25,
  };
  const defectScore = severityMap[condition.defect_severity?.toLowerCase()] ?? 0.25;

  // Traffic volume normalized (0-1 where 10000 is max): weight 20%
  const trafficNorm = Math.min(condition.traffic_volume_daily / 10000, 1.0);

  // Bearing capacity: weight 10%
  const bearingMap: Record<string, number> = {
    kriitiline: 1.0,
    "nõrk": 0.66,
    piisav: 0.0,
  };
  const bearingScore = bearingMap[condition.bearing_capacity?.toLowerCase()] ?? 0.0;

  return iriNorm * 0.4 + defectScore * 0.3 + trafficNorm * 0.2 + bearingScore * 0.1;
}

function matchRepairType(
  iri: number,
  repairTypes: RepairType[]
): RepairType | null {
  // Sort descending by cost_per_km_eur to find the most expensive matching repair
  const sorted = [...repairTypes]
    .filter((rt) => iri >= rt.min_iri)
    .sort((a, b) => b.cost_per_km_eur - a.cost_per_km_eur);
  return sorted[0] ?? null;
}

export default function Home() {
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [budget, setBudget] = useState<number>(500000);
  const [budgetInput, setBudgetInput] = useState<string>("500000");
  const [roadSections, setRoadSections] = useState<RoadSection[]>([]);
  const [conditionData, setConditionData] = useState<ConditionData[]>([]);
  const [repairTypes, setRepairTypes] = useState<RepairType[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(true);

  // Fetch municipalities on mount
  useEffect(() => {
    async function fetchMunicipalities() {
      setLoadingMunicipalities(true);
      const { data, error } = await supabase
        .from("road_sections")
        .select("municipality");

      if (error) {
        console.error("Error fetching municipalities:", error);
        setLoadingMunicipalities(false);
        return;
      }

      const unique = [...new Set((data ?? []).map((r) => r.municipality))]
        .filter(Boolean)
        .sort();
      setMunicipalities(unique);
      setLoadingMunicipalities(false);
    }
    fetchMunicipalities();
  }, []);

  // Fetch data when municipality changes
  const fetchData = useCallback(async (municipality: string) => {
    if (!municipality) return;
    setLoading(true);

    const [sectionsRes, repairRes] = await Promise.all([
      supabase
        .from("road_sections")
        .select("*")
        .eq("municipality", municipality),
      supabase.from("repair_types").select("*"),
    ]);

    if (sectionsRes.error) {
      console.error("Error fetching sections:", sectionsRes.error);
      setLoading(false);
      return;
    }

    const sections: RoadSection[] = sectionsRes.data ?? [];
    const repairs: RepairType[] = repairRes.data ?? [];
    setRoadSections(sections);
    setRepairTypes(repairs);

    // Fetch condition data for these sections
    if (sections.length > 0) {
      const sectionIds = sections.map((s) => s.id);
      const { data: condData, error: condError } = await supabase
        .from("condition_data")
        .select("*")
        .in("road_section_id", sectionIds);

      if (condError) {
        console.error("Error fetching condition data:", condError);
      }
      setConditionData(condData ?? []);
    } else {
      setConditionData([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedMunicipality) {
      fetchData(selectedMunicipality);
    }
  }, [selectedMunicipality, fetchData]);

  // Calculate prioritized list
  const prioritizedRoads: RoadWithCondition[] = useMemo(() => {
    if (!roadSections.length || !conditionData.length || !repairTypes.length) {
      return [];
    }

    const conditionMap = new Map<number, ConditionData>();
    for (const cd of conditionData) {
      const existing = conditionMap.get(cd.road_section_id);
      // Keep the most recent year's data
      if (!existing || cd.year > existing.year) {
        conditionMap.set(cd.road_section_id, cd);
      }
    }

    const results: RoadWithCondition[] = [];

    for (const section of roadSections) {
      const condition = conditionMap.get(section.id);
      if (!condition) continue;

      const score = calculatePriorityScore(condition);
      const repair = matchRepairType(condition.iri_value, repairTypes);
      if (!repair) continue;

      const cost = repair.cost_per_km_eur * section.length_km;

      results.push({
        ...section,
        condition,
        priority_score: score,
        recommended_repair: repair,
        estimated_cost: cost,
      });
    }

    results.sort((a, b) => b.priority_score - a.priority_score);
    return results;
  }, [roadSections, conditionData, repairTypes]);

  // Budget calculations
  const { totalCostInBudget, kmRepaired, sectionsInBudget } = useMemo(() => {
    let cumulative = 0;
    let km = 0;
    let sections = 0;
    for (const road of prioritizedRoads) {
      if (cumulative + road.estimated_cost <= budget) {
        cumulative += road.estimated_cost;
        km += road.length_km;
        sections++;
      } else {
        break;
      }
    }
    return { totalCostInBudget: cumulative, kmRepaired: km, sectionsInBudget: sections };
  }, [prioritizedRoads, budget]);

  function handleBudgetChange(value: string) {
    setBudgetInput(value);
    const num = parseInt(value.replace(/\D/g, ""), 10);
    if (!isNaN(num) && num >= 0) {
      setBudget(num);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Controls */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label
                htmlFor="municipality"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Omavalitsus
              </label>
              <select
                id="municipality"
                value={selectedMunicipality}
                onChange={(e) => setSelectedMunicipality(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#009B8D] focus:border-transparent"
                disabled={loadingMunicipalities}
              >
                <option value="">
                  {loadingMunicipalities
                    ? "Laen omavalitsusi..."
                    : "Vali omavalitsus"}
                </option>
                {municipalities.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:w-56">
              <label
                htmlFor="budget"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Aastaeelarve (EUR)
              </label>
              <input
                id="budget"
                type="text"
                inputMode="numeric"
                value={budgetInput}
                onChange={(e) => handleBudgetChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B8D] focus:border-transparent"
                placeholder="500000"
              />
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex items-center gap-3 text-gray-500">
              <svg
                className="animate-spin h-5 w-5 text-[#009B8D]"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm">Laen andmeid...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !selectedMunicipality && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg
              className="w-16 h-16 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <p className="text-lg font-medium text-gray-500">
              Vali omavalitsus alustamiseks
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Kuvatakse teeloikude prioriteetsus ja remondisoovitused
            </p>
          </div>
        )}

        {/* Results */}
        {!loading && selectedMunicipality && prioritizedRoads.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="text-center sm:text-left">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remonditud
                  </p>
                  <p className="text-2xl font-bold text-[#009B8D]">
                    {kmRepaired.toFixed(1)} km
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Eelarve kasutus
                  </p>
                  <p className="text-2xl font-bold text-[#009B8D]">
                    {formatEur(totalCostInBudget)}
                    <span className="text-sm font-normal text-gray-400">
                      {" "}
                      / {formatEur(budget)}
                    </span>
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#009B8D] rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          (totalCostInBudget / budget) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="text-center sm:text-right">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loike eelarves
                  </p>
                  <p className="text-2xl font-bold text-[#009B8D]">
                    {sectionsInBudget}
                    <span className="text-sm font-normal text-gray-400">
                      {" "}
                      / {prioritizedRoads.length}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        #
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Tee nimi
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Loik (km)
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        IRI
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Seisukord
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Prioriteet
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Soovituslik remont
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Maksumus
                      </th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">
                        Kumulatiivne
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let cumCost = 0;
                      return prioritizedRoads.map((road, idx) => {
                        cumCost += road.estimated_cost;
                        const inBudget = cumCost <= budget;
                        const iriColor = getIriColor(road.condition.iri_value);
                        const priorityPct = (road.priority_score * 100).toFixed(0);

                        return (
                          <tr
                            key={road.id}
                            className={`border-b border-gray-100 transition-colors ${
                              inBudget
                                ? idx % 2 === 0
                                  ? "bg-white"
                                  : "bg-gray-50/50"
                                : "opacity-50 bg-gray-100"
                            } ${inBudget ? "hover:bg-teal-50/30" : ""}`}
                          >
                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                              {road.road_name}
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                              {road.section_start_km.toFixed(1)}–
                              {road.section_end_km.toFixed(1)}
                              <span className="text-gray-400 ml-1">
                                ({road.length_km.toFixed(1)} km)
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-800">
                              {road.condition.iri_value.toFixed(1)}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${iriColor.bg} ${iriColor.text}`}
                              >
                                {iriColor.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-16">
                                  <div
                                    className="h-full bg-[#009B8D] rounded-full"
                                    style={{
                                      width: `${priorityPct}%`,
                                    }}
                                  />
                                </div>
                                <span className="text-xs text-gray-500 font-mono w-8">
                                  {priorityPct}%
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                              {road.recommended_repair.name}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-800 whitespace-nowrap">
                              {formatEur(road.estimated_cost)}
                            </td>
                            <td
                              className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                                inBudget ? "text-[#009B8D]" : "text-red-500"
                              }`}
                            >
                              {formatEur(cumCost)}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500 px-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-green-100 border border-green-200" />
                Hea (IRI &lt; 2)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-yellow-100 border border-yellow-200" />
                Rahuldav (IRI 2–4)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-orange-100 border border-orange-200" />
                Halb (IRI 4–6)
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-red-100 border border-red-200" />
                Kriitiline (IRI &gt; 6)
              </span>
              <span className="ml-auto text-gray-400">
                Hallid read yleta&shy;vad eelarvet
              </span>
            </div>
          </>
        )}

        {/* No data state */}
        {!loading &&
          selectedMunicipality &&
          prioritizedRoads.length === 0 &&
          roadSections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <p className="text-lg font-medium text-gray-500">
                Andmed puuduvad
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Selle omavalitsuse kohta ei leitud teeloikude andmeid
              </p>
            </div>
          )}
      </div>
    </div>
  );
}
