import { EmptyRow, Flash, PageHeader, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { Row } from "@/lib/types";
import { LoginLinkBox } from "@/components/login-link-box";
import { addTeamMemberAction, setRoleAction } from "./actions";

export default async function UsersPage({ searchParams }: { searchParams: { error?: string; ok?: string; link?: string; name?: string } }) {
  const { supabase, user } = await requireRole(["admin"]);
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,phone,role,created_at")
    .order("created_at", { ascending: true });
  const users = (data ?? []) as Row[];

  return (
    <>
      <PageHeader
        title="Users & Roles"
        text="Owner: everything, including money and users. Manager: leads, clients, projects and updates (no invoices or payments). Designer / Editor: only the projects assigned to them. Client: only their own portal. Add a team member below: they receive a one-time link and choose their own password."
      />
      <Flash searchParams={searchParams} />
      <LoginLinkBox link={searchParams.link} name={searchParams.name} />

      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Change role</th></tr></thead>
          <tbody>
            {users.length === 0 && <EmptyRow colSpan={4} text="No users yet." />}
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <p className="font-semibold text-slate-900">{u.full_name || "—"}</p>
                  <p className="text-xs text-brand-muted">{u.email}</p>
                </td>
                <td><StatusBadge value={u.role} /></td>
                <td>{formatDate(u.created_at)}</td>
                <td>
                  {u.id === user.id ? (
                    <span className="text-xs text-brand-muted">This is you</span>
                  ) : (
                    <form action={setRoleAction} className="flex gap-2">
                      <input type="hidden" name="target" value={u.id} />
                      <select name="role" defaultValue={u.role} className="input !py-1.5 text-xs" aria-label={`Role for ${u.email}`}>
                        <option value="client">Client</option>
                        <option value="designer">Designer / Editor</option>
                        <option value="staff">Manager</option>
                        <option value="admin">Owner</option>
                      </select>
                      <button className="btn-outline btn-sm">Save</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card mt-10 p-6">
        <h2 className="font-display text-xl font-bold text-slate-900">Add a team member</h2>
        <p className="mt-1 text-sm text-slate-600">Creates the login and gives you a one-time link to send. Assign designers to projects from each project page.</p>
        <form action={addTeamMemberAction} className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="name" className="label">Name *</label>
            <input id="name" name="name" required className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">Email *</label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label htmlFor="role" className="label">Role *</label>
            <select id="role" name="role" className="input" defaultValue="designer">
              <option value="designer">Designer / Editor</option>
              <option value="staff">Manager</option>
            </select>
          </div>
          <div className="sm:col-span-3"><button className="btn-primary">Create login</button></div>
        </form>
      </section>
    </>
  );
}
