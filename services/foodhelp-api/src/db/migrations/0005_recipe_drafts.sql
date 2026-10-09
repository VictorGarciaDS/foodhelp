ALTER TABLE foodhelp.recipes ADD COLUMN person_id uuid REFERENCES foodhelp.people(id);
ALTER TABLE foodhelp.recipes ADD COLUMN meal_time text;
ALTER TABLE foodhelp.recipes ADD COLUMN source_text text;
ALTER TABLE foodhelp.recipes ADD COLUMN review_notes text[] NOT NULL DEFAULT ARRAY[]::text[];

DO $$
BEGIN
  IF (SELECT count(*) FROM foodhelp.people WHERE name = 'Patricia Sánchez Hernández') <> 1 THEN
    RAISE EXCEPTION 'Se requiere una única persona Patricia para asociar los borradores.';
  END IF;
END $$;

WITH drafts(name, meal_time, source_text, review_notes) AS (VALUES
  ('Pan de centeno con crema de cacahuate y mermelada', 'Desayuno',
   '1 vaso de Ades sin azúcar, 1 rebanada de pan de centeno, 2 cucharadas de crema de cacahuate sin azúcar y 2 cucharadas de mermelada sin azúcar.',
   ARRAY['Confirmar que el vaso de Ades corresponde a 1 taza.', 'Falta la porción base del pan de centeno y confirmar las variantes sin azúcar de crema de cacahuate y mermelada.', 'La mermelada del catálogo aportaría 2 azúcares no indicados; no se asume que la variante sin azúcar sea libre.']),
  ('Huevos con pechuga de pavo, espinacas y tortillas', 'Almuerzo',
   '2 huevos + 2 rebanadas de pechuga de pavo + 1 taza de espinacas. Cocinar con 1 cucharadita de aceite de oliva. 2 tortillas de maíz y ½ plátano.',
   ARRAY['Confirmar plátano tabasco: ½ pieza corresponde a 1 fruta. Si es dominico, aporta solo ¼ de fruta.']),
  ('Tacos de queso con pico de gallo y papaya', 'Almuerzo',
   'Tacos de queso panela: 2 tortillas de maíz + 120 g de queso Oaxaca + pico de gallo con 1/3 de aguacate y 1 taza de papaya.',
   ARRAY['El nombre menciona panela y la cantidad menciona Oaxaca: confirmar el queso y si es light.', '120 g de Oaxaca light aportan 4 proteínas; se indican 3. Con esa variante serían 90 g. 120 g de panela light aportan 3.']),
  ('Huevos con frijoles, tortilla y chayote', 'Almuerzo',
   '2 huevos + ½ taza de frijoles. Cocinar con 1 cucharadita de aceite de oliva. 1 tortilla de maíz, 1 chayote cocido y 2 kiwis.',
   ARRAY['Falta 1 proteína: los huevos aportan 2 de las 3 indicadas.', 'Los frijoles de la olla cuentan como cereales y leguminosas, no como proteínas. Confirmar esa preparación.']),
  ('Envueltos de atún', 'Almuerzo',
   '2 tortillas, 80 g de atún, 40 g de queso panela y 1/3 de aguacate.',
   ARRAY['Faltan fruta y verdura.', 'Confirmar tortillas de maíz, atún fresco y panela light: con esas variantes se obtienen 2 cereales, 3 proteínas y 1 grasa.']),
  ('Proteína con verduras y cereal a elección', 'Comida',
   'Mínimo 2 tazas de verduras en ensalada, cocidas o en sopa. 200 g de pescado blanco o salmón, o 150 g de pollo o carne de res. ½ taza de arroz cocido, o 2 tortillas de maíz, o 2 paquetes de Salmas, o 1 papa cocida. Cocinar con aceite de oliva.',
   ARRAY['Confirmar corte de pollo o res: 150 g de pechuga de pollo o bistec de res aportan 5 proteínas.', '½ taza de arroz blanco, 2 tortillas o 2 paquetes de Salmas aportan 2 cereales; 1 papa mediana aporta 1 y ½ taza de arroz integral aporta 1.5.', 'Falta la cantidad de aceite: 1 cucharadita equivale a 1 grasa.']),
  ('Salmón con papas y crema de verduras', 'Comida',
   '120 g de salmón, 2 piezas de salchicha, 1 papa mediana, 1 tortilla y crema de verduras.',
   ARRAY['Confirmar salchicha de pavo y tortilla de maíz: con esas variantes se obtienen 5 proteínas y 2 cereales.', 'Faltan ingredientes y cantidades de la crema de verduras para verificar grasas y cualquier otro aporte.'])
)
INSERT INTO foodhelp.recipes (name, person_id, meal_time, source_text, review_notes, instructions, ingredients, verified_at)
SELECT d.name, p.id, d.meal_time, d.source_text, d.review_notes, '[]'::jsonb, '[]'::jsonb, NULL
FROM drafts d CROSS JOIN foodhelp.people p
WHERE p.name = 'Patricia Sánchez Hernández'
  AND NOT EXISTS (SELECT 1 FROM foodhelp.recipes r WHERE r.person_id = p.id AND r.name = d.name AND r.meal_time = d.meal_time);