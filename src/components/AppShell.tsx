import { Logo } from "./Logo";
import { AppNav } from "./app-nav";
import { StatusBadge } from "./app-ui";
import { signOutAction } from "@/lib/auth-actions";

/** Light-themed frame shared by the admin dashboard and the client portal. */
export function AppShell({
  links,
  base,
  name,
  role,
  children,
}: {
  links: { href: string; label: string }[];
  base: string;
  name: string;
  role: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-light min-h-screen bg-slate-50 lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-slate-200 bg-white p-4 print:hidden lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r lg:p-5">
        <Logo tone="light" />
        <div className="my-4 lg:my-6">
          <AppNav links={links} base={base} />
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4 lg:mt-8">
          <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
          <div className="mt-1"><StatusBadge value={role} /></div>
          <form action={signOutAction} className="mt-4">
            <button type="submit" className="btn-outline btn-sm w-full">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 p-5 sm:p-8 lg:p-10 print:p-0">{children}</main>
    </div>
  );
}
