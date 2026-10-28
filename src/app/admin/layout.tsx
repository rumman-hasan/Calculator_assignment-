import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireRole(["admin", "staff", "designer"]);

  // Designers see only their assigned projects. Managers see no money pages. The Owner sees everything.
  const links =
    profile.role === "designer"
      ? [{ href: "/admin/projects", label: "My Projects" }]
      : [
          { href: "/admin", label: "Overview" },
          { href: "/admin/enquiries", label: "Leads & Enquiries" },
          { href: "/admin/clients", label: "Clients" },
          { href: "/admin/projects", label: "Projects" },
          ...(profile.role === "admin"
            ? [
                { href: "/admin/invoices", label: "Invoices" },
                { href: "/admin/reports", label: "Reports" },
                { href: "/admin/services", label: "Services & Packages" },
                { href: "/admin/content", label: "Portfolio & Reviews" },
                { href: "/admin/users", label: "Users & Roles" },
                { href: "/admin/settings", label: "Website Settings" },
              ]
            : []),
        ];

  return (
    <AppShell links={links} base="/admin" name={profile.full_name || profile.email} role={profile.role}>
      {children}
    </AppShell>
  );
}
