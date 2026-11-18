INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'cajas de 1 L', '4', 'tazas', '1', 'cajas de 1 L', true, false, true
FROM foodhelp.foods WHERE name LIKE 'Leche %'
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  quantity = EXCLUDED.quantity, ingredient_unit = EXCLUDED.ingredient_unit,
  purchase_quantity = EXCLUDED.purchase_quantity, purchase_unit = EXCLUDED.purchase_unit,
  is_confirmed = true, is_approximate = false, round_up = true;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'bolsas de 16 rebanadas', '16', 'rebanadas', '1', 'bolsas de 16 rebanadas', true, false, true
FROM foodhelp.foods WHERE name = 'Pan de centeno Oroweat'
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  quantity = EXCLUDED.quantity, is_confirmed = true, round_up = true;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'tazas crudas', conversion.cooked_cups, 'tazas', '1', 'tazas crudas', true, true, false
FROM foodhelp.foods f JOIN (VALUES
  ('Arroz blanco', '3'), ('Arroz integral o salvaje', '3'), ('Pasta cocida', '2'),
  ('Frijoles de la olla', '3'), ('Lentejas cocidas', '3'), ('Garbanzos cocidos', '3')
) AS conversion(name, cooked_cups) ON f.name = conversion.name
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  quantity = EXCLUDED.quantity, is_confirmed = true, is_approximate = true, round_up = false;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'mililitros por ' || measures.ingredient_unit,
  '1', measures.ingredient_unit, measures.milliliters, 'ml', true, false, false
FROM foodhelp.foods f CROSS JOIN (VALUES
  ('cucharadas', '15'), ('cucharaditas', '5'), ('tazas', '250')
) AS measures(ingredient_unit, milliliters)
WHERE f.name IN ('Salsa de soya baja en sodio', 'Salsa inglesa', 'Salsa picante', 'Salsa tamari', 'Salsa verde o roja', 'Vinagre')
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  purchase_quantity = EXCLUDED.purchase_quantity, is_confirmed = true, is_approximate = false, round_up = false;

DELETE FROM foodhelp.food_purchase_units pending
WHERE NOT pending.is_confirmed AND pending.unit_name = 'empaque por confirmar'
  AND EXISTS (SELECT 1 FROM foodhelp.food_purchase_units confirmed
    WHERE confirmed.food_id = pending.food_id AND confirmed.is_confirmed
      AND confirmed.ingredient_unit = pending.ingredient_unit);