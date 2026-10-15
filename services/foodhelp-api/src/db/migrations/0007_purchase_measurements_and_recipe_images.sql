ALTER TABLE foodhelp.food_purchase_units
  ADD COLUMN purchase_quantity text NOT NULL DEFAULT '1' CHECK (
    purchase_quantity ~ '^([1-9][0-9]*([.][0-9]+)?|0?[.][0-9]*[1-9][0-9]*|[1-9][0-9]*/[1-9][0-9]*)$'
  ),
  ADD COLUMN purchase_unit text NOT NULL DEFAULT 'paquetes' CHECK (btrim(purchase_unit) <> ''),
  ADD COLUMN is_confirmed boolean NOT NULL DEFAULT true,
  ADD COLUMN is_approximate boolean NOT NULL DEFAULT false,
  ADD COLUMN round_up boolean NOT NULL DEFAULT true;

UPDATE foodhelp.food_purchase_units
SET quantity = '12', purchase_quantity = '1', purchase_unit = 'paquetes',
    is_confirmed = true, is_approximate = false, round_up = true
WHERE food_id = (SELECT id FROM foodhelp.foods WHERE name = 'Pan de caja chico')
  AND unit_name = 'paquetes';

ALTER TABLE foodhelp.recipes
  ADD COLUMN image_url text,
  ADD COLUMN image_attribution text,
  ADD COLUMN image_license text;