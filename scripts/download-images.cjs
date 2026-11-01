const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

const publicDir = path.resolve(__dirname, '../services/foodhelp-web/public/images');
const userAgent = 'FoodHelp/1.0 (private family recipe app)';
const freeLicense = /^(cc0|cc by(-sa)? \d|public domain|pd)/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const redoRecipes = process.argv.includes('--redo-recipes');
const onlyPattern = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7);
const curatedRecipes = ['Avena con Ades, nueces y crema de cacahuate', 'Pan tostado con crema de cacahuate y Ades', 'Sándwich de atún con aguacate y Ades', 'Tostada de huevo con aguacate y Ades'];
// Ordered from most to least specific; the first match decides the Commons query.
const dishQueries = [
  ['chiles tipo en nogada', 'chiles en nogada'], ['chiles rellenos', 'chiles rellenos'], ['calabacitas rellenas', 'stuffed zucchini'],
  ['crema de verduras', 'vegetable cream soup'], ['mole de olla', 'mole de olla'], ['caldo tlalpe', 'caldo tlalpeño'],
  ['caldo de pescado', 'fish soup'], ['caldo de pollo', 'chicken soup'], ['sopa de conchita', 'pasta soup tomato'],
  ['pipián', 'pipian sauce'], ['encacahuatado', 'chicken peanut sauce'], ['almendrado', 'chicken almond sauce'],
  ['pollo con rajas', 'rajas con crema'], ['mixiotes', 'mixiote'], ['albóndigas', 'albóndigas'], ['tinga', 'tinga tostadas'],
  ['chilaquiles', 'chilaquiles'], ['enchiladas', 'enchiladas'], ['quesadillas', ['intitle:quesadillas', 'intitle:quesadilla']], ['taco de salmón', 'fish tacos'],
  ['tacos', 'tacos mexican'], ['sopes', 'sopes mexican'], ['tostadas', ['intitle:tostadas', 'intitle:tostada']], ['salmas', ['intitle:tostadas', 'intitle:tostada']],
  ['estilo burrito', 'burrito bowl'], ['burrito', 'burrito'], ['hamburguesa de salmón', 'salmon burger'], ['bowl de salmón', 'salmon rice bowl'],
  ['empapelado', 'fish en papillote'], ['pescado al mojo', 'fish garlic sauce'], ['camarones al mojo', 'garlic shrimp'],
  ['brochetas de camarones', 'shrimp skewers'], ['alambre', 'alambre mexican'], ['lasaña', 'zucchini lasagna'], ['pasta con', 'pasta dish'],
  ['omelette', 'spinach omelette'], ['motuleños', 'huevos motuleños'], ['huevos ahogados', 'eggs in salsa'], ['huevo', 'scrambled eggs'],
  ['tortitas de atún', ['intitle:tuna intitle:patties', 'intitle:tuna intitle:cakes', 'intitle:fishcakes']], ['tortitas', 'vegetable fritters'], ['chapata', 'sandwich'], ['envueltos de lechuga', 'lettuce wraps'],
  ['envueltos', 'tuna wrap'], ['licuado', ['intitle:smoothie intitle:glass', 'intitle:licuado']], ['rollo de carne', 'meatloaf'], ['bistec', ['intitle:"bistec a la mexicana"', 'intitle:bistec']],
  ['chayote relleno', 'stuffed chayote'], ['coliflor', 'cauliflower gratin'], ['pescado', 'fish fillet rice'], ['bowl de pollo', 'chicken rice bowl'],
  ['pan', 'toast breakfast'],
];
const recipeQuery = (name) => dishQueries.find(([key]) => name.toLowerCase().includes(key))?.[1] ?? null;
// Hand-picked Commons files for dishes where search results were misleading.
const curatedFiles = [
  ['quesadillas de flor de calabaza', 'File:Quesadilla de flor de calabaza.jpg'],
  ['quesadillas de coliflor', 'File:QuesadillasTenancingo.JPG'],
  ['bistec', 'File:Plato con quesadillas.jpg'],
  ['tortitas de atún', 'File:Croquetas de atún (El Portón).jpg'],
];
const curatedFile = (name) => curatedFiles.find(([key]) => name.toLowerCase().includes(key))?.[1] ?? null;

async function politeFetch(url) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, { headers: { 'User-Agent': userAgent } });
    if (response.status !== 429) return response;
    const wait = Number(response.headers.get('retry-after')) || 20 * (attempt + 1);
    await sleep(wait * 1000);
  }
  throw new Error('Commons sigue limitando solicitudes');
}

function slug(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function searchTerms(name) {
  const clean = name.replace(/\(.*?\)/g, '').replace(/:.*$/, '').trim();
  const beforeCon = clean.split(/\s+(con|al|a la|en|y)\s+/i)[0];
  return [...new Set([clean, beforeCon, beforeCon.split(/\s+/)[0]])].filter((term) => term.length > 2);
}

async function imageByTitle(title) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '320', format: 'json' }).toString();
  const response = await politeFetch(url);
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  const info = Object.values((await response.json()).query?.pages ?? {})[0]?.imageinfo?.[0];
  const license = info?.extmetadata?.LicenseShortName?.value ?? '';
  if (!info?.thumburl || !freeLicense.test(license)) return null;
  const artist = (info.extmetadata?.Artist?.value ?? 'Autor desconocido').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return { thumb: info.thumburl, page: info.descriptionurl, license: `${artist.slice(0, 120)} · ${license}`, term: title };
}

async function findImage(name, query) {
  const title = curatedFile(name);
  if (title) return imageByTitle(title);
  for (const term of query ? [query].flat() : searchTerms(name)) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query', generator: 'search', gsrsearch: `${term} filetype:bitmap`, gsrnamespace: '6', gsrlimit: '8',
      prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '320', format: 'json',
    }).toString();
    const response = await politeFetch(url);
    if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
    const pages = Object.values((await response.json()).query?.pages ?? {}).sort((a, b) => a.index - b.index);
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const license = info?.extmetadata?.LicenseShortName?.value ?? '';
      if (!info?.thumburl || !freeLicense.test(license)) continue;
      const artist = (info.extmetadata?.Artist?.value ?? 'Autor desconocido').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      return { thumb: info.thumburl, page: info.descriptionurl, license: `${artist.slice(0, 120)} · ${license}`, term };
    }
    await sleep(1000);
  }
  return null;
}

async function download(source, kind, row, force = false) {
  const extension = /\.png(\?|$)/i.test(source) ? 'png' : 'jpg';
  const file = `${slug(row.name)}-${row.id.slice(0, 8)}.${extension}`;
  const target = path.join(publicDir, kind, file);
  if (force || !fs.existsSync(target)) {
    const response = await politeFetch(source);
    if (!response.ok) throw new Error(`Image HTTP ${response.status}`);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
  return `/images/${kind}/${file}`;
}

async function processTable(client, table, kind) {
  const redo = redoRecipes && table === 'recipes';
  const rows = (await client.query(
    `SELECT id, name, image_url AS "imageUrl", image_attribution AS "imageAttribution", image_license AS "imageLicense"
     FROM foodhelp.${table} WHERE ${redo ? 'NOT (name = ANY($1::text[]))' : "(image_url IS NULL OR image_url LIKE 'https://%')"} ORDER BY name`,
    redo ? [curatedRecipes] : [],
  )).rows;
  fs.mkdirSync(path.join(publicDir, kind), { recursive: true });
  if (redo && onlyPattern) rows.splice(0, rows.length, ...rows.filter((row) => new RegExp(onlyPattern, 'i').test(row.name)));
  const summary = { total: rows.length, saved: 0, missing: [] };
  for (const row of rows) {
    try {
      const found = row.imageUrl?.startsWith('https://') && !redo
        ? { thumb: row.imageUrl, page: row.imageAttribution, license: row.imageLicense }
        : await findImage(row.name, table === 'recipes' ? recipeQuery(row.name) : null);
      if (!found) { summary.missing.push(row.name); continue; }
      const localUrl = await download(found.thumb, kind, row, redo);
      await client.query(`UPDATE foodhelp.${table} SET image_url = $2, image_attribution = $3, image_license = $4 WHERE id = $1`, [row.id, localUrl, found.page, found.license]);
      summary.saved += 1;
    } catch (error) {
      summary.missing.push(`${row.name} (${error.message})`);
    }
    await sleep(1500);
  }
  return summary;
}

async function main() {
  const client = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, max: 2, idleTimeoutMillis: 10000 });
  client.on('error', () => {});
  try {
    const recipes = await processTable(client, 'recipes', 'recipes');
    const foods = await processTable(client, 'foods', 'foods');
    console.log(JSON.stringify({ recipes, foods }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
