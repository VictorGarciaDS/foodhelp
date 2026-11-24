import { sumAmounts } from '../equivalents/exact';
import type { InheritedIngredient } from './inheritance';

export function mergeRecipeIngredients<T extends InheritedIngredient>(ingredients: T[]): T[] {
  const merged = new Map<string, T>();
  for (const ingredient of ingredients) {
    const key = JSON.stringify([ingredient.foodId, ingredient.group, ingredient.unit, ingredient.isFreeConsumption]);
    const existing = merged.get(key);
    merged.set(key, existing ? {
      ...existing,
      quantity: existing.quantity === null || ingredient.quantity === null ? null : sumAmounts([existing.quantity, ingredient.quantity]),
    } : { ...ingredient });
  }
  return [...merged.values()];
}