CREATE TABLE foodhelp.food_purchase_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id uuid NOT NULL REFERENCES foodhelp.foods(id) ON DELETE CASCADE,
  unit_name text NOT NULL CHECK (btrim(unit_name) <> ''),
  quantity text NOT NULL CHECK (
    quantity ~ '^([1-9][0-9]*([.][0-9]+)?|0?[.][0-9]*[1-9][0-9]*|[1-9][0-9]*/[1-9][0-9]*)$'
  ),
  ingredient_unit text NOT NULL CHECK (btrim(ingredient_unit) <> ''),
  UNIQUE (food_id, unit_name)
);

INSERT INTO foodhelp.food_purchase_units (food_id, unit_name, quantity, ingredient_unit)
SELECT id, 'paquetes', '11', 'rebanadas'
FROM foodhelp.foods
WHERE name = 'Pan de caja chico'
ON CONFLICT (food_id, unit_name) DO NOTHING;