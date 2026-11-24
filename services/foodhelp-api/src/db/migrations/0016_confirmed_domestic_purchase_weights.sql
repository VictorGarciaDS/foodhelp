INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'gramos aproximados por ' || measures.unit, '1', measures.unit, measures.grams, 'g', true, true, false
FROM foodhelp.foods f JOIN (VALUES
  ('Acelga', 'tazas', '36'),
  ('Brócoli', 'tazas', '90'),
  ('Calabaza de castilla', 'tazas', '120'),
  ('Cebolla', 'tazas', '160'),
  ('Cebolla', 'cucharadas', '10'),
  ('Champiñón', 'tazas', '70'),
  ('Col', 'tazas', '90'),
  ('Coliflor', 'tazas', '100'),
  ('Espinaca', 'tazas', '30'),
  ('Flor de calabaza', 'tazas', '30'),
  ('Jitomate', 'tazas', '180'),
  ('Tomate', 'tazas', '180'),
  ('Lechuga', 'tazas', '45'),
  ('Nopal', 'tazas', '85'),
  ('Pimiento', 'tazas', '150'),
  ('Tomatillo', 'tazas', '130'),
  ('Zanahoria', 'tazas', '130'),
  ('Chayote', 'piezas', '200'),
  ('Chile poblano', 'piezas', '80'),
  ('Chile (todo tipo)', 'piezas', '10'),
  ('Chiles secos', 'piezas', '5'),
  ('Ajo', 'dientes', '3'),
  ('Limón', 'piezas', '70'),
  ('Cilantro', 'cucharadas', '1'),
  ('Perejil', 'cucharadas', '1'),
  ('Pimienta', 'cucharaditas', '2'),
  ('Especias', 'cucharaditas', '2'),
  ('Huauzontles', 'tazas', '100'),
  ('Otras verduras', 'tazas', '100'),
  ('Verduras de acompañamiento', 'tazas', '100'),
  ('Verduras para crema', 'tazas', '100'),
  ('Avena cruda', 'tazas', '80'),
  ('Crema de cacahuate', 'cucharadas', '16'),
  ('Semillas de calabaza', 'cucharadas', '10'),
  ('Guacamole', 'cucharadas', '15'),
  ('Puré de tomate', 'tazas', '250'),
  ('Yogurt griego', 'tazas', '250'),
  ('Chícharos', 'tazas', '160'),
  ('Elote desgranado', 'tazas', '160'),
  ('Melón', 'tazas', '150'),
  ('Papaya', 'tazas', '150'),
  ('Arándanos y pasas', 'puñito', '30')
) AS measures(name, unit, grams) ON f.name = measures.name
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  quantity = EXCLUDED.quantity, ingredient_unit = EXCLUDED.ingredient_unit,
  purchase_quantity = EXCLUDED.purchase_quantity, purchase_unit = EXCLUDED.purchase_unit,
  is_confirmed = true, is_approximate = true, round_up = false;

DELETE FROM foodhelp.food_purchase_units pending
WHERE NOT pending.is_confirmed AND pending.unit_name = 'empaque por confirmar'
  AND EXISTS (SELECT 1 FROM foodhelp.food_purchase_units confirmed
    WHERE confirmed.food_id = pending.food_id AND confirmed.is_confirmed);