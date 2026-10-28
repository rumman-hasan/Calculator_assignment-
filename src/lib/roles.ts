/**
 * Database role names. What the website calls them:
 *   admin = Owner, staff = Manager, designer = Designer / Video Editor, client = Client.
 * This file has no server-only imports, so it is safe to use anywhere.
 */
export type Role = "admin" | "staff" | "designer" | "client";

export const roleLabels: Record<Role, string> = {
  admin: "Owner",
  staff: "Manager",
  designer: "Designer / Editor",
  client: "Client",
};

/** Where each role lands after logging in. */
export function homeFor(role: Role): string {
  if (role === "client") return "/portal";
  if (role === "designer") return "/admin/projects";
  return "/admin";
}
