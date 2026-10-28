"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { done, fail, logActivity, notifyClient, str } from "@/lib/actions";
import { invoiceHeaderSchema, invoiceItemSchema, manualPaymentSchema, voidPaymentSchema } from "@/lib/validation";
import { formatMoney } from "@/lib/format";

// Money pages and actions are OWNER ONLY. The database enforces this too (Row Level Security).
const LIST = "/admin/invoices";
const NEW = "/admin/invoices/new";
const detail = (id: string) => `${LIST}/${id}`;
const UUID = /^[0-9a-f-]{36}$/i;

/** Shows our own database messages (they are written for people); hides anything technical. */
function friendly(message: string | undefined, fallback: string): string {
  if (!message) return fallback;
  if (message.length > 160 || /violates|row-level|permission denied|constraint|duplicate key/i.test(message)) return fallback;
  return message;
}

export async function createInvoiceAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin"]);

  const header = invoiceHeaderSchema.safeParse({
    client_id: str(fd, "client_id"),
    project_id: str(fd, "project_id"),
    issue_date: str(fd, "issue_date"),
    due_date: str(fd, "due_date"),
    currency: str(fd, "currency") || "BDT",
    discount: str(fd, "discount") || "0",
    tax_percent: str(fd, "tax_percent") || "0",
    payment_terms: str(fd, "payment_terms"),
    payment_instructions: str(fd, "payment_instructions"),
    notes: str(fd, "notes"),
  });
  if (!header.success) fail(NEW, header.error.issues[0].message);

  const descs = fd.getAll("item_desc").map((v) => String(v));
  const qtys = fd.getAll("item_qty").map((v) => String(v));
  const prices = fd.getAll("item_price").map((v) => String(v));
  const items: { description: string; quantity: number; unit_price: number }[] = [];
  for (let i = 0; i < descs.length; i++) {
    if (!descs[i].trim() && !prices[i]?.trim()) continue; // skip empty rows
    const parsed = invoiceItemSchema.safeParse({ description: descs[i], quantity: qtys[i] || "1", unit_price: prices[i] });
    if (!parsed.success) fail(NEW, `Row ${i + 1}: ${parsed.error.issues[0].message}`);
    items.push(parsed.data);
  }
  if (items.length === 0) fail(NEW, "Add at least one line item.");

  const subtotal = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);
  if (header.data.discount > subtotal) fail(NEW, "The discount is more than the invoice subtotal.");
  if (header.data.due_date && header.data.due_date < header.data.issue_date) fail(NEW, "The due date is before the issue date.");

  const h = header.data;
  // One database function creates the invoice and all its items together, so nothing is half-saved.
  const { data: id, error } = await supabase.rpc("create_invoice", {
    p_client: h.client_id,
    p_project: h.project_id,
    p_issue: h.issue_date,
    p_due: h.due_date,
    p_currency: h.currency,
    p_discount: h.discount,
    p_tax: h.tax_percent,
    p_terms: h.payment_terms,
    p_instructions: h.payment_instructions,
    p_notes: h.notes,
    p_items: items,
  });
  if (error || !id) fail(NEW, friendly(error?.message, "Could not create the invoice."));

  await logActivity(supabase, user.id, "invoice.create", "invoice", String(id));
  revalidatePath(LIST);
  redirect(`${detail(String(id))}?ok=${encodeURIComponent("Invoice created as a draft. Check it, then mark it as sent. After that it is locked.")}`);
}

export async function setInvoiceStatusAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin"]);
  const id = str(fd, "id");
  const next = str(fd, "status");
  if (!UUID.test(id) || !["sent", "cancelled"].includes(next)) fail(LIST, "Invalid request.");

  const { data: inv } = await supabase.from("invoice_overview").select("stored_status,number,total,currency,client_id,paid_amount").eq("id", id).single();
  if (!inv) fail(LIST, "Invoice not found.");
  if (next === "sent" && inv.stored_status !== "draft") fail(detail(id), "Only a draft invoice can be marked as sent.");
  if (next === "cancelled" && !["draft", "sent"].includes(inv.stored_status)) fail(detail(id), "This invoice cannot be cancelled.");
  if (next === "cancelled" && Number(inv.paid_amount) > 0) fail(detail(id), "Void the recorded payments before cancelling this invoice.");
  if (next === "sent" && Number(inv.total) <= 0) fail(detail(id), "An invoice needs a total above 0 before it is sent.");

  const { error } = await supabase.from("invoices").update({ status: next }).eq("id", id);
  if (error) fail(detail(id), friendly(error.message, "Could not update the invoice."));
  await logActivity(supabase, user.id, `invoice.${next}`, "invoice", id);
  if (next === "sent") {
    await notifyClient(supabase, inv.client_id, "New invoice", `Invoice ${inv.number} for ${formatMoney(inv.total, inv.currency)} is ready.`, `/portal/invoices/${id}`);
  }
  revalidatePath(detail(id));
  done(detail(id), next === "sent" ? "Invoice marked as sent. It is now locked and visible to the client." : "Invoice cancelled.");
}

/** Records money received outside the website (cash, bank, bKash, Nagad). Nothing here touches a payment gateway. */
export async function recordManualPaymentAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin"]);
  const parsed = manualPaymentSchema.safeParse({
    invoice_id: str(fd, "invoice_id"),
    amount: str(fd, "amount"),
    method: str(fd, "method"),
    paid_on: str(fd, "paid_on"),
    reference: str(fd, "reference"),
  });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);
  const id = parsed.data.invoice_id;

  const { data: inv } = await supabase.from("invoice_overview").select("stored_status,balance,currency").eq("id", id).single();
  if (!inv) fail(LIST, "Invoice not found.");
  if (inv.stored_status !== "sent") fail(detail(id), "Payments can only be recorded on a sent invoice.");
  const due = Number(inv.balance);
  if (parsed.data.amount > due + 0.001) fail(detail(id), `Amount is more than the balance due (${formatMoney(due, inv.currency)}).`);

  const { error } = await supabase.from("payments").insert({
    invoice_id: id,
    tran_id: `MAN-${randomUUID()}`,
    provider: "manual",
    method: parsed.data.method,
    amount: parsed.data.amount,
    currency: inv.currency,
    reference: parsed.data.reference,
    status: "paid",
    paid_at: `${parsed.data.paid_on}T12:00:00+06:00`,
    created_by: user.id,
  });
  if (error) fail(detail(id), friendly(error.message, "Could not record the payment."));
  await logActivity(supabase, user.id, "payment.manual", "invoice", id, { amount: parsed.data.amount, method: parsed.data.method });
  revalidatePath(detail(id));
  done(detail(id), "Payment recorded.");
}

/** A mistaken payment is voided with a reason, never edited or deleted, so the history stays complete. */
export async function voidPaymentAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin"]);
  const parsed = voidPaymentSchema.safeParse({
    payment_id: str(fd, "payment_id"),
    invoice_id: str(fd, "invoice_id"),
    reason: str(fd, "reason"),
  });
  if (!parsed.success) fail(LIST, parsed.error.issues[0].message);
  const { payment_id, invoice_id, reason } = parsed.data;

  const { data: changed, error } = await supabase
    .from("payments")
    .update({ status: "cancelled", void_reason: reason })
    .eq("id", payment_id)
    .eq("invoice_id", invoice_id)
    .eq("status", "paid")
    .select("id");
  if (error) fail(detail(invoice_id), friendly(error.message, "Could not void the payment."));
  if (!changed || changed.length === 0) fail(detail(invoice_id), "That payment was not found or is already voided.");
  await logActivity(supabase, user.id, "payment.void", "invoice", invoice_id, { reason });
  revalidatePath(detail(invoice_id));
  done(detail(invoice_id), "Payment voided. It stays in the history.");
}
