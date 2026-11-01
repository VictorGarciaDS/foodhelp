import { describe, expect, it } from 'vitest';
import { planInheritance, type InheritedIngredient } from './inheritance';

const exact = (group: string, equivalents: string) => ({ group, equivalents, requirementKind: 'exact' });
const beans: InheritedIngredient = { foodId: 'beans', quantity: '1/2', unit: 'tazas', group: 'Cereales y leguminosas', isFreeConsumption: false };
const peach: InheritedIngredient = { foodId: 'peach', quantity: '4', unit: 'piezas', group: 'Frutas', isFreeConsumption: false };
const lettuce: InheritedIngredient = { foodId: 'lettuce', quantity: '1', unit: 'tazas', group: 'Verduras', isFreeConsumption: true };

describe('recipe inheritance between profiles', () => {
  it('copies unchanged when groups and portions match', () => {
    const rows = [exact('Cereales y leguminosas', '1'), exact('Frutas', '2')];
    const plan = planInheritance(rows, rows, [beans, peach, lettuce]);
    expect(plan.mode).toBe('identical');
    expect(plan.ingredients).toEqual([beans, peach, lettuce]);
    expect(plan.notes).toEqual([]);
  });

  it('scales each group proportionally when only portions differ', () => {
    const plan = planInheritance(
      [exact('Cereales y leguminosas', '1'), exact('Frutas', '2')],
      [exact('Cereales y leguminosas', '2'), exact('Frutas', '1')],
      [beans, peach, lettuce],
    );
    expect(plan.mode).toBe('proportional');
    expect(plan.ingredients.map((item) => item.quantity)).toEqual(['1', '2', '1']);
    expect(plan.notes).toEqual([]);
  });

  it('adjusts shared groups and reports differences when prescriptions differ', () => {
    const plan = planInheritance(
      [exact('Cereales y leguminosas', '1'), exact('Frutas', '2')],
      [exact('Cereales y leguminosas', '3'), exact('Proteinas', '2')],
      [beans, peach],
    );
    expect(plan.mode).toBe('different');
    expect(plan.ingredients.map((item) => item.quantity)).toEqual(['3/2', '4']);
    expect(plan.notes).toEqual([
      'El perfil no tiene porciones de Frutas; ajusta o quita esos ingredientes.',
      'Añade 2 porción(es) de Proteínas.',
    ]);
  });

  it('marks a recipe for review when the profile has no rows for that meal', () => {
    const plan = planInheritance([exact('Frutas', '2')], [], [peach]);
    expect(plan.mode).toBe('different');
    expect(plan.ingredients).toEqual([peach]);
  });
});
