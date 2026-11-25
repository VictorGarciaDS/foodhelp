import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import type { Response } from 'express';
import PDFDocument from 'pdfkit';
import { describe, expect, it, vi } from 'vitest';
import { streamShoppingPdf, type ShoppingPdfData } from './pdf';

async function render(data: ShoppingPdfData): Promise<Buffer> {
  const response = Object.assign(new PassThrough(), { type: vi.fn(), setHeader: vi.fn() });
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = once(response, 'end');
  streamShoppingPdf(response as unknown as Response, data);
  await finished;
  return Buffer.concat(chunks);
}

describe('shopping PDF', () => {
  it('prints the purchase location next to each product', async () => {
    const text = vi.spyOn(PDFDocument.prototype, 'text');
    try {
      await render({
        personName: 'Familia', days: 1, peopleCount: 1, menu: [], recipes: [],
        items: ['Mercado', 'Naturista', 'Supermercado'].map((purchaseLocation) => ({
          name: `Producto ${purchaseLocation}`, group: 'Proteinas', unit: 'g', quantity: '100',
          purchaseLocation, purchasePending: false, purchaseOptions: [],
        })),
      });
      const texts = text.mock.calls.map(([value]) => String(value));
      expect(texts).toContain('Dónde comprar');
      for (const location of ['Mercado', 'Naturista', 'Supermercado']) expect(texts).toContain(location);
    } finally { text.mockRestore(); }
  });
  it('prints identical preparations once and combines consecutive identical menu days', async () => {
    const text = vi.spyOn(PDFDocument.prototype, 'text');
    try {
      await render({
        personName: 'Familia', days: 4, peopleCount: 3, items: [],
        menu: [1, 2, 3, 4].map((day) => ({ day, mealTime: 'Comida', recipeName: day <= 2 ? 'Pollo' : 'Pescado' })),
        recipes: ['Patricia', 'Laura', 'Victor'].map((personName) => ({
          id: personName, name: `Pollo de ${personName}`, baseRecipeId: 'base-pollo', baseName: 'Pollo', personName,
          mealTime: 'Comida', instructions: ['Cocinar el pollo', 'Servir'],
        })),
      });
      const texts = text.mock.calls.map(([value]) => String(value));
      expect(texts).toContain('Días 1-2');
      expect(texts).toContain('Días 3-4');
      expect(texts).not.toContain('Día 2');
      expect(texts.filter((value) => value === '1. Cocinar el pollo')).toHaveLength(1);
      expect(texts.filter((value) => value === '2. Servir')).toHaveLength(1);
      expect(texts.some((value) => value.includes('Pollo de '))).toBe(false);
    } finally { text.mockRestore(); }
  });
  it('identifies diners and adapted preparation steps for each profile', async () => {
    const text = vi.spyOn(PDFDocument.prototype, 'text');
    try {
      await render({
        personName: 'Menu compartido', days: 1, peopleCount: 3,
        participants: [{ personName: 'Patricia', peopleCount: 1 }, { personName: 'Laura', peopleCount: 2 }],
        menu: [{ day: 1, mealTime: 'Comida', recipeName: 'Pollo base' }], items: [],
        recipes: [
          { id: 'patricia', name: 'Pollo', personName: 'Patricia', mealTime: 'Comida', instructions: ['Pasos de Patricia'] },
          { id: 'laura', name: 'Pollo', personName: 'Laura', mealTime: 'Comida', instructions: ['Pasos de Laura'] },
        ],
      });
      const texts = text.mock.calls.map(([value]) => String(value));
      expect(texts).toContain('Patricia: 1 persona');
      expect(texts).toContain('Laura: 2 personas');
      expect(texts).toContain('Pollo · Patricia');
      expect(texts).toContain('Pollo · Laura');
      expect(texts).toContain('1. Pasos de Patricia');
      expect(texts).toContain('1. Pasos de Laura');
      expect(texts.indexOf('Comensales')).toBeLessThan(texts.indexOf('Menú'));
    } finally { text.mockRestore(); }
  });
  it('places saved steps between menu and list in meal order', async () => {
    const text = vi.spyOn(PDFDocument.prototype, 'text');
    try {
      const recipes = [
        { id: 'dinner', name: 'Tostada', mealTime: 'Cena', instructions: ['Servir tostada'] },
        { id: 'lunch', name: 'Caldo', mealTime: 'Almuerzo', instructions: ['Preparar caldo'] },
        { id: 'breakfast', name: 'Avena', mealTime: 'Desayuno', instructions: ['Preparar avena', 'Servir avena'] },
        { id: 'main', name: 'Pollo', mealTime: 'Comida', instructions: [] },
      ];
      const buffer = await render({
        personName: 'Familia', days: 2, peopleCount: 2, recipes,
        menu: [1, 2].flatMap((day) => recipes.map((recipe) => ({ day, mealTime: recipe.mealTime, recipeName: recipe.name }))),
        items: [],
      });
      expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
      const texts = text.mock.calls.map(([value]) => String(value));
      const recipeSection = texts.indexOf('Recetas');
      const listSection = texts.indexOf('Lista');
      expect(recipeSection).toBeGreaterThan(texts.indexOf('Men\u00fa'));
      expect(listSection).toBeGreaterThan(recipeSection);
      const steps = texts.slice(recipeSection + 1, listSection);
      expect(steps.filter((value) => ['Desayuno', 'Almuerzo', 'Comida', 'Cena'].includes(value))).toEqual(['Desayuno', 'Almuerzo', 'Comida', 'Cena']);
      expect(steps.filter((value) => value === 'Avena')).toHaveLength(1);
      expect(steps).toContain('1. Preparar avena');
      expect(steps).toContain('2. Servir avena');
      expect(steps).toContain('1. Preparar caldo');
      expect(steps).toContain('1. Servir tostada');
      expect(steps).toContain('Sin pasos de preparaci\u00f3n registrados.');
    } finally {
      text.mockRestore();
    }
  });

  it('paginates long instructions and keeps the list after the last step', async () => {
    const text = vi.spyOn(PDFDocument.prototype, 'text');
    try {
      const instructions = Array.from({ length: 24 }, () => 'Mezclar los ingredientes y cocinar hasta que esten listos. '.repeat(12));
      const buffer = await render({
        personName: 'Familia', days: 1, peopleCount: 1,
        menu: [{ day: 1, mealTime: 'Comida', recipeName: 'Guisado' }],
        recipes: [{ id: 'main', name: 'Guisado', mealTime: 'Comida', instructions }],
        items: [],
      });
      expect((buffer.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
      const texts = text.mock.calls.map(([value]) => String(value));
      expect(texts.indexOf('Lista')).toBeGreaterThan(texts.indexOf(`24. ${instructions[23]}`));
    } finally {
      text.mockRestore();
    }
  });
});