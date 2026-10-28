import Link from "next/link";
import { EmptyRow, Flash, PageHeader, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import type { Row } from "@/lib/types";

const STATUS_OPTIONS = ["draft", "sent", "partial", "overdue", "paid", "cancelled"];

type Search = { error?: string; ok?: string; q?: string; status?: string; client?: string; from?: string; to?: string };

const safeText = (v: string | undefined) => (v ?? "").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 60);
const isDate = (v: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(v ?? "");

export default async function InvoicesPage({ searchParams }: { searchParams: Search }) {
  const { supabase } = await requireRole(["admin"]);
  const q = safeText(searchParams.q);
  const status = STATUS_OPTIONS.includes(searchParams.status ?? "") ? searchParams.status! : "";
  const clientFilter = /^[0-9a-f-]{36}$/i.test(searchParams.client ?? "") ? searchParams.client! : "";

  const { data: allClients } = await supabase.from("clients").select("id,name").order("name");
  const clientRows = (allClients ?? []) as Row[];

  let query = supabase
    .from("invoice_overview")
    .select("id,number,client_id,status,total,paid_amount,balance,currency,issue_date,due_date")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status) query = query.eq("status", status);
  if (clientFilter) query = query.eq("client_id", clientFilter);
  if (isDate(searchParams.from)) query = query.gte("issue_date", searchParams.from!);
  if (isDate(searchParams.to)) query = query.lte("issue_date", searchParams.to!);
  if (q) {
    const ids = clientRows.filter((c) => String(c.name).toLowerCase().includes(q.toLowerCase())).map((c) => c.id);
    query = ids.length ? query.or(`number.ilike.%${q}%,client_id.in.(${ids.join(",")})`) : query.ilike("number", `%${q}%`);
  }
  const { data } = await query;
  const rows = (data ?? []) as Row[];
  const names = new Map(clientRows.map((c) => [c.id as string, c.name as string]));

  // Money summary per currency (drafts and cancelled invoices are not counted).
  const summary = new Map<string, { invoiced: number; paid: number; outstanding: number; overdue: number }>();
  for (const i of rows) {
    if (i.status === "draft" || i.status === "cancelled") continue;
    const cur = i.currency ?? "BDT";
    const s = summary.get(cur) ?? { invoiced: 0, paid: 0, outstanding: 0, overdue: 0 };
    s.invoiced += Number(i.total);
    s.paid += Number(i.paid_amount);
    s.outstanding += Number(i.balance);
    if (i.status === "overdue") s.overdue += Number(i.balance);
    summary.set(cur, s);
  }

  return (
    <>
      <PageHeader title="Invoices" text="Create invoices, send them to clients and track manual payments. Sent invoices are locked.">
        <Link href="/admin/invoices/new" className="btn-primary">New invoice</Link>
      </PageHeader>
      <Flash searchParams={searchParams} />

      <section className="card mb-6 overflow-x-auto">
        <table className="data">
          <thead><tr><th>Currency</th><th>Invoiced</th><th>Paid</th><th>Outstanding</th><th>Overdue</th></tr></thead>
          <tbody>
            {summary.size === 0 && <EmptyRow colSpan={5} text="No sent invoices in this view." />}
            {Array.from(summary.entries()).map(([cur, s]) => (
              <tr key={cur}>
                <td className="font-semibold">{cur}</td>
                <td>{formatMoney(s.invoiced, cur)}</td>
                <td>{formatMoney(s.paid, cur)}</td>
                <td>{formatMoney(s.outstanding, cur)}</td>
                <td className={s.overdue > 0 ? "font-semibold text-red-700" : ""}>{formatMoney(s.overdue, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form method="get" className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={q} placeholder="Search number or client" className="input lg:col-span-2" aria-label="Search" />
        <select name="status" defaultValue={status} className="input" aria-label="Status">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === "partial" ? "Partially paid" : s[0].toUpperCase() + s.slice(1)}</option>)}
        </select>
        <select name="client" defaultValue={clientFilter} className="input" aria-label="Client">
          <option value="">All clients</option>
          {clientRows.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input name="from" type="date" defaultValue={isDate(searchParams.from) ? searchParams.from : ""} className="input" aria-label="Issued from" />
        <input name="to" type="date" defaultValue={isDate(searchParams.to) ? searchParams.to : ""} className="input" aria-label="Issued to" />
        <div className="flex gap-3 sm:col-span-2 lg:col-span-6">
          <button className="btn-primary btn-sm">Filter</button>
          <Link href="/admin/invoices" className="btn-outline btn-sm">Clear</Link>
        </div>
      </form>

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Number</th><th>Client</th><th>Total</th><th>Balance</th><th>Status</th><th>Issued</th><th>Due</th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={7} text="No invoices match." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/admin/invoices/${i.id}`} className="font-semibold text-brand-royal hover:underline">{i.number}</Link></td>
                <td>{names.get(i.client_id) ?? "—"}</td>
                <td>{formatMoney(i.total, i.currency)}</td>
                <td>{i.status === "draft" || i.status === "cancelled" ? "—" : formatMoney(i.balance, i.currency)}</td>
                <td><StatusBadge value={i.status} /></td>
                <td>{formatDate(i.issue_date)}</td>
                <td>{formatDate(i.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
