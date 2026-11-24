WITH originals AS MATERIALIZED (
  SELECT r.*, gen_random_uuid() AS base_id
  FROM foodhelp.recipes r JOIN foodhelp.people person ON person.id = r.person_id
  WHERE person.name = 'Patricia Sánchez Hernández' AND r.inherited_from_recipe_id IS NULL
), bases AS (
  INSERT INTO foodhelp.recipes
    (id, person_id, name, meal_time, source_text, review_notes, instructions, ingredients,
     verified_at, image_url, image_attribution, image_license)
  SELECT base_id, NULL, name, meal_time, source_text, review_notes, instructions, ingredients,
    verified_at, image_url, image_attribution, image_license FROM originals
  RETURNING id
)
UPDATE foodhelp.recipes personal SET inherited_from_recipe_id = originals.base_id
FROM originals JOIN bases ON bases.id = originals.base_id
WHERE personal.id = originals.id;