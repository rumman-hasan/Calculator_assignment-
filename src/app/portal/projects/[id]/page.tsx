import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyRow, PageHeader, ProgressBar, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Row } from "@/lib/types";

export default async function PortalProject({ params }: { params: { id: string } }) {
  const { supabase } = await requireRole(["client"]);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const { data: project } = await supabase.from("projects").select("id,title,description,status,progress,deadline").eq("id", params.id).maybeSingle();
  if (!project) notFound(); // also what a client gets for someone else's project
  const [updates, milestones, files] = await Promise.all([
    supabase.from("project_updates").select("id,body,created_at").eq("project_id", params.id).eq("visible_to_client", true).order("created_at", { ascending: false }),
    supabase.from("milestones").select("id,title,due_date,is_done").eq("project_id", params.id).order("sort_order"),
    supabase.from("deliverables").select("id,title,kind,created_at").eq("project_id", params.id).eq("visible_to_client", true).order("created_at", { ascending: false }),
  ]);
  const p = project as Row;

  return (
    <>
      <PageHeader title={p.title} text={p.description ?? undefined}>
        <StatusBadge value={p.status} />
      </PageHeader>
      <div className="card mb-8 flex flex-wrap items-center gap-6 p-5">
        <ProgressBar value={p.progress} />
        <p className="text-sm text-slate-600">Deadline: {formatDate(p.deadline)}</p>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold text-slate-900">Updates</h2>
        <div className="space-y-3">
          {((updates.data ?? []) as Row[]).length === 0 && <p className="card p-5 text-sm text-slate-500">No updates yet.</p>}
          {((updates.data ?? []) as Row[]).map((u) => (
            <article key={u.id} className="card p-5">
              <p className="whitespace-pre-line text-sm text-slate-800">{u.body}</p>
              <p className="mt-2 text-xs text-slate-500">{formatDate(u.created_at)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-bold text-slate-900">Milestones</h2>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>Milestone</th><th>Due</th><th>Done</th></tr></thead>
            <tbody>
              {((milestones.data ?? []) as Row[]).length === 0 && <EmptyRow colSpan={3} text="No milestones yet." />}
              {((milestones.data ?? []) as Row[]).map((m) => (
                <tr key={m.id}><td>{m.title}</td><td>{formatDate(m.due_date)}</td><td>{m.is_done ? "Yes" : "Not yet"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-bold text-slate-900">Files shared with you</h2>
        <div className="card overflow-x-auto">
          <table className="data">
            <thead><tr><th>File</th><th>Added</th><th></th></tr></thead>
            <tbody>
              {((files.data ?? []) as Row[]).length === 0 && <EmptyRow colSpan={3} text="Nothing has been shared yet." />}
              {((files.data ?? []) as Row[]).map((f) => (
                <tr key={f.id}>
                  <td>{f.title}</td>
                  <td>{formatDate(f.created_at)}</td>
                  <td><a href={`/api/deliverables/${f.id}`} className="font-semibold text-brand-royal hover:underline">Download</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-8"><Link href="/portal/projects" className="text-sm font-semibold text-brand-royal">← All projects</Link></p>
    </>
  );
}
