import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

// Secure download of a project deliverable.
// The user's own database session is used for every lookup, so Row Level Security decides who may download:
// owner and managers (all projects), designers (assigned projects), clients (their own projects only).
// Files live in a private bucket and are handed out through a link that works for 60 seconds.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse("Not found", { status: 404 });
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Please sign in.", { status: 401 });

  const { data: d } = await supabase.from("deliverables").select("kind,url,storage_path,title").eq("id", params.id).maybeSingle();
  if (!d) return new NextResponse("Not found", { status: 404 });

  if (d.kind === "link") {
    if (!/^https?:\/\//i.test(String(d.url))) return new NextResponse("Not found", { status: 404 });
    return NextResponse.redirect(String(d.url));
  }
  const { data: signed, error } = await supabase.storage.from("deliverables").createSignedUrl(String(d.storage_path), 60, { download: true });
  if (error || !signed?.signedUrl) return new NextResponse("File not available.", { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
