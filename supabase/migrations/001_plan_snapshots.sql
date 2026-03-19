CREATE TABLE plan_snapshots (
  id serial PRIMARY KEY,
  reference_code text UNIQUE NOT NULL,
  municipality text NOT NULL,
  budget integer NOT NULL,
  weights_json jsonb NOT NULL,
  ranked_list_json jsonb NOT NULL,
  total_cost integer NOT NULL,
  covered_count integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  locked_at timestamptz,
  notes text
);

CREATE TABLE audit_log (
  id serial PRIMARY KEY,
  snapshot_id integer REFERENCES plan_snapshots(id),
  action text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE plan_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow public access (prototype — no auth)
CREATE POLICY "Allow all on plan_snapshots" ON plan_snapshots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_log" ON audit_log FOR ALL USING (true) WITH CHECK (true);
