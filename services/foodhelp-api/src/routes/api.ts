import { Router } from 'express';
import { z } from 'zod';
import {
  calculateEquivalentSchema, createFoodSchema, createPersonSchema, generateMenuRequestSchema, recipeDiscoverySchema, recipeEditSchema, shoppingPlanSchema,
  idPathSchema, pdfRequestSchema, personPathSchema, prescriptionPathSchema, prescriptionSchema, shoppingListQuerySchema,
  suggestionsRequestSchema, weekPathSchema,
} from '@foodhelp/contracts';
import type { RecipeEdit } from '@foodhelp/contracts';
import { getPool } from '../db/pool';
import { calculateEquivalent, equivalentFraction, multiplyAmount, rationallyEqual, sumAmounts } from '../domain/equivalents/exact';
import { getGenerationBlockReason } from '../domain/menus/generation-readiness';
import { streamPdf } from '../exports/pdf';
import { ApiError, parseRequest } from '../errors';
import { requestRecipeProposals } from '../integrations/completion-api';

const foodIdPathSchema = z.object({ foodId: z.string().uuid() });

async function validateRecipeForProfile(input: RecipeEdit): Promise<void> {
  const pool = getPool();
  const person = await pool.query('SELECT id FROM foodhelp.people WHERE id = $1', [input.personId]);
  if (!person.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Persona seleccionada no encontrada.');

  const ids = input.ingredients.map((ingredient) => ingredient.foodId);
  const foodsResult = ids.length ? await pool.query(
    `SELECT id, name, food_group AS "group", base_quantity AS "baseQuantity", unit,
            is_free_consumption AS "isFreeConsumption", portion_pending AS "portionPending", verified_at AS "verifiedAt"
     FROM foodhelp.foods WHERE id = ANY($1::uuid[])`, [ids],
  ) : { rows: [] };
  const foods = new Map(foodsResult.rows.map((food) => [food.id as string, food]));
  for (const ingredient of input.ingredients) {
    const food = foods.get(ingredient.foodId);
    if (!food || !food.verifiedAt || food.portionPending || food.group !== ingredient.group || food.isFreeConsumption !== ingredient.isFreeConsumption) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'Cada ingrediente debe corresponder a un alimento verificado del catálogo.');
    }
    if (ingredient.isFreeConsumption) {
      if (!food.isFreeConsumption || (ingredient.quantity === null) !== (ingredient.unit === null)) throw new ApiError(422, 'VALIDATION_ERROR', 'Un ingrediente libre requiere cantidad y unidad de compra juntas, o ninguna.');
    } else if (food.isFreeConsumption || !food.baseQuantity || !food.unit || food.unit !== ingredient.unit || ingredient.quantity === null) {
      throw new ApiError(422, 'VALIDATION_ERROR', 'La cantidad debe usar exactamente la unidad porcionada del catálogo.');
    }
  }

  if (!input.verify) return;
  if (input.reviewNotes.length) throw new ApiError(422, 'VALIDATION_ERROR', 'Resuelve o elimina los pendientes antes de verificar la receta.');
  const prescription = await pool.query<{ group: string; equivalents: string; requirementKind: string }>(
    `SELECT pi.food_group AS "group", pi.equivalents::text AS equivalents, pi.requirement_kind AS "requirementKind"
     FROM foodhelp.prescription_items pi JOIN foodhelp.prescriptions pr ON pr.id = pi.prescription_id
     WHERE pr.person_id = $1 AND pr.reviewed_at IS NOT NULL
       AND pr.month = (SELECT max(month) FROM foodhelp.prescriptions WHERE person_id = $1 AND reviewed_at IS NOT NULL)
       AND pi.meal_time = $2`,
    [input.personId, input.mealTime],
  );
  if (!prescription.rowCount) throw new ApiError(409, 'MENU_BLOCKED', 'Esta persona no tiene una prescripción revisada para ese tiempo de comida.');
  const missingGroups = [...new Set(prescription.rows.map((row) => row.group))]
    .filter((group) => !input.ingredients.some((ingredient) => ingredient.group === group));
  if (missingGroups.length) throw new ApiError(422, 'VALIDATION_ERROR', `Añade al menos un ingrediente para: ${missingGroups.join(', ')}.`);
  const expected = new Map(prescription.rows.filter((row) => row.requirementKind !== 'free_guidance').map((row) => [row.group, row.equivalents]));
  const totals = new Map<string, string[]>();
  for (const ingredient of input.ingredients) {
    if (ingredient.isFreeConsumption) continue;
    const food = foods.get(ingredient.foodId)!;
    const ratio = equivalentFraction(ingredient.quantity!, food.baseQuantity as string);
    const amount = ratio.denominator === '1' ? ratio.numerator : `${ratio.numerator}/${ratio.denominator}`;
    totals.set(ingredient.group, [...(totals.get(ingredient.group) ?? []), amount]);
  }
  const groups = new Set([...expected.keys(), ...totals.keys()]);
  const mismatches = [...groups].filter((group) => {
    const target = expected.get(group) ?? '0';
    const actual = sumAmounts(totals.get(group) ?? []);
    return !rationallyEqual(actual, target);
  });
  if (mismatches.length) throw new ApiError(422, 'VALIDATION_ERROR', `Las equivalencias no coinciden con la prescripción para: ${mismatches.join(', ')}.`);
}

async function getGenerationReadiness(weekStart: string, peopleIds: string[]) {
  const result = await getPool().query<{ ready: boolean; savedRecipes: boolean; verifiedFoods: boolean }>(
    `SELECT
       EXISTS (SELECT 1 FROM foodhelp.foods WHERE verified_at IS NOT NULL AND NOT is_free_consumption) AS "verifiedFoods",
       EXISTS (SELECT 1 FROM foodhelp.recipes WHERE verified_at IS NOT NULL) AS "savedRecipes",
       cardinality($1::uuid[]) > 0
       AND NOT EXISTS (
         SELECT 1 FROM unnest($1::uuid[]) AS selected(person_id)
         LEFT JOIN foodhelp.people p ON p.id = selected.person_id
         LEFT JOIN foodhelp.prescriptions pr ON pr.person_id = p.id
           AND pr.month = date_trunc('month', $2::date)::date AND pr.reviewed_at IS NOT NULL
         WHERE p.id IS NULL OR pr.id IS NULL
           OR NOT EXISTS (SELECT 1 FROM foodhelp.prescription_items pi WHERE pi.prescription_id = pr.id)
           OR EXISTS (
             SELECT 1 FROM foodhelp.prescription_items pi
             JOIN foodhelp.foods f ON f.id = pi.preferred_food_id
             WHERE pi.prescription_id = pr.id AND (f.portion_pending OR f.verified_at IS NULL)
           )
       ) AS ready`,
    [peopleIds, weekStart],
  );
  return result.rows[0];
}

export function createApiRouter(): Router {
  const router = Router();

  router.get('/foods', async (_request, response) => {
    const result = await getPool().query(
                  `SELECT id, name, food_group AS "group", base_quantity AS "baseQuantity", unit,
                    is_free_consumption AS "isFreeConsumption", portion_pending AS "portionPending", verified_at AS "verifiedAt"
       FROM foodhelp.foods ORDER BY food_group, name`,
    );
    response.json({ items: result.rows });
  });

  router.post('/foods', async (request, response) => {
    const input = parseRequest(createFoodSchema, request.body);
    const result = await getPool().query(
      `INSERT INTO foodhelp.foods (name, food_group, base_quantity, unit, is_free_consumption, verified_at, portion_pending)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $6 THEN now() ELSE NULL END, $7)
       RETURNING id, name, food_group AS "group", base_quantity AS "baseQuantity", unit,
         is_free_consumption AS "isFreeConsumption", portion_pending AS "portionPending", verified_at AS "verifiedAt"`,
      [input.name, input.group, input.baseQuantity, input.unit, input.isFreeConsumption, input.verified, input.portionPending ?? false],
    );
    response.status(201).json({ item: result.rows[0] });
  });

  router.get('/people', async (_request, response) => {
    const result = await getPool().query(
      `SELECT p.id, p.name,
              EXISTS (
                SELECT 1 FROM foodhelp.prescriptions pr
                WHERE pr.person_id = p.id AND pr.reviewed_at IS NOT NULL
                  AND EXISTS (SELECT 1 FROM foodhelp.prescription_items pi WHERE pi.prescription_id = pr.id)
              ) AS "prescriptionComplete"
       FROM foodhelp.people p ORDER BY p.created_at`,
    );
    response.json({ people: result.rows });
  });

  router.post('/people', async (request, response) => {
    const input = parseRequest(createPersonSchema, request.body);
    const result = await getPool().query(
      'INSERT INTO foodhelp.people (name) VALUES ($1) RETURNING id, name',
      [input.name],
    );
    response.status(201).json({ person: { ...result.rows[0], prescriptionComplete: false } });
  });

  router.get('/people/:personId/prescriptions', async (request, response) => {
    const { personId } = parseRequest(personPathSchema, request.params);
    const pool = getPool();
    const person = await pool.query('SELECT id FROM foodhelp.people WHERE id = $1', [personId]);
    if (!person.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Persona no encontrada.');
    const result = await pool.query(
      `SELECT pr.id, pr.person_id AS "personId", to_char(pr.month, 'YYYY-MM') AS month,
              pr.indicated_on::text AS "indicatedOn", pr.reviewed_at AS "reviewedAt",
              COALESCE(jsonb_agg(jsonb_build_object(
                'mealTime', pi.meal_time, 'group', pi.food_group, 'equivalents', pi.equivalents::text,
                'requirementKind', pi.requirement_kind, 'preferredFoodId', pi.preferred_food_id, 'notes', pi.notes
              ) ORDER BY pi.meal_time, pi.food_group) FILTER (WHERE pi.id IS NOT NULL), '[]'::jsonb) AS meals
       FROM foodhelp.prescriptions pr LEFT JOIN foodhelp.prescription_items pi ON pi.prescription_id = pr.id
       WHERE pr.person_id = $1 GROUP BY pr.id ORDER BY pr.month DESC`,
      [personId],
    );
    response.json({ prescriptions: result.rows });
  });

  router.delete('/people/:personId/prescriptions/:prescriptionId', async (request, response) => {
    const { personId, prescriptionId } = parseRequest(prescriptionPathSchema, request.params);
    const result = await getPool().query('DELETE FROM foodhelp.prescriptions WHERE id = $1 AND person_id = $2 RETURNING id', [prescriptionId, personId]);
    if (!result.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Prescripción no encontrada para esta persona.');
    response.status(204).end();
  });

  router.put('/people/:personId/prescription', async (request, response) => {
    const { personId } = parseRequest(personPathSchema, request.params);
    const input = parseRequest(prescriptionSchema, request.body);
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const person = await client.query('SELECT id FROM foodhelp.people WHERE id = $1 FOR UPDATE', [personId]);
      if (person.rowCount === 0) throw new ApiError(404, 'NOT_FOUND', 'Persona no encontrada.');
      const preferredIds = input.meals.flatMap((meal) => meal.preferredFoodId ? [meal.preferredFoodId] : []);
      if (preferredIds.length) {
        const foods = await client.query<{ id: string; group: string }>('SELECT id, food_group AS "group" FROM foodhelp.foods WHERE id = ANY($1::uuid[])', [preferredIds]);
        if (input.meals.some((meal) => meal.preferredFoodId && !foods.rows.some((food) => food.id === meal.preferredFoodId && food.group === meal.group))) {
          throw new ApiError(422, 'VALIDATION_ERROR', 'El alimento preferido debe existir y pertenecer al grupo indicado.');
        }
      }
      const prescription = await client.query(
        `INSERT INTO foodhelp.prescriptions (person_id, month, indicated_on, reviewed_at)
         VALUES ($1, ($2 || '-01')::date, $3::date, now())
         ON CONFLICT (person_id, month) DO UPDATE SET reviewed_at = now(),
           indicated_on = CASE WHEN $4 THEN EXCLUDED.indicated_on ELSE foodhelp.prescriptions.indicated_on END
         RETURNING id`,
        [personId, input.month, input.indicatedOn ?? null, input.indicatedOn !== undefined],
      );
      const prescriptionId = prescription.rows[0].id as string;
      await client.query('DELETE FROM foodhelp.prescription_items WHERE prescription_id = $1', [prescriptionId]);
      for (const meal of input.meals) {
        await client.query(
          `INSERT INTO foodhelp.prescription_items (prescription_id, meal_time, food_group, equivalents, requirement_kind, preferred_food_id, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [prescriptionId, meal.mealTime, meal.group, meal.equivalents, meal.requirementKind ?? 'exact', meal.preferredFoodId ?? null, meal.notes ?? null],
        );
      }
      await client.query('UPDATE foodhelp.recipes SET verified_at = NULL WHERE person_id = $1', [personId]);
      await client.query('COMMIT');
      response.json({ prescription: { id: prescriptionId, personId, month: input.month, indicatedOn: input.indicatedOn, reviewed: true, meals: input.meals } });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  });

  router.post('/equivalents/calculate', async (request, response) => {
    const input = parseRequest(calculateEquivalentSchema, request.body);
    const result = await getPool().query<{ baseQuantity: string | null; unit: string | null; isFreeConsumption: boolean; verifiedAt: string | null }>(
      'SELECT base_quantity AS "baseQuantity", unit, is_free_consumption AS "isFreeConsumption", verified_at AS "verifiedAt" FROM foodhelp.foods WHERE id = $1',
      [input.foodId],
    );
    const food = result.rows[0];
    if (!food) throw new ApiError(404, 'NOT_FOUND', 'Alimento no encontrado.');
    if (!food.verifiedAt) throw new ApiError(422, 'VALIDATION_ERROR', 'El cálculo requiere un alimento verificado.');
    if (food.isFreeConsumption || !food.baseQuantity || !food.unit) throw new ApiError(422, 'VALIDATION_ERROR', 'El alimento es de consumo libre y no tiene equivalencia por porción.');
    if (food.unit !== input.unit) throw new ApiError(422, 'VALIDATION_ERROR', 'La unidad debe coincidir exactamente con la unidad verificada del alimento.');
    response.json(calculateEquivalent(input.quantity, food.baseQuantity));
  });

  router.get('/recipes', async (_request, response) => {
    const result = await getPool().query(
      `SELECT r.id, r.name, r.verified_at AS "verifiedAt", r.person_id AS "personId", p.name AS "personName",
          r.meal_time AS "mealTime", r.review_notes AS "reviewNotes"
       FROM foodhelp.recipes r LEFT JOIN foodhelp.people p ON p.id = r.person_id ORDER BY r.created_at DESC, r.meal_time, r.name`,
    );
    response.json({ items: result.rows });
  });

  router.post('/recipes/matches', async (request, response) => {
    const input = parseRequest(recipeDiscoverySchema, request.body);
    const pool = getPool();
    const person = await pool.query('SELECT id FROM foodhelp.people WHERE id = $1', [input.personId]);
    if (!person.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Persona seleccionada no encontrada.');
    const selectedFoods = await pool.query('SELECT id FROM foodhelp.foods WHERE id = ANY($1::uuid[]) AND verified_at IS NOT NULL AND NOT portion_pending', [input.mainFoodIds]);
    if (selectedFoods.rowCount !== input.mainFoodIds.length) throw new ApiError(422, 'VALIDATION_ERROR', 'Los ingredientes principales deben existir y estar verificados.');
    const result = await pool.query(
      `SELECT r.id, r.name, r.verified_at AS "verifiedAt", r.person_id AS "personId", p.name AS "personName",
              r.meal_time AS "mealTime", r.review_notes AS "reviewNotes", r.ingredients
       FROM foodhelp.recipes r JOIN foodhelp.people p ON p.id = r.person_id
       WHERE r.person_id = $1 AND r.meal_time = $2 ORDER BY r.verified_at DESC NULLS LAST, r.created_at DESC`,
      [input.personId, input.mealTime],
    );
    const selected = new Set(input.mainFoodIds);
    const matches = result.rows.map((recipe) => {
      const ingredients = recipe.ingredients as { foodId: string }[];
      const matchedFoodIds = [...new Set(ingredients.map((ingredient) => ingredient.foodId).filter((foodId) => selected.has(foodId)))];
      return { ...recipe, matchCount: matchedFoodIds.length, matchedFoodIds };
    }).filter((recipe) => recipe.matchCount > 0)
      .sort((left, right) => right.matchCount - left.matchCount || Number(Boolean(right.verifiedAt)) - Number(Boolean(left.verifiedAt)));
    response.json({ matches });
  });

  router.post('/recipes/generate', async (request, response) => {
    const input = parseRequest(recipeDiscoverySchema, request.body);
    const pool = getPool();
    const person = await pool.query<{ id: string; name: string }>('SELECT id, name FROM foodhelp.people WHERE id = $1', [input.personId]);
    if (!person.rowCount) throw new ApiError(404, 'NOT_FOUND', 'Persona seleccionada no encontrada.');
    const [foods, prescription] = await Promise.all([
      pool.query(`SELECT id, name, food_group AS "group", base_quantity AS "baseQuantity", unit,
                         is_free_consumption AS "isFreeConsumption", portion_pending AS "portionPending"
                  FROM foodhelp.foods WHERE verified_at IS NOT NULL ORDER BY food_group, name`),
      pool.query<{ group: string; equivalents: string; requirementKind: string }>(
        `SELECT pi.food_group AS "group", pi.equivalents::text AS equivalents, pi.requirement_kind AS "requirementKind"
         FROM foodhelp.prescription_items pi JOIN foodhelp.prescriptions pr ON pr.id = pi.prescription_id
         WHERE pr.person_id = $1 AND pr.reviewed_at IS NOT NULL
           AND pr.month = (SELECT max(month) FROM foodhelp.prescriptions WHERE person_id = $1 AND reviewed_at IS NOT NULL)
           AND pi.meal_time = $2`,
        [input.personId, input.mealTime],
      ),
    ]);
    if (!prescription.rowCount) throw new ApiError(409, 'MENU_BLOCKED', 'No hay una prescripción revisada para esa persona y tiempo de comida.');
    const selectedFoods = foods.rows.filter((food) => input.mainFoodIds.includes(food.id as string) && !food.portionPending);
    if (selectedFoods.length !== input.mainFoodIds.length) throw new ApiError(422, 'VALIDATION_ERROR', 'Selecciona ingredientes principales del catálogo verificado.');
    const context = JSON.stringify({
      personName: person.rows[0].name,
      mealTime: input.mealTime,
      selectedMainIngredients: selectedFoods,
      prescription: prescription.rows,
      verifiedCatalog: foods.rows.filter((food) => !food.portionPending),
      rules: [
        'Devuelve exactamente tres propuestas en una propiedad suggestions.',
        'Usa todos los ingredientes principales elegidos; emplea solo alimentos y unidades del catálogo.',
        'Suma cantidades de cada grupo exactamente a las equivalencias prescritas; se permiten submúltiplos y mezclas.',
        'Los alimentos de consumo libre no cuentan como equivalencias, aunque pueden llevar cantidades de compra.',
        'Propón combinaciones culinarias coherentes y conocidas; no mezcles salsas dulces con platos salados como chilaquiles.',
        'Si no puedes cumplir exactamente los grupos y cantidades, no inventes conversiones ni cambies la prescripción.',
        'Incluye nombre, instrucciones breves e ingredientes con foodId, cantidad en unidad catalogada, grupo e indicador de consumo libre.',
      ],
    });
    const proposals = await requestRecipeProposals(context);
    const selectedIds = new Set(input.mainFoodIds);
    const saved = [];
    const rejected: string[] = [];
    for (const proposal of proposals) {
      if (!input.mainFoodIds.every((foodId) => proposal.ingredients.some((ingredient) => ingredient.foodId === foodId))) {
        rejected.push(`${proposal.name}: no incluyó todos los ingredientes principales.`);
        continue;
      }
      const edit: RecipeEdit = {
        personId: input.personId,
        name: proposal.name,
        mealTime: input.mealTime,
        sourceText: `Propuesta generada con: ${selectedFoods.filter((food) => selectedIds.has(food.id as string)).map((food) => food.name).join(', ')}.`,
        reviewNotes: [],
        instructions: proposal.instructions,
        ingredients: proposal.ingredients.map((ingredient) => ({ ...ingredient, isFreeConsumption: ingredient.isFreeConsumption ?? false })),
        verify: true,
      };
      try {
        await validateRecipeForProfile(edit);
      } catch (error) {
        rejected.push(`${proposal.name}: ${error instanceof Error ? error.message : 'no coincide con la prescripción.'}`);
        continue;
      }
      const result = await pool.query(
        `INSERT INTO foodhelp.recipes (person_id, name, meal_time, source_text, review_notes, instructions, ingredients, verified_at)
         VALUES ($1, $2, $3, $4, ARRAY[]::text[], $5::jsonb, $6::jsonb, now())
         RETURNING id, name, verified_at AS "verifiedAt", person_id AS "personId", meal_time AS "mealTime",
           (SELECT p.name FROM foodhelp.people p WHERE p.id = $1) AS "personName", source_text AS "sourceText",
           review_notes AS "reviewNotes", instructions, ingredients`,
        [edit.personId, edit.name, edit.mealTime, edit.sourceText, JSON.stringify(edit.instructions), JSON.stringify(edit.ingredients)],
      );
      saved.push(result.rows[0]);
    }
    if (!saved.length) throw new ApiError(422, 'VALIDATION_ERROR', `Ninguna propuesta cumplió la prescripción. ${rejected.join(' ')}`);
    response.status(201).json({ recipes: saved, rejected });
  });

  router.get('/recipes/:id', async (request, response) => {
    const { id } = parseRequest(idPathSchema, request.params);
    const result = await getPool().query(
      `SELECT r.id, r.name, r.instructions, r.ingredients, r.verified_at AS "verifiedAt",
          r.person_id AS "personId", p.name AS "personName", r.meal_time AS "mealTime",
          r.source_text AS "sourceText", r.review_notes AS "reviewNotes"
       FROM foodhelp.recipes r LEFT JOIN foodhelp.people p ON p.id = r.person_id WHERE r.id = $1`,
      [id],
    );
    if (!result.rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Receta no encontrada.');
    response.json({ recipe: result.rows[0] });
  });

  router.post('/recipes', async (request, response) => {
    const input = parseRequest(recipeEditSchema, request.body);
    const duplicate = await getPool().query(
      'SELECT id FROM foodhelp.recipes WHERE person_id = $1 AND name = $2 AND meal_time = $3 LIMIT 1',
      [input.personId, input.name, input.mealTime],
    );
    if (duplicate.rowCount) throw new ApiError(409, 'CONFLICT', 'Ya existe una receta con ese nombre para esta persona y comida.');
    await validateRecipeForProfile(input);
    const result = await getPool().query(
      `INSERT INTO foodhelp.recipes
         (person_id, name, meal_time, source_text, review_notes, instructions, ingredients, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, CASE WHEN $8 THEN now() ELSE NULL END)
       RETURNING id, name, verified_at AS "verifiedAt", person_id AS "personId", meal_time AS "mealTime",
         (SELECT p.name FROM foodhelp.people p WHERE p.id = $1) AS "personName",
         source_text AS "sourceText", review_notes AS "reviewNotes", instructions, ingredients`,
      [input.personId, input.name, input.mealTime, input.sourceText, input.reviewNotes, JSON.stringify(input.instructions), JSON.stringify(input.ingredients), input.verify],
    );
    response.status(201).json({ recipe: result.rows[0] });
  });

  router.put('/recipes/:id', async (request, response) => {
    const { id } = parseRequest(idPathSchema, request.params);
    const input = parseRequest(recipeEditSchema, request.body);
    const pool = getPool();
    const existing = await pool.query<{ personId: string | null }>('SELECT person_id AS "personId" FROM foodhelp.recipes WHERE id = $1', [id]);
    if (!existing.rowCount || !existing.rows[0].personId) throw new ApiError(404, 'NOT_FOUND', 'Receta o persona asociada no encontrada.');
    await validateRecipeForProfile(input);

    const result = await pool.query(
      `UPDATE foodhelp.recipes SET person_id = $9, name = $2, meal_time = $3, source_text = $4,
         review_notes = $5, ingredients = $6::jsonb, instructions = $7::jsonb,
         verified_at = CASE WHEN $8 THEN now() ELSE NULL END
       WHERE id = $1
       RETURNING id, name, verified_at AS "verifiedAt", person_id AS "personId", meal_time AS "mealTime",
        (SELECT p.name FROM foodhelp.people p WHERE p.id = $9) AS "personName",
        source_text AS "sourceText", review_notes AS "reviewNotes", instructions, ingredients`,
      [id, input.name, input.mealTime, input.sourceText, input.reviewNotes, JSON.stringify(input.ingredients), JSON.stringify(input.instructions), input.verify, input.personId],
    );
    response.json({ recipe: result.rows[0] });
  });

  router.post('/recipes/suggestions', async (request, response) => {
    const input = parseRequest(suggestionsRequestSchema, request.body);
    const readiness = await getGenerationReadiness(input.weekStart, input.peopleIds);
    if (!readiness?.ready || !readiness.verifiedFoods) throw new ApiError(409, 'MENU_BLOCKED', 'Faltan alimentos verificados o prescripciones revisadas con porciones confirmadas.');
    if (readiness.savedRecipes) throw new ApiError(409, 'CONFLICT', 'Revisa primero las recetas guardadas antes de solicitar propuestas externas.');

    const [foods, people] = await Promise.all([
      getPool().query(`SELECT id, name, food_group AS "group", base_quantity AS "baseQuantity", unit, is_free_consumption AS "isFreeConsumption" FROM foodhelp.foods WHERE verified_at IS NOT NULL ORDER BY food_group, name`),
      getPool().query(
        `SELECT p.id, pr.month::text AS month, pi.meal_time AS "mealTime", pi.food_group AS "group",
          pi.equivalents::text AS equivalents, pi.requirement_kind AS "requirementKind", pi.preferred_food_id AS "preferredFoodId", pi.notes
         FROM foodhelp.people p
         JOIN foodhelp.prescriptions pr ON pr.person_id = p.id AND pr.month = date_trunc('month', $2::date)::date AND pr.reviewed_at IS NOT NULL
         JOIN foodhelp.prescription_items pi ON pi.prescription_id = pr.id
         WHERE p.id = ANY($1::uuid[]) ORDER BY p.id, pi.meal_time, pi.food_group`,
        [input.peopleIds, input.weekStart],
      ),
    ]);
    const context = JSON.stringify({ weekStart: input.weekStart, verifiedFoods: foods.rows, reviewedPrescriptions: people.rows });
    const suggestions = await requestRecipeProposals(context);
    const available = new Map(foods.rows.map((food) => [food.id as string, food]));
    const allValid = suggestions.every((recipe) => recipe.ingredients.every((ingredient) => {
      const food = available.get(ingredient.foodId);
      return food && food.group === ingredient.group
        && food.isFreeConsumption === ingredient.isFreeConsumption && food.unit === ingredient.unit;
    }));
    if (!allValid) throw new ApiError(422, 'VALIDATION_ERROR', 'Se descartaron propuestas con alimentos o unidades que no coinciden con el catalogo revisado.');
    response.json({ suggestions });
  });

  router.get('/menus/:weekStart', async (request, response) => {
    const { weekStart } = parseRequest(weekPathSchema, request.params);
    const result = await getPool().query(
      `SELECT person_id AS "personId", menu_data AS "menuData", reviewed_at AS "reviewedAt"
       FROM foodhelp.weekly_menus WHERE week_start = $1::date ORDER BY person_id`,
      [weekStart],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'NOT_FOUND', 'No hay un menu guardado para esta semana.');
    response.json({ weekStart, days: result.rows });
  });

  router.post('/menus/generate', async (request, response) => {
    const input = parseRequest(generateMenuRequestSchema, request.body);
    const readiness = await getGenerationReadiness(input.weekStart, input.peopleIds);
    const reason = getGenerationBlockReason({
      verifiedFoods: Boolean(readiness?.verifiedFoods),
      prescriptionsReviewed: Boolean(readiness?.ready),
      plannerApproved: false,
    });
    if (reason) throw new ApiError(409, 'MENU_BLOCKED', reason);
    response.status(501).json({ error: { code: 'MENU_BLOCKED', message: 'No hay un planificador clínico aprobado.', details: null } });
  });

  router.get('/shopping-list/:weekStart', async (request, response) => {
    const { weekStart } = parseRequest(weekPathSchema, request.params);
    const queryIds = request.query.peopleIds;
    const peopleIds = parseRequest(shoppingListQuerySchema, {
      peopleIds: Array.isArray(queryIds) ? queryIds : queryIds ? [queryIds] : [],
    }).peopleIds;
    const result = await getPool().query(
      `SELECT item->>'foodId' AS "foodId", item->>'name' AS name, item->>'unit' AS unit,
              SUM((item->>'quantity')::numeric)::text AS quantity
       FROM foodhelp.weekly_menus wm
       CROSS JOIN LATERAL jsonb_array_elements(wm.menu_data->'shoppingItems') AS item
      WHERE wm.week_start = $1::date AND wm.person_id = ANY($2::uuid[])
      GROUP BY item->>'foodId', item->>'name', item->>'unit' ORDER BY item->>'name', item->>'unit'`,
          [weekStart, peopleIds],
    );
    if (result.rowCount === 0) throw new ApiError(404, 'NOT_FOUND', 'No hay compras calculables para esta semana.');
    response.json({ items: result.rows });
  });

  router.post('/shopping-list/calculate', async (request, response) => {
    const input = parseRequest(shoppingPlanSchema, request.body);
    const personIds = [...new Set(input.participants.map((participant) => participant.personId))];
    const existingPeople = await getPool().query('SELECT id FROM foodhelp.people WHERE id = ANY($1::uuid[])', [personIds]);
    if (existingPeople.rowCount !== personIds.length) throw new ApiError(404, 'NOT_FOUND', 'Una persona seleccionada ya no existe.');

    const recipeIds = [...new Set(input.participants.flatMap((participant) => participant.meals.flatMap((meal) => meal.recipeIds)))];
    const recipeResult = await getPool().query(
      `SELECT id, person_id AS "personId", meal_time AS "mealTime", ingredients
       FROM foodhelp.recipes WHERE id = ANY($1::uuid[]) AND verified_at IS NOT NULL`, [recipeIds],
    );
    const recipes = new Map(recipeResult.rows.map((recipe) => [recipe.id as string, recipe]));
    const ingredientTotals = new Map<string, { foodId: string; quantities: string[]; unit: string }>();
    const usage: { personId: string; mealTime: string; recipeId: string; day: number }[] = [];

    const participantDurations = input.participants.map((participant) => ({ personId: participant.personId, days: participant.days ?? input.days }));
    for (const participant of input.participants) {
      const participantDays = participant.days ?? input.days;
      for (const meal of participant.meals) {
        for (let day = 0; day < participantDays; day += 1) {
          const recipeId = meal.recipeIds[day % meal.recipeIds.length];
          const recipe = recipes.get(recipeId);
          if (!recipe) throw new ApiError(409, 'MENU_BLOCKED', 'Todas las recetas deben tener ingredientes completos y verificados antes de generar compras.');
          if (recipe.personId !== participant.personId || recipe.mealTime !== meal.mealTime) {
            throw new ApiError(422, 'VALIDATION_ERROR', 'La receta debe estar verificada para esa persona y ese tiempo de comida.');
          }
          usage.push({ personId: participant.personId, mealTime: meal.mealTime, recipeId, day: day + 1 });
          for (const ingredient of recipe.ingredients as { foodId: string; quantity: string | null; unit: string | null; isFreeConsumption: boolean }[]) {
            if (ingredient.quantity === null && ingredient.unit === null) continue;
            if (!ingredient.quantity || !ingredient.unit) throw new ApiError(409, 'MENU_BLOCKED', 'Un ingrediente de receta contiene solo cantidad o unidad.');
            const key = `${ingredient.foodId}\u0000${ingredient.unit}`;
            const item = ingredientTotals.get(key) ?? { foodId: ingredient.foodId, quantities: [], unit: ingredient.unit };
            item.quantities.push(ingredient.quantity);
            ingredientTotals.set(key, item);
          }
        }
      }
    }

    const foodIds = [...new Set([...ingredientTotals.values()].map((item) => item.foodId))];
    const foodResult = foodIds.length ? await getPool().query('SELECT id, name FROM foodhelp.foods WHERE id = ANY($1::uuid[])', [foodIds]) : { rows: [] };
    const names = new Map(foodResult.rows.map((food) => [food.id as string, food.name as string]));
    const items = [...ingredientTotals.entries()].map(([key, item]) => ({
      foodId: item.foodId,
      name: names.get(item.foodId) ?? 'Alimento desconocido',
      unit: item.unit,
      quantity: sumAmounts(item.quantities),
    })).sort((left, right) => left.name.localeCompare(right.name, 'es') || left.unit.localeCompare(right.unit, 'es'));
    response.json({ days: input.days, participantCount: input.participants.length, participants: participantDurations, usage, items });
  });

  router.post('/exports/pdf', async (request, response) => {
    const input = parseRequest(pdfRequestSchema, request.body);
    if (input.kind === 'shopping') {
      const shopping = await getPool().query<{ name: string; quantity: string; unit: string }>(
        `SELECT item->>'name' AS name, SUM((item->>'quantity')::numeric)::text AS quantity, item->>'unit' AS unit
         FROM foodhelp.weekly_menus wm
         CROSS JOIN LATERAL jsonb_array_elements(wm.menu_data->'shoppingItems') AS item
         WHERE wm.week_start = $1::date AND wm.person_id = ANY($2::uuid[])
         GROUP BY item->>'foodId', item->>'name', item->>'unit' ORDER BY item->>'name', item->>'unit'`,
        [input.weekStart, input.peopleIds],
      );
      if (shopping.rowCount === 0) throw new ApiError(409, 'MENU_BLOCKED', 'No hay compras calculables para las personas seleccionadas.');
      streamPdf(response, `Compras ${input.weekStart}`, shopping.rows.map((item) => `${item.name}: ${item.quantity} ${item.unit}`));
      return;
    }
    const result = await getPool().query<{ name: string; menuData: unknown }>(
      `SELECT p.name, wm.menu_data AS "menuData"
       FROM foodhelp.weekly_menus wm JOIN foodhelp.people p ON p.id = wm.person_id
       WHERE wm.week_start = $1::date AND wm.person_id = ANY($2::uuid[])
       ORDER BY p.name`,
      [input.weekStart, input.peopleIds],
    );
    if (result.rowCount !== input.peopleIds.length) throw new ApiError(409, 'MENU_BLOCKED', 'No hay un plan revisado para todas las personas seleccionadas.');
    const rows = result.rows.map((entry) => `${entry.name}: ${JSON.stringify(entry.menuData)}`);
    streamPdf(response, `Menu ${input.weekStart}`, rows);
  });

  router.use((_request, _response, next) => next(new ApiError(404, 'NOT_FOUND', 'Ruta de API no encontrada.')));
  return router;
}