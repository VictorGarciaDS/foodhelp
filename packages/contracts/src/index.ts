import { z } from 'zod';

export const prescriptionFoodGroups = ['Frutas', 'Verduras', 'Cereales y leguminosas', 'Proteinas', 'Grasas', 'Azucar', 'Lacteos'] as const;
export const freeFoodGroups = ['Verduras', 'Condimentos', 'Bebidas', 'Antojos'] as const;
export const foodGroups = [...prescriptionFoodGroups, 'Condimentos', 'Bebidas', 'Antojos'] as const;
export const errorCodes = ['VALIDATION_ERROR', 'NOT_FOUND', 'DATABASE_UNAVAILABLE', 'UNAUTHORIZED', 'INTERNAL_ERROR', 'MENU_BLOCKED', 'ENHANCEMENT_UNAVAILABLE', 'CONFLICT'] as const;
export const errorResponseSchema = z.object({
  error: z.object({ code: z.enum(errorCodes), message: z.string(), details: z.unknown().nullable().optional() }),
});

const positiveAmount = z.string().trim().regex(/^(?:[1-9]\d*(?:\.\d+)?|0?\.\d*[1-9]\d*|[1-9]\d*\/[1-9]\d*)$/);
const foodPortionSchema = z.object({
  group: z.enum(foodGroups), baseQuantity: positiveAmount.nullable(), unit: z.string().trim().min(1).max(80).nullable(),
  isFreeConsumption: z.boolean(),
  portionPending: z.boolean().optional(),
});
function validateFoodPortion(value: z.infer<typeof foodPortionSchema>, context: z.RefinementCtx) {
  const freeGroup = (freeFoodGroups as readonly string[]).includes(value.group);
  if (value.portionPending) {
    if (value.isFreeConsumption || freeGroup || value.baseQuantity !== null || value.unit !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Una porción pendiente no es consumo libre y no tiene medida confirmada.' });
    }
    return;
  }
  if (value.isFreeConsumption) {
    if (!freeGroup || value.baseQuantity !== null || value.unit !== null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'El consumo libre requiere una categoría libre y no lleva porción ni unidad.' });
    }
  } else if (freeGroup || value.baseQuantity === null || value.unit === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Un alimento porcionado requiere cantidad base y unidad.' });
  }
}
export const foodSchema = foodPortionSchema.extend({
  id: z.string().uuid(), name: z.string(), verifiedAt: z.string().datetime().nullable(),
}).superRefine((value, context) => {
  validateFoodPortion(value, context);
  if (value.portionPending && value.verifiedAt !== null) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Una porción pendiente no puede estar verificada.' });
});
export const createFoodSchema = foodPortionSchema.extend({
  name: z.string().trim().min(1).max(160), verified: z.boolean(),
}).superRefine((value, context) => {
  validateFoodPortion(value, context);
  if (value.portionPending && value.verified) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Una porción pendiente no puede estar verificada.' });
});
export const personSchema = z.object({
  id: z.string().uuid(), name: z.string(), prescriptionComplete: z.boolean(),
});
export const createPersonSchema = z.object({ name: z.string().trim().min(1).max(120) });
export const prescriptionSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), reviewed: z.literal(true),
  indicatedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'La fecha de consulta no es válida.').nullable().optional(),
  meals: z.array(z.object({
    mealTime: z.string().trim().min(1).max(80), group: z.enum(prescriptionFoodGroups), equivalents: z.string().regex(/^\d+(?:\.\d+)?$/),
    requirementKind: z.enum(['exact', 'free_guidance']).optional(),
    preferredFoodId: z.string().uuid().nullable().optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
  }).refine((meal) => meal.requirementKind !== 'free_guidance' || meal.group === 'Verduras', 'La indicación libre solo corresponde a verduras.')).min(1).max(100),
}).superRefine((value, context) => {
  if (value.indicatedOn && !value.indicatedOn.startsWith(`${value.month}-`)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['indicatedOn'], message: 'La fecha de consulta debe pertenecer al mes de vigencia.' });
  }
  const keys = new Set<string>();
  value.meals.forEach((meal, index) => {
    const key = JSON.stringify([meal.mealTime.toLocaleLowerCase('es'), meal.group]);
    if (keys.has(key)) context.addIssue({ code: z.ZodIssueCode.custom, path: ['meals', index], message: 'No repitas el mismo grupo y tiempo de comida.' });
    keys.add(key);
  });
});
export const prescriptionPathSchema = z.object({ personId: z.string().uuid(), prescriptionId: z.string().uuid() });
export const calculateEquivalentSchema = z.object({
  foodId: z.string().uuid(), quantity: positiveAmount, unit: z.string().trim().min(1).max(80),
});
export const recipeCandidateSchema = z.object({
  name: z.string().trim().min(1).max(160), instructions: z.array(z.string().trim().min(1)).min(1),
  ingredients: z.array(z.object({
    foodId: z.string().uuid(), quantity: positiveAmount.nullable(), unit: z.string().trim().min(1).nullable(),
    group: z.enum(foodGroups), isFreeConsumption: z.boolean().default(false),
  }).superRefine((ingredient, context) => {
    const freeGroup = (freeFoodGroups as readonly string[]).includes(ingredient.group);
    if (ingredient.isFreeConsumption) {
      if (!freeGroup || (ingredient.quantity === null) !== (ingredient.unit === null)) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'Un ingrediente libre permite cantidad y unidad de compra juntas, o ninguna.' });
      }
    } else if (freeGroup || ingredient.quantity === null || ingredient.unit === null) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Un ingrediente porcionado requiere cantidad y unidad.' });
    }
  })).min(1),
});
export const mealTimes = ['Desayuno', 'Almuerzo', 'Comida', 'Cena'] as const;
export const recipeEditSchema = z.object({
  personId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  mealTime: z.enum(mealTimes),
  sourceText: z.string().trim().min(1).max(6000),
  reviewNotes: z.array(z.string().trim().min(1).max(500)).max(30),
  instructions: z.array(z.string().trim().min(1).max(1000)).max(30),
  ingredients: z.array(z.object({
    foodId: z.string().uuid(), quantity: positiveAmount.nullable(), unit: z.string().trim().min(1).max(80).nullable(),
    group: z.enum(foodGroups), isFreeConsumption: z.boolean(),
  }).superRefine((ingredient, context) => {
    const freeGroup = (freeFoodGroups as readonly string[]).includes(ingredient.group);
    if (ingredient.isFreeConsumption && (!freeGroup || (ingredient.quantity === null) !== (ingredient.unit === null))) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Un alimento libre permite cantidad y unidad de compra juntas, o ninguna.' });
    }
    if (!ingredient.isFreeConsumption && (freeGroup || ingredient.quantity === null || ingredient.unit === null)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: 'Un alimento porcionado requiere cantidad y unidad.' });
    }
  })).max(100),
  verify: z.boolean(),
}).refine((recipe) => !recipe.verify || recipe.ingredients.length > 0, {
  path: ['ingredients'], message: 'Añade ingredientes antes de verificar la receta.',
}).refine((recipe) => !recipe.verify || recipe.instructions.length > 0, {
  path: ['instructions'], message: 'Añade pasos de preparación antes de verificar la receta.',
});
export const recipeDiscoverySchema = z.object({
  personId: z.string().uuid(),
  mealTime: z.enum(mealTimes),
  mainFoodIds: z.array(z.string().uuid()).min(1).max(12),
}).refine((input) => new Set(input.mainFoodIds).size === input.mainFoodIds.length, {
  path: ['mainFoodIds'], message: 'No repitas ingredientes principales.',
});
const shoppingMealSelectionSchema = z.object({
  mealTime: z.enum(mealTimes), recipeIds: z.array(z.string().uuid()).min(1).max(31),
}).refine((meal) => new Set(meal.recipeIds).size === meal.recipeIds.length, {
  path: ['recipeIds'], message: 'No repitas una receta en la misma selección.',
});
export const shoppingPlanSchema = z.object({
  days: z.number().int().min(1).max(31),
  participants: z.array(z.object({ personId: z.string().uuid(), days: z.number().int().min(1).max(31).optional(), meals: z.array(shoppingMealSelectionSchema).length(4) })).min(1).max(6),
}).superRefine((plan, context) => {
  plan.participants.forEach((participant, participantIndex) => {
    const selectedTimes = participant.meals.map((meal) => meal.mealTime);
    if (new Set(selectedTimes).size !== 4 || mealTimes.some((mealTime) => !selectedTimes.includes(mealTime))) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['participants', participantIndex, 'meals'], message: 'Selecciona al menos una receta para cada tiempo de comida.' });
    }
  });
});
export const suggestionsRequestSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), peopleIds: z.array(z.string().uuid()).min(1),
});
export const generateMenuRequestSchema = suggestionsRequestSchema;
export const weekPathSchema = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
export const shoppingListQuerySchema = z.object({ peopleIds: z.array(z.string().uuid()).min(1) });
export const idPathSchema = z.object({ id: z.string().uuid() });
export const personPathSchema = z.object({ personId: z.string().uuid() });
export const pdfRequestSchema = z.object({
  kind: z.enum(['menu', 'shopping']), weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), peopleIds: z.array(z.string().uuid()).min(1),
});

export type FoodGroup = (typeof foodGroups)[number];
export type ErrorCode = (typeof errorCodes)[number];
export type Food = z.infer<typeof foodSchema>;
export type CreateFood = z.infer<typeof createFoodSchema>;
export type Person = z.infer<typeof personSchema>;
export type RecipeCandidate = z.infer<typeof recipeCandidateSchema>;
export type RecipeEdit = z.infer<typeof recipeEditSchema>;
export type RecipeDiscovery = z.infer<typeof recipeDiscoverySchema>;
export type EquivalentResult = { numerator: string; denominator: string; decimal: string | null };
