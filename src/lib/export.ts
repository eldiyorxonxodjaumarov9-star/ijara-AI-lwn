import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

import { APP_NAME } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export function exportToExcel(
  rows: Record<string, string | number>[],
  fileName: string,
  sheetName = "Hisobot"
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export function exportToPdf({
  title,
  head,
  body,
  fileName,
}: {
  title: string;
  head: string[];
  body: (string | number)[][];
  fileName: string;
}) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(22, 132, 90);
  doc.text(APP_NAME, 14, 18);
  doc.setFontSize(12);
  doc.setTextColor(40, 40, 40);
  doc.text(title, 14, 27);
  doc.setFontSize(9);
  doc.setTextColor(140, 140, 140);
  doc.text(`Sana: ${formatDate(new Date())}`, 14, 33);

  autoTable(doc, {
    head: [head],
    body: body.map((r) => r.map((c) => String(c))),
    startY: 38,
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [22, 132, 90], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 248, 246] },
  });

  doc.save(`${fileName}.pdf`);
}
