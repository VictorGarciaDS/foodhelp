const path = require('node:path');
const fs = require('node:fs');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 10000 });
  try {
    const recipes = await pool.query(`SELECT r.id, r.name, r.person_id, r.meal_time, r.instructions, r.verified_at,
      (SELECT jsonb_agg(jsonb_build_object('name', f.name, 'group', f.food_group, 'quantity', ingredient->>'quantity', 'unit', ingredient->>'unit'))
       FROM jsonb_array_elements(r.ingredients) ingredient JOIN foodhelp.foods f ON f.id = (ingredient->>'foodId')::uuid) AS ingredients
      FROM foodhelp.recipes r ORDER BY r.name`);
    const pending = await pool.query(`SELECT f.id, f.name, f.food_group, f.base_quantity, f.unit,
      COALESCE(jsonb_agg(to_jsonb(pu)) FILTER (WHERE pu.id IS NOT NULL), '[]'::jsonb) AS purchase_units
      FROM foodhelp.foods f LEFT JOIN foodhelp.food_purchase_units pu ON pu.food_id = f.id
      WHERE NOT EXISTS (SELECT 1 FROM foodhelp.food_purchase_units confirmed WHERE confirmed.food_id=f.id AND confirmed.is_confirmed)
      GROUP BY f.id ORDER BY f.name`);
    const report = JSON.stringify({ recipes: recipes.rows, pendingPurchaseUnits: pending.rows }, null, 2);
    const pendingReport = process.argv.find((argument) => argument.startsWith('--pending-report='))?.slice(17);
    if (pendingReport) {
      const units = new Map();
      for (const recipe of recipes.rows) {
        for (const ingredient of recipe.ingredients ?? []) {
          const current = units.get(ingredient.name) ?? new Set();
          if (ingredient.unit) current.add(ingredient.unit);
          units.set(ingredient.name, current);
        }
      }
      const lines = [
        '# Unidades de compra pendientes', '',
        'No se han aplicado pesos aproximados sin confirmacion. Para cada alimento hace falta su peso por medida, rendimiento de coccion o contenido del envase.', '',
        'Leches: caja 1 L y taza 250 ml. Oroweat: 16 rebanadas por bolsa. Pan domino: 1 rebanada registrada = 1 pieza. Habits: bote de 1000 g, falta peso por cucharada.', '',
        '| Alimento | Medidas usadas en recetas | Medida base del catalogo | Dato por confirmar |',
        '| --- | --- | --- | --- |',
        ...pending.rows.map((food) => `| ${food.name} | ${[...(units.get(food.name) ?? [])].join(', ') || 'No usado'} | ${food.base_quantity ?? ''} ${food.unit ?? ''} | ${/Habits/.test(food.name) ? 'Gramos por cucharada; bote 1000 g confirmado' : 'Peso por medida o contenido del envase'} |`), '',
      ];
      await fs.promises.mkdir(path.dirname(pendingReport), { recursive: true });
      fs.writeFileSync(pendingReport, lines.join('\n'), 'utf8');
    }
    const output = process.argv.find((argument) => argument.startsWith('--output='))?.slice(9);
    if (output) fs.writeFileSync(output, report, 'utf8');
    else console.log(report);
  } finally { await pool.end(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });