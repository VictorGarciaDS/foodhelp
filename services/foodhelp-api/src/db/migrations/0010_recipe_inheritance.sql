ALTER TABLE foodhelp.people
  ADD COLUMN base_person_id uuid REFERENCES foodhelp.people(id) ON DELETE SET NULL;

ALTER TABLE foodhelp.recipes
  ADD COLUMN inherited_from_recipe_id uuid REFERENCES foodhelp.recipes(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX recipes_person_inherited_from_idx
  ON foodhelp.recipes (person_id, inherited_from_recipe_id)
  WHERE inherited_from_recipe_id IS NOT NULL;
