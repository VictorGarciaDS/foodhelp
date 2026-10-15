const origin = process.env.FOODHELP_API_ORIGIN || 'http://localhost:3000';
const apply = process.argv.includes('--apply');

const portion = (food, quantity, unit) => ({ food, quantity, unit });
const free = (...foods) => foods.map((food) => ({ food, quantity: null, unit: null }));
const recipes = [];
const add = (name, mealTime, ingredients, reviewNotes = [], adjustment = '') => recipes.push({ name, mealTime, ingredients, reviewNotes, adjustment });
const A = 'Almuerzo';
const C = 'Comida';
const fruit = () => portion('Fruta de temporada', '2', 'piezas');
const oil = () => portion('Aceite de oliva', '1', 'cucharaditas');

add('Omelette de espinacas con queso', A, [portion('Huevo entero', '2', 'piezas'), portion('Queso panela light', '40', 'g'), ...free('Espinaca'), portion('Tortilla de maíz', '2', 'piezas'), oil(), fruit()]);
add('Tacos dorados de zanahoria con queso', A, [portion('Queso panela light', '120', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Zanahoria', 'Lechuga'), oil(), fruit()]);
add('Enchiladas de pollo', A, [portion('Pechuga de pollo', '90', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Salsa verde o roja', 'Lechuga', 'Cebolla'), oil(), fruit()]);
add('Enchiladas con picadillo de verdura', A, [portion('Queso panela light', '120', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Zanahoria', 'Calabacita', 'Champiñón', 'Puré de tomate'), oil(), fruit()]);
add('Chilaquiles con totopos de nopal', A, [portion('Totopos de nopal', '2', 'tazón'), portion('Pechuga de pollo', '90', 'g'), ...free('Salsa verde o roja', 'Cebolla', 'Cilantro', 'Lechuga'), oil(), fruit()]);
add('Tacos de pollo con salsa', A, [portion('Pechuga de pollo', '90', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Salsa verde o roja', 'Cebolla', 'Cilantro'), portion('Aguacate', '1/3', 'piezas'), fruit()]);
add('Tostadas de tinga con col', A, [portion('Pechuga de pollo', '90', 'g'), portion('Tostadas horneadas', '3', 'piezas'), ...free('Col', 'Jitomate', 'Cebolla'), portion('Aguacate', '1/3', 'piezas'), fruit()]);
add('Caldo de pollo con arroz', A, [portion('Pechuga de pollo', '90', 'g'), portion('Arroz blanco', '1/2', 'tazas'), ...free('Chayote', 'Zanahoria', 'Calabacita'), oil(), fruit()]);
add('Burrito de pollo con frijoles', A, [portion('Pechuga de pollo', '90', 'g'), portion('Tortillas de harina blanca', '1/2', 'piezas'), portion('Frijoles de la olla', '1/2', 'tazas'), ...free('Lechuga', 'Jitomate', 'Cebolla'), portion('Aguacate', '1/3', 'piezas'), fruit()], ['Pendiente: confirmar el tamaño de la tortilla de harina que compran. Se usa 1/2 pieza según el catálogo; queda sin verificar hasta confirmar que corresponde.']);
add('Quesadillas de flor de calabaza con queso', A, [portion('Queso panela light', '120', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Flor de calabaza', 'Cebolla'), oil(), fruit()]);
add('Bistec con 2 quesadillas', A, [portion('Bistec de res', '30', 'g'), portion('Queso panela light', '80', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Nopal'), oil(), fruit()]);
add('Sopes con base de nopal (Almuerzo)', A, [portion('Carne molida sin grasa', '90', 'g'), ...free('Nopal', 'Lechuga', 'Jitomate', 'Cebolla', 'Salsa verde o roja')], ['Pendiente: confirmar qué cereal acompaña la base de nopal para completar los 2 equivalentes de cereales.']);
add('Calabacitas rellenas de elote, queso y carne', A, [portion('Carne molida sin grasa', '60', 'g'), portion('Queso panela light', '40', 'g'), portion('Elote desgranado', '1/2', 'tazas'), portion('Tortilla de maíz', '1', 'piezas'), ...free('Calabacita', 'Jitomate', 'Cebolla'), oil(), fruit()]);
add('Salmas con picadillo', A, [portion('Salmas', '2', 'paquete'), portion('Carne molida sin grasa', '90', 'g'), ...free('Jitomate', 'Cebolla', 'Zanahoria', 'Calabacita'), oil(), fruit()]);
add('Chiles rellenos: opción de queso', A, [portion('Queso panela light', '120', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Chile poblano', 'Jitomate', 'Cebolla'), oil(), fruit()]);
add('Chiles rellenos: opción de carne, queso y elote', A, [portion('Carne molida sin grasa', '30', 'g'), portion('Queso panela light', '80', 'g'), portion('Elote desgranado', '1/2', 'tazas'), portion('Tortilla de maíz', '1', 'piezas'), ...free('Chile poblano', 'Jitomate', 'Cebolla'), oil(), fruit()]);
add('Tostadas de calabacitas poblanas', A, [portion('Queso panela light', '120', 'g'), portion('Tostadas horneadas', '3', 'piezas'), ...free('Calabacita', 'Chile poblano', 'Cebolla'), oil(), fruit()]);
add('Tacos de pollo con rajas', A, [portion('Pechuga de pollo', '90', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Chile poblano', 'Cebolla'), portion('Aguacate', '1/3', 'piezas'), fruit()]);
add('Tacos de bistec con pico de gallo', A, [portion('Bistec de res', '90', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Jitomate', 'Cebolla', 'Cilantro'), portion('Aguacate', '1/3', 'piezas'), fruit()]);
add('Caldo tlalpeño (Almuerzo)', A, [portion('Pechuga de pollo', '90', 'g'), portion('Garbanzos cocidos', '1/2', 'tazas'), portion('Arroz blanco', '1/4', 'tazas'), ...free('Zanahoria', 'Calabacita', 'Jitomate', 'Cebolla', 'Chile (todo tipo)'), oil(), fruit()]);

add('Albóndigas', C, [portion('Carne molida sin grasa', '150', 'g'), portion('Arroz blanco', '1/2', 'tazas'), ...free('Jitomate', 'Zanahoria', 'Calabacita', 'Chayote'), oil()]);
add('Mole de olla', C, [portion('Bistec de res', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Calabacita', 'Chayote', 'Zanahoria', 'Jitomate', 'Chile (todo tipo)', 'Ajo'), oil()]);
add('Pollo encacahuatado', C, [portion('Pechuga de pollo', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), portion('Cacahuates naturales', '7', 'piezas'), ...free('Jitomate', 'Chile (todo tipo)', 'Ajo')], ['Pendiente: confirmar que la salsa no lleva grasa adicional; los cacahuates ya aportan 1 equivalente de grasa.']);
add('Pollo en pipián', C, [portion('Pechuga de pollo', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), portion('Semillas de calabaza', '2', 'cucharadas'), ...free('Tomatillo', 'Chile (todo tipo)', 'Especias')]);
add('Pollo almendrado', C, [portion('Pechuga de pollo', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), portion('Almendras', '5', 'piezas'), ...free('Jitomate', 'Cebolla', 'Especias')], ['Pendiente: confirmar que la salsa no lleva grasa adicional; las almendras ya aportan 1 equivalente de grasa.']);
add('Pollo con rajas', C, [portion('Pechuga de pollo', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Chile poblano', 'Cebolla'), oil()]);
add('Bistec a la mexicana con quesadillas', C, [portion('Bistec de res', '90', 'g'), portion('Queso panela light', '80', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Jitomate', 'Cebolla', 'Chile (todo tipo)'), oil()]);
add('Calabacitas rellenas en chile rojo', C, [portion('Carne molida sin grasa', '150', 'g'), portion('Arroz blanco', '1/2', 'tazas'), ...free('Calabacita', 'Jitomate', 'Chile (todo tipo)'), oil()]);
add('Calabacitas rellenas en caldo de chile poblano', C, [portion('Tortilla de maíz', '2', 'piezas'), ...free('Calabacita', 'Chile poblano')], ['Pendiente: confirmar si el relleno lleva carne, queso o ambos y especificar el caldo.']);
add('Bowl de salmón y verduras', C, [portion('Salmón', '120', 'g'), portion('Queso panela light', '40', 'g'), portion('Surimi', '1', 'barra'), portion('Arroz blanco', '1/2', 'tazas'), ...free('Lechuga', 'Brócoli', 'Otras verduras'), oil()]);
add('Tostadas de tinga', C, [portion('Pechuga de pollo', '150', 'g'), portion('Tostadas horneadas', '3', 'piezas'), ...free('Col', 'Jitomate', 'Cebolla'), portion('Aguacate', '1/3', 'piezas')]);
add('Chiles rellenos de queso', C, [portion('Queso panela light', '200', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Chile poblano', 'Jitomate', 'Cebolla'), oil()]);
add('Mixiotes rojos', C, [portion('Carne molida sin grasa', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Chiles secos', 'Especias', 'Nopal'), oil()]);
add('Mixiotes verdes', C, [portion('Carne molida sin grasa', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Tomatillo', 'Chile (todo tipo)', 'Cilantro', 'Nopal'), oil()]);
add('Chiles rellenos de carne molida', C, [portion('Carne molida sin grasa', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Chile poblano', 'Jitomate', 'Cebolla'), oil()]);
add('Chiles tipo en nogada', C, free('Chile poblano'), ['Pendiente: faltan cantidades de carne, fruta, nuez y lácteo de la nogada; no se verifica hasta recibir la receta familiar.']);
add('Sopes con base de nopal (Comida)', C, [portion('Carne molida sin grasa', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Nopal', 'Lechuga', 'Jitomate', 'Salsa verde o roja'), oil()]);
add('Tortitas de queso, huevo, avena y brócoli', C, [portion('Queso panela light', '160', 'g'), portion('Huevo entero', '1', 'piezas'), portion('Avena cruda', '1/2', 'tazas'), ...free('Brócoli'), oil()], [], 'Se consolidó con la variante repetida de tortitas de brócoli, queso, huevo y avena; 160 g de queso más 1 huevo completan 5 proteínas.');
add('Tortitas de huevo, avena y zanahoria', C, [portion('Huevo entero', '5', 'piezas'), portion('Avena cruda', '1/2', 'tazas'), ...free('Zanahoria'), oil()]);
add('Tortitas de atún con verduras', C, [portion('Atún fresco', '160', 'g'), portion('Avena cruda', '1/2', 'tazas'), portion('Huevo entero', '1', 'piezas'), ...free('Zanahoria', 'Calabacita'), oil()], [], 'Se redujo el atún a 160 g: 4 proteínas de atún más 1 de huevo.');
add('Tortitas de verduras con queso', C, [portion('Queso panela light', '160', 'g'), portion('Avena cruda', '1/2', 'tazas'), portion('Huevo entero', '1', 'piezas'), ...free('Zanahoria', 'Calabacita', 'Brócoli'), oil()], [], 'Se redujo el queso a 160 g: 4 proteínas de queso más 1 de huevo.');
add('Tortitas de avena, zanahoria y calabacita', C, [portion('Huevo entero', '5', 'piezas'), portion('Avena cruda', '1/2', 'tazas'), ...free('Zanahoria', 'Calabacita'), oil()]);
add('Tortitas de queso, avena y brócoli', C, [portion('Queso panela light', '200', 'g'), portion('Avena cruda', '1/2', 'tazas'), ...free('Brócoli'), oil()]);
add('Chayote relleno de queso con jamón', C, [portion('Queso panela light', '160', 'g'), portion('Jamón de pierna', '1', 'rebanadas'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Chayote'), oil()]);
add('Coliflor y brócoli con jamón y queso', C, [portion('Queso panela light', '160', 'g'), portion('Jamón de pierna', '1', 'rebanadas'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Coliflor', 'Brócoli'), oil()]);
add('Tortitas de huauzontle con queso', C, [portion('Queso panela light', '160', 'g'), portion('Huevo entero', '1', 'piezas'), portion('Avena cruda', '1/2', 'tazas'), ...free('Huauzontles'), oil()], [], 'Se redujo el queso a 160 g: 4 proteínas de queso más 1 de huevo.');
add('Crema de verduras', C, [portion('Leche alta en proteína', '5/2', 'taza'), portion('Pan de caja chico', '2', 'rebanada'), ...free('Verduras para crema'), oil()]);
add('Caldo de pollo', C, [portion('Pechuga de pollo', '150', 'g'), portion('Arroz blanco', '1/2', 'tazas'), ...free('Chayote', 'Zanahoria', 'Calabacita'), oil()]);
add('Caldo tlalpeño (Comida)', C, [portion('Pechuga de pollo', '150', 'g'), portion('Garbanzos cocidos', '1/2', 'tazas'), portion('Tortilla de maíz', '1', 'piezas'), ...free('Zanahoria', 'Calabacita', 'Jitomate', 'Cebolla', 'Chile (todo tipo)'), oil()]);
add('Quesadillas de coliflor con queso', C, [portion('Queso panela light', '200', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Coliflor', 'Cebolla'), oil()]);
add('Rollo de carne navideño', C, [portion('Carne molida sin grasa', '150', 'g'), portion('Chícharos', '1/2', 'tazas'), portion('Tortilla de maíz', '1', 'piezas'), ...free('Espinaca', 'Zanahoria', 'Puré de tomate')], ['Borrador: falta la cantidad de tocino; también se redujeron las tortillas a 1 pieza para que chícharos y tortilla sumen 2 cereales. Verificar grasa y proteína cuando se conozca el tocino.']);
add('Sopa de conchita en jitomate con zanahoria', C, [portion('Pasta cocida', '1', 'tazas'), portion('Pechuga de pollo', '150', 'g'), ...free('Zanahoria', 'Jitomate'), oil()]);
add('Hamburguesa de salmón', C, [portion('Salmón', '200', 'g'), portion('Pan de hamburguesa', '2/3', 'piezas'), ...free('Lechuga', 'Jitomate'), oil()]);
add('Pescado empapelado con jamón, queso y guacamole', C, [portion('Pescado blanco', '120', 'g'), portion('Jamón de pierna', '1', 'rebanadas'), portion('Queso panela light', '40', 'g'), portion('Guacamole', '2', 'cucharadas'), ...free('Zanahoria'), portion('Tortilla de maíz', '2', 'piezas')]);
add('Caldo de pescado', C, [portion('Pescado blanco', '200', 'g'), portion('Arroz blanco', '1/2', 'tazas'), ...free('Jitomate', 'Zanahoria', 'Calabacita', 'Cebolla', 'Ajo'), oil()]);
add('Pasta con pescado', C, [portion('Pescado blanco', '200', 'g'), portion('Pasta cocida', '1', 'tazas'), ...free('Jitomate', 'Calabacita'), oil()]);
add('Pescado al mojo de ajo', C, [portion('Pescado blanco', '200', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Ajo', 'Perejil', 'Verduras de acompañamiento'), oil()]);
add('Camarones al mojo de ajo', C, [portion('Camarón', '25', 'piezas'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Ajo', 'Perejil', 'Verduras de acompañamiento'), oil()]);
add('Brochetas de camarones', C, [portion('Camarón', '25', 'piezas'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Pimiento', 'Cebolla', 'Calabacita'), oil()]);
add('Alambre de pollo con morrones, papas, nopales, cebolla y champiñones', C, [portion('Pechuga de pollo', '150', 'g'), portion('Papa mediana', '2', 'piezas'), ...free('Pimiento', 'Nopal', 'Cebolla', 'Champiñón'), oil()]);
add('Alambre de bistec con morrones, nopales, papas, cebolla y champiñones', C, [portion('Bistec de res', '150', 'g'), portion('Papa mediana', '2', 'piezas'), ...free('Pimiento', 'Nopal', 'Cebolla', 'Champiñón'), oil()]);
add('Alambre de pollo con morrones, nopales, cebolla y champiñones', C, [portion('Pechuga de pollo', '150', 'g'), portion('Tortilla de maíz', '2', 'piezas'), ...free('Pimiento', 'Nopal', 'Cebolla', 'Champiñón'), oil()]);
add('Lasaña de calabacita con carne, queso y brócoli', C, [portion('Carne molida sin grasa', '90', 'g'), portion('Queso panela light', '80', 'g'), portion('Frijoles de la olla', '1', 'tazas'), ...free('Calabacita', 'Brócoli', 'Puré de tomate'), oil()], [], 'Se aumentaron los frijoles de 1/2 a 1 taza para completar 2 equivalentes de cereal sin añadir otro ingrediente.');

const newFoods = [
  { name: 'Tostadas horneadas', group: 'Cereales y leguminosas', baseQuantity: '3/2', unit: 'piezas', isFreeConsumption: false, verified: true },
  ...['Chile poblano', 'Tomatillo', 'Verduras para crema', 'Verduras de acompañamiento', 'Otras verduras', 'Huauzontles'].map((name) => ({ name, group: 'Verduras', baseQuantity: null, unit: null, isFreeConsumption: true, verified: true })),
];
const aliases = {
  'Fruta de temporada': 'Durazno',
  'Tortilla de maíz': 'Tortillas de maíz',
};
const semanticDuplicates = [{ mealTime: C, name: 'Pasta con pollo', existingName: 'Pasta con pollo, jitomate y calabacita al ajo' }];

function key(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/[^a-z0-9]+/g, ' ').trim();
}

function fraction(value) {
  const [numerator, denominator = '1'] = String(value).split('/');
  if (numerator.includes('.')) {
    const digits = numerator.split('.')[1].length;
    return reduce(BigInt(numerator.replace('.', '')), 10n ** BigInt(digits));
  }
  return reduce(BigInt(numerator), BigInt(denominator));
}

function reduce(numerator, denominator) {
  const gcd = (left, right) => right === 0n ? left : gcd(right, left % right);
  const divisor = gcd(numerator < 0n ? -numerator : numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function addFractions(left, right) {
  return reduce(left.numerator * right.denominator + right.numerator * left.denominator, left.denominator * right.denominator);
}

function equal(left, right) {
  return left.numerator * right.denominator === right.numerator * left.denominator;
}

async function request(path, method = 'GET', body) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    headers: { origin, 'x-foodhelp-request': '1', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${method} ${path}: ${payload?.error?.message ?? response.status}`);
  return payload;
}

async function main() {
  const people = (await request('/people')).people;
  const personId = process.env.FOODHELP_PERSON_ID || (people.length === 1 ? people[0].id : null);
  const person = people.find((item) => item.id === personId);
  if (!person) throw new Error('Define FOODHELP_PERSON_ID cuando no haya exactamente un perfil.');
  const prescriptions = (await request(`/people/${person.id}/prescriptions`)).prescriptions;
  const latest = prescriptions.filter((item) => item.reviewedAt).sort((left, right) => right.month.localeCompare(left.month))[0];
  if (!latest) throw new Error('El perfil no tiene una prescripción revisada.');
  const foods = (await request('/foods')).items;
  const foodByName = new Map(foods.map((item) => [key(item.name), item]));
  for (const definition of newFoods) {
    if (!foodByName.has(key(definition.name))) foodByName.set(key(definition.name), { ...definition, id: `planned:${definition.name}`, verifiedAt: 'planned' });
  }
  const savedRecipes = (await request('/recipes')).items.filter((item) => item.personId === person.id);
  const savedByKey = new Set(savedRecipes.map((item) => `${item.mealTime}\u0000${key(item.name)}`));
  const skippedSemantic = semanticDuplicates.filter((item) => savedByKey.has(`${item.mealTime}\u0000${key(item.existingName)}`));
  const inputRecipes = recipes;
  const duplicateKeys = new Set();
  for (const recipe of inputRecipes) {
    const recipeKey = `${recipe.mealTime}\u0000${key(recipe.name)}`;
    if (duplicateKeys.has(recipeKey)) throw new Error(`Nombre duplicado dentro de la carga: ${recipe.name} (${recipe.mealTime}).`);
    duplicateKeys.add(recipeKey);
  }

  const resolved = inputRecipes.map((recipe) => {
    const ingredients = recipe.ingredients.map((ingredient) => {
      const food = foodByName.get(key(aliases[ingredient.food] ?? ingredient.food));
      if (!food) throw new Error(`Falta alimento de catálogo: ${ingredient.food} (${recipe.name}).`);
      if (!food.verifiedAt || food.portionPending) throw new Error(`Porción sin verificar: ${ingredient.food} (${recipe.name}).`);
      if (food.isFreeConsumption) return { foodId: food.id, quantity: null, unit: null, group: food.group, isFreeConsumption: true };
      if (ingredient.unit !== food.unit) throw new Error(`Unidad ${ingredient.unit} no coincide con ${food.name}: ${food.unit} (${recipe.name}).`);
      return { foodId: food.id, quantity: ingredient.quantity, unit: ingredient.unit, group: food.group, isFreeConsumption: false };
    });
    const uniqueIngredients = [...new Map(ingredients.map((item) => [item.isFreeConsumption ? `${item.foodId}:free` : `${item.foodId}:${item.unit}:${item.quantity}`, item])).values()];
    return { ...recipe, ingredients: uniqueIngredients };
  });
  const requirements = new Map(latest.meals.filter((meal) => meal.requirementKind !== 'free_guidance').map((meal) => [`${meal.mealTime}\u0000${meal.group}`, fraction(meal.equivalents)]));
  for (const recipe of resolved.filter((item) => !item.reviewNotes.length)) {
    for (const guidance of latest.meals.filter((meal) => meal.mealTime === recipe.mealTime && meal.requirementKind === 'free_guidance')) {
      if (!recipe.ingredients.some((item) => item.group === guidance.group)) throw new Error(`Falta la guía de ${guidance.group}: ${recipe.name}.`);
    }
    const expected = [...requirements.entries()].filter(([requirementKey]) => requirementKey.startsWith(`${recipe.mealTime}\u0000`));
    if (!expected.length) throw new Error(`Sin equivalencias prescritas para ${recipe.name} (${recipe.mealTime}).`);
    for (const [requirementKey, target] of expected) {
      const group = requirementKey.slice(recipe.mealTime.length + 1);
      const items = recipe.ingredients.filter((item) => item.group === group && !item.isFreeConsumption);
      const freeGuidance = latest.meals.some((meal) => meal.mealTime === recipe.mealTime && meal.group === group && meal.requirementKind === 'free_guidance');
      if (!items.length && !freeGuidance) throw new Error(`Falta ${group}: ${recipe.name}.`);
      const actual = items.reduce((total, item) => {
        const food = [...foodByName.values()].find((candidate) => candidate.id === item.foodId);
        const amount = fraction(item.quantity);
        const base = fraction(food.baseQuantity);
        return addFractions(total, reduce(amount.numerator * base.denominator, amount.denominator * base.numerator));
      }, fraction('0'));
      if (!freeGuidance && !equal(actual, target)) throw new Error(`Equivalencias ${group}: ${recipe.name}; esperado ${target.numerator}/${target.denominator}, recibido ${actual.numerator}/${actual.denominator}.`);
    }
    for (const item of recipe.ingredients.filter((ingredient) => !ingredient.isFreeConsumption)) {
      if (!requirements.has(`${recipe.mealTime}\u0000${item.group}`)) throw new Error(`Grupo no prescrito ${item.group}: ${recipe.name}.`);
    }
  }

  const alreadySaved = resolved.filter((recipe) => savedByKey.has(`${recipe.mealTime}\u0000${key(recipe.name)}`));
  const toAdd = resolved.filter((recipe) => !savedByKey.has(`${recipe.mealTime}\u0000${key(recipe.name)}`));
  const summary = {
    mode: apply ? 'apply' : 'dry-run', person: person.name, prescriptionMonth: latest.month,
    suppliedEntries: 65,
    consolidatedOrExisting: 2,
    alreadySaved: alreadySaved.map((recipe) => `${recipe.name} (${recipe.mealTime})`),
    semanticDuplicatesSkipped: skippedSemantic,
    newVerified: toAdd.filter((recipe) => !recipe.reviewNotes.length).length,
    newDrafts: toAdd.filter((recipe) => recipe.reviewNotes.length).length,
    drafts: toAdd.filter((recipe) => recipe.reviewNotes.length).map((recipe) => ({ name: recipe.name, mealTime: recipe.mealTime, notes: recipe.reviewNotes })),
    foodsToCreate: newFoods.filter((food) => !foods.some((saved) => key(saved.name) === key(food.name))).map((food) => food.name),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!apply) return;

  for (const definition of newFoods) {
    if (foodByName.get(key(definition.name)).id.startsWith('planned:')) {
      const result = await request('/foods', 'POST', definition);
      foodByName.set(key(definition.name), result.item);
    }
  }
  const refreshedFoods = (await request('/foods')).items;
  const actualByName = new Map(refreshedFoods.map((item) => [key(item.name), item]));
  let added = 0;
  let drafts = 0;
  for (const recipe of toAdd) {
    const ingredients = recipe.ingredients.map((ingredient) => {
      const plannedName = ingredient.foodId.startsWith('planned:') ? ingredient.foodId.slice('planned:'.length) : null;
      const plannedFood = plannedName ? null : [...foodByName.values()].find((item) => item.id === ingredient.foodId);
      const storedFood = actualByName.get(key(plannedName ?? plannedFood.name));
      return { ...ingredient, foodId: storedFood.id, group: storedFood.group, isFreeConsumption: storedFood.isFreeConsumption };
    });
    await request('/recipes', 'POST', {
      personId: person.id, name: recipe.name, mealTime: recipe.mealTime,
      sourceText: `Ingredientes proporcionados por la familia; cantidades ajustadas a la prescripción revisada de ${latest.month}.${recipe.adjustment ? ` Ajuste: ${recipe.adjustment}` : ''}${recipe.ingredients.some((item) => item.group === 'Frutas') ? ' La fruta de temporada se representa con 2 duraznos del catálogo.' : ''}${recipe.ingredients.some((item) => item.foodId === foodByName.get(key('Tostadas horneadas'))?.id) ? ' Las 3 tostadas indicadas se usan como 2 equivalentes de cereal.' : ''} Las verduras libres sin medida física se sumarán como porciones de receta en compras.`,
      reviewNotes: recipe.reviewNotes,
      instructions: ['Preparar con el método habitual de la familia y servir las cantidades indicadas.'],
      ingredients, verify: recipe.reviewNotes.length === 0,
    });
    added += 1;
    if (recipe.reviewNotes.length) drafts += 1;
  }
  console.log(JSON.stringify({ result: 'import complete', added, verified: added - drafts, drafts, skippedExisting: alreadySaved.length + skippedSemantic.length }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});