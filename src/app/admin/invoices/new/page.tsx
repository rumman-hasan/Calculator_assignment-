import Link from "next/link";
import { Field, Flash, PageHeader } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { CURRENCIES, todayDhaka } from "@/lib/format";
import { site } from "@/lib/site-config";
import type { Row } from "@/lib/types";
import { createInvoiceAction } from "../actions";

export default async function NewInvoicePage({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const { supabase } = await requireRole(["admin"]);
  const [clients, projects] = await Promise.all([
    supabase.from("clients").select("id,name,company,email,phone,address").is("archived_at", null).order("name"),
    supabase.from("projects").select("id,title,client_id").is("archived_at", null).order("title"),
  ]);
  const clientRows = (clients.data ?? []) as Row[];
  const today = todayDhaka();

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/admin/invoices" className="text-brand-royal">← All invoices</Link></p>
      <PageHeader title="New invoice" text="Saved as a draft first. The client sees it only after you mark it as sent, and then it is locked." />
      <Flash searchParams={searchParams} />

      {clientRows.length === 0 ? (
        <p className="text-sm text-slate-600">Add a client first.</p>
      ) : (
        <form action={createInvoiceAction} className="card max-w-3xl space-y-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client" name="client_id" required>
              <select id="client_id" name="client_id" required className="input">
                {clientRows.map((c) => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
              </select>
            </Field>
            <Field label="Project (optional)" name="project_id">
              <select id="project_id" name="project_id" className="input">
                <option value="">— none —</option>
                {((projects.data ?? []) as Row[]).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>
            <Field label="Issue date" name="issue_date" type="date" defaultValue={today} required />
            <Field label="Due date" name="due_date" type="date" />
            <Field label="Currency" name="currency">
              <select id="currency" name="currency" defaultValue="BDT" className="input">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Payment terms" name="payment_terms" placeholder="e.g. Due within 7 days" />
          </div>
          <p className="-mt-3 text-xs text-slate-500">The client's saved name, company, email, phone and address are printed on the invoice automatically.</p>

          <fieldset>
            <legend className="label">Line items</legend>
            <div className="space-y-3">
              {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_90px_140px]">
                  <input name="item_desc" placeholder={i === 0 ? "Service or item description" : "Description (optional)"} className="input" aria-label={`Item ${i + 1} description`} />
                  <input name="item_qty" type="number" min="0.01" step="0.01" defaultValue="1" className="input" aria-label={`Item ${i + 1} quantity`} />
                  <input name="item_price" type="number" min="0" step="0.01" placeholder="Unit price" className="input" aria-label={`Item ${i + 1} unit price`} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Empty rows are ignored. Line totals, subtotal and the final amount are calculated by the database.</p>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount (amount, same currency)" name="discount" type="number" min={0} step="0.01" defaultValue="0" />
            <Field label="Tax / VAT (%)" name="tax_percent" type="number" min={0} max={100} step="0.01" defaultValue="0" />
          </div>
          <p className="-mt-3 text-xs text-slate-500">Total = (subtotal − discount) + tax. Leave tax at 0 if it does not apply.</p>

          <Field label="Payment instructions (printed on the invoice)" name="payment_instructions" textarea rows={3}
            defaultValue={`Please send the payment and share the payment reference with us on WhatsApp (${site.phoneDisplay}).`} />
          <Field label="Notes (printed on the invoice)" name="notes" textarea />
          <button className="btn-primary">Create draft invoice</button>
        </form>
      )}
    </>
  );
}
