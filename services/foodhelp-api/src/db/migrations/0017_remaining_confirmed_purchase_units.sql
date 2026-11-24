INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'gramos aproximados por ' || measures.unit, '1', measures.unit, measures.grams, 'g', true, true, false
FROM foodhelp.foods f JOIN (VALUES
  ('Alcachofa', 'tazas', '170'), ('Alga', 'tazas', '80'), ('Arúgula', 'tazas', '20'),
  ('Berenjena', 'tazas', '80'), ('Berros', 'tazas', '35'), ('Betabel', 'tazas', '135'),
  ('Coles de Bruselas', 'tazas', '90'), ('Ejote', 'tazas', '100'), ('Espárrago', 'tazas', '130'),
  ('Germinados', 'tazas', '35'), ('Huitlacoche', 'tazas', '140'), ('Jícama', 'tazas', '120'),
  ('Kale', 'tazas', '25'), ('Palmitos', 'tazas', '145'), ('Pepino', 'tazas', '100'),
  ('Rábano', 'tazas', '115'), ('Verdolaga', 'tazas', '45'), ('Jengibre', 'cucharadas', '6'),
  ('Canela', 'cucharaditas', '2'), ('Chile piquín', 'cucharaditas', '2'),
  ('Aderezo light', 'cucharadas', '15'), ('Ajonjolí', 'cucharadas', '9'),
  ('Azúcar blanca o morena', 'cucharadas', '12'), ('Cacao en polvo', 'cucharadas', '5'),
  ('Cajeta', 'cucharadas', '20'), ('Chía', 'cucharadas', '12'), ('Coco rallado sin azúcar', 'cucharadas', '5'),
  ('Crema de almendras', 'cucharadas', '16'), ('Cátsup', 'cucharadas', '15'),
  ('Granola sin azúcar', 'cucharadas', '10'), ('Hummus', 'cucharadas', '15'),
  ('Linaza molida', 'cucharadas', '7'), ('Linaza molida', 'cucharaditas', '7/3'),
  ('Mayonesa', 'cucharadas', '15'), ('Mermelada', 'cucharadas', '20'), ('Miel de abeja', 'cucharadas', '21'),
  ('Mostaza', 'cucharadas', '15'), ('Nutella', 'cucharadas', '20'), ('Queso cottage', 'cucharadas', '15'),
  ('Queso parmesano', 'cucharadas', '5'), ('Requesón', 'cucharadas', '15'),
  ('Semillas de girasol', 'cucharadas', '9'), ('Tahini', 'cucharadas', '15'),
  ('Cacao nibs', 'cucharaditas', '3'), ('Ghee', 'cucharaditas', '5'), ('Mantequilla', 'cucharaditas', '5'),
  ('Piñón', 'cucharaditas', '3'), ('Semillas de hemp', 'cucharaditas', '3'),
  ('Amaranto', 'tazas', '190'), ('Capulín', 'tazas', '150'), ('Cereal sin azúcar', 'tazas', '30'),
  ('Coctel de frutas', 'tazas', '180'), ('Croutones', 'tazas', '30'), ('Frambuesa', 'tazas', '120'),
  ('Fresa', 'tazas', '150'), ('Harina de avena', 'tazas', '90'), ('Mora azul', 'tazas', '150'),
  ('Palomitas naturales', 'tazas', '8'), ('Quinoa inflada', 'tazas', '15'), ('Sandía', 'tazas', '150'),
  ('Tamarindo pelado', 'tazas', '120'), ('Uva', 'tazas', '150'), ('Zarzamora', 'tazas', '140'),
  ('Piña', 'rebanadas', '85'), ('Camote cocido', 'tazas', '200'),
  ('Proteínas sin carbs', 'cucharadas', '10'), ('Jamón de pavo', 'rebanadas', '20'),
  ('Jamón de pierna', 'rebanadas', '20'), ('Pechuga de pavo', 'rebanadas', '20'),
  ('Sazonadores sin glutamato', 'cucharaditas', '3')
) AS measures(name, unit, grams) ON f.name = measures.name
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  purchase_quantity = EXCLUDED.purchase_quantity, is_confirmed = true, is_approximate = true, round_up = false;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'gramos secos por taza cocida', '1', 'tazas', yields.grams, 'g secos', true, true, false
FROM foodhelp.foods f JOIN (VALUES
  ('Avena cocida', '40'), ('Cous cous', '60'), ('Fideos de arroz cocidos', '55'),
  ('Habas cocidas', '60'), ('Quinoa cocida', '60')
) AS yields(name, grams) ON f.name = yields.name
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  purchase_quantity = EXCLUDED.purchase_quantity, is_confirmed = true, is_approximate = true, round_up = false;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'mililitros por ' || measures.unit, '1', measures.unit, measures.milliliters, 'ml', true, false, false
FROM foodhelp.foods f CROSS JOIN (VALUES
  ('tazas', '250'), ('cucharadas', '15'), ('cucharaditas', '5')
) AS measures(unit, milliliters)
WHERE f.name IN (
  'Vinagreta', 'Vainilla (esencia)', 'Gelatina', 'Gelatina light', 'Nieve de frutas', 'Chamoy sin azúcar',
  'Agua natural', 'Agua mineral', 'Agua de jamaica sin azúcar', 'Agua de limón sin azúcar',
  'Café sin azúcar', 'Caldo de res o pollo sin grasa', 'Consomé vegetal',
  'Infusiones sin azúcar', 'Té verde o negro sin azúcar'
)
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  purchase_quantity = EXCLUDED.purchase_quantity, is_confirmed = true, is_approximate = false, round_up = false;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'gramos por cucharada', '1', 'cucharadas', '30.5', 'g', true, false, false
FROM foodhelp.foods WHERE name = 'Proteína vegana Habits'
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  purchase_quantity = EXCLUDED.purchase_quantity, is_confirmed = true, is_approximate = false, round_up = false;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'botes de 1 kg', '2000/61', 'cucharadas', '1', 'botes de 1 kg', true, false, true
FROM foodhelp.foods WHERE name = 'Proteína vegana Habits'
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  quantity = EXCLUDED.quantity, is_confirmed = true, is_approximate = false, round_up = true;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'bolsas de 24 rebanadas', '24', 'rebanadas', '1', 'bolsas de 24 rebanadas', true, false, true
FROM foodhelp.foods WHERE name = 'Pan de caja grande'
ON CONFLICT (food_id, unit_name) DO UPDATE SET
  quantity = EXCLUDED.quantity, is_confirmed = true, is_approximate = false, round_up = true;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'piezas', '1', 'piezas', '1', 'piezas', true, false, false
FROM foodhelp.foods WHERE name IN ('Quinoa bites', 'Merengues light', 'Chicle sin azúcar')
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'sobres de 1 g por ' || measures.unit, '1', measures.unit, '1', 'sobres de 1 g', true, false, true
FROM foodhelp.foods f CROSS JOIN (VALUES ('sobres'), ('g')) AS measures(unit)
WHERE f.name IN ('Splenda', 'Stevia', 'Monk fruit')
ON CONFLICT (food_id, unit_name) DO NOTHING;

DELETE FROM foodhelp.food_purchase_units pending
WHERE NOT pending.is_confirmed AND pending.unit_name = 'empaque por confirmar'
  AND EXISTS (SELECT 1 FROM foodhelp.food_purchase_units confirmed
    WHERE confirmed.food_id = pending.food_id AND confirmed.is_confirmed);