import { equivalentFraction, multiplyAmounts, rationallyEqual } from '../equivalents/exact';

export type PrescriptionRow = { group: string; equivalents: string; requirementKind: string };
export type InheritedIngredient = { foodId: string; quantity: string | null; unit: string | null; group: string; isFreeConsumption: boolean };
export type InheritanceMode = 'identical' | 'proportional' | 'different';

const groupLabel = (group: string) => ({ Proteinas: 'Proteínas', Azucar: 'Azúcar', Lacteos: 'Lácteos' }[group] ?? group);

function exactGroups(rows: PrescriptionRow[]): Map<string, string> {
  return new Map(rows
    .filter((row) => row.requirementKind !== 'free_guidance' && !rationallyEqual(row.equivalents, '0'))
    .map((row) => [row.group, row.equivalents]));
}

function freeGroups(rows: PrescriptionRow[]): Set<string> {
  return new Set(rows.filter((row) => row.requirementKind === 'free_guidance').map((row) => row.group));
}

function ratio(target: string, base: string): string {
  const value = equivalentFraction(target, base);
  return value.denominator === '1' ? value.numerator : `${value.numerator}/${value.denominator}`;
}

export function planInheritance<T extends InheritedIngredient>(baseRows: PrescriptionRow[], targetRows: PrescriptionRow[], ingredients: T[]) {
  const base = exactGroups(baseRows);
  const target = exactGroups(targetRows);
  const baseFree = freeGroups(baseRows);
  const targetFree = freeGroups(targetRows);
  const sameGroups = base.size === target.size && [...base.keys()].every((group) => target.has(group));
  const sameFree = baseFree.size === targetFree.size && [...baseFree].every((group) => targetFree.has(group));
  const sameAmounts = sameGroups && [...base].every(([group, amount]) => rationallyEqual(amount, target.get(group)!));
  const mode: InheritanceMode = !targetRows.length || !sameGroups || !sameFree ? 'different' : sameAmounts ? 'identical' : 'proportional';

  const notes: string[] = [];
  if (!targetRows.length) notes.push('Este perfil no tiene prescripción para este tiempo de comida; revisa la receta completa.');
  for (const group of base.keys()) {
    if (targetRows.length && !target.has(group)) notes.push(`El perfil no tiene porciones de ${groupLabel(group)}; ajusta o quita esos ingredientes.`);
  }
  for (const [group, amount] of target) {
    if (!base.has(group)) notes.push(`Añade ${amount} porción(es) de ${groupLabel(group)}.`);
  }
  for (const group of targetFree) {
    if (!baseFree.has(group)) notes.push(`La prescripción indica ${groupLabel(group)} libres; agrégalas si hace falta.`);
  }

  const adjusted = ingredients.map((ingredient) => {
    const baseAmount = base.get(ingredient.group);
    const targetAmount = target.get(ingredient.group);
    if (ingredient.isFreeConsumption || !ingredient.quantity || !baseAmount || !targetAmount || rationallyEqual(baseAmount, targetAmount)) return ingredient;
    return { ...ingredient, quantity: multiplyAmounts(ingredient.quantity, ratio(targetAmount, baseAmount)) };
  });

  return { mode, ingredients: adjusted, notes };
}
