import Link from "next/link";
import { notFound } from "next/navigation";
import { Flash, PageHeader, StatusBadge } from "@/components/app-ui";
import { PrintButton } from "@/components/print-button";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney, titleCase, todayDhaka } from "@/lib/format";
import { site } from "@/lib/site-config";
import type { Row } from "@/lib/types";
import { whatsappToClient } from "@/lib/whatsapp";
import { recordManualPaymentAction, setInvoiceStatusAction, voidPaymentAction } from "../actions";

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; ok?: string };
}) {
  const { supabase } = await requireRole(["admin"]);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();

  const { data } = await supabase.from("invoice_overview").select("*").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  const inv = data as Row;

  const [clientRes, projectRes, items, payments] = await Promise.all([
    supabase.from("clients").select("name,company,email,phone,address").eq("id", inv.client_id).maybeSingle(),
    inv.project_id ? supabase.from("projects").select("title").eq("id", inv.project_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("invoice_items").select("id,description,quantity,unit_price,amount").eq("invoice_id", params.id).order("id"),
    supabase
      .from("payments")
      .select("id,method,amount,status,paid_at,created_at,reference,void_reason")
      .eq("invoice_id", params.id)
      .order("created_at", { ascending: true }),
  ]);
  const client = (clientRes.data ?? {}) as Row;
  const project = (projectRes.data ?? null) as Row | null;
  const itemRows = (items.data ?? []) as Row[];
  const payRows = (payments.data ?? []) as Row[];

  const cur = inv.currency as string;
  const subtotal = Number(inv.subtotal);
  const discount = Number(inv.discount);
  const taxAmount = Math.round((Number(inv.total) - Math.max(subtotal - discount, 0)) * 100) / 100;
  const canPay = inv.stored_status === "sent" && Number(inv.balance) > 0;
  const portalLink = `${site.url}/portal/invoices/${inv.id}`;
  const shareText = `Hello ${client.name ?? ""}, invoice ${inv.number} for ${formatMoney(inv.total, cur)} is ready. Please sign in to your ThumbStop portal to view and download it: ${portalLink}`;
  const mailto = `mailto:${encodeURIComponent(client.email ?? "")}?subject=${encodeURIComponent(`Invoice ${inv.number} from ThumbStop`)}&body=${encodeURIComponent(shareText)}`;
  const today = todayDhaka();

  return (
    <>
      <p className="mb-3 text-sm print:hidden"><Link href="/admin/invoices" className="text-brand-royal">← All invoices</Link></p>
      <PageHeader title={`Invoice ${inv.number}`} text={`${client.name ?? ""}${project?.title ? ` · ${project.title}` : ""}`}>
        <StatusBadge value={inv.status} />
      </PageHeader>
      <div className="print:hidden"><Flash searchParams={searchParams} /></div>

      {inv.stored_status !== "draft" && inv.stored_status !== "cancelled" && (
        <p className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 print:hidden">
          This invoice is final and locked. To correct a mistake, cancel it (after voiding any payments) and issue a new one.
        </p>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="label">Issued</dt><dd>{formatDate(inv.issue_date)}</dd></div>
            <div><dt className="label">Due</dt><dd className={inv.status === "overdue" ? "font-semibold text-red-700" : ""}>{formatDate(inv.due_date)}</dd></div>
            <div><dt className="label">Terms</dt><dd>{inv.payment_terms ?? "—"}</dd></div>
            <div className="sm:col-span-3">
              <dt className="label">Billed to</dt>
              <dd>
                <span className="font-semibold">{client.name}</span>{client.company ? ` · ${client.company}` : ""}
                <br />{[client.email, client.phone].filter(Boolean).join(" · ") || "—"}
                {client.address ? <><br />{client.address}</> : null}
              </dd>
            </div>
          </dl>
          <div className="mt-6 overflow-x-auto">
            <table className="data">
              <thead><tr><th>Description</th><th>Qty</th><th>Unit price</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {itemRows.map((it) => (
                  <tr key={it.id}>
                    <td>{it.description}</td>
                    <td>{Number(it.quantity)}</td>
                    <td>{formatMoney(it.unit_price, cur)}</td>
                    <td className="text-right">{formatMoney(it.amount, cur)}</td>
                  </tr>
                ))}
                <tr><td colSpan={3} className="text-right">Subtotal</td><td className="text-right">{formatMoney(subtotal, cur)}</td></tr>
                {discount > 0 && <tr><td colSpan={3} className="text-right">Discount</td><td className="text-right">− {formatMoney(discount, cur)}</td></tr>}
                {Number(inv.tax_percent) > 0 && <tr><td colSpan={3} className="text-right">Tax ({Number(inv.tax_percent)}%)</td><td className="text-right">{formatMoney(taxAmount, cur)}</td></tr>}
                <tr><td colSpan={3} className="text-right font-semibold">Total</td><td className="text-right font-semibold text-slate-900">{formatMoney(inv.total, cur)}</td></tr>
                <tr><td colSpan={3} className="text-right">Paid</td><td className="text-right">{formatMoney(inv.paid_amount, cur)}</td></tr>
                <tr><td colSpan={3} className="text-right font-semibold">Balance due</td><td className="text-right font-semibold text-brand-royal">{formatMoney(inv.balance, cur)}</td></tr>
              </tbody>
            </table>
          </div>
          {inv.payment_instructions && (
            <div className="mt-5"><p className="label">Payment instructions</p><p className="whitespace-pre-wrap text-sm text-slate-700">{inv.payment_instructions}</p></div>
          )}
          {inv.notes && <div className="mt-4"><p className="label">Notes</p><p className="whitespace-pre-wrap text-sm text-slate-700">{inv.notes}</p></div>}
        </section>

        <div className="space-y-8 print:hidden">
          <section className="card p-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-3">
              <a href={`/api/invoices/${inv.id}/pdf`} className="btn-primary btn-sm">Download PDF</a>
              <PrintButton label="Print" />
              {inv.stored_status === "sent" && (
                <>
                  <a href={whatsappToClient(client.phone, shareText)} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Share on WhatsApp</a>
                  <a href={mailto} className="btn-outline btn-sm">Share by email</a>
                </>
              )}
              {inv.stored_status === "draft" && (
                <form action={setInvoiceStatusAction}>
                  <input type="hidden" name="id" value={inv.id} />
                  <input type="hidden" name="status" value="sent" />
                  <button className="btn-primary btn-sm">Mark as sent (locks it)</button>
                </form>
              )}
              {["draft", "sent"].includes(inv.stored_status) && Number(inv.paid_amount) === 0 && (
                <form action={setInvoiceStatusAction}>
                  <input type="hidden" name="id" value={inv.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <button className="btn-danger btn-sm">Cancel invoice</button>
                </form>
              )}
            </div>
            {inv.stored_status === "sent" && (
              <p className="mt-3 text-xs text-slate-500">
                The share message contains a link to the client portal. The client must sign in to see the invoice; there are no public invoice links.
                {!client.email && " This client has no email saved, so the email button opens an empty address."}
              </p>
            )}
          </section>

          {canPay && (
            <section className="card p-6">
              <h2 className="font-display text-xl font-bold text-slate-900">Record a payment</h2>
              <p className="mt-2 text-xs text-slate-500">Only record money you have actually received. Partial payments are fine. The status updates by itself.</p>
              <form action={recordManualPaymentAction} className="mt-4 grid gap-3">
                <input type="hidden" name="invoice_id" value={inv.id} />
                <input name="amount" type="number" min="0.01" step="0.01" max={Number(inv.balance)} defaultValue={Number(inv.balance)} required className="input" aria-label="Amount" />
                <input name="paid_on" type="date" max={today} defaultValue={today} required className="input" aria-label="Date received" />
                <select name="method" className="input" aria-label="Method" defaultValue="cash">
                  <option value="cash">Cash</option>
                  <option value="bank">Bank transfer</option>
                  <option value="bkash_manual">bKash (manual)</option>
                  <option value="nagad_manual">Nagad (manual)</option>
                  <option value="other">Other</option>
                </select>
                <input name="reference" maxLength={120} placeholder="Reference / transaction ID (optional)" className="input" aria-label="Reference" />
                <button className="btn-primary">Record payment</button>
              </form>
            </section>
          )}

          <section className="card p-6">
            <h2 className="font-display text-xl font-bold text-slate-900">Payment history</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {payRows.length === 0 && <li className="text-slate-500">No payments yet.</li>}
              {payRows.map((p) => (
                <li key={p.id} className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`font-medium ${p.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"}`}>{formatMoney(p.amount, cur)} · {titleCase(p.method)}</p>
                      <p className="text-xs text-slate-500">{formatDate(p.paid_at ?? p.created_at)}{p.reference ? ` · Ref ${p.reference}` : ""}</p>
                      {p.status === "cancelled" && <p className="text-xs text-red-700">Voided: {p.void_reason}</p>}
                    </div>
                    <StatusBadge value={p.status === "paid" ? "paid" : "cancelled"} />
                  </div>
                  {p.status === "paid" && inv.stored_status !== "cancelled" && (
                    <form action={voidPaymentAction} className="mt-2 flex gap-2">
                      <input type="hidden" name="payment_id" value={p.id} />
                      <input type="hidden" name="invoice_id" value={inv.id} />
                      <input name="reason" required minLength={3} maxLength={300} placeholder="Reason for voiding" className="input !py-1.5 text-xs" aria-label="Reason for voiding this payment" />
                      <button className="btn-danger btn-sm">Void</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
