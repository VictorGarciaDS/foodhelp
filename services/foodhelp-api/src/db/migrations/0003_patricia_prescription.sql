ALTER TABLE foodhelp.foods ADD COLUMN portion_pending boolean NOT NULL DEFAULT false;
ALTER TABLE foodhelp.foods DROP CONSTRAINT foods_food_group_check;
ALTER TABLE foodhelp.foods ADD CONSTRAINT foods_food_group_check CHECK (
  food_group IN ('Frutas', 'Verduras', 'Cereales y leguminosas', 'Proteinas', 'Grasas', 'Azucar', 'Lacteos', 'Condimentos', 'Bebidas', 'Antojos')
);
ALTER TABLE foodhelp.foods DROP CONSTRAINT foods_portion_validity_check;
ALTER TABLE foodhelp.foods ADD CONSTRAINT foods_portion_validity_check CHECK (
  (portion_pending AND NOT is_free_consumption AND base_quantity IS NULL AND unit IS NULL AND verified_at IS NULL)
  OR (NOT portion_pending AND is_free_consumption AND base_quantity IS NULL AND unit IS NULL)
  OR (NOT portion_pending AND NOT is_free_consumption AND base_quantity IS NOT NULL
    AND base_quantity ~ '^([1-9][0-9]*([.][0-9]+)?|0?[.][0-9]*[1-9][0-9]*|[1-9][0-9]*/[1-9][0-9]*)$'
    AND unit IS NOT NULL AND btrim(unit) <> '')
);

ALTER TABLE foodhelp.prescriptions ADD COLUMN indicated_on date;
ALTER TABLE foodhelp.prescriptions ADD CONSTRAINT prescriptions_indicated_month_check CHECK (
  indicated_on IS NULL OR date_trunc('month', indicated_on)::date = month
);
ALTER TABLE foodhelp.prescription_items DROP CONSTRAINT prescription_items_food_group_check;
ALTER TABLE foodhelp.prescription_items ADD CONSTRAINT prescription_items_food_group_check CHECK (
  food_group IN ('Frutas', 'Verduras', 'Cereales y leguminosas', 'Proteinas', 'Grasas', 'Azucar', 'Lacteos')
);
ALTER TABLE foodhelp.prescription_items ADD COLUMN requirement_kind text NOT NULL DEFAULT 'exact'
  CHECK (requirement_kind IN ('exact', 'free_guidance'));
ALTER TABLE foodhelp.prescription_items ADD COLUMN preferred_food_id uuid REFERENCES foodhelp.foods(id);
ALTER TABLE foodhelp.prescription_items ADD COLUMN notes text;
ALTER TABLE foodhelp.prescription_items ADD CONSTRAINT prescription_items_free_guidance_check CHECK (
  requirement_kind <> 'free_guidance' OR food_group = 'Verduras'
);

UPDATE foodhelp.foods SET name = replace(name, 'S/A', 'sin azúcar') WHERE name LIKE '%S/A%';

INSERT INTO foodhelp.foods (name, food_group, base_quantity, unit, is_free_consumption, portion_pending)
SELECT 'Leche Ades sin azúcar', 'Lacteos', NULL, NULL, false, true
WHERE NOT EXISTS (SELECT 1 FROM foodhelp.foods WHERE name = 'Leche Ades sin azúcar' AND food_group = 'Lacteos');

DO $$
DECLARE
  patricia_id uuid;
  prescription_id uuid;
  ades_id uuid;
BEGIN
  IF (SELECT count(*) FROM foodhelp.people WHERE name = 'Patricia Sánchez Hernández') > 1 THEN
    RAISE EXCEPTION 'Hay varias personas con el nombre solicitado; no se puede elegir automáticamente.';
  END IF;
  SELECT id INTO patricia_id FROM foodhelp.people WHERE name = 'Patricia Sánchez Hernández';
  IF patricia_id IS NULL THEN
    INSERT INTO foodhelp.people (name) VALUES ('Patricia Sánchez Hernández') RETURNING id INTO patricia_id;
  END IF;
  SELECT id INTO ades_id FROM foodhelp.foods WHERE name = 'Leche Ades sin azúcar' AND food_group = 'Lacteos';
  INSERT INTO foodhelp.prescriptions (person_id, month, indicated_on, reviewed_at)
  VALUES (patricia_id, DATE '2026-10-01', DATE '2026-10-02', now())
  RETURNING id INTO prescription_id;

  INSERT INTO foodhelp.prescription_items
    (prescription_id, meal_time, food_group, equivalents, requirement_kind, preferred_food_id, notes)
  VALUES
    (prescription_id, 'Desayuno', 'Cereales y leguminosas', 1, 'exact', NULL, NULL),
    (prescription_id, 'Desayuno', 'Grasas', 2, 'exact', NULL, NULL),
    (prescription_id, 'Desayuno', 'Lacteos', 1, 'exact', ades_id, 'Medida de una porción de Ades pendiente de confirmar.'),
    (prescription_id, 'Almuerzo', 'Frutas', 1, 'exact', NULL, NULL),
    (prescription_id, 'Almuerzo', 'Verduras', 1, 'free_guidance', NULL, 'Consumo libre; cantidad indicada sin medida base. No se interpreta como mínimo ni límite.'),
    (prescription_id, 'Almuerzo', 'Cereales y leguminosas', 2, 'exact', NULL, NULL),
    (prescription_id, 'Almuerzo', 'Proteinas', 3, 'exact', NULL, NULL),
    (prescription_id, 'Almuerzo', 'Grasas', 1, 'exact', NULL, NULL),
    (prescription_id, 'Comida', 'Verduras', 2, 'free_guidance', NULL, 'Consumo libre; cantidad indicada sin medida base. Confirmar si representa un mínimo.'),
    (prescription_id, 'Comida', 'Cereales y leguminosas', 2, 'exact', NULL, NULL),
    (prescription_id, 'Comida', 'Proteinas', 5, 'exact', NULL, NULL),
    (prescription_id, 'Comida', 'Grasas', 1, 'exact', NULL, NULL),
    (prescription_id, 'Cena', 'Cereales y leguminosas', 1, 'exact', NULL, NULL),
    (prescription_id, 'Cena', 'Proteinas', 2, 'exact', NULL, NULL),
    (prescription_id, 'Cena', 'Grasas', 1, 'exact', NULL, NULL),
    (prescription_id, 'Cena', 'Lacteos', 1, 'exact', ades_id, 'Medida de una porción de Ades pendiente de confirmar.');
END $$;