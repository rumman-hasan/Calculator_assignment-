import Link from "next/link";
import { EmptyRow, PageHeader, StatusBadge } from "@/components/app-ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/format";
import type { Row } from "@/lib/types";

export default async function PortalInvoices() {
  const { supabase } = await requireRole(["client"]);
  const { data } = await supabase
    .from("invoice_overview")
    .select("id,number,issue_date,due_date,currency,total,paid_amount,balance,status")
    .neq("stored_status", "draft")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader title="My Invoices" text="Invoices issued to you and the payments we have recorded." />
      <div className="card overflow-x-auto">
        <table className="data">
          <thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={7} text="No invoices yet." />}
            {rows.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/portal/invoices/${i.id}`} className="font-semibold text-brand-royal hover:underline">{i.number}</Link></td>
                <td>{formatDate(i.issue_date)}</td>
                <td>{formatDate(i.due_date)}</td>
                <td>{formatMoney(i.total, i.currency)}</td>
                <td>{formatMoney(i.paid_amount, i.currency)}</td>
                <td>{formatMoney(i.balance, i.currency)}</td>
                <td><StatusBadge value={i.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
