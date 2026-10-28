import { EmptyRow, PageHeader, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import type { Row } from "@/lib/types";

const one = (v: unknown): Row | undefined => (Array.isArray(v) ? (v[0] as Row | undefined) : (v as Row | undefined));

function dhakaMonth(iso: string | null): string {
  if (!iso) return "Unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-CA", { year: "numeric", month: "2-digit", timeZone: "Asia/Dhaka" });
}

function monthLabel(key: string): string {
  const d = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function tally(rows: Row[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((m, r) => {
    const k = String(r.status);
    m[k] = (m[k] ?? 0) + 1;
    return m;
  }, {});
}

export default async function ReportsPage() {
  const { supabase } = await requireRole(["admin"]);

  const [paymentsRes, invoicesRes, enquiriesRes] = await Promise.all([
    supabase
      .from("payments")
      .select("id,amount,currency,method,paid_at,created_at,invoices(number,clients(name))")
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(500),
    supabase.from("invoice_overview").select("status,stored_status,total,currency"),
    supabase.from("enquiries").select("status"),
  ]);

  const payments = (paymentsRes.data ?? []) as Row[];
  const invoices = (invoicesRes.data ?? []) as Row[];
  const enquiries = (enquiriesRes.data ?? []) as Row[];

  // Money is never added across currencies: every figure is grouped by currency.
  const cur = (r: Row) => String(r.currency ?? "BDT");
  const currencies = Array.from(new Set([...payments.map(cur), ...invoices.map(cur)])).sort();
  const sumBy = (rows: Row[], c: string, f: string) => rows.filter((r) => cur(r) === c).reduce((s, r) => s + Number(r[f]), 0);
  const money = currencies.map((c) => {
    const invoiced = sumBy(invoices.filter((i) => !["draft", "cancelled"].includes(i.stored_status)), c, "total");
    const collected = sumBy(payments, c, "amount");
    return { c, invoiced, collected, outstanding: Math.max(0, invoiced - collected) };
  });

  const byMonth = new Map<string, number>();
  const byMethod = new Map<string, number>();
  payments.forEach((p) => {
    const m = `${dhakaMonth(p.paid_at ?? p.created_at)}|${cur(p)}`;
    byMonth.set(m, (byMonth.get(m) ?? 0) + Number(p.amount));
    const k = `${p.method}|${cur(p)}`;
    byMethod.set(k, (byMethod.get(k) ?? 0) + Number(p.amount));
  });
  const months = Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  const methods = Array.from(byMethod.entries()).sort((a, b) => b[1] - a[1]);

  const invoiceCounts = tally(invoices);
  const enquiryCounts = tally(enquiries);

  return (
    <>
      <PageHeader title="Reports" text="Money in, invoice status and enquiry pipeline. Figures come from recorded (non-voided) payments, shown per currency." />

      <section className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Currency</th><th>Invoiced (sent)</th><th>Collected</th><th>Outstanding</th></tr></thead>
          <tbody>
            {money.length === 0 && <EmptyRow colSpan={4} text="No invoices yet." />}
            {money.map((m) => (
              <tr key={m.c}><td>{m.c}</td><td>{formatMoney(m.invoiced, m.c)}</td><td>{formatMoney(m.collected, m.c)}</td><td>{formatMoney(m.outstanding, m.c)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto">
          <h2 className="px-4 pt-4 font-display text-lg font-bold text-slate-900">Collected per month</h2>
          <table className="data mt-2">
            <thead><tr><th>Month</th><th>Amount</th></tr></thead>
            <tbody>
              {months.length === 0 && <EmptyRow colSpan={2} text="No payments recorded yet." />}
              {months.map(([key, amount]) => (
                <tr key={key}><td>{monthLabel(key.split("|")[0])}</td><td>{formatMoney(amount, key.split("|")[1])}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card overflow-x-auto">
          <h2 className="px-4 pt-4 font-display text-lg font-bold text-slate-900">Collected by method</h2>
          <table className="data mt-2">
            <thead><tr><th>Method</th><th>Amount</th></tr></thead>
            <tbody>
              {methods.length === 0 && <EmptyRow colSpan={2} text="No payments recorded yet." />}
              {methods.map(([key, amount]) => (
                <tr key={key}><td>{titleCase(key.split("|")[0])}</td><td>{formatMoney(amount, key.split("|")[1])}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Invoices by status</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.keys(invoiceCounts).length === 0 && <li className="text-slate-500">No invoices yet.</li>}
            {Object.entries(invoiceCounts).map(([k, n]) => (
              <li key={k} className="flex items-center justify-between"><StatusBadge value={k} /><span className="text-slate-900">{n}</span></li>
            ))}
          </ul>
        </section>

        <section className="card p-4">
          <h2 className="font-display text-lg font-bold text-slate-900">Enquiries by status</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.keys(enquiryCounts).length === 0 && <li className="text-slate-500">No enquiries yet.</li>}
            {Object.entries(enquiryCounts).map(([k, n]) => (
              <li key={k} className="flex items-center justify-between"><StatusBadge value={k} /><span className="text-slate-900">{n}</span></li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-10 overflow-x-auto">
        <h2 className="px-4 pt-4 font-display text-lg font-bold text-slate-900">Transaction history</h2>
        <p className="px-4 text-xs text-slate-500">Latest 50 paid payments.</p>
        <table className="data mt-2">
          <thead><tr><th>Date</th><th>Invoice</th><th>Client</th><th>Method</th><th>Amount</th></tr></thead>
          <tbody>
            {payments.length === 0 && <EmptyRow colSpan={5} text="No transactions yet." />}
            {payments.slice(0, 50).map((p) => {
              const inv = one(p.invoices);
              const client = one(inv?.clients);
              return (
                <tr key={p.id}>
                  <td>{formatDate(p.paid_at ?? p.created_at)}</td>
                  <td>{inv?.number ?? "—"}</td>
                  <td>{client?.name ?? "—"}</td>
                  <td>{titleCase(p.method)}</td>
                  <td>{formatMoney(p.amount, p.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}
