# Teehoiu Planner

Digital road maintenance planning prototype for Estonian municipalities.

## Problem
Municipalities currently make road repair decisions based on politics, not data.
They need a system that takes road condition measurements (IRI, defects, bearing
capacity, traffic) and generates a prioritized repair list within their budget.

## Tech Stack
- Next.js 15 (App Router), TypeScript, Tailwind CSS
- Supabase (PostgreSQL) for data
- Deploy: Vercel

## Database
Tables: road_sections, condition_data, repair_types, feedback
See types/database.ts for schema.

## Design
- Estonian UI text
- Clean, professional — teal (#009B8D) accent color
- Mobile-responsive (participants will open on phones)
- Simple and clear — this is a prototype, not production

## Core Feature
User selects municipality → enters annual budget in EUR → system calculates
priority score per road section → shows sorted repair list with recommended
repair type and cost → running total shows budget usage → rows beyond budget
are greyed out.

Priority score formula:
- IRI weight: 40%
- Defect severity: 30%
- Traffic volume: 20%
- Bearing capacity: 10%
