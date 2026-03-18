# Demo Prompts — Teehoiu Planner

## Prompt 1: Dashboard + Priority Engine (main prompt)

```
Read CLAUDE.md. Build the main page with:
1. Municipality dropdown (populated from Supabase road_sections distinct municipalities)
2. Annual budget input field (EUR, default 500000)
3. Priority table: query road_sections + condition_data for selected municipality,
   calculate priority score (IRI 40%, defect severity 30%, traffic 20%, bearing 10%),
   match each section to best repair_type based on IRI, show sorted table with columns:
   road name, section (km), IRI, condition class (color badge: green<2, yellow<4, orange<6, red>=6),
   recommended repair, cost estimate.
4. Running total bar at top: "X km remonditud | Y EUR kasutatud Z-st | N lõiku eelarves"
5. Grey out rows that exceed budget.
Estonian UI. Professional clean design with teal (#009B8D) accents.
```

## Prompt 2: Feedback form (if time allows)

```
Add a /feedback page: simple form with 1-5 star rating,
comment textarea, optional name field. Saves to Supabase feedback table.
Shows thank you after submit. Link from main page header.
Estonian UI. Mobile-friendly.
```
