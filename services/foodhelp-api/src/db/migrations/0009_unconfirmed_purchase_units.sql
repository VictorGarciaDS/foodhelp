INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, 'empaque por confirmar', '1',
       CASE
         WHEN f.unit IN ('pieza', 'piezas') THEN 'piezas'
         WHEN f.unit IN ('taza', 'tazas') THEN 'tazas'
         WHEN f.unit IN ('cucharada', 'cucharadas') THEN 'cucharadas'
         WHEN f.unit IN ('cucharadita', 'cucharaditas') THEN 'cucharaditas'
         WHEN f.unit IN ('rebanada', 'rebanadas') THEN 'rebanadas'
         WHEN f.unit IN ('paquete', 'paquetes') THEN 'paquetes'
         WHEN f.unit IN ('barra', 'barras') THEN 'barras'
         WHEN f.unit IN ('bolsa', 'bolsas') THEN 'bolsas'
         WHEN f.unit IN ('g', 'gramo', 'gramos') THEN 'g'
         WHEN f.unit IN ('ml', 'mililitro', 'mililitros') THEN 'ml'
         ELSE COALESCE(f.unit, 'porciones')
       END,
       '1', 'empaque por confirmar', false, false, true
FROM foodhelp.foods f
WHERE NOT EXISTS (
  SELECT 1 FROM foodhelp.food_purchase_units pu
  WHERE pu.food_id = f.id AND pu.is_confirmed
)
AND NOT EXISTS (
  SELECT 1 FROM foodhelp.food_purchase_units pu
  WHERE pu.food_id = f.id AND pu.unit_name = 'empaque por confirmar'
);