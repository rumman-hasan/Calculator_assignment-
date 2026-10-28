// SERVER ONLY. Creates login accounts (clients and team members) using the service-role key.
// Public sign-up is switched off in Supabase, so this is the only way an account comes into existence.
import { createServiceClient, isServiceClientConfigured } from "@/lib/supabase/service";
import { site } from "@/lib/site-config";

export type AccountResult = { ok: true; userId: string; link: string; created: boolean } | { ok: false; error: string };

/** True only for the one-time links produced by createAccountWithLink (used before showing a link on screen). */
export function isLoginLink(value: string | undefined): value is string {
  return Boolean(value && value.startsWith(`${site.url}/auth/confirm?`) && value.length < 1500);
}

/**
 * Creates the account if it does not exist yet, then returns a one-time link where the person
 * chooses their own password. No password is ever created, shown or stored by us.
 */
export async function createAccountWithLink(email: string, fullName: string | null): Promise<AccountResult> {
  if (!isServiceClientConfigured()) {
    return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (or Netlify settings) and restart." };
  }
  const admin = createServiceClient();

  let userId: string | null = null;
  let created = false;
  const res = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName ?? "" },
  });
  if (res.error) {
    const { data: existing } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (!existing) return { ok: false, error: `Could not create the account: ${res.error.message}` };
    userId = existing.id as string;
  } else {
    userId = res.data.user.id;
    created = true;
  }

  const link = await admin.auth.admin.generateLink({ type: "recovery", email });
  const hashed = link.data?.properties?.hashed_token;
  if (link.error || !hashed) return { ok: false, error: "The account exists, but the login link could not be created." };

  const url = `${site.url}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=recovery&next=${encodeURIComponent("/reset-password")}`;
  return { ok: true, userId, link: url, created };
}

export function serviceClient() {
  return createServiceClient();
}
