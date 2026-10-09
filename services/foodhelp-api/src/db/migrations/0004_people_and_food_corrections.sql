ALTER TABLE foodhelp.people DROP COLUMN restrictions_status;
ALTER TABLE foodhelp.people DROP COLUMN restrictions_reviewed_at;
ALTER TABLE foodhelp.people DROP COLUMN restriction_notes;

UPDATE foodhelp.foods
SET base_quantity = '1', unit = 'taza', portion_pending = false, verified_at = now()
WHERE name = 'Leche Ades sin azúcar' AND food_group = 'Lacteos';

UPDATE foodhelp.prescription_items
SET notes = NULL
WHERE preferred_food_id IN (
  SELECT id FROM foodhelp.foods WHERE name = 'Leche Ades sin azúcar' AND food_group = 'Lacteos'
) AND notes = 'Medida de una porción de Ades pendiente de confirmar.';

UPDATE foodhelp.foods
SET name = replace(replace(name, 'S/G', 'sin grasa'), 'S/ glutamato', 'sin glutamato')
WHERE name LIKE '%S/G%' OR name LIKE '%S/ glutamato%';