import PDFDocument from 'pdfkit';
import type { Response } from 'express';
import { mealTimes } from '@foodhelp/contracts';

export function streamPdf(response: Response, title: string, rows: string[]): void {
  response.type('application/pdf');
  const document = new PDFDocument({ info: { Title: title, CreationDate: new Date('2000-01-01T00:00:00Z') } });
  document.pipe(response);
  document.fontSize(18).text(title);
  document.moveDown();
  for (const row of rows) document.fontSize(11).text(row);
  document.end();
}

type ShoppingPdfItem = {
  name: string; group: string; unit: string; quantity: string; purchasePending: boolean;
  purchaseOptions: { quantity: string; purchaseUnit: string; isApproximate: boolean }[];
};
export type ShoppingPdfData = {
  personName: string; days: number; peopleCount: number;
  menu: { day: number; mealTime: string; recipeName: string }[];
  recipes: { id: string; name: string; mealTime: string; instructions: string[] }[];
  items: ShoppingPdfItem[];
};

const colors = { primary: '#1f6f5c', accent: '#e8f3ef', text: '#1f2933', muted: '#6b7680', line: '#d9e2e7', warn: '#a35b00' };
const groupOrder = ['Verduras', 'Frutas', 'Proteinas', 'Lacteos', 'Cereales y leguminosas', 'Grasas', 'Azucar', 'Condimentos', 'Bebidas', 'Antojos'];
const groupLabel = (group: string) => ({ Proteinas: 'Proteínas', Lacteos: 'Lácteos', Azucar: 'Azúcar' }[group] ?? group);
const singular: Record<string, string> = { paquetes: 'paquete', docenas: 'docena', piezas: 'pieza', tazas: 'taza', rebanadas: 'rebanada', cucharadas: 'cucharada', cucharaditas: 'cucharadita', porciones: 'porción', dientes: 'diente' };
const readable = (value: string) => {
  const [numerator, denominator] = value.split('/').map(Number);
  if (!denominator) return value;
  const decimal = numerator / denominator;
  return Number.isInteger(decimal * 100) ? String(decimal) : value;
};
const amount = (value: string, unit: string) => `${readable(value)} ${value === '1' ? singular[unit] ?? unit : unit}`;

export function streamShoppingPdf(response: Response, data: ShoppingPdfData): void {
  response.type('application/pdf');
  response.setHeader('Content-Disposition', 'attachment; filename="foodhelp-compras.pdf"');
  const doc = new PDFDocument({ size: 'LETTER', margins: { top: 54, bottom: 54, left: 54, right: 54 }, bufferPages: true, info: { Title: 'Lista de compras FoodHelp' } });
  doc.pipe(response);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const ensure = (height: number) => { if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage(); };

  doc.rect(0, 0, doc.page.width, 96).fill(colors.primary);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('Lista de compras', left, 30);
  doc.font('Helvetica').fontSize(11).text(`${data.personName} · ${data.days} ${data.days === 1 ? 'día' : 'días'} · ${data.peopleCount} ${data.peopleCount === 1 ? 'persona' : 'personas'}`, left, 60);
  doc.y = 120;

  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(13).text('Menú', left);
  doc.moveDown(0.4);
  for (const day of [...new Set(data.menu.map((entry) => entry.day))]) {
    const entries = data.menu.filter((entry) => entry.day === day);
    ensure(22 + entries.length * 16);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(colors.primary).text(`Día ${day}`, left);
    for (const entry of entries) {
      const y = doc.y + 2;
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(colors.muted).text(entry.mealTime, left + 10, y, { width: 80 });
      doc.font('Helvetica').fillColor(colors.text).text(entry.recipeName, left + 92, y, { width: width - 92 });
    }
    doc.moveDown(0.5);
  }

  doc.moveDown(0.6);
  ensure(60);
  doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(13).text('Recetas', left);
  doc.moveDown(0.4);
  for (const mealTime of mealTimes) {
    const recipes = data.recipes.filter((recipe) => recipe.mealTime === mealTime);
    if (!recipes.length) continue;
    ensure(60);
    doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(11).text(mealTime, left);
    doc.moveDown(0.3);
    for (const recipe of recipes) {
      ensure(50);
      doc.fillColor(colors.text).font('Helvetica-Bold').fontSize(10.5).text(recipe.name, left + 10, doc.y, { width: width - 10 });
      doc.moveDown(0.3);
      const instructions = recipe.instructions.map((instruction) => instruction.trim()).filter(Boolean);
      doc.font('Helvetica').fontSize(10);
      if (!instructions.length) {
        doc.fillColor(colors.muted).text('Sin pasos de preparación registrados.', left + 10, doc.y, { width: width - 10 });
      }
      for (const [index, instruction] of instructions.entries()) {
        const step = `${index + 1}. ${instruction}`;
        const height = doc.heightOfString(step, { width: width - 10 }) + 6;
        ensure(Math.min(height, doc.page.height - doc.page.margins.top - doc.page.margins.bottom));
        doc.fillColor(colors.text).text(step, left + 10, doc.y, { width: width - 10 });
        doc.moveDown(0.3);
      }
      doc.moveDown(0.6);
    }
  }

  const columns = [{ x: left + 22, width: 200 }, { x: left + 226, width: 110 }, { x: left + 340, width: width - 340 }];
  const rank = (group: string) => { const index = groupOrder.indexOf(group); return index === -1 ? groupOrder.length : index; };
  const groups = [...new Set(data.items.map((item) => item.group))].sort((a, b) => rank(a) - rank(b));
  doc.moveDown(0.6);
  ensure(40);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(colors.text).text('Lista', left);
  doc.moveDown(0.3);
  for (const group of groups) {
    ensure(44);
    const headerY = doc.y;
    doc.rect(left, headerY, width, 20).fill(colors.accent);
    doc.fillColor(colors.primary).font('Helvetica-Bold').fontSize(10).text(groupLabel(group).toUpperCase(), left + 8, headerY + 6, { characterSpacing: 0.6 });
    doc.y = headerY + 22;
    for (const item of data.items.filter((entry) => entry.group === group)) {
      const buy = item.purchaseOptions.map((option) => `${amount(option.quantity, option.purchaseUnit)}${option.isApproximate ? ' aprox.' : ''}`).join(' · ');
      const buyText = buy || (item.purchasePending ? 'Empaque por confirmar' : '-');
      const rowHeight = Math.max(18, doc.font('Helvetica').fontSize(9.5).heightOfString(item.name, { width: columns[0].width }) + 8);
      ensure(rowHeight);
      const y = doc.y;
      doc.lineWidth(0.8).strokeColor(colors.muted).rect(left + 6, y + 4, 9, 9).stroke();
      doc.fillColor(colors.text).font('Helvetica').fontSize(9.5).text(item.name, columns[0].x, y + 4, { width: columns[0].width });
      doc.text(amount(item.quantity, item.unit), columns[1].x, y + 4, { width: columns[1].width });
      doc.fillColor(buy ? colors.primary : item.purchasePending ? colors.warn : colors.muted).font(buy ? 'Helvetica-Bold' : 'Helvetica-Oblique').text(buyText, columns[2].x, y + 4, { width: columns[2].width });
      doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).lineWidth(0.4).strokeColor(colors.line).stroke();
      doc.y = y + rowHeight;
    }
    doc.moveDown(0.6);
  }

  ensure(30);
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(colors.muted).text('"aprox." indica una equivalencia aproximada. Las verduras libres sin medida se cuentan como porciones de receta.', left, doc.y, { width });

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(colors.muted).text(`FoodHelp · Página ${index + 1} de ${range.count}`, left, doc.page.height - 36, { width, align: 'center', lineBreak: false });
    doc.page.margins.bottom = bottomMargin;
  }
  doc.end();
}