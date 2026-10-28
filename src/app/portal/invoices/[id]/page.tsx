import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyRow, PageHeader, StatusBadge } from "@/components/app-ui";
import { PrintButton } from "@/components/print-button";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import type { Row } from "@/lib/types";

export default async function PortalInvoice({ params }: { params: { id: string } }) {
  const { supabase } = await requireRole(["client"]);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { data } = await supabase.from("invoice_overview").select("*").eq("id", params.id).neq("stored_status", "draft").maybeSingle();
  if (!data) notFound(); // someone else's invoice looks exactly like a missing one
  const inv = data as Row;
  const [items, payments] = await Promise.all([
    supabase.from("invoice_items").select("id,description,quantity,unit_price,amount").eq("invoice_id", params.id).order("id"),
    supabase.from("payments").select("id,amount,method,paid_at,reference").eq("invoice_id", params.id).eq("status", "paid").order("paid_at"),
  ]);
  const cur = inv.currency;
  const itemRows = (items.data ?? []) as Row[];
  const payRows = (payments.data ?? []) as Row[];
  const discount = Number(inv.discount ?? 0);
  const tax = Number(inv.tax_percent ?? 0);

  return (
    <>
      <PageHeader title={`Invoice ${inv.number}`}>
        <div className="flex items-center gap-3 print:hidden">
          <StatusBadge value={inv.status} />
          <a href={`/api/invoices/${inv.id}/pdf`} className="btn-primary btn-sm">Download PDF</a>
          <PrintButton />
        </div>
      </PageHeader>

      <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div><p className="label">Issued</p><p>{formatDate(inv.issue_date)}</p></div>
        <div><p className="label">Due</p><p>{formatDate(inv.due_date)}</p></div>
        <div><p className="label">Balance due</p><p className="font-semibold">{formatMoney(inv.balance, cur)}</p></div>
      </div>

      <div className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead>
          <tbody>
            {itemRows.length === 0 && <EmptyRow colSpan={4} text="No items." />}
            {itemRows.map((it) => (
              <tr key={it.id}><td>{it.description}</td><td>{it.quantity}</td><td>{formatMoney(it.unit_price, cur)}</td><td>{formatMoney(it.amount, cur)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto w-full max-w-xs space-y-1 p-5 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(inv.subtotal, cur)}</dd></div>
          {discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>-{formatMoney(discount, cur)}</dd></div>}
          {tax > 0 && <div className="flex justify-between"><dt>Tax ({tax}%)</dt><dd>included</dd></div>}
          <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatMoney(inv.total, cur)}</dd></div>
          <div className="flex justify-between"><dt>Paid</dt><dd>{formatMoney(inv.paid_amount, cur)}</dd></div>
          <div className="flex justify-between font-semibold"><dt>Balance</dt><dd>{formatMoney(inv.balance, cur)}</dd></div>
        </dl>
      </div>

      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl font-bold text-slate-900">Payment history</h2>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Amount</th></tr></thead>
            <tbody>
              {payRows.length === 0 && <EmptyRow colSpan={4} text="No payments recorded yet." />}
              {payRows.map((p) => (
                <tr key={p.id}><td>{formatDate(p.paid_at)}</td><td>{String(p.method).replace(/_/g, " ")}</td><td>{p.reference ?? "—"}</td><td>{formatMoney(p.amount, cur)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {(inv.payment_instructions || inv.payment_terms || inv.notes) && (
        <section className="card space-y-3 p-5 text-sm">
          {inv.payment_instructions && <div><p className="label">How to pay</p><p className="whitespace-pre-line">{inv.payment_instructions}</p></div>}
          {inv.payment_terms && <div><p className="label">Terms</p><p className="whitespace-pre-line">{inv.payment_terms}</p></div>}
          {inv.notes && <div><p className="label">Notes</p><p className="whitespace-pre-line">{inv.notes}</p></div>}
        </section>
      )}
      <p className="mt-8 print:hidden"><Link href="/portal/invoices" className="text-sm font-semibold text-brand-royal">← All invoices</Link></p>
    </>
  );
}
