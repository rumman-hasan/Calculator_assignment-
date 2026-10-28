import Link from "next/link";
import { notFound } from "next/navigation";
import { Field, Flash, PageHeader, ProgressBar, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Row } from "@/lib/types";
import {
  addLinkDeliverableAction,
  addMilestoneAction,
  addProjectNoteAction,
  assignDesignerAction,
  deleteDeliverableAction,
  setProgressAction,
  toggleMilestoneAction,
  toggleDeliverableVisibleAction,
  unassignDesignerAction,
  updateProjectAction,
  uploadDeliverableAction,
} from "../actions";

const STATUSES = ["planning", "in_progress", "review", "completed", "on_hold", "cancelled"];
const DESIGNER_STATUSES = ["planning", "in_progress", "review", "on_hold"];

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; ok?: string };
}) {
  const { supabase, profile } = await requireRole(["admin", "staff", "designer"]);
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const isDesigner = profile.role === "designer";
  const canManage = !isDesigner;

  // For a designer the database returns this project only if they are assigned to it.
  const { data: project } = await supabase
    .from("projects")
    .select("id,title,description,status,progress,start_date,deadline,clients(name)")
    .eq("id", params.id)
    .maybeSingle();
  if (!project) notFound();

  const [milestones, deliverables, updates, members, designers] = await Promise.all([
    supabase.from("milestones").select("id,title,due_date,is_done").eq("project_id", params.id).order("sort_order").order("created_at"),
    supabase.from("deliverables").select("id,title,kind,visible_to_client,created_at").eq("project_id", params.id).order("created_at", { ascending: false }),
    supabase.from("project_updates").select("id,body,visible_to_client,created_by,created_at").eq("project_id", params.id).order("created_at", { ascending: false }).limit(30),
    canManage ? supabase.from("project_members").select("user_id").eq("project_id", params.id) : Promise.resolve({ data: [] as Row[] }),
    canManage ? supabase.from("profiles").select("id,full_name,email").eq("role", "designer").order("full_name") : Promise.resolve({ data: [] as Row[] }),
  ]);

  const p = project as Row;
  const ms = (milestones.data ?? []) as Row[];
  const ds = (deliverables.data ?? []) as Row[];
  const ups = (updates.data ?? []) as Row[];
  const assignedIds = new Set(((members.data ?? []) as Row[]).map((m) => m.user_id as string));
  const allDesigners = (designers.data ?? []) as Row[];
  const assigned = allDesigners.filter((d) => assignedIds.has(d.id));
  const available = allDesigners.filter((d) => !assignedIds.has(d.id));

  // Author names (only the owner/manager may read other people's profiles).
  const names = new Map<string, string>();
  if (canManage && ups.length) {
    const ids = Array.from(new Set(ups.map((u) => u.created_by).filter(Boolean)));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      ((profs ?? []) as Row[]).forEach((x) => names.set(x.id, x.full_name || x.email));
    }
  }

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/admin/projects" className="text-brand-royal">← {isDesigner ? "My projects" : "All projects"}</Link></p>
      <PageHeader title={p.title} text={canManage ? `Client: ${p.clients?.name ?? "—"}` : undefined}>
        <StatusBadge value={p.status} />
      </PageHeader>
      <Flash searchParams={searchParams} />
      {p.description && <p className="mb-8 max-w-3xl whitespace-pre-wrap text-sm text-slate-600">{p.description}</p>}

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-display text-xl font-bold text-slate-900">Status & progress</h2>
          <div className="mt-3"><ProgressBar value={p.progress} /></div>
          {canManage ? (
            <form action={updateProjectAction} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={p.id} />
              <div className="sm:col-span-2"><Field label="Title" name="title" defaultValue={p.title} required /></div>
              <Field label="Status" name="status">
                <select id="status" name="status" defaultValue={p.status} className="input">
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Progress (%)" name="progress" type="number" min={0} max={100} step={1} defaultValue={p.progress} required />
              <Field label="Deadline" name="deadline" type="date" defaultValue={p.deadline} />
              <div className="flex items-end"><button className="btn-primary w-full">Save & notify client</button></div>
            </form>
          ) : (
            <form action={setProgressAction} className="mt-5 grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={p.id} />
              <Field label="Status" name="status">
                <select id="status" name="status" defaultValue={DESIGNER_STATUSES.includes(p.status) ? p.status : "review"} className="input">
                  {DESIGNER_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </Field>
              <Field label="Progress (%)" name="progress" type="number" min={0} max={100} step={1} defaultValue={p.progress} required />
              <div className="sm:col-span-2">
                <button className="btn-primary">Save progress</button>
                <p className="mt-2 text-xs text-slate-500">Only the owner or a manager can mark a project completed or cancelled. Deadline: {formatDate(p.deadline)}.</p>
              </div>
            </form>
          )}
        </section>

        <section className="card p-6">
          <h2 className="font-display text-xl font-bold text-slate-900">Milestones</h2>
          <ul className="mt-4 space-y-2">
            {ms.length === 0 && <li className="text-sm text-slate-500">No milestones yet.</li>}
            {ms.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
                <div>
                  <p className={`text-sm ${m.is_done ? "text-slate-400 line-through" : "text-slate-900"}`}>{m.title}</p>
                  <p className="text-xs text-slate-500">Due {formatDate(m.due_date)}</p>
                </div>
                {canManage && (
                  <form action={toggleMilestoneAction}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="project_id" value={p.id} />
                    <input type="hidden" name="done" value={m.is_done ? "0" : "1"} />
                    <button className="btn-outline btn-sm">{m.is_done ? "Reopen" : "Mark done"}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
          {canManage && (
            <form action={addMilestoneAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <input type="hidden" name="project_id" value={p.id} />
              <input name="title" required placeholder="New milestone" className="input" aria-label="Milestone title" />
              <input name="due_date" type="date" className="input" aria-label="Milestone due date" />
              <button className="btn-primary">Add</button>
            </form>
          )}
        </section>

        <section className="card p-6 xl:col-span-2">
          <h2 className="font-display text-xl font-bold text-slate-900">Progress updates</h2>
          <p className="mt-1 text-xs text-slate-500">
            {canManage ? "Tick “Show to client” to publish an update in the client's portal. Unticked notes stay internal." : "Your notes are internal. The owner or a manager decides what the client sees."}
          </p>
          <form action={addProjectNoteAction} className="mt-4 space-y-3">
            <input type="hidden" name="project_id" value={p.id} />
            <textarea name="body" required maxLength={2000} rows={3} placeholder="What is done, what is next…" className="input" aria-label="Update" />
            <div className="flex flex-wrap items-center gap-4">
              {canManage && (
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="visible" defaultChecked /> Show to client
                </label>
              )}
              <button className="btn-primary btn-sm">Post update</button>
            </div>
          </form>
          <ul className="mt-6 space-y-3">
            {ups.length === 0 && <li className="text-sm text-slate-500">No updates yet.</li>}
            {ups.map((u) => (
              <li key={u.id} className="rounded-md border border-slate-200 px-4 py-3">
                <p className="whitespace-pre-wrap text-sm text-slate-800">{u.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {formatDate(u.created_at)}{names.get(u.created_by) ? ` · ${names.get(u.created_by)}` : ""} · {u.visible_to_client ? "Visible to client" : "Internal"}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {canManage && (
          <section className="card p-6 xl:col-span-2">
            <h2 className="font-display text-xl font-bold text-slate-900">Team on this project</h2>
            <p className="mt-1 text-xs text-slate-500">Designers and editors see only the projects they are assigned to.</p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {assigned.length === 0 && <li className="text-sm text-slate-500">Nobody assigned yet.</li>}
              {assigned.map((d) => (
                <li key={d.id} className="flex items-center gap-3 rounded-full border border-slate-200 px-3 py-1.5 text-sm">
                  <span>{d.full_name || d.email}</span>
                  <form action={unassignDesignerAction}>
                    <input type="hidden" name="project_id" value={p.id} />
                    <input type="hidden" name="user_id" value={d.id} />
                    <button className="text-xs text-red-700 underline">Remove</button>
                  </form>
                </li>
              ))}
            </ul>
            {available.length > 0 ? (
              <form action={assignDesignerAction} className="mt-4 flex flex-wrap gap-3">
                <input type="hidden" name="project_id" value={p.id} />
                <select name="user_id" className="input max-w-xs" aria-label="Designer or editor to assign">
                  {available.map((d) => <option key={d.id} value={d.id}>{d.full_name || d.email}</option>)}
                </select>
                <button className="btn-outline">Assign</button>
              </form>
            ) : (
              <p className="mt-4 text-xs text-slate-500">No other designers or editors yet. The owner can add them under Users &amp; Roles.</p>
            )}
          </section>
        )}

        <section className="card p-6 xl:col-span-2">
          <h2 className="font-display text-xl font-bold text-slate-900">Deliverables</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="data">
              <thead><tr><th>Title</th><th>Type</th><th>Added</th><th>Client can see</th><th /></tr></thead>
              <tbody>
                {ds.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Nothing added yet.</td></tr>}
                {ds.map((d) => (
                  <tr key={d.id}>
                    <td><a href={`/api/deliverables/${d.id}`} target="_blank" rel="noopener noreferrer" className="text-brand-royal hover:underline">{d.title}</a></td>
                    <td>{d.kind === "link" ? "Link" : "File"}</td>
                    <td>{formatDate(d.created_at)}</td>
                    <td>
                      {canManage ? (
                        <form action={toggleDeliverableVisibleAction} className="flex items-center gap-2">
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="project_id" value={p.id} />
                          <input type="hidden" name="visible" value={d.visible_to_client ? "0" : "1"} />
                          <span className={d.visible_to_client ? "text-emerald-700" : "text-slate-500"}>{d.visible_to_client ? "Shared" : "Internal"}</span>
                          <button className="btn-outline btn-sm">{d.visible_to_client ? "Stop sharing" : "Share"}</button>
                        </form>
                      ) : (
                        d.visible_to_client ? "Shared" : "Internal"
                      )}
                    </td>
                    <td>
                      {profile.role === "admin" && (
                        <form action={deleteDeliverableAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <input type="hidden" name="project_id" value={p.id} />
                          <button className="btn-danger btn-sm">Delete</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">The client sees only items marked “Shared”. Files are private and download through a short-lived secure link.{!canManage && " Your uploads stay internal until the owner or a manager shares them."}</p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <form action={addLinkDeliverableAction} className="space-y-3">
              <h3 className="eyebrow">Share a link (Drive, YouTube…)</h3>
              <input type="hidden" name="project_id" value={p.id} />
              <input name="title" required placeholder="Title" className="input" aria-label="Link title" />
              <input name="url" type="url" required placeholder="https://…" className="input" aria-label="Link address" />
              {canManage && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="share" /> Share with the client</label>}
              <button className="btn-primary">Add link</button>
            </form>
            <form action={uploadDeliverableAction} className="space-y-3">
              <h3 className="eyebrow">Upload a file (max 4 MB)</h3>
              <input type="hidden" name="project_id" value={p.id} />
              <input name="title" required placeholder="Title" className="input" aria-label="File title" />
              <input name="file" type="file" required className="input" aria-label="File" />
              {canManage && <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="share" /> Share with the client</label>}
              <button className="btn-primary">Upload</button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
