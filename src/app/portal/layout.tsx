import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Client Portal", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["client"]);
  const links = [
    { href: "/portal", label: "Overview" },
    { href: "/portal/projects", label: "My Projects" },
    { href: "/portal/invoices", label: "My Invoices" },
  ];
  return (
    <AppShell links={links} base="/portal" name={profile.full_name || profile.email} role={profile.role}>
      {children}
    </AppShell>
  );
}
