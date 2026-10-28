import Link from "next/link";
import { EmptyRow, PageHeader, ProgressBar, Stat, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatBDT, formatDate, todayDhaka } from "@/lib/format";
import type { Row } from "@/lib/types";

export default async function AdminOverview() {
  const { supabase, profile } = await requireRole(["admin", "staff"]);
  const isOwner = profile.role === "admin";
  const head = { count: "exact" as const, head: true };
  const today = todayDhaka();

  const [clients, projectCount, newEnq, ongoing, recent, invoices, paid] = await Promise.all([
    supabase.from("clients").select("id", head).is("archived_at", null),
    supabase.from("projects").select("id", head).in("status", ["planning", "in_progress", "review"]).is("archived_at", null),
    supabase.from("enquiries").select("id", head).eq("status", "new"),
    supabase
      .from("projects")
      .select("id,title,status,progress,deadline,clients(name)")
      .in("status", ["planning", "in_progress", "review"])
      .is("archived_at", null)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(6),
    supabase.from("enquiries").select("id,name,service,status,created_at").order("created_at", { ascending: false }).limit(6),
    // Money figures: only the Owner can read these tables (Managers get no rows from the database).
    isOwner ? supabase.from("invoice_overview").select("balance,status,currency") : Promise.resolve({ data: [] as Row[] }),
    isOwner ? supabase.from("payments").select("amount,currency").eq("status", "paid") : Promise.resolve({ data: [] as Row[] }),
  ]);

  // BDT figures only on the headline cards; invoices in other currencies are listed on the invoices page.
  const invRows = ((invoices.data ?? []) as Row[]).filter((i) => (i.currency ?? "BDT") === "BDT");
  const open = invRows.filter((i) => ["sent", "partial", "overdue"].includes(i.status));
  const outstanding = open.reduce((s, i) => s + Number(i.balance), 0);
  const overdue = invRows.filter((i) => i.status === "overdue");
  const overdueTotal = overdue.reduce((s, i) => s + Number(i.balance), 0);
  const collected = ((paid.data ?? []) as Row[]).filter((p) => (p.currency ?? "BDT") === "BDT").reduce((s, p) => s + Number(p.amount), 0);

  const ongoingRows = (ongoing.data ?? []) as Row[];
  const enquiryRows = (recent.data ?? []) as Row[];

  return (
    <>
      <PageHeader title="Overview" text={`Welcome, ${profile.full_name || profile.email}.`} />
      <div className={`grid gap-4 sm:grid-cols-2 ${isOwner ? "xl:grid-cols-5" : "xl:grid-cols-3"}`}>
        <Stat label="Active clients" value={clients.count ?? 0} />
        <Stat label="Ongoing projects" value={projectCount.count ?? 0} />
        <Stat label="New enquiries" value={newEnq.count ?? 0} hint="Waiting for a first reply" />
        {isOwner && <Stat label="Outstanding (BDT)" value={formatBDT(outstanding)} hint={`Overdue: ${formatBDT(overdueTotal)}`} />}
        {isOwner && <Stat label="Collected (BDT)" value={formatBDT(collected)} hint="All recorded, non-voided payments" />}
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900">Ongoing projects</h2>
          <Link href="/admin/projects" className="text-sm font-semibold text-brand-royal">View all</Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Progress</th><th>Deadline</th></tr></thead>
            <tbody>
              {ongoingRows.length === 0 && <EmptyRow colSpan={5} text="No ongoing projects." />}
              {ongoingRows.map((p) => {
                const late = p.deadline && p.deadline < today;
                return (
                  <tr key={p.id}>
                    <td><Link href={`/admin/projects/${p.id}`} className="font-semibold text-brand-royal hover:underline">{p.title}</Link></td>
                    <td>{p.clients?.name ?? "—"}</td>
                    <td><StatusBadge value={p.status} /></td>
                    <td><ProgressBar value={p.progress} /></td>
                    <td className={late ? "font-semibold text-red-700" : ""}>{formatDate(p.deadline)}{late ? " (late)" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900">Latest enquiries</h2>
          <Link href="/admin/enquiries" className="text-sm font-semibold text-brand-royal">View all</Link>
        </div>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Name</th><th>Service</th><th>Status</th><th>Received</th></tr></thead>
            <tbody>
              {enquiryRows.length === 0 && <EmptyRow colSpan={4} text="No enquiries yet." />}
              {enquiryRows.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.service ?? "—"}</td>
                  <td><StatusBadge value={e.status} /></td>
                  <td>{formatDate(e.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
