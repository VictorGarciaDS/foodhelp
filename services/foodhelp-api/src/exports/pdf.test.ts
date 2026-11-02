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