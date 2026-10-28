import Link from "next/link";
import { EmptyRow, PageHeader, ProgressBar, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Row } from "@/lib/types";

export default async function PortalProjects() {
  const { supabase } = await requireRole(["client"]);
  const { data } = await supabase.from("projects").select("id,title,status,progress,deadline").is("archived_at", null).order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader title="My Projects" text="Open a project to see updates, milestones and files shared with you." />
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Project</th><th>Status</th><th>Progress</th><th>Deadline</th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={4} text="No projects yet." />}
            {rows.map((p) => (
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
    </>
  );
}
