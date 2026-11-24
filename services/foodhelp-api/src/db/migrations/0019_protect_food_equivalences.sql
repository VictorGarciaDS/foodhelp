CREATE UNIQUE INDEX foods_normalized_name_idx ON foodhelp.foods (lower(btrim(name)));

CREATE FUNCTION foodhelp.protect_food_equivalences() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW.food_group, NEW.base_quantity, NEW.unit, NEW.is_free_consumption)
       IS DISTINCT FROM ROW(OLD.food_group, OLD.base_quantity, OLD.unit, OLD.is_free_consumption)
     AND current_setting('foodhelp.authorize_equivalence_change', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Las equivalencias del catalogo requieren autorizacion explicita.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER foods_protect_equivalences
BEFORE UPDATE OF food_group, base_quantity, unit, is_free_consumption ON foodhelp.foods
FOR EACH ROW EXECUTE FUNCTION foodhelp.protect_food_equivalences();