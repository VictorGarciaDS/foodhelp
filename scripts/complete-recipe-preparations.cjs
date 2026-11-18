const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { preparationFor } = require('./recipe-preparations.cjs');
const origin = process.env.FOODHELP_API_ORIGIN || 'http://localhost:3002';

async function request(route, method = 'GET', body) {
  const response = await fetch(`${origin}/api${route}`, {
    method, headers: { origin, 'x-foodhelp-request': '1', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${result.error?.message ?? response.status}`);
  return result;
}

async function research(sources) {
  const failures = [];
  for (const source of sources) {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const recipes = [];
      const visit = (value) => {
        if (Array.isArray(value)) return value.forEach(visit);
        if (!value || typeof value !== 'object') return;
        if ([value['@type']].flat().includes('Recipe')) recipes.push(value);
        if (value['@graph']) visit(value['@graph']);
      };
      for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        try { visit(JSON.parse(match[1])); } catch {}
      }
      const instructions = (value) => {
        if (Array.isArray(value)) return value.flatMap(instructions);
        if (typeof value === 'string') return [value];
        if (value?.itemListElement) return instructions(value.itemListElement);
        return value?.text ? [value.text] : [];
      };
      if (!recipes.length) throw new Error('No Recipe structured data');
      const recipe = recipes[0];
      const steps = instructions(recipe.recipeInstructions);
      if (!steps.length) throw new Error('No instructions');
      console.log(JSON.stringify({ source, name: recipe.name, steps: steps.length, method: steps.slice(0, 3).map((step) => step.replace(/<[^>]*>/g, '').slice(0, 180)) }));
    } catch (error) { failures.push({ source, error: error.message }); }
  }
  console.log(JSON.stringify({ sources: sources.length, failures }));
  if (failures.length) process.exitCode = 1;
}

async function main() {
  const foods = new Map((await request('/foods')).items.map((food) => [food.id, food]));
  const summaries = (await request('/recipes')).items;
  const plan = [];
  for (const summary of summaries) {
    const { recipe } = await request(`/recipes/${summary.id}`);
    plan.push({ recipe, preparation: preparationFor(recipe, foods) });
  }
  if (process.argv.includes('--research')) {
    const sources = [...new Set(plan.flatMap((entry) => entry.preparation.sources ?? []))]
      .filter((source) => !source.includes('foodsafety.gov'));
    return research(sources);
  }
  const blocked = plan.filter((entry) => entry.preparation.blocked).map((entry) => ({ name: entry.recipe.name, reason: entry.preparation.blocked }));
  console.log(JSON.stringify({ recipes: plan.length, ready: plan.length - blocked.length, verified: plan.filter((entry) => entry.recipe.verifiedAt).length, blocked }));
  if (!process.argv.includes('--apply')) return;
  const backupPath = path.join(os.tmpdir(), `foodhelp-recipes-before-preparations-${Date.now()}.json`);
  await fs.writeFile(backupPath, JSON.stringify(plan.map((entry) => entry.recipe), null, 2), { mode: 0o600 });
  console.log(`Backup: ${backupPath}`);
  let updated = 0;
  let verified = 0;
  for (const { recipe, preparation } of plan) {
    if (preparation.blocked) continue;
    const marker = '\n\nPreparacion adaptada a los ingredientes registrados. Referencias culinarias: ';
    const sourceText = `${(recipe.sourceText ?? '').split(marker)[0]}${marker}${preparation.sources.join(' ')}`;
    const { recipe: saved } = await request(`/recipes/${recipe.id}`, 'PUT', {
      personId: recipe.personId, name: recipe.name, mealTime: recipe.mealTime,
      sourceText, reviewNotes: recipe.reviewNotes, instructions: preparation.instructions,
      ingredients: recipe.ingredients, imageUrl: recipe.imageUrl, imageAttribution: recipe.imageAttribution,
      imageLicense: recipe.imageLicense, verify: Boolean(recipe.verifiedAt),
    });
    if (recipe.verifiedAt && !saved.verifiedAt) throw new Error(`Se perdio verificacion: ${recipe.name}`);
    if (JSON.stringify(saved.ingredients) !== JSON.stringify(recipe.ingredients)) {
      const normalizeIngredients = (ingredients) => ingredients.map(({ foodId, quantity, unit, group, isFreeConsumption }) => ({ foodId, quantity, unit, group, isFreeConsumption }));
      if (JSON.stringify(normalizeIngredients(saved.ingredients)) !== JSON.stringify(normalizeIngredients(recipe.ingredients))) throw new Error(`Ingredientes cambiados: ${recipe.name}`);
    }
    updated += 1;
    if (saved.verifiedAt) verified += 1;
  }
  console.log(JSON.stringify({ updated, verified, blocked }));
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });