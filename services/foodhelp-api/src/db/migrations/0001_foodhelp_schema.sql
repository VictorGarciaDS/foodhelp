CREATE SCHEMA IF NOT EXISTS foodhelp;
CREATE TABLE foodhelp.foods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  food_group text NOT NULL CHECK (food_group IN ('Frutas', 'Verduras', 'Cereales y leguminosas', 'Proteinas', 'Grasas')),
  base_quantity numeric NOT NULL CHECK (base_quantity > 0),
  unit text NOT NULL CHECK (btrim(unit) <> ''),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE foodhelp.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  restrictions_status text CHECK (restrictions_status IN ('none_reported', 'restrictions_recorded')),
  restrictions_reviewed_at timestamptz,
  restriction_notes text,
  CHECK (restrictions_status IS DISTINCT FROM 'restrictions_recorded' OR (restriction_notes IS NOT NULL AND btrim(restriction_notes) <> '')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE foodhelp.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES foodhelp.people(id) ON DELETE CASCADE,
  month date NOT NULL,
  reviewed_at timestamptz,
  UNIQUE (person_id, month)
);
CREATE TABLE foodhelp.prescription_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES foodhelp.prescriptions(id) ON DELETE CASCADE,
  meal_time text NOT NULL CHECK (btrim(meal_time) <> ''),
  food_group text NOT NULL CHECK (food_group IN ('Frutas', 'Verduras', 'Cereales y leguminosas', 'Proteinas', 'Grasas')),
  equivalents numeric NOT NULL CHECK (equivalents >= 0),
  UNIQUE (prescription_id, meal_time, food_group)
);
CREATE TABLE foodhelp.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  instructions jsonb NOT NULL CHECK (jsonb_typeof(instructions) = 'array'),
  ingredients jsonb NOT NULL CHECK (jsonb_typeof(ingredients) = 'array'),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE foodhelp.weekly_menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  person_id uuid NOT NULL REFERENCES foodhelp.people(id),
  menu_data jsonb NOT NULL CHECK (jsonb_typeof(menu_data) = 'object'),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, person_id)
);
CREATE INDEX foods_group_name_idx ON foodhelp.foods (food_group, name);
CREATE INDEX prescriptions_person_month_idx ON foodhelp.prescriptions (person_id, month);
CREATE INDEX weekly_menus_week_idx ON foodhelp.weekly_menus (week_start);