import PDFDocument from 'pdfkit';
import type { Response } from 'express';

export function streamPdf(response: Response, title: string, rows: string[]): void {
  response.type('application/pdf');
  const document = new PDFDocument({ info: { Title: title, CreationDate: new Date('2000-01-01T00:00:00Z') } });
  document.pipe(response);
  document.fontSize(18).text(title);
  document.moveDown();
  for (const row of rows) document.fontSize(11).text(row);
  document.end();
}