"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { done, fail, logActivity, str } from "@/lib/actions";
import { clean, roleSchema } from "@/lib/validation";
import { createAccountWithLink, serviceClient } from "@/lib/accounts";

const BASE = "/admin/users";

export async function setRoleAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin"]);
  const parsed = roleSchema.safeParse({ target: str(fd, "target"), role: str(fd, "role") });
  if (!parsed.success) fail(BASE, parsed.error.issues[0].message);
  const { target, role } = parsed.data;
  if (target === user.id) fail(BASE, "You cannot change your own role.");

  // The database function re-checks that the caller is an admin, so this cannot be bypassed from the browser.
  const { error } = await supabase.rpc("set_user_role", { target, new_role: role });
  if (error) fail(BASE, "Could not change the role. Only the Owner can do this.");

  await logActivity(supabase, user.id, "user.role", "profile", target, { role });
  revalidatePath(BASE);
  done(BASE, "Role updated.");
}

const teamSchema = z.object({
  name: z.string().transform(clean).pipe(z.string().min(2, "Enter the person's name.").max(120)),
  email: z.string().transform((v) => clean(v).toLowerCase()).pipe(z.string().email("Enter a valid email.").max(200)),
  role: z.enum(["staff", "designer"]),
});

/** Owner only: creates a team login (Manager or Designer / Editor) and returns a one-time link to send them. */
export async function addTeamMemberAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin"]);
  const parsed = teamSchema.safeParse({ name: str(fd, "name"), email: str(fd, "email"), role: str(fd, "role") });
  if (!parsed.success) fail(BASE, parsed.error.issues[0].message);
  const { name, email, role } = parsed.data;

  const account = await createAccountWithLink(email, name);
  if (!account.ok) fail(BASE, account.error);
  if (account.userId === user.id) fail(BASE, "That is your own account.");

  const admin = serviceClient();
  const { error } = await admin.from("profiles").update({ role, full_name: name }).eq("id", account.userId);
  if (error) fail(BASE, "The account was created but its role could not be set. Set it in the table below.");

  await logActivity(supabase, user.id, "user.add_team", "profile", account.userId, { role });
  revalidatePath(BASE);
  redirect(`${BASE}?link=${encodeURIComponent(account.link)}&name=${encodeURIComponent(name)}`);
}
