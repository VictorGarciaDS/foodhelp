const origin = process.env.FOODHELP_API_ORIGIN || 'http://localhost:3000';
const apply = process.argv.includes('--apply');
const measurementNote = 'Las cantidades domésticas de verduras y condimentos libres se estimaron solo para compras; no cuentan como equivalencias.';

function normalize(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

function canonicalUnit(value) {
  const normalized = normalize(value);
  const units = {
    pieza: 'piezas', piezas: 'piezas',
    taza: 'tazas', tazas: 'tazas',
    cucharada: 'cucharadas', cucharadas: 'cucharadas',
    cucharadita: 'cucharaditas', cucharaditas: 'cucharaditas',
    diente: 'dientes', dientes: 'dientes',
  };
  return units[normalized] ?? value.trim();
}

function measurementFor(foodName, recipeName = '') {
  const name = normalize(foodName);
  const recipe = normalize(recipeName);
  if (name === 'calabacita') return { quantity: /rellen|lasana/.test(recipe) ? '1' : '1/2', unit: 'piezas' };
  if (name === 'chayote') return { quantity: '1', unit: 'piezas' };
  if (name === 'cebolla') return { quantity: '4', unit: 'cucharadas' };
  if (name === 'ajo') return { quantity: '1', unit: 'dientes' };
  if (name === 'chile (todo tipo)') return { quantity: '1/2', unit: 'piezas' };
  if (name === 'chile poblano') return { quantity: '1', unit: 'piezas' };
  if (name === 'chile (todo tipo)' || name === 'chiles secos') return { quantity: '1/2', unit: 'piezas' };
  if (name === 'cilantro' || name === 'perejil') return { quantity: '1', unit: 'cucharadas' };
  if (name === 'especias' || name === 'pimienta' || name === 'canela' || name === 'comino') return { quantity: '1', unit: 'cucharaditas' };
  if (name === 'vinagre' || name === 'salsa inglesa' || name === 'salsa picante' || name.includes('salsa de soya')) return { quantity: '1', unit: 'cucharadas' };
  if (name.includes('salsa') || name.includes('pure de tomate')) return { quantity: '1/4', unit: 'tazas' };
  if (name === 'cebolla') return { quantity: '1/4', unit: 'tazas' };
  if (name === 'lechuga' || name === 'col' || name === 'espinaca' || name === 'acelga' || name === 'arugula' || name === 'berros' || name === 'kale') return { quantity: '1', unit: 'tazas' };
  if (name.includes('verdura') || name === 'alga' || name === 'nopal') return { quantity: '1', unit: 'tazas' };
  if (name === 'jitomate' || name === 'tomate' || name === 'tomatillo') return { quantity: '1/2', unit: 'tazas' };
  if (name === 'zanahoria' || name === 'calabacita' || name === 'chayote' || name === 'champiñon' || name === 'champiñones' || name === 'brocoli' || name === 'coliflor' || name === 'flor de calabaza' || name === 'pimiento' || name === 'jicama' || name === 'pepino' || name === 'berenjena') return { quantity: '1/2', unit: 'tazas' };
  if (name === 'limon') return { quantity: '1', unit: 'piezas' };
  return { quantity: '1/2', unit: 'tazas' };
}

function normalizedIngredient(ingredient, foodName, recipeName) {
  const name = normalize(foodName);
  const target = measurementFor(foodName, recipeName);
  if (ingredient.quantity === null || ingredient.unit === null) return { ...ingredient, ...target };
  const unit = canonicalUnit(ingredient.unit);
  if (name === 'cebolla' && unit === 'tazas') {
    const tablespoons = { '1/4': '4', '1/2': '8', '3/4': '12', '1': '16' }[ingredient.quantity];
    if (!tablespoons) throw new Error(`No hay conversión doméstica exacta para ${ingredient.quantity} tazas de cebolla.`);
    return { ...ingredient, quantity: tablespoons, unit: 'cucharadas' };
  }
  if (['calabacita', 'chayote', 'ajo', 'chile (todo tipo)', 'chile poblano'].includes(name)) {
    return { ...ingredient, ...target };
  }
  return { ...ingredient, unit };
}

async function request(path, method = 'GET', body) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { origin, 'x-foodhelp-request': '1', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${response.status}.`);
  return payload;
}

async function main() {
  const [recipeList, foodList] = await Promise.all([request('/recipes'), request('/foods')]);
  const foods = new Map(foodList.items.map((food) => [food.id, food.name]));
  const changes = [];

  for (const summary of recipeList.items) {
    const { recipe } = await request(`/recipes/${summary.id}`);
    let updatedIngredients = 0;
    const ingredients = recipe.ingredients.map((ingredient) => {
      if (!ingredient.isFreeConsumption) return ingredient;
      const name = foods.get(ingredient.foodId);
      if (!name) throw new Error(`Food missing for recipe ${recipe.name}.`);
      const normalized = normalizedIngredient(ingredient, name, recipe.name);
      if (normalized.quantity === ingredient.quantity && normalized.unit === ingredient.unit) return ingredient;
      updatedIngredients += 1;
      return normalized;
    });
    if (updatedIngredients) changes.push({ recipe, ingredients, updatedIngredients });
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    recipesToUpdate: changes.length,
    ingredientsToMeasureOrNormalize: changes.reduce((total, item) => total + item.updatedIngredients, 0),
    verifiedRecipes: changes.filter((item) => Boolean(item.recipe.verifiedAt)).length,
    draftsPreserved: changes.filter((item) => !item.recipe.verifiedAt).length,
    samples: changes.slice(0, 8).map((item) => item.recipe.name),
  }, null, 2));
  if (!apply) return;

  for (const change of changes) {
    const { recipe, ingredients } = change;
    const sourceText = recipe.sourceText?.includes(measurementNote)
      ? recipe.sourceText
      : [recipe.sourceText, measurementNote].filter(Boolean).join('\n');
    await request(`/recipes/${recipe.id}`, 'PUT', {
      personId: recipe.personId,
      name: recipe.name,
      mealTime: recipe.mealTime,
      sourceText,
      reviewNotes: recipe.reviewNotes,
      instructions: recipe.instructions,
      ingredients,
      verify: Boolean(recipe.verifiedAt) && recipe.reviewNotes.length === 0,
    });
  }
  console.log(JSON.stringify({ result: 'complete', recipesUpdated: changes.length }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});