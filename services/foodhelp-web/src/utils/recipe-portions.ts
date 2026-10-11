import type { Food, RecipeEdit } from '@foodhelp/contracts';
import type { PrescriptionInput } from '../api/types';

type Rational = { numerator: bigint; denominator: bigint };
type Meal = PrescriptionInput['meals'][number];
const zero: Rational = { numerator: 0n, denominator: 1n };

function reduce(numerator: bigint, denominator: bigint): Rational {
  let left = numerator < 0n ? -numerator : numerator;
  let right = denominator;
  while (right !== 0n) [left, right] = [right, left % right];
  return { numerator: numerator / left, denominator: denominator / left };
}

function parse(value: string | null): Rational | null {
  if (value === null || !/^\d+(?:\.\d+)?$|^[1-9]\d*\/[1-9]\d*$/.test(value.trim())) return null;
  const trimmed = value.trim();
  if (trimmed.includes('/')) {
    const [numerator, denominator] = trimmed.split('/');
    return reduce(BigInt(numerator), BigInt(denominator));
  }
  const [whole, decimal = ''] = trimmed.split('.');
  return reduce(BigInt(whole + decimal), 10n ** BigInt(decimal.length));
}

function add(left: Rational, right: Rational): Rational {
  return reduce(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
}

function subtract(left: Rational, right: Rational): Rational {
  return add(left, { ...right, numerator: -right.numerator });
}

function format(value: Rational): string {
  if (value.denominator === 1n) return value.numerator.toString();
  let remainder = value.denominator;
  let twos = 0;
  let fives = 0;
  while (remainder % 2n === 0n) { remainder /= 2n; twos += 1; }
  while (remainder % 5n === 0n) { remainder /= 5n; fives += 1; }
  if (remainder !== 1n) return `${value.numerator}/${value.denominator}`;
  const places = Math.max(twos, fives);
  const scaled = value.numerator * (10n ** BigInt(places)) / value.denominator;
  const digits = scaled.toString().padStart(places + 1, '0');
  return `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/0+$/, '').replace(/\.$/, '');
}

function totalForGroup(group: string, ingredients: RecipeEdit['ingredients'], foods: Food[], excludedIndex = -1): Rational {
  return ingredients.reduce((total, ingredient, index) => {
    if (index === excludedIndex || ingredient.group !== group || ingredient.isFreeConsumption) return total;
    const food = foods.find((item) => item.id === ingredient.foodId);
    const quantity = parse(ingredient.quantity);
    const base = parse(food?.baseQuantity ?? null);
    if (!food || ingredient.unit !== food.unit || !quantity || !base || base.numerator <= 0n) return total;
    return add(total, reduce(quantity.numerator * base.denominator, quantity.denominator * base.numerator));
  }, zero);
}

export function defaultIngredientQuantity(food: Food, meals: Meal[], ingredients: RecipeEdit['ingredients'], index: number, foods: Food[]): string | null {
  if (food.isFreeConsumption) return null;
  const base = parse(food.baseQuantity);
  if (!base || base.numerator <= 0n) return null;
  const target = parse(meals.find((meal) => meal.group === food.group && meal.requirementKind !== 'free_guidance')?.equivalents ?? null);
  if (!target) return food.baseQuantity;
  const remaining = subtract(target, totalForGroup(food.group, ingredients, foods, index));
  return remaining.numerator > 0n
    ? format(reduce(base.numerator * remaining.numerator, base.denominator * remaining.denominator))
    : food.baseQuantity;
}

export function prescriptionAlerts(meals: Meal[], ingredients: RecipeEdit['ingredients'], foods: Food[]): string[] {
  const groups = new Set([...meals.filter((meal) => meal.requirementKind !== 'free_guidance').map((meal) => meal.group), ...ingredients.filter((ingredient) => !ingredient.isFreeConsumption && ingredient.foodId).map((ingredient) => ingredient.group)]);
  const labels: Record<string, string> = { Proteinas: 'Proteínas', Lacteos: 'Lácteos', Azucar: 'Azúcar' };
  return [...groups].flatMap((group) => {
    const target = parse(meals.find((meal) => meal.group === group && meal.requirementKind !== 'free_guidance')?.equivalents ?? '0') ?? zero;
    const total = totalForGroup(group, ingredients, foods);
    const delta = subtract(target, total);
    if (delta.numerator === 0n) return [];
    return [delta.numerator > 0n
      ? `${labels[group] ?? group}: faltan ${format(delta)} porciones adicionales (${format(total)} de ${format(target)}).`
      : `${labels[group] ?? group}: demasiado; excede ${format({ ...delta, numerator: -delta.numerator })} porciones (${format(total)} de ${format(target)}).`];
  });
}