const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparationFor } = require('./recipe-preparations.cjs');

function prepare(name, entries) {
  const ingredients = entries.map(([name, group], index) => ({ foodId: String(index), name, group, quantity: '1', unit: 'piezas' }));
  const before = JSON.stringify(ingredients);
  const result = preparationFor({ name, ingredients }, new Map());
  assert.equal(JSON.stringify(ingredients), before);
  return result;
}

test('keeps fruit separate and last for a savory recipe', () => {
  const result = prepare('Bistec con 2 quesadillas', [['Bistec de res', 'Proteinas'], ['Queso panela light', 'Proteinas'], ['Tortillas de maiz', 'Cereales y leguminosas'], ['Durazno', 'Frutas']]);
  assert.ok(result.instructions.at(-1).startsWith('Acompanar con Durazno'));
  assert.ok(result.instructions.slice(0, -1).every((step) => !step.includes('Durazno')));
  assert.ok(result.sources.length > 0);
});

test('does not invent ingredients or verification for incomplete nogada', () => {
  const result = prepare('Chiles tipo en nogada', [['Chile poblano', 'Verduras']]);
  assert.ok(result.blocked);
  assert.equal(result.instructions, undefined);
});

test('cooks fresh tuna instead of treating it as canned', () => {
  const result = prepare('Sandwich de atun', [['Atun fresco', 'Proteinas'], ['Pan de caja chico', 'Cereales y leguminosas'], ['Lechuga', 'Verduras']]);
  assert.ok(result.instructions.some((step) => step.includes('63 C')));
});

test('does not add eggs to egg-free patties', () => {
  const result = prepare('Tortitas de queso, avena y brocoli', [['Queso panela light', 'Proteinas'], ['Avena cruda', 'Cereales y leguminosas'], ['Brocoli', 'Verduras']]);
  assert.ok(result.instructions.some((step) => step.includes('sin huevo')));
  assert.ok(result.instructions.every((step) => !step.includes('Huauzontle')));
});

test('warns when recipe name mentions unlisted jam', () => {
  const result = prepare('Pan de centeno con crema de cacahuate y mermelada', [['Pan de centeno Oroweat', 'Cereales y leguminosas'], ['Crema de cacahuate', 'Grasas'], ['Leche Ades sin azucar', 'Lacteos']]);
  assert.ok(result.instructions.some((step) => step.includes('no agregarla')));
});

test('allows fruit inside a complete nogada while retaining its draft warning', () => {
  const result = prepare('Chiles tipo en nogada', [['Chile poblano', 'Verduras'], ['Carne molida sin grasa', 'Proteinas'], ['Queso cottage', 'Proteinas'], ['Nueces', 'Grasas'], ['Manzana', 'Frutas'], ['Pera', 'Frutas'], ['Durazno', 'Frutas'], ['Cebolla', 'Verduras'], ['Jitomate', 'Verduras']]);
  assert.ok(result.instructions.some((step) => step.includes('Manzana, Pera, Durazno')));
  assert.ok(result.instructions.some((step) => step.includes('pendiente de autorizacion nutricional')));
});