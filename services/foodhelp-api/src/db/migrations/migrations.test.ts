import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(__dirname, '0001_foodhelp_schema.sql'), 'utf8');

describe('foodhelp schema migration', () => {
  it('protects catalog equivalences while allowing explicitly authorized maintenance', () => {
    const migration = readFileSync(resolve(__dirname, '0019_protect_food_equivalences.sql'), 'utf8');
    expect(migration).toContain('CREATE UNIQUE INDEX foods_normalized_name_idx');
    expect(migration).toContain('BEFORE UPDATE OF food_group, base_quantity, unit, is_free_consumption');
    expect(migration).toContain("current_setting('foodhelp.authorize_equivalence_change', true)");
    expect(migration).toContain("ERRCODE = '42501'");
    expect(migration).not.toContain('UPDATE foodhelp.foods SET');
  });
  it('uses the confirmed Habits tablespoon weight and an exact one-kilogram package ratio', () => {
    const migration = readFileSync(resolve(__dirname, '0017_remaining_confirmed_purchase_units.sql'), 'utf8');
    expect(migration).toContain("'cucharadas', '30.5', 'g'");
    expect(migration).toContain("'2000/61', 'cucharadas', '1', 'botes de 1 kg'");
    expect(migration).toContain("'gramos secos por taza cocida'");
    expect(migration).not.toContain('UPDATE foodhelp.foods');
  });
  it('marks confirmed domestic weights as approximate without changing prescription portions', () => {
    const migration = readFileSync(resolve(__dirname, '0016_confirmed_domestic_purchase_weights.sql'), 'utf8');
    expect(migration).toContain("('Cebolla', 'cucharadas', '10')");
    expect(migration).toContain("('Ajo', 'dientes', '3')");
    expect(migration).toContain("'g', true, true, false");
    expect(migration).not.toContain('UPDATE foodhelp.foods');
    expect(migration).not.toContain('Habits');
  });
  it('adds cotija and zero snack rows while retaining independently linked profile recipes', () => {
    const foodMigration = readFileSync(resolve(__dirname, '0014_cotija_and_colacion.sql'), 'utf8');
    expect(foodMigration).toContain("'Queso cotija', 'Proteinas', '35', 'g', false");
    expect(foodMigration).toContain("'Colacion', groups.food_group, 0");
    const bases = readFileSync(resolve(__dirname, '0015_independent_recipe_bases.sql'), 'utf8');
    expect(bases).toContain('base_id, NULL, name');
    expect(bases).toContain('SET inherited_from_recipe_id = originals.base_id');
    expect(bases).not.toContain('DELETE FROM');
  });
  it('records confirmed packages and explicitly approved cooking yields without guessing protein scoop weights', () => {
    const migration = readFileSync(resolve(__dirname, '0012_confirmed_household_purchase_units.sql'), 'utf8');
    expect(migration).toContain("'cajas de 1 L', '4', 'tazas'");
    expect(migration).toContain("'bolsas de 16 rebanadas', '16', 'rebanadas'");
    expect(migration).toContain("('Pasta cocida', '2')");
    expect(migration).toContain("'tazas crudas', true, true, false");
    expect(migration).not.toContain('Habits');
  });
  it('stores the seven supplied recipes as unverified drafts with review notes', () => {
    const migration = readFileSync(resolve(__dirname, '0005_recipe_drafts.sql'), 'utf8');
    expect(migration.match(/ARRAY\['/g)).toHaveLength(7);
    expect(migration).toContain("'[]'::jsonb, '[]'::jsonb, NULL");
    expect(migration).toContain('review_notes');
    expect(migration).toContain('NOT EXISTS');
  });
  it('relates exact purchase-pack quantities to catalog foods', () => {
    const migration = readFileSync(resolve(__dirname, '0006_food_purchase_units.sql'), 'utf8');
    expect(migration).toContain('CREATE TABLE foodhelp.food_purchase_units');
    expect(migration).toContain('REFERENCES foodhelp.foods(id) ON DELETE CASCADE');
    expect(migration).toContain("SELECT id, 'paquetes', '11', 'rebanadas'");
  });
  it('supports confirmed and approximate purchase conversions and recipe image attribution', () => {
    const migration = readFileSync(resolve(__dirname, '0007_purchase_measurements_and_recipe_images.sql'), 'utf8');
    expect(migration).toContain('ADD COLUMN purchase_quantity');
    expect(migration).toContain('ADD COLUMN is_confirmed');
    expect(migration).toContain('ADD COLUMN is_approximate');
    expect(migration).toContain("SET quantity = '12'");
    expect(migration).toContain('ADD COLUMN image_attribution');
  });
  it('seeds only stated or standard purchase conversions and user-provided approximations', () => {
    const migration = readFileSync(resolve(__dirname, '0008_food_purchase_defaults.sql'), 'utf8');
    expect(migration).toContain("WHERE unit = 'g'");
    expect(migration).toContain("SELECT id, 'docenas', '12', 'piezas', '1', 'docenas'");
    expect(migration).toContain("SELECT id, 'gramos aproximados', '12', 'piezas', '60', 'g'");
    expect(migration).toContain("SELECT id, 'gramos aproximados', '1', 'piezas', '175', 'g'");
  });
  it('marks foods without a confirmed conversion instead of inventing a package size', () => {
    const migration = readFileSync(resolve(__dirname, '0009_unconfirmed_purchase_units.sql'), 'utf8');
    expect(migration).toContain("'empaque por confirmar'");
    expect(migration).toContain('false, false, true');
    expect(migration).toContain('WHERE NOT EXISTS');
  });
  it('simplifies people and confirms Ades without saving unreviewed recipes', () => {
    const migration = readFileSync(resolve(__dirname, '0004_people_and_food_corrections.sql'), 'utf8');
    expect(migration.match(/ALTER TABLE foodhelp.people DROP COLUMN/g)).toHaveLength(3);
    expect(migration).toContain("base_quantity = '1', unit = 'taza', portion_pending = false");
    expect(migration).toContain("'S/G', 'sin grasa'");
    expect(migration).toContain("'S/ glutamato', 'sin glutamato'");
    expect(migration).not.toMatch(/INSERT\s+INTO\s+foodhelp\.(recipes|weekly_menus)/i);
  });
  it('records Patricia instructions without inventing Ades measures or vegetable minimums', () => {
    const migration = readFileSync(resolve(__dirname, '0003_patricia_prescription.sql'), 'utf8');
    expect(migration).toContain("DATE '2026-10-02'");
    expect(migration).toContain("'Leche Ades sin azúcar', 'Lacteos', NULL, NULL, false, true");
    expect(migration).toContain("'Comida', 'Verduras', 2, 'free_guidance'");
    expect(migration).toContain("replace(name, 'S/A', 'sin azúcar')");
    expect(migration.match(/\(prescription_id, '/g)).toHaveLength(16);
  });
  it('creates only explicitly scoped foodhelp tables without inserting rows', () => {
    expect(schema).toMatch(/CREATE SCHEMA IF NOT EXISTS foodhelp/i);
    const tables = [...schema.matchAll(/CREATE TABLE\s+([^\s(]+)/gi)].map((match) => match[1]);
    expect(tables).toEqual(expect.arrayContaining([
      'foodhelp.foods', 'foodhelp.people', 'foodhelp.prescriptions', 'foodhelp.prescription_items',
      'foodhelp.recipes', 'foodhelp.weekly_menus',
    ]));
    expect(tables.every((table) => table.startsWith('foodhelp.'))).toBe(true);
    expect(schema).not.toMatch(/\bINSERT\s+INTO\b/i);
  });

  it('refuses a non-loopback migration target before opening a database connection', () => {
    const runner = resolve(__dirname, '../../../scripts/migrate-local.cjs');
    const result = spawnSync(process.execPath, [runner], {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH ?? '',
        SystemRoot: process.env.SystemRoot ?? '',
        FOODHELP_ALLOW_LOCAL_MIGRATIONS: '1',
        DATABASE_URL: 'postgresql://unused.invalid/foodhelp',
      },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Migration failed (UNKNOWN).');
  });
});