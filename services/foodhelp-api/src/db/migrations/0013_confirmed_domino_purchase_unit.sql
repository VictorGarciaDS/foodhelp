INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'piezas', '1', 'rebanadas', '1', 'piezas', true, false, true
FROM foodhelp.foods WHERE name = 'Pan dominó de salvado'
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  quantity = EXCLUDED.quantity, ingredient_unit = EXCLUDED.ingredient_unit,
  purchase_quantity = EXCLUDED.purchase_quantity, purchase_unit = EXCLUDED.purchase_unit,
  is_confirmed = true, is_approximate = false, round_up = true;

DELETE FROM foodhelp.food_purchase_units
WHERE food_id = (SELECT id FROM foodhelp.foods WHERE name = 'Pan dominó de salvado')
  AND NOT is_confirmed AND unit_name = 'empaque por confirmar';