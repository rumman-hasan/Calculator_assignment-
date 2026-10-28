import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate, formatMoneyPlain, titleCase } from "@/lib/format";
import type { SiteInfo } from "@/lib/site-config";
import type { Row } from "@/lib/types";

export type InvoicePdfInput = {
  invoice: Row;
  client: Row;
  items: Row[];
  payments: Row[];
  siteInfo: Pick<SiteInfo, "address" | "phoneDisplay" | "email">;
  /** The original logo file, byte for byte. If missing, only the text name is printed. */
  logoBytes: Uint8Array | null;
};

// The standard PDF fonts only cover Latin-1. Anything else (for example Bengali letters) is shown as "?".
// For Bengali text use the on-screen Print button and choose "Save as PDF".
const safe = (v: unknown) =>
  Array.from(String(v ?? ""))
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 63;
      if (ch === "\n") return " ";
      if (ch === "−" || ch === "–" || ch === "—" || ch === "•") return "-";
      if (ch === "‘" || ch === "’") return "'";
      if (ch === "“" || ch === "”") return '"';
      if (ch === "…") return "...";
      return (c >= 32 && c <= 126) || (c >= 160 && c <= 255) ? ch : "?";
    })
    .join("");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of safe(text).split(/\r?\n|\s{2,}/)) {
    let line = "";
    for (const word of para.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
  const { client, items, payments, siteInfo } = input;
  const i = input.invoice;
  const cur = i.currency as string;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${i.number}`);
  pdf.setAuthor("ThumbStop");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // The official logo is embedded exactly as uploaded (same pixels, same proportions).
  const logo = input.logoBytes ? await pdf.embedPng(input.logoBytes) : null;

  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const ink = rgb(0.06, 0.09, 0.16);
  const muted = rgb(0.39, 0.45, 0.55);
  const brand = rgb(0.157, 0.384, 0.749); // royal blue
  const line = rgb(0.86, 0.89, 0.93);

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (t: string, x: number, yy: number, size = 10, f = font, color = ink) =>
    page.drawText(safe(t), { x, y: yy, size, font: f, color });
  const right = (t: string, xr: number, yy: number, size = 10, f = font, color = ink) =>
    page.drawText(safe(t), { x: xr - f.widthOfTextAtSize(safe(t), size), y: yy, size, font: f, color });

  // Header: logo (left), brand name beside it, contact details (right)
  const logoH = 52;
  if (logo) {
    const logoW = (logoH * logo.width) / logo.height; // keeps the original proportions
    page.drawImage(logo, { x: M, y: y - logoH, width: logoW, height: logoH });
    text("ThumbStop", M + logoW + 12, y - 30, 20, bold, ink);
  } else {
    text("ThumbStop", M, y - 30, 20, bold, ink);
  }
  const contact = [siteInfo.address, siteInfo.phoneDisplay, siteInfo.email];
  let cy = y - 12;
  for (const c of contact) {
    for (const l of wrap(c, font, 8.5, 210)) {
      right(l, W - M, cy, 8.5, font, muted);
      cy -= 11;
    }
  }
  y -= logoH + 26;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: line });
  y -= 30;

  text("INVOICE", M, y, 22, bold, brand);
  right(String(i.number), W - M, y, 14, bold);
  y -= 18;
  const statusLabel = i.status === "paid" ? "Paid" : i.status === "partial" ? "Partially paid" : titleCase(String(i.status));
  right(`Status: ${statusLabel}`, W - M, y, 9.5, font, muted);
  y -= 26;

  // Billed to + dates
  text("BILLED TO", M, y, 8, bold, muted);
  text("ISSUED", 360, y, 8, bold, muted);
  text("DUE", 460, y, 8, bold, muted);
  y -= 14;
  text(client.name ?? "", M, y, 11, bold);
  text(formatDate(i.issue_date), 360, y, 10);
  text(formatDate(i.due_date), 460, y, 10);
  let by = y - 14;
  const billLines = [client.company, client.email, client.phone, client.address].filter(Boolean) as string[];
  for (const b of billLines) {
    for (const l of wrap(b, font, 9.5, 280)) {
      text(l, M, by, 9.5, font, muted);
      by -= 12;
    }
  }
  if (i.payment_terms) {
    text("TERMS", 360, y - 28, 8, bold, muted);
    text(String(i.payment_terms), 360, y - 42, 9.5);
  }
  y = Math.min(by, y - 60) - 16;

  // Items table
  const tableHeader = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 22, color: rgb(0.945, 0.961, 0.98) });
    text("DESCRIPTION", M + 8, y, 8, bold, muted);
    right("QTY", 370, y, 8, bold, muted);
    right("UNIT PRICE", 460, y, 8, bold, muted);
    right("AMOUNT", W - M - 8, y, 8, bold, muted);
    y -= 24;
  };
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };
  tableHeader();
  for (const it of items) {
    const descLines = wrap(String(it.description), font, 10, 270);
    const need = descLines.length * 13 + 10;
    if (y - need < 150) {
      newPage();
      tableHeader();
    }
    descLines.forEach((l, k) => text(l, M + 8, y - k * 13, 10));
    right(String(Number(it.quantity)), 370, y, 10);
    right(formatMoneyPlain(it.unit_price, cur), 460, y, 10);
    right(formatMoneyPlain(it.amount, cur), W - M - 8, y, 10);
    y -= need - 2;
    page.drawLine({ start: { x: M, y: y + 14 }, end: { x: W - M, y: y + 14 }, thickness: 0.5, color: line });
  }

  // Totals
  if (y < 200) newPage();
  y -= 10;
  const totalsRow = (label: string, value: string, strong = false, color = ink) => {
    right(label, 430, y, strong ? 11 : 10, strong ? bold : font, strong ? ink : muted);
    right(value, W - M - 8, y, strong ? 11 : 10, strong ? bold : font, color);
    y -= strong ? 20 : 16;
  };
  const subtotal = Number(i.subtotal);
  const discount = Number(i.discount);
  const tax = Math.round((Number(i.total) - Math.max(subtotal - discount, 0)) * 100) / 100;
  totalsRow("Subtotal", formatMoneyPlain(subtotal, cur));
  if (discount > 0) totalsRow("Discount", `- ${formatMoneyPlain(discount, cur)}`);
  if (Number(i.tax_percent) > 0) totalsRow(`Tax (${Number(i.tax_percent)}%)`, formatMoneyPlain(tax, cur));
  totalsRow("Total", formatMoneyPlain(i.total, cur), true);
  totalsRow("Paid", formatMoneyPlain(i.paid_amount, cur));
  totalsRow("Balance due", formatMoneyPlain(i.balance, cur), true, brand);

  // Recorded payments (only payments that were really recorded and not voided)
  if (payments.length > 0) {
    y -= 8;
    if (y < 160) newPage();
    text("PAYMENTS RECEIVED", M, y, 8, bold, muted);
    y -= 14;
    for (const p of payments) {
      text(`${formatDate(p.paid_at ?? p.created_at)}  -  ${titleCase(String(p.method))}${p.reference ? `  -  Ref ${p.reference}` : ""}`, M, y, 9.5);
      right(formatMoneyPlain(p.amount, cur), W - M - 8, y, 9.5);
      y -= 14;
    }
  }

  // Payment instructions and notes
  const block = (title: string, body: string | null | undefined) => {
    if (!body) return;
    const lines = wrap(body, font, 9.5, W - 2 * M);
    if (y - lines.length * 12 - 30 < 60) newPage();
    y -= 14;
    text(title, M, y, 8, bold, muted);
    y -= 14;
    for (const l of lines) {
      text(l, M, y, 9.5);
      y -= 12;
    }
  };
  block("PAYMENT INSTRUCTIONS", i.payment_instructions);
  block("NOTES", i.notes);

  page.drawLine({ start: { x: M, y: 52 }, end: { x: W - M, y: 52 }, thickness: 0.5, color: line });
  text("Thank you for choosing ThumbStop.", M, 38, 9, font, muted);

  return pdf.save();
}
