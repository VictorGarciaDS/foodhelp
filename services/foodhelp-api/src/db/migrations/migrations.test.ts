import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(__dirname, '0001_foodhelp_schema.sql'), 'utf8');

describe('foodhelp schema migration', () => {
  it('stores the seven supplied recipes as unverified drafts with review notes', () => {
    const migration = readFileSync(resolve(__dirname, '0005_recipe_drafts.sql'), 'utf8');
    expect(migration.match(/ARRAY\['/g)).toHaveLength(7);
    expect(migration).toContain("'[]'::jsonb, '[]'::jsonb, NULL");
    expect(migration).toContain('review_notes');
    expect(migration).toContain('NOT EXISTS');
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