INSERT INTO foodhelp.foods (name, food_group, base_quantity, unit, is_free_consumption, portion_pending, verified_at)
VALUES
  ('Leche deslactosada light', 'Lacteos', '1', 'taza', false, false, now()),
  ('Pan Cero Cero', 'Cereales y leguminosas', '1.5', 'rebanadas', false, false, now()),
  ('Proteína Evolution WP100', 'Proteinas', '1', 'cucharadas', false, false, now())
ON CONFLICT DO NOTHING;

INSERT INTO foodhelp.food_purchase_units
  (food_id, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, is_confirmed, is_approximate, round_up)
SELECT f.id, conversion.unit_name, conversion.quantity, conversion.ingredient_unit, conversion.purchase_quantity,
  conversion.purchase_unit, true, false, conversion.round_up
FROM foodhelp.foods f JOIN (VALUES
  ('Leche deslactosada light', 'cajas de 1 L', '4', 'tazas', '1', 'cajas de 1 L', true),
  ('Pan Cero Cero', 'rebanadas', '1', 'rebanadas', '1', 'rebanadas', false),
  ('Proteína Evolution WP100', 'gramos por cucharada', '1', 'cucharadas', '33.3', 'g', false)
) AS conversion(name, unit_name, quantity, ingredient_unit, purchase_quantity, purchase_unit, round_up) ON f.name = conversion.name
ON CONFLICT (food_id, unit_name) DO NOTHING;