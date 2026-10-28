# Testing checklist

## A. Already tested by the assistant (local PostgreSQL 16 stand-in, not real Supabase)
- Owner, Manager, Designer, Client permissions on every finance and project table.
- Client A cannot see Client B invoices, projects, updates, files.
- Clients see only files marked "shared" and only sent (non-draft) invoices.
- Invoices: locking after Sent, no delete, gap-free numbers, payments cannot be edited, void needs a reason, overpayment blocked, status Sent/Partial/Paid/Overdue calculated.
- A client cannot make themselves admin.
- PDF generated and visually checked. TypeScript syntax parsed with no errors.

## B. You must test (the assistant could not)
1. `npm install` then `npm run build` finishes with no errors.
2. Login as Owner > goes to /admin. Wrong password is refused.
3. Users & Roles: create a Manager and a Designer; open the one-time link in a private window; set a password; log in.
4. Manager: no Invoices, Reports, Settings menu; typing /admin/invoices in the address bar redirects away.
5. Designer: sees only My Projects, only assigned ones; can update progress; cannot mark completed.
6. Create a client + portal login; log in as client in a private window: sees only their projects/invoices.
7. Create an invoice (2 items, discount, tax), mark Sent, download PDF (logo correct), record a partial payment, then full: status changes; void one payment.
8. Client portal: invoice appears after Sent; unshared files hidden; shared file downloads.
9. Contact form: submit; appears in Leads. WhatsApp button opens chat.
10. Phone-size screens (browser narrow window) look fine.
11. After deploy: repeat 2, 3, 7 on the live Netlify address.
12. Try /register: must show a 404.
