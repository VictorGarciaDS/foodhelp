const origin = process.env.FOODHELP_API_ORIGIN || 'http://localhost:3000';
const recipes = [
  {
    name: 'Avena con Ades, nueces y crema de cacahuate', mealTime: 'Desayuno',
    ingredients: [
      ['Avena cruda', '1/4', 'tazas'], ['Leche Ades sin azúcar', '1', 'taza'],
      ['Nueces', '4', 'piezas'], ['Crema de cacahuate', '1', 'cucharadas'],
    ],
    instructions: ['Cocer la avena con agua hasta que quede suave.', 'Servir con la leche Ades, las nueces y la crema de cacahuate.'],
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Granola_oatmeal_with_soymilk_flickr_user_daisybush.jpg',
    imageAttribution: 'https://commons.wikimedia.org/wiki/File:Granola_oatmeal_with_soymilk_flickr_user_daisybush.jpg',
    imageLicense: 'daisybush · CC BY 2.0',
  },
  {
    name: 'Pan tostado con crema de cacahuate y Ades', mealTime: 'Desayuno',
    ingredients: [
      ['Pan de caja chico', '1', 'rebanada'], ['Crema de cacahuate', '2', 'cucharadas'], ['Leche Ades sin azúcar', '1', 'taza'],
    ],
    instructions: ['Tostar el pan.', 'Untar la crema de cacahuate y acompañar con la leche Ades.'],
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Peanutbutterontoast.JPG',
    imageAttribution: 'https://commons.wikimedia.org/wiki/File:Peanutbutterontoast.JPG',
    imageLicense: "DO'Neil · CC BY-SA 3.0",
  },
  {
    name: 'Sándwich de atún con aguacate y Ades', mealTime: 'Cena',
    ingredients: [
      ['Atún fresco', '80', 'g'], ['Pan de caja chico', '1', 'rebanada'], ['Aguacate', '1/3', 'piezas'],
      ['Leche Ades sin azúcar', '1', 'taza'], ['Lechuga', '1/2', 'tazas'], ['Jitomate', '1/4', 'tazas'],
    ],
    instructions: ['Desmenuzar el atún y colocarlo sobre el pan.', 'Añadir lechuga, jitomate y aguacate; acompañar con la leche Ades.'],
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Tuna_salad_sandwich.jpg',
    imageAttribution: 'https://commons.wikimedia.org/wiki/File:Tuna_salad_sandwich.jpg',
    imageLicense: 'jeffreyw · CC BY 2.0',
  },
  {
    name: 'Tostada de huevo con aguacate y Ades', mealTime: 'Cena',
    ingredients: [
      ['Huevo entero', '2', 'piezas'], ['Pan de caja chico', '1', 'rebanada'],
      ['Aguacate', '1/3', 'piezas'], ['Leche Ades sin azúcar', '1', 'taza'],
    ],
    instructions: ['Cocinar los huevos en un sartén antiadherente sin aceite adicional.', 'Servir sobre el pan tostado con aguacate y acompañar con la leche Ades.'],
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/4/4e/Fresh_Avocado_Toast_with_Egg.jpg',
    imageAttribution: 'https://commons.wikimedia.org/wiki/File:Fresh_Avocado_Toast_with_Egg.jpg',
    imageLicense: 'Asramsey · CC BY-SA 4.0',
  },
];

async function request(path) {
  const response = await fetch(`${origin}/api${path}`);
  if (!response.ok) throw new Error(`GET ${path} failed with HTTP ${response.status}.`);
  return response.json();
}

async function createRecipe(recipe, person, foods) {
  const ingredients = recipe.ingredients.map(([name, quantity, unit]) => {
    const food = foods.get(name);
    if (!food) throw new Error(`Missing food: ${name}`);
    return { foodId: food.id, quantity, unit, group: food.group, isFreeConsumption: food.isFreeConsumption };
  });
  const body = {
    personId: person.id,
    name: recipe.name,
    mealTime: recipe.mealTime,
    sourceText: `Receta familiar ajustada a las equivalencias revisadas de octubre de 2026. La imagen es ilustrativa; sus ingredientes visuales no se agregan a la receta.`,
    reviewNotes: [],
    instructions: recipe.instructions,
    ingredients,
    verify: true,
    imageUrl: recipe.imageUrl,
    imageAttribution: recipe.imageAttribution,
    imageLicense: recipe.imageLicense,
  };
  const response = await fetch(`${origin}/api/recipes`, {
    method: 'POST',
    headers: { origin, 'x-foodhelp-request': '1', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`Recipe ${recipe.name} failed with HTTP ${response.status}.`);
  return result.recipe;
}

async function main() {
  const [people, foodsResponse, recipeResponse] = await Promise.all([
    request('/people'), request('/foods'), request('/recipes'),
  ]);
  const person = people.people.length === 1 ? people.people[0] : people.people.find((item) => item.name === 'Patricia Sánchez Hernández');
  if (!person) throw new Error('Select exactly one recipe profile before import.');
  const foods = new Map(foodsResponse.items.map((food) => [food.name, food]));
  const existing = new Set(recipeResponse.items.filter((recipe) => recipe.personId === person.id).map((recipe) => `${recipe.mealTime}\u0000${recipe.name.toLocaleLowerCase('es')}`));
  const added = [];
  const skipped = [];
  for (const recipe of recipes) {
    const key = `${recipe.mealTime}\u0000${recipe.name.toLocaleLowerCase('es')}`;
    if (existing.has(key)) { skipped.push(recipe.name); continue; }
    const saved = await createRecipe(recipe, person, foods);
    added.push({ name: saved.name, mealTime: saved.mealTime, verified: Boolean(saved.verifiedAt), image: Boolean(saved.imageUrl) });
  }
  console.log(JSON.stringify({ added, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});