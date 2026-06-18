import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { Workbook } from 'exceljs';
import { MonthlyRow } from './reports.service';

@Injectable()
export class ExportService {
  private format(value: number): string {
    return new Intl.NumberFormat('uz-UZ').format(value);
  }

  exportPdf(
    res: Response,
    year: number,
    rows: MonthlyRow[],
    totals: { revenue: number; expense: number; tax: number; profit: number },
  ): void {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="arendahub-report-${year}.pdf"`,
    );
    doc.pipe(res);

    doc.fontSize(20).fillColor('#16845a').text('ArendaHub', { continued: false });
    doc
      .fontSize(12)
      .fillColor('#444')
      .text(`Moliyaviy hisobot — ${year}`, { align: 'left' });
    doc.moveDown();

    const tableTop = doc.y + 10;
    const colX = [40, 180, 300, 430];
    doc.fontSize(10).fillColor('#000');
    doc.text('Oy', colX[0], tableTop);
    doc.text('Daromad', colX[1], tableTop);
    doc.text('Xarajat', colX[2], tableTop);
    doc.text('Foyda', colX[3], tableTop);
    doc
      .moveTo(40, tableTop + 15)
      .lineTo(555, tableTop + 15)
      .strokeColor('#ccc')
      .stroke();

    let y = tableTop + 22;
    rows.forEach((row) => {
      doc.fillColor('#222').fontSize(9);
      doc.text(row.month, colX[0], y);
      doc.text(this.format(row.revenue), colX[1], y);
      doc.text(this.format(row.expense), colX[2], y);
      doc.text(this.format(row.profit), colX[3], y);
      y += 18;
    });

    doc.moveTo(40, y + 4).lineTo(555, y + 4).strokeColor('#ccc').stroke();
    y += 14;
    doc.fontSize(11).fillColor('#16845a');
    doc.text(`Jami daromad: ${this.format(totals.revenue)} UZS`, 40, y);
    doc.text(`Jami xarajat: ${this.format(totals.expense)} UZS`, 40, y + 16);
    doc.text(`Soliq: ${this.format(totals.tax)} UZS`, 40, y + 32);
    doc
      .fontSize(13)
      .fillColor('#000')
      .text(`Sof foyda: ${this.format(totals.profit)} UZS`, 40, y + 52);

    doc.end();
  }

  async exportExcel(
    res: Response,
    year: number,
    rows: MonthlyRow[],
    totals: { revenue: number; expense: number; tax: number; profit: number },
  ): Promise<void> {
    const workbook = new Workbook();
    workbook.creator = 'ArendaHub';
    const sheet = workbook.addWorksheet(`Hisobot ${year}`);

    sheet.columns = [
      { header: 'Oy', key: 'month', width: 16 },
      { header: 'Daromad', key: 'revenue', width: 18 },
      { header: 'Xarajat', key: 'expense', width: 18 },
      { header: 'Foyda', key: 'profit', width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF16845A' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    rows.forEach((row) => sheet.addRow(row));

    sheet.addRow({});
    sheet.addRow({ month: 'Jami daromad', revenue: totals.revenue });
    sheet.addRow({ month: 'Jami xarajat', expense: totals.expense });
    sheet.addRow({ month: 'Soliq', expense: totals.tax });
    sheet.addRow({ month: 'Sof foyda', profit: totals.profit });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="arendahub-report-${year}.xlsx"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }
}
