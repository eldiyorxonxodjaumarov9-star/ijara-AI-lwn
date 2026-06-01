import { jsPDF } from "jspdf";

import { formatCurrency, formatDate } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";
import type { Contract } from "@/types";

export function generateContractPdf(contract: Contract) {
  const doc = new jsPDF();
  const left = 18;
  let y = 22;

  doc.setFontSize(20);
  doc.setTextColor(22, 132, 90);
  doc.text(APP_NAME, left, y);

  doc.setFontSize(11);
  doc.setTextColor(120, 120, 120);
  doc.text("Ijara shartnomasi", left, y + 7);

  y += 22;
  doc.setDrawColor(220, 220, 220);
  doc.line(left, y, 192, y);

  y += 12;
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(`Shartnoma #${contract.id.slice(0, 8).toUpperCase()}`, left, y);

  const rows: [string, string][] = [
    ["Mulk", contract.propertyName ?? "—"],
    ["Arendator", contract.tenantName ?? "—"],
    ["Boshlanish sanasi", formatDate(contract.startDate)],
    ["Tugash sanasi", formatDate(contract.endDate)],
    ["Oylik to'lov", formatCurrency(contract.monthlyPayment)],
    ["Garov (deposit)", formatCurrency(contract.deposit ?? 0)],
  ];

  y += 12;
  doc.setFontSize(11);
  rows.forEach(([label, value]) => {
    doc.setTextColor(120, 120, 120);
    doc.text(label, left, y);
    doc.setTextColor(20, 20, 20);
    doc.text(String(value), 80, y);
    y += 9;
  });

  if (contract.notes) {
    y += 6;
    doc.setTextColor(120, 120, 120);
    doc.text("Izoh:", left, y);
    y += 7;
    doc.setTextColor(20, 20, 20);
    doc.text(doc.splitTextToSize(contract.notes, 170), left, y);
    y += 14;
  }

  // Elektron imzo uchun joy
  y = Math.max(y + 20, 230);
  doc.setDrawColor(180, 180, 180);
  doc.line(left, y, left + 60, y);
  doc.line(120, y, 180, y);
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text("Ijaraga beruvchi imzosi", left, y + 6);
  doc.text("Arendator imzosi", 120, y + 6);

  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(
    `Yaratildi: ${formatDate(new Date())} • ${APP_NAME}`,
    left,
    285
  );

  doc.save(`shartnoma-${contract.id.slice(0, 8)}.pdf`);
}
