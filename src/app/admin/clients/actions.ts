"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { done, fail, logActivity, str } from "@/lib/actions";
import { clientSchema, portalLoginSchema } from "@/lib/validation";
import { createAccountWithLink, serviceClient } from "@/lib/accounts";

const BASE = "/admin/clients";

export async function createClientAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const parsed = clientSchema.safeParse({
    name: str(fd, "name"),
    company: str(fd, "company"),
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    address: str(fd, "address"),
    notes: str(fd, "notes"),
  });
  if (!parsed.success) fail(BASE, parsed.error.issues[0].message);

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed.data, created_by: user.id })
    .select("id")
    .single();
  if (error || !data) fail(BASE, "Could not save the client.");
  await logActivity(supabase, user.id, "client.create", "client", data.id, { name: parsed.data.name });
  revalidatePath(BASE);
  done(BASE, "Client created.");
}

export async function toggleArchiveClientAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const id = str(fd, "id");
  const archive = str(fd, "archive") === "1";
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail(BASE, "Invalid request.");
  const { error } = await supabase
    .from("clients")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) fail(BASE, "Could not update the client.");
  await logActivity(supabase, user.id, archive ? "client.archive" : "client.restore", "client", id);
  revalidatePath(BASE);
  done(BASE, archive ? "Client archived." : "Client restored.");
}

/**
 * Creates (or renews) the client's portal login. The owner/manager never sees a password:
 * they receive a one-time link and send it to the client, who chooses their own password.
 */
export async function createPortalLoginAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const parsed = portalLoginSchema.safeParse({ client_id: str(fd, "id"), email: str(fd, "email") });
  if (!parsed.success) fail(BASE, parsed.error.issues[0].message);
  const { client_id, email } = parsed.data;

  const { data: client } = await supabase.from("clients").select("id,name,phone,profile_id").eq("id", client_id).maybeSingle();
  if (!client) fail(BASE, "Client not found.");

  const account = await createAccountWithLink(email, client.name);
  if (!account.ok) fail(BASE, account.error);

  // Only client accounts can be attached to a client record, never a team account.
  const admin = serviceClient();
  const { data: prof } = await admin.from("profiles").select("role").eq("id", account.userId).single();
  if (!prof || prof.role !== "client") fail(BASE, "That email belongs to a team account, not a client. Use a different email.");

  const { error } = await admin.from("clients").update({ profile_id: account.userId }).eq("id", client_id);
  if (error) fail(BASE, "That login is already linked to another client.");

  await logActivity(supabase, user.id, "client.login_link", "client", client_id);
  revalidatePath(BASE);
  redirect(`${BASE}?link=${encodeURIComponent(account.link)}&name=${encodeURIComponent(client.name)}&phone=${encodeURIComponent(client.phone ?? "")}`);
}

/** Makes a fresh one-time link for a client who already has a portal login (for example, a forgotten password). */
export async function renewPortalLinkAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const id = str(fd, "id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail(BASE, "Invalid request.");
  const { data: client } = await supabase.from("clients").select("id,name,phone,profile_id").eq("id", id).maybeSingle();
  if (!client || !client.profile_id) fail(BASE, "This client has no portal login yet.");
  const { data: prof } = await supabase.from("profiles").select("email").eq("id", client.profile_id).maybeSingle();
  if (!prof?.email) fail(BASE, "Could not find the login email.");
  const account = await createAccountWithLink(prof.email, client.name);
  if (!account.ok) fail(BASE, account.error);
  await logActivity(supabase, user.id, "client.login_link", "client", id);
  redirect(`${BASE}?link=${encodeURIComponent(account.link)}&name=${encodeURIComponent(client.name)}&phone=${encodeURIComponent(client.phone ?? "")}`);
}

export async function unlinkPortalAccountAction(fd: FormData) {
  const { supabase, user } = await requireRole(["admin", "staff"]);
  const id = str(fd, "id");
  if (!/^[0-9a-f-]{36}$/i.test(id)) fail(BASE, "Invalid request.");
  const { error } = await supabase.from("clients").update({ profile_id: null }).eq("id", id);
  if (error) fail(BASE, "Could not unlink.");
  await logActivity(supabase, user.id, "client.unlink", "client", id);
  revalidatePath(BASE);
  done(BASE, "Portal account unlinked.");
}
