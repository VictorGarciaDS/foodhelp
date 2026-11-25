ALTER TABLE foodhelp.foods ADD COLUMN purchase_location text
GENERATED ALWAYS AS (
  CASE
    WHEN lower(translate(name, 'áéíóúüÁÉÍÓÚÜ', 'aeiouuAEIOUU')) LIKE '%habits%'
      OR lower(name) LIKE '%wp100%' THEN 'Naturista'
    WHEN food_group IN ('Frutas', 'Verduras') THEN 'Mercado'
    WHEN food_group = 'Proteinas' AND (
      lower(name) ~ '(^| )(pollo|res)( |$)'
      OR lower(name) IN ('arrachera', 'carne molida sin grasa', 'cecina', 'machaca')
    ) THEN 'Mercado'
    ELSE 'Supermercado'
  END
) STORED;