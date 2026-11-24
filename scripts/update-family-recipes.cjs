const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { sumAmounts, multiplyAmounts } = require('../services/foodhelp-api/dist/domain/equivalents/exact');
const { mergeRecipeIngredients } = require('../services/foodhelp-api/dist/domain/recipes/ingredients');
const origin = process.env.FOODHELP_API_ORIGIN || 'http://localhost:3003';

async function request(route, method = 'GET', body) {
  const response = await fetch(`${origin}/api${route}`, {
    method, headers: { origin, 'x-foodhelp-request': '1', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${route}: ${result.error?.message ?? response.status}`);
  return result;
}

async function main() {
  const foods = (await request('/foods')).items;
  const food = (name) => {
    const found = foods.find((item) => item.name === name);
    if (!found) throw new Error(`Alimento no encontrado: ${name}`);
    return found;
  };
  const ingredient = (name, quantity, unit) => {
    const item = food(name);
    return { foodId: item.id, quantity, unit: unit ?? item.unit, group: item.group, isFreeConsumption: item.isFreeConsumption };
  };
  const portion = (name, factor) => ingredient(name, multiplyAmounts(food(name).baseQuantity, factor));
  const summaries = (await request('/recipes')).items;
  const recipes = [];
  for (const summary of summaries) recipes.push((await request(`/recipes/${summary.id}`)).recipe);
  const backup = path.join(os.tmpdir(), `foodhelp-recipes-before-nov24-${Date.now()}.json`);
  await fs.writeFile(backup, JSON.stringify(recipes, null, 2), { mode: 0o600 });
  console.log(`Backup: ${backup}`);
  let updated = 0;
  let consolidated = 0;
  for (const recipe of recipes.sort((left, right) => Number(left.personId !== null) - Number(right.personId !== null))) {
    const ingredients = mergeRecipeIngredients(recipe.ingredients);
    const before = JSON.stringify(recipe.ingredients);
    if (ingredients.length < recipe.ingredients.length) consolidated += 1;
    const edit = { ...recipe, ingredients, verify: Boolean(recipe.verifiedAt) };
    let changed = JSON.stringify(ingredients) !== before;
    if (/^Mole de olla(?: con res| con pollo)?$/.test(recipe.name)) {
      if (recipe.name === 'Mole de olla') edit.name = 'Mole de olla con res';
      const chicken = ingredients.some((item) => item.foodId === food('Pechuga de pollo').id);
      edit.instructions = [
        'Medir el aceite indicado; cocer jitomate, chile y ajo en agua, licuar y calentar la salsa con ese aceite, sin agregar grasa adicional.',
        chicken ? 'Cocer la pechuga de pollo en agua a hervor suave, retirando la espuma, hasta que alcance 74 C en el centro.' : 'Cocer la res en agua a hervor suave hasta que este tierna; debe alcanzar al menos 63 C y reposar 3 minutos.',
        'Agregar al caldo el chayote y la zanahoria cortados; incorporar la salsa y cocinar hasta que las verduras firmes esten tiernas.',
        'Anadir la calabacita al final y continuar a fuego bajo hasta ablandarla sin deshacerla; servir la proteina y las verduras con su caldo.',
        'Calentar las tortillas en comal y acompanar el mole de olla con las cantidades indicadas.',
      ];
      changed = true;
    }
    if (recipe.name === 'Tazón de pollo estilo burrito') {
      const chicken = ingredients.find((item) => item.foodId === food('Pechuga de pollo').id);
      const cheese = ingredients.find((item) => item.foodId === food('Queso panela light').id);
      if (!cheese) {
        chicken.quantity = sumAmounts([chicken.quantity, `-${food('Pechuga de pollo').baseQuantity}`]);
        ingredients.push(portion('Queso panela light', '1'));
      }
      edit.instructions = [
        'Cocer el pollo en agua a hervor suave hasta alcanzar 74 C en el centro; retirar y deshebrar.',
        'Lavar y desinfectar la lechuga, cortar y escurrir; cortar el queso panela en cubos.',
        'Calentar los frijoles cocidos y las tortillas sin agregar grasa.',
        'Servir el pollo con los frijoles y la lechuga en un tazon; agregar el queso panela y el aguacate, y acompanar con las tortillas en las cantidades indicadas.',
      ];
      changed = true;
    }
    if (recipe.name === 'Taco de salmón y crema de verduras') {
      if (!ingredients.some((item) => item.foodId === food('Calabaza de castilla').id)) ingredients.push(ingredient('Calabaza de castilla', '1/2', 'tazas'));
      if (recipe.personId === null && !ingredients.some((item) => item.foodId === food('Papa mediana').id)) ingredients.push(portion('Papa mediana', '1'));
      edit.instructions = [
        'Medir el aceite indicado y repartirlo entre la coccion del salmon y las espinacas, sin duplicar la cantidad.',
        'Cocinar el salmon con una parte del aceite hasta alcanzar 63 C en el centro; retirar las espinas.',
        'Lavar las espinacas y saltearlas con el resto del aceite y un poco de agua; servirlas con el salmon, no licuarlas en la crema.',
        recipe.personId === null
          ? 'Pelar la papa y la calabaza; cortar con la zanahoria y cocer en agua hasta que todas esten tiernas. Licuar con su agua y calentar para formar la crema, sin leche ni harina adicionales.'
          : 'Pelar la calabaza y cortar con la zanahoria; cocer en agua hasta que esten tiernas, licuar con su agua y calentar para formar la crema. No agregar papa a esta copia, para conservar los 2 cereales de Patricia.',
        'Calentar la salchicha de pavo siguiendo su etiqueta; servir con el salmon y las espinacas. Calentar las 2 tortillas y acompanar con la crema de verduras.',
      ];
      changed = true;
    }
    if (recipe.name === 'Chiles tipo en nogada') {
      edit.ingredients = ingredients.filter((item) => ![food('Queso cottage').id, food('Leche alta en proteína').id, food('Plátano tabasco').id, food('Arándanos y pasas').id].includes(item.foodId));
      edit.ingredients.push(portion('Leche alta en proteína', '1'), portion('Plátano tabasco', '1/5'), portion('Arándanos y pasas', '1/5'));
      for (const name of ['Manzana', 'Pera', 'Durazno']) edit.ingredients.find((item) => item.foodId === food(name).id).quantity = multiplyAmounts(food(name).baseQuantity, '1/5');
      edit.instructions = [
        'Desflemar y pelar el chile poblano: asarlo por todos sus lados, cubrirlo 10 minutos, retirar la piel, abrirlo y quitar venas y semillas; remojar brevemente en agua caliente y escurrir.',
        'Cocinar la carne molida con jitomate y cebolla picados y un poco de agua, sin aceite adicional, hasta alcanzar 71 C.',
        'Pelar y picar manzana, pera, durazno y platano; agregar al picadillo con las pasas (registradas en el catalogo como Arandanos y pasas) y calentar de 2 a 3 minutos para conservar su forma.',
        'Licuar las nueces con la leche alta en proteina indicada; anadir solo agua si hace falta para obtener una salsa fluida, sin cottage, crema ni azucar adicionales.',
        'Rellenar el chile con el picadillo de fruta, cubrir con la nogada y servir sin capear; acompanar con las tortillas indicadas.',
      ];
      edit.reviewNotes = ['Borrador de Comida: el relleno aporta Frutas y Azucar no prescritos en ese tiempo. Pasas se registran con la porcion del alimento Arandanos y pasas del catalogo. Requiere revision nutricional antes de usar en compras.'];
      edit.verify = false;
      changed = true;
    }
    if (changed) {
      const { recipe: saved } = await request(`/recipes/${recipe.id}`, 'PUT', edit);
      if (edit.verify && !saved.verifiedAt) throw new Error(`Verificacion perdida: ${recipe.name}`);
      updated += 1;
      console.log(JSON.stringify({ name: saved.name, profile: saved.personId ?? 'base', verified: Boolean(saved.verifiedAt) }));
    }
  }
  const current = (await request('/recipes')).items;
  for (const summary of current.filter((item) => item.name === 'Mole de olla con res').sort((left, right) => Number(left.personId !== null) - Number(right.personId !== null))) {
    if (current.some((item) => item.personId === summary.personId && item.name === 'Mole de olla con pollo')) continue;
    const { recipe } = await request(`/recipes/${summary.id}`);
    const chicken = food('Pechuga de pollo');
    const beef = food('Bistec de res');
    const ingredients = recipe.ingredients.map((item) => item.foodId === beef.id ? {
      ...item, foodId: chicken.id, unit: chicken.unit,
      quantity: multiplyAmounts(item.quantity, `${chicken.baseQuantity}/${beef.baseQuantity}`),
    } : item);
    await request('/recipes', 'POST', {
      ...recipe, name: 'Mole de olla con pollo', ingredients, verify: Boolean(recipe.verifiedAt),
      instructions: recipe.instructions.map((step) => step.replace(/Bistec de res/g, 'Pechuga de pollo').replace(/bistec/g, 'pollo')),
    });
    updated += 1;
  }
  console.log(JSON.stringify({ updated, consolidated }));
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });