INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'kilogramos', '1000', 'g', '1', 'kg', true, false, false
FROM foodhelp.foods
WHERE unit = 'g'
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'litros', '1000', 'ml', '1', 'L', true, false, false
FROM foodhelp.foods
WHERE unit = 'ml'
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'piezas', '1', 'piezas', '1', 'piezas', true, false, false
FROM foodhelp.foods
WHERE unit = 'piezas' AND name <> 'Huevo entero'
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id,
       CASE unit WHEN 'paquete' THEN 'paquetes' WHEN 'lata' THEN 'latas' WHEN 'sobre' THEN 'sobres'
         WHEN 'barra' THEN 'barras' WHEN 'bolsa' THEN 'bolsas' WHEN 'tazón' THEN 'tazones' ELSE 'vasos' END,
       '1', unit, '1',
       CASE unit WHEN 'paquete' THEN 'paquetes' WHEN 'lata' THEN 'latas' WHEN 'sobre' THEN 'sobres'
         WHEN 'barra' THEN 'barras' WHEN 'bolsa' THEN 'bolsas' WHEN 'tazón' THEN 'tazones' ELSE 'vasos' END,
       true, false, false
FROM foodhelp.foods
WHERE unit IN ('paquete', 'lata', 'sobre', 'barra', 'bolsa', 'tazón', 'vaso')
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'docenas', '12', 'piezas', '1', 'docenas', true, false, true
FROM foodhelp.foods
WHERE name = 'Huevo entero' AND unit = 'piezas'
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'mililitros', '1', 'cucharaditas', '5', 'ml', true, false, false
FROM foodhelp.foods
WHERE name LIKE 'Aceite %' AND unit = 'cucharaditas'
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'gramos aproximados', '12', 'piezas', '60', 'g', true, true, false
FROM foodhelp.foods
WHERE name = 'Nueces' AND unit = 'piezas'
ON CONFLICT (food_id, unit_name) DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT id, 'gramos aproximados', '1', 'piezas', '175', 'g', true, true, false
FROM foodhelp.foods
WHERE name = 'Calabacita' AND is_free_consumption
ON CONFLICT (food_id, unit_name) DO NOTHING;