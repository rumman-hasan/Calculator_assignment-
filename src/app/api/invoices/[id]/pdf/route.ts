import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getSite } from "@/lib/data";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import type { Row } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  if (!isSupabaseConfigured || !/^[0-9a-f-]{36}$/i.test(params.id)) return new NextResponse("Not found", { status: 404 });

  // The signed-in user's own database session is used, so Row Level Security decides who may see this invoice:
  // the Owner sees all invoices, a client sees only their own sent invoices, anyone else gets nothing.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Please sign in.", { status: 401 });

  const { data: inv } = await supabase.from("invoice_overview").select("*").eq("id", params.id).maybeSingle();
  if (!inv) return new NextResponse("Not found", { status: 404 });
  const invoice = inv as Row;

  const [clientRes, itemsRes, payRes, siteInfo] = await Promise.all([
    supabase.from("clients").select("name,company,email,phone,address").eq("id", invoice.client_id).maybeSingle(),
    supabase.from("invoice_items").select("description,quantity,unit_price,amount").eq("invoice_id", params.id).order("id"),
    supabase.from("payments").select("amount,method,paid_at,created_at,reference").eq("invoice_id", params.id).eq("status", "paid").order("created_at"),
    getSite(),
  ]);

  let logoBytes: Uint8Array | null = null;
  try {
    const res = await fetch(new URL("/brand/thumbstop-logo.png", request.url));
    if (res.ok) logoBytes = new Uint8Array(await res.arrayBuffer());
  } catch {
    logoBytes = null;
  }

  const bytes = await buildInvoicePdf({
    invoice,
    client: (clientRes.data ?? {}) as Row,
    items: (itemsRes.data ?? []) as Row[],
    payments: (payRes.data ?? []) as Row[],
    siteInfo,
    logoBytes,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${String(invoice.number).replace(/[^A-Za-z0-9-]/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
