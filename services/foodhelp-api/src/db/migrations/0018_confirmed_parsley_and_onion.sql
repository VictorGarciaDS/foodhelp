INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'gramos aproximados por ' || measures.unit, '1', measures.unit, measures.grams, 'g', true, true, false
FROM foodhelp.foods f JOIN (VALUES
  ('Perejil', 'tazas', '16'), ('Cebolla', 'piezas', '150')
) AS measures(name, unit, grams) ON f.name = measures.name
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  purchase_quantity = EXCLUDED.purchase_quantity, is_confirmed = true, is_approximate = true, round_up = false;