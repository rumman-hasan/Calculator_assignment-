# ThumbStop Website, Admin Dashboard and Client Portal

Next.js 14 + TypeScript + Tailwind. Supabase provides login, database and file storage. Hosting: Netlify (code on GitHub).

**Start here (Bangla step by step): `docs/SETUP-BANGLA.md`.** Putting it online: `docs/DEPLOY.md`. What to test: `docs/TESTING-CHECKLIST.md`.

## What is inside
| Part | Who uses it | Address |
|---|---|---|
| Public website (dark): Home, Services, Portfolio, Pricing, About, Contact, Privacy, Terms | Visitors | `/` |
| Admin dashboard (light) | Owner, Manager, Designer/Editor | `/admin` |
| Client portal (light) | Clients | `/portal` |

### Roles (enforced in the database and in the code)
- **Owner** (database value `admin`): everything, including invoices, payments, reports, users and settings.
- **Manager** (`staff`): leads, clients, projects and project updates. No invoices, payments, reports or settings.
- **Designer / Editor** (`designer`): only projects assigned to them; update progress, post updates, upload files. No finance, no client list.
- **Client**: only their own projects, shared files and invoices.

There is **no public registration**. The Owner creates every account in the dashboard and sends the person a one-time "set your password" link. No password is ever shown or stored by the site.

### Invoices (Owner only)
Automatic numbers (`TS-2026-0001`), multiple items, discount, tax %, any 3-letter currency (BDT, USD...), issue and due date, terms, notes, payment instructions. Status is **calculated**: Draft, Sent, Partially Paid, Paid, Overdue, Cancelled. An invoice becomes locked once it is marked Sent. Payments are recorded by hand (cash, bank, bKash/Nagad manual, other), with history. A wrong payment is voided with a reason, never edited. The site never says "paid" without a recorded payment. PDF download uses your exact logo. Clients see their invoices in the portal; share links go through the portal login (no public links).

There is **no online payment** and no card data anywhere.

## Run on Windows
1. Install Node.js 20 LTS from nodejs.org.
2. Follow `docs/SETUP-BANGLA.md` (Supabase and `.env.local`).
3. In the VS Code terminal: `npm install`, then `npm run dev`. Open http://localhost:3000.

## Where to edit
- Contact details, services, packages, portfolio, reviews: Admin panel (no code).
- Brand colours: `tailwind.config.ts`. Logo: `public/brand/thumbstop-logo.png` (used unmodified, never redrawn).

## Honest status
Written and checked by the assistant:
- All code was syntax-checked with the TypeScript parser.
- The database (all 3 migrations) was run on a local PostgreSQL 16 with a test script: role isolation, client isolation, invoice locking, payment rules, status calculation, deliverable sharing. This used a stand-in for Supabase's login, not real Supabase.
- The invoice PDF was generated and looked at (logo, items, totals, multi-page).

**Not done by the assistant (no internet in its workspace):** `npm install`, `npm run build`, a real Supabase project, a real login, Netlify deploy, email delivery. The first `npm run build` on your PC is the real test. Send any error text back for a fix.

Known limits: the PDF cannot print Bengali letters (they show as `?`); for Bengali use the invoice page's **Print** button and "Save as PDF". Draft invoices cannot be edited: cancel and create again. Not built yet: Google Analytics (GA4) and Facebook Pixel with cookie consent, Google Maps embed, YouTube/Vimeo video embeds in the portfolio (portfolio items can hold images and links), email alerts, reports export, blog, Bangla language. WhatsApp click-to-chat is built.
