INSERT INTO foodhelp.foods (name, food_group, base_quantity, unit, is_free_consumption, portion_pending, verified_at)
SELECT 'Queso cotija', 'Proteinas', '35', 'g', false, false, now()
WHERE NOT EXISTS (SELECT 1 FROM foodhelp.foods WHERE name = 'Queso cotija');

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'kilogramos', '1000', 'g', '1', 'kg', true, false, false
FROM foodhelp.foods WHERE name = 'Queso cotija'
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.prescription_items
  (prescription_id, meal_time, food_group, equivalents, requirement_kind, preferred_food_id, notes)
SELECT pr.id, 'Colacion', groups.food_group, 0, 'exact', NULL, NULL
FROM foodhelp.prescriptions pr CROSS JOIN (VALUES
  ('Frutas'), ('Verduras'), ('Cereales y leguminosas'), ('Proteinas'), ('Grasas'), ('Azucar'), ('Lacteos')
) AS groups(food_group)
ON CONFLICT (prescription_id, meal_time, food_group) DO NOTHING;