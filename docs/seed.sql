-- ============================================
-- Teehoiu Planner — Database Schema & Seed Data
-- Run this in Supabase SQL Editor
-- ============================================

-- Teelõigud (road sections)
CREATE TABLE road_sections (
  id SERIAL PRIMARY KEY,
  road_name TEXT NOT NULL,
  section_start_km DECIMAL,
  section_end_km DECIMAL,
  length_km DECIMAL,
  municipality TEXT NOT NULL,
  road_class TEXT,
  surface_type TEXT
);

-- Seisukorra andmed (condition data)
CREATE TABLE condition_data (
  id SERIAL PRIMARY KEY,
  road_section_id INT REFERENCES road_sections(id),
  year INT DEFAULT 2025,
  iri_value DECIMAL,
  defect_count INT,
  defect_severity TEXT,
  bearing_capacity TEXT,
  traffic_volume_daily INT
);

-- Remonditüübid (repair types)
CREATE TABLE repair_types (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cost_per_km_eur INT,
  min_iri DECIMAL,
  typical_lifespan_years INT
);

-- Tagasiside (feedback)
CREATE TABLE feedback (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  user_name TEXT
);

-- Enable RLS but allow public read for demo
ALTER TABLE road_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE condition_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read road_sections" ON road_sections FOR SELECT USING (true);
CREATE POLICY "Public read condition_data" ON condition_data FOR SELECT USING (true);
CREATE POLICY "Public read repair_types" ON repair_types FOR SELECT USING (true);
CREATE POLICY "Public read feedback" ON feedback FOR SELECT USING (true);
CREATE POLICY "Public insert feedback" ON feedback FOR INSERT WITH CHECK (true);

-- ============================================
-- REPAIR TYPES
-- ============================================

INSERT INTO repair_types (name, description, cost_per_km_eur, min_iri, typical_lifespan_years) VALUES
  ('Kruusatee korrashoid', 'Kruusateede profileerimine ja kruusa lisamine', 3000, 0, 2),
  ('Profileerimine', 'Teepinna profileerimine ja tasandamine', 5000, 2.0, 3),
  ('Pindamine', 'Pindamistöö — uus kattekiht olemasoleva peale', 8000, 3.0, 5),
  ('Ülekatmine', 'Asfaltbetoonkatte ülekatmine', 25000, 4.5, 8),
  ('Osaline rekonstrueerimine', 'Aluse ja katte osaline rekonstrueerimine', 80000, 6.0, 15),
  ('Täielik rekonstrueerimine', 'Tee täielik rekonstrueerimine koos alusega', 180000, 7.0, 25);

-- ============================================
-- ROAD SECTIONS — Tartu vald
-- ============================================

INSERT INTO road_sections (road_name, section_start_km, section_end_km, length_km, municipality, road_class, surface_type) VALUES
  ('Ülenurme–Kambja tee', 0.0, 4.2, 4.2, 'Tartu vald', 'kõrvalmaantee', 'asfalt'),
  ('Tõrvandi ringtee', 0.0, 1.8, 1.8, 'Tartu vald', 'kohalik tee', 'asfalt'),
  ('Räni–Lemmatsi tee', 0.0, 3.5, 3.5, 'Tartu vald', 'kohalik tee', 'asfalt'),
  ('Haage–Vahi tee', 0.0, 5.1, 5.1, 'Tartu vald', 'kõrvalmaantee', 'asfalt'),
  ('Kambja–Pangodi tee', 0.0, 6.3, 6.3, 'Tartu vald', 'kõrvalmaantee', 'kruus'),
  ('Reola–Kärevere tee', 0.0, 4.7, 4.7, 'Tartu vald', 'kohalik tee', 'asfalt'),
  ('Vahi külatee', 0.0, 2.1, 2.1, 'Tartu vald', 'kohalik tee', 'kruus'),
  ('Tõrvandi–Ülenurme kergliiklustee', 0.0, 2.4, 2.4, 'Tartu vald', 'kohalik tee', 'asfalt'),
  ('Ilmatsalu–Tähtvere tee', 0.0, 3.8, 3.8, 'Tartu vald', 'kõrvalmaantee', 'asfalt'),
  ('Lähte–Jõgeva maantee lõik', 12.0, 18.5, 6.5, 'Tartu vald', 'põhimaantee', 'asfalt'),
  ('Märja tööstusala tee', 0.0, 1.2, 1.2, 'Tartu vald', 'kohalik tee', 'asfalt'),
  ('Soinaste külatee', 0.0, 2.8, 2.8, 'Tartu vald', 'kohalik tee', 'kruus');

-- ============================================
-- ROAD SECTIONS — Elva vald
-- ============================================

INSERT INTO road_sections (road_name, section_start_km, section_end_km, length_km, municipality, road_class, surface_type) VALUES
  ('Elva–Puhja tee', 0.0, 8.4, 8.4, 'Elva vald', 'kõrvalmaantee', 'asfalt'),
  ('Rõngu–Hellenurme tee', 0.0, 5.6, 5.6, 'Elva vald', 'kõrvalmaantee', 'asfalt'),
  ('Käärdi–Uderna tee', 0.0, 3.2, 3.2, 'Elva vald', 'kohalik tee', 'kruus'),
  ('Palupera mõisatee', 0.0, 2.1, 2.1, 'Elva vald', 'kohalik tee', 'kruus'),
  ('Elva–Tartu maantee lõik', 0.0, 7.8, 7.8, 'Elva vald', 'põhimaantee', 'asfalt'),
  ('Rannu–Sangla tee', 0.0, 4.5, 4.5, 'Elva vald', 'kõrvalmaantee', 'asfalt'),
  ('Pühaste külatee', 0.0, 1.9, 1.9, 'Elva vald', 'kohalik tee', 'kruus'),
  ('Konguta–Mäeküla tee', 0.0, 3.7, 3.7, 'Elva vald', 'kohalik tee', 'kruus'),
  ('Elva kesklinna tänav', 0.0, 1.4, 1.4, 'Elva vald', 'kohalik tee', 'asfalt'),
  ('Käo–Aakre tee', 0.0, 6.2, 6.2, 'Elva vald', 'kõrvalmaantee', 'asfalt'),
  ('Rõngu aleviku tee', 0.0, 1.6, 1.6, 'Elva vald', 'kohalik tee', 'asfalt');

-- ============================================
-- ROAD SECTIONS — Nõo vald
-- ============================================

INSERT INTO road_sections (road_name, section_start_km, section_end_km, length_km, municipality, road_class, surface_type) VALUES
  ('Nõo–Elva tee', 0.0, 9.2, 9.2, 'Nõo vald', 'kõrvalmaantee', 'asfalt'),
  ('Nõo–Luke tee', 0.0, 4.8, 4.8, 'Nõo vald', 'kohalik tee', 'asfalt'),
  ('Tõravere observatooriumi tee', 0.0, 1.5, 1.5, 'Nõo vald', 'kohalik tee', 'asfalt'),
  ('Meeri–Vissi tee', 0.0, 5.3, 5.3, 'Nõo vald', 'kohalik tee', 'kruus'),
  ('Nõo–Tartu kergliiklustee', 0.0, 3.6, 3.6, 'Nõo vald', 'kohalik tee', 'asfalt'),
  ('Keeri külatee', 0.0, 2.7, 2.7, 'Nõo vald', 'kohalik tee', 'kruus'),
  ('Voika–Illi tee', 0.0, 3.4, 3.4, 'Nõo vald', 'kohalik tee', 'kruus'),
  ('Nõo aleviku põhitänav', 0.0, 1.1, 1.1, 'Nõo vald', 'kohalik tee', 'asfalt'),
  ('Tartu–Valga maantee lõik', 22.0, 28.5, 6.5, 'Nõo vald', 'põhimaantee', 'asfalt'),
  ('Luke mõisa tee', 0.0, 1.8, 1.8, 'Nõo vald', 'kohalik tee', 'kruus');

-- ============================================
-- CONDITION DATA — Tartu vald
-- ============================================

INSERT INTO condition_data (road_section_id, year, iri_value, defect_count, defect_severity, bearing_capacity, traffic_volume_daily) VALUES
  (1, 2025, 3.8, 12, 'keskmine', 'piisav', 4200),
  (2, 2025, 2.1, 4, 'madal', 'piisav', 6800),
  (3, 2025, 5.4, 28, 'kõrge', 'nõrk', 3100),
  (4, 2025, 4.2, 15, 'keskmine', 'piisav', 2800),
  (5, 2025, 6.8, 34, 'kriitiline', 'kriitiline', 1200),
  (6, 2025, 1.8, 3, 'madal', 'piisav', 2400),
  (7, 2025, 7.2, 18, 'kõrge', 'nõrk', 450),
  (8, 2025, 1.4, 1, 'madal', 'piisav', 5200),
  (9, 2025, 4.9, 22, 'kõrge', 'nõrk', 3500),
  (10, 2025, 2.5, 6, 'madal', 'piisav', 8500),
  (11, 2025, 6.1, 19, 'kõrge', 'kriitiline', 1800),
  (12, 2025, 5.8, 14, 'keskmine', 'nõrk', 380);

-- ============================================
-- CONDITION DATA — Elva vald
-- ============================================

INSERT INTO condition_data (road_section_id, year, iri_value, defect_count, defect_severity, bearing_capacity, traffic_volume_daily) VALUES
  (13, 2025, 4.5, 20, 'kõrge', 'nõrk', 3800),
  (14, 2025, 3.2, 9, 'keskmine', 'piisav', 2100),
  (15, 2025, 5.9, 16, 'kõrge', 'nõrk', 620),
  (16, 2025, 3.5, 7, 'madal', 'piisav', 280),
  (17, 2025, 2.8, 5, 'madal', 'piisav', 7200),
  (18, 2025, 7.5, 38, 'kriitiline', 'kriitiline', 1900),
  (19, 2025, 4.1, 11, 'keskmine', 'nõrk', 340),
  (20, 2025, 8.2, 42, 'kriitiline', 'kriitiline', 510),
  (21, 2025, 1.6, 2, 'madal', 'piisav', 5400),
  (22, 2025, 5.1, 25, 'kõrge', 'nõrk', 2600),
  (23, 2025, 3.9, 13, 'keskmine', 'piisav', 3200);

-- ============================================
-- CONDITION DATA — Nõo vald
-- ============================================

INSERT INTO condition_data (road_section_id, year, iri_value, defect_count, defect_severity, bearing_capacity, traffic_volume_daily) VALUES
  (24, 2025, 4.7, 21, 'kõrge', 'nõrk', 3400),
  (25, 2025, 6.3, 30, 'kriitiline', 'kriitiline', 1600),
  (26, 2025, 1.9, 3, 'madal', 'piisav', 2200),
  (27, 2025, 7.8, 36, 'kriitiline', 'kriitiline', 420),
  (28, 2025, 2.3, 5, 'madal', 'piisav', 4800),
  (29, 2025, 5.5, 17, 'kõrge', 'nõrk', 350),
  (30, 2025, 6.9, 28, 'kriitiline', 'nõrk', 280),
  (31, 2025, 1.2, 1, 'madal', 'piisav', 4100),
  (32, 2025, 3.1, 8, 'keskmine', 'piisav', 9200),
  (33, 2025, 4.4, 12, 'keskmine', 'nõrk', 310);
