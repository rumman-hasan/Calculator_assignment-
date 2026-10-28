import Link from "next/link";
import { EmptyRow, PageHeader, ProgressBar, Stat, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import type { Row } from "@/lib/types";

export default async function PortalHome() {
  // Row Level Security returns only this client's own rows.
  const { supabase, profile } = await requireRole(["client"]);
  const [projects, invoices] = await Promise.all([
    supabase.from("projects").select("id,title,status,progress,deadline").is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("invoice_overview").select("id,number,currency,total,balance,status,due_date").neq("stored_status", "draft").order("created_at", { ascending: false }),
  ]);
  const proj = (projects.data ?? []) as Row[];
  const inv = (invoices.data ?? []) as Row[];
  const open = inv.filter((i) => ["sent", "partial", "overdue"].includes(i.status));
  const dueByCurrency = new Map<string, number>();
  for (const i of open) dueByCurrency.set(i.currency, (dueByCurrency.get(i.currency) ?? 0) + Number(i.balance));
  const dueText = dueByCurrency.size ? [...dueByCurrency].map(([c, v]) => formatMoney(v, c)).join(" + ") : formatMoney(0, "BDT");

  return (
    <>
      <PageHeader title={`Welcome, ${profile.full_name || "there"}`} text="Follow your projects, download approved files and see your invoices." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active projects" value={proj.filter((p) => !["completed", "cancelled"].includes(p.status)).length} />
        <Stat label="Open invoices" value={open.length} />
        <Stat label="Balance due" value={dueText} />
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl font-bold text-slate-900">Your projects</h2>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Project</th><th>Status</th><th>Progress</th><th>Deadline</th></tr></thead>
            <tbody>
              {proj.length === 0 && <EmptyRow colSpan={4} text="No projects yet. We will add yours here once work begins." />}
              {proj.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/portal/projects/${p.id}`} className="font-semibold text-brand-royal hover:underline">{p.title}</Link></td>
                  <td><StatusBadge value={p.status} /></td>
                  <td><ProgressBar value={p.progress} /></td>
                  <td>{formatDate(p.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
