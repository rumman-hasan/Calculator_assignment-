-- ThumbStop upgrade 3: roles, client portal data, locked invoices, owner-only finance.
-- Run ONCE in Supabase Dashboard > SQL Editor, AFTER files 1 and 2.
--
-- Role names in the database (shown in the website as):
--   admin    = Owner     (everything, including invoices, payments, reports, settings, users)
--   staff    = Manager   (leads, clients, projects, updates; NO invoices or payments)
--   designer = Designer / Video Editor (only projects assigned to them)
--   client   = Client    (only their own projects, updates, files, invoices and payments)

-- =====================================================================
-- 1. Roles and helper functions
-- =====================================================================
alter type public.user_role add value if not exists 'designer';

-- is_admin() = Owner, is_staff() = Owner or Manager (both already exist; kept in sync here).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text in ('admin', 'staff') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_designer() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role::text = 'designer' from public.profiles where id = auth.uid()), false)
$$;

-- =====================================================================
-- 2. Project team (which designer works on which project) and updates
-- =====================================================================
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index if not exists project_members_user_idx on public.project_members (user_id);

create or replace function public.my_assigned_project_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select project_id from public.project_members where user_id = auth.uid()
$$;

create table if not exists public.project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  visible_to_client boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists project_updates_project_idx on public.project_updates (project_id, created_at desc);

alter table public.project_members enable row level security;
alter table public.project_updates enable row level security;

drop policy if exists project_members_select on public.project_members;
drop policy if exists project_members_staff_write on public.project_members;
create policy project_members_select on public.project_members for select to authenticated
  using (public.is_staff() or user_id = auth.uid());
create policy project_members_staff_write on public.project_members for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists project_updates_staff_select on public.project_updates;
drop policy if exists project_updates_designer_select on public.project_updates;
drop policy if exists project_updates_client_select on public.project_updates;
drop policy if exists project_updates_staff_insert on public.project_updates;
drop policy if exists project_updates_designer_insert on public.project_updates;
drop policy if exists project_updates_admin_delete on public.project_updates;
create policy project_updates_staff_select on public.project_updates for select to authenticated
  using (public.is_staff());
create policy project_updates_designer_select on public.project_updates for select to authenticated
  using (public.is_designer() and project_id in (select public.my_assigned_project_ids()));
create policy project_updates_client_select on public.project_updates for select to authenticated
  using (visible_to_client and project_id in (select public.my_project_ids()));
create policy project_updates_staff_insert on public.project_updates for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());
create policy project_updates_designer_insert on public.project_updates for insert to authenticated
  with check (public.is_designer() and created_by = auth.uid() and project_id in (select public.my_assigned_project_ids()));
create policy project_updates_admin_delete on public.project_updates for delete to authenticated
  using (public.is_admin());

-- Designers can read only their assigned projects, milestones and deliverables, and add deliverables.
drop policy if exists projects_designer_select on public.projects;
drop policy if exists milestones_designer_select on public.milestones;
drop policy if exists deliverables_designer_select on public.deliverables;
drop policy if exists deliverables_designer_insert on public.deliverables;
create policy projects_designer_select on public.projects for select to authenticated
  using (public.is_designer() and id in (select public.my_assigned_project_ids()));
create policy milestones_designer_select on public.milestones for select to authenticated
  using (public.is_designer() and project_id in (select public.my_assigned_project_ids()));
create policy deliverables_designer_select on public.deliverables for select to authenticated
  using (public.is_designer() and project_id in (select public.my_assigned_project_ids()));
create policy deliverables_designer_insert on public.deliverables for insert to authenticated
  with check (public.is_designer() and created_by = auth.uid() and project_id in (select public.my_assigned_project_ids()));

-- Deliverables are shared with the client ONLY when marked "visible to client" (default: not shared).
-- Deliverables that already existed before this upgrade were visible to clients, so they stay visible.
do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'deliverables' and column_name = 'visible_to_client') then
    alter table public.deliverables add column visible_to_client boolean not null default false;
    update public.deliverables set visible_to_client = true;
  end if;
end $$;

drop policy if exists deliverables_client_select on public.deliverables;
create policy deliverables_client_select on public.deliverables for select to authenticated
  using (visible_to_client and project_id in (select public.my_project_ids()));

drop policy if exists deliverable_files_client_read on storage.objects;
create policy deliverable_files_client_read on storage.objects for select to authenticated
  using (
    bucket_id = 'deliverables'
    and exists (
      select 1 from public.deliverables d
      where d.storage_path = storage.objects.name
        and d.visible_to_client
        and d.project_id in (select public.my_project_ids())
    )
  );

-- Private file storage: designers may read and upload only inside their assigned projects' folders.
drop policy if exists deliverable_files_designer_read on storage.objects;
drop policy if exists deliverable_files_designer_insert on storage.objects;
create policy deliverable_files_designer_read on storage.objects for select to authenticated
  using (
    bucket_id = 'deliverables' and public.is_designer()
    and (storage.foldername(name))[1] in (select p::text from public.my_assigned_project_ids() as p)
  );
create policy deliverable_files_designer_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'deliverables' and public.is_designer()
    and (storage.foldername(name))[1] in (select p::text from public.my_assigned_project_ids() as p)
  );

-- Progress changes go through one checked function (designers cannot mark a project completed or cancelled).
create or replace function public.set_project_progress(p_project uuid, p_progress int, p_status public.project_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_progress is null or p_progress < 0 or p_progress > 100 then
    raise exception 'Progress must be between 0 and 100';
  end if;
  if public.is_staff() then
    null;
  elsif public.is_designer() and p_project in (select public.my_assigned_project_ids()) then
    if p_status::text in ('completed', 'cancelled') then
      raise exception 'Only the owner or a manager can complete or cancel a project';
    end if;
  else
    raise exception 'You are not allowed to update this project';
  end if;
  update public.projects set progress = p_progress, status = p_status where id = p_project;
end $$;
revoke all on function public.set_project_progress(uuid, int, public.project_status) from public, anon;
grant execute on function public.set_project_progress(uuid, int, public.project_status) to authenticated;

-- Team members (not only managers) may write their own activity log rows.
drop policy if exists activity_staff_insert on public.activity_log;
drop policy if exists activity_team_insert on public.activity_log;
create policy activity_team_insert on public.activity_log for insert to authenticated
  with check ((public.is_staff() or public.is_designer()) and actor_id = auth.uid());

-- =====================================================================
-- 3. Invoices: currencies, discount, tax, terms, gap-free numbers
-- =====================================================================
-- Old online-payment function is not used in version 1 (manual payment recording only).
drop function if exists public.record_verified_payment(text, text, numeric, jsonb);

alter table public.invoices drop constraint if exists invoices_currency_check;
alter table public.invoices add constraint invoices_currency_check check (currency ~ '^[A-Z]{3}$');
alter table public.invoices add column if not exists discount numeric(12, 2) not null default 0 check (discount >= 0);
alter table public.invoices add column if not exists tax_percent numeric(5, 2) not null default 0 check (tax_percent >= 0 and tax_percent <= 100);
alter table public.invoices add column if not exists payment_terms text;
alter table public.invoices add column if not exists payment_instructions text;

-- Invoices that were stored as paid / partial / overdue become plain "sent"; those states are now calculated.
update public.invoices set status = 'sent' where status::text in ('partial', 'paid', 'overdue');

create table if not exists public.invoice_counters (
  year int primary key,
  last_number int not null
);
alter table public.invoice_counters enable row level security; -- no policies: only next_invoice_number() touches it

insert into public.invoice_counters (year, last_number)
select substring(number from 4 for 4)::int, max(substring(number from 9)::int)
from public.invoices
where number ~ '^TS-[0-9]{4}-[0-9]+$'
group by 1
on conflict (year) do nothing;

-- Same name and signature as before, so the invoices.number default keeps working.
-- The counter row is locked and updated inside the same transaction as the invoice, so numbers never skip.
create or replace function public.next_invoice_number() returns text
language plpgsql security definer set search_path = public as $$
declare
  y int := extract(year from (now() at time zone 'Asia/Dhaka'))::int;
  n int;
begin
  insert into public.invoice_counters (year, last_number) values (y, 1)
  on conflict (year) do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into n;
  return 'TS-' || y::text || '-' || lpad(n::text, 4, '0');
end $$;
revoke all on function public.next_invoice_number() from public, anon;
grant execute on function public.next_invoice_number() to authenticated;

-- Total = (subtotal - discount) + tax, calculated by the database.
create or replace function public.recalc_invoice_total() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv uuid;
  s numeric;
  d numeric;
  t numeric;
begin
  if tg_op = 'DELETE' then inv := old.invoice_id; else inv := new.invoice_id; end if;
  select coalesce(sum(amount), 0) into s from public.invoice_items where invoice_id = inv;
  select discount, tax_percent into d, t from public.invoices where id = inv;
  update public.invoices
    set subtotal = s,
        total = round(greatest(s - coalesce(d, 0), 0) * (1 + coalesce(t, 0) / 100), 2)
    where id = inv;
  return null;
end $$;

-- =====================================================================
-- 4. Invoice integrity: finalized invoices are locked
-- =====================================================================
create or replace function public.guard_invoice_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status::text = 'cancelled' then
    raise exception 'A cancelled invoice cannot be changed';
  end if;
  if old.status::text <> 'draft' then
    if new.status::text = 'draft' then
      raise exception 'A sent invoice cannot go back to draft';
    end if;
    if (new.number, new.client_id, new.project_id, new.issue_date, new.due_date, new.currency, new.subtotal,
        new.discount, new.tax_percent, new.total, new.notes, new.payment_terms, new.payment_instructions)
       is distinct from
       (old.number, old.client_id, old.project_id, old.issue_date, old.due_date, old.currency, old.subtotal,
        old.discount, old.tax_percent, old.total, old.notes, old.payment_terms, old.payment_instructions) then
      raise exception 'This invoice is final and cannot be edited. Cancel it and issue a corrected invoice.';
    end if;
  end if;
  if new.status::text = 'cancelled' and old.status::text <> 'cancelled'
     and exists (select 1 from public.payments where invoice_id = old.id and status::text = 'paid') then
    raise exception 'Void the recorded payments before cancelling this invoice';
  end if;
  return new;
end $$;
drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard before update on public.invoices
  for each row execute function public.guard_invoice_update();

create or replace function public.guard_invoice_items() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  inv uuid;
  st text;
begin
  if tg_op = 'DELETE' then inv := old.invoice_id; else inv := new.invoice_id; end if;
  select status::text into st from public.invoices where id = inv;
  if st is not null and st <> 'draft' then
    raise exception 'The items of a final invoice cannot be changed';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists invoice_items_guard on public.invoice_items;
create trigger invoice_items_guard before insert or update or delete on public.invoice_items
  for each row execute function public.guard_invoice_items();

-- One atomic function creates the invoice and all of its items (no half-created invoices).
create or replace function public.create_invoice(
  p_client uuid, p_project uuid, p_issue date, p_due date, p_currency text,
  p_discount numeric, p_tax numeric, p_terms text, p_instructions text, p_notes text, p_items jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  it jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only the owner can create invoices';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line item';
  end if;
  insert into public.invoices
    (client_id, project_id, issue_date, due_date, currency, discount, tax_percent,
     payment_terms, payment_instructions, notes, created_by)
  values
    (p_client, p_project, coalesce(p_issue, current_date), p_due, upper(coalesce(nullif(p_currency, ''), 'BDT')),
     coalesce(p_discount, 0), coalesce(p_tax, 0), p_terms, p_instructions, p_notes, auth.uid())
  returning id into v_id;
  for it in select * from jsonb_array_elements(p_items) loop
    insert into public.invoice_items (invoice_id, description, quantity, unit_price)
    values (v_id, it ->> 'description', (it ->> 'quantity')::numeric, (it ->> 'unit_price')::numeric);
  end loop;
  return v_id;
end $$;
revoke all on function public.create_invoice(uuid, uuid, date, date, text, numeric, numeric, text, text, text, jsonb) from public, anon;
grant execute on function public.create_invoice(uuid, uuid, date, date, text, numeric, numeric, text, text, text, jsonb) to authenticated;

-- =====================================================================
-- 5. Payments: manual records only, owner only, history preserved
-- =====================================================================
alter table public.payments add column if not exists reference text;
alter table public.payments add column if not exists void_reason text;
alter table public.payments alter column provider set default 'manual';
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('cash', 'bank', 'bkash_manual', 'nagad_manual', 'other', 'online'));

-- Payments cannot be edited. The only allowed change is voiding a recorded payment (with a reason).
create or replace function public.guard_payment_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.invoice_id, new.amount, new.method, new.paid_at, new.created_by, new.tran_id, new.currency, new.reference)
     is distinct from
     (old.invoice_id, old.amount, old.method, old.paid_at, old.created_by, old.tran_id, old.currency, old.reference) then
    raise exception 'Recorded payments cannot be edited. Void the payment and record a new one.';
  end if;
  if new.status::text <> old.status::text then
    if not (old.status::text = 'paid' and new.status::text = 'cancelled') then
      raise exception 'A payment can only be changed from paid to voided';
    end if;
    if coalesce(btrim(new.void_reason), '') = '' then
      raise exception 'Enter a reason for voiding the payment';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists payments_guard_update on public.payments;
create trigger payments_guard_update before update on public.payments
  for each row execute function public.guard_payment_update();

-- A payment can only be added to a sent invoice, and never above the remaining balance.
create or replace function public.guard_payment_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  v_status text;
  v_paid numeric;
begin
  select total, status::text into v_total, v_status from public.invoices where id = new.invoice_id for update;
  if v_status is null or v_status <> 'sent' then
    raise exception 'Payments can only be recorded on a sent invoice';
  end if;
  select coalesce(sum(amount), 0) into v_paid
    from public.payments where invoice_id = new.invoice_id and status::text = 'paid';
  if new.status::text = 'paid' and v_paid + new.amount > v_total + 0.001 then
    raise exception 'The payment is more than the remaining balance';
  end if;
  return new;
end $$;
drop trigger if exists payments_guard_insert on public.payments;
create trigger payments_guard_insert before insert on public.payments
  for each row execute function public.guard_payment_insert();

-- Status is now CALCULATED from payments and the due date, so the old auto-update trigger is removed.
drop trigger if exists payments_refresh_invoice on public.payments;
drop function if exists public.refresh_invoice_payment_status();

-- =====================================================================
-- 6. Finance is OWNER-ONLY: replace the old "staff" policies
-- =====================================================================
drop policy if exists invoices_staff_select on public.invoices;
drop policy if exists invoices_staff_insert on public.invoices;
drop policy if exists invoices_staff_update on public.invoices;
drop policy if exists invoices_admin_delete on public.invoices;
drop policy if exists invoices_admin_select on public.invoices;
drop policy if exists invoices_admin_update on public.invoices;
create policy invoices_admin_select on public.invoices for select to authenticated using (public.is_admin());
create policy invoices_admin_update on public.invoices for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Invoices are created only through create_invoice(); they are never deleted, only cancelled.

drop policy if exists invoice_items_staff_select on public.invoice_items;
drop policy if exists invoice_items_staff_insert on public.invoice_items;
drop policy if exists invoice_items_staff_update on public.invoice_items;
drop policy if exists invoice_items_admin_delete on public.invoice_items;
drop policy if exists invoice_items_admin_select on public.invoice_items;
create policy invoice_items_admin_select on public.invoice_items for select to authenticated using (public.is_admin());

drop policy if exists payments_staff_select on public.payments;
drop policy if exists payments_staff_insert_manual on public.payments;
drop policy if exists payments_admin_update on public.payments;
drop policy if exists payments_admin_select on public.payments;
drop policy if exists payments_admin_insert on public.payments;
drop policy if exists payments_admin_void on public.payments;
create policy payments_admin_select on public.payments for select to authenticated using (public.is_admin());
create policy payments_admin_insert on public.payments for insert to authenticated
  with check (public.is_admin() and method <> 'online' and status::text = 'paid' and created_by = auth.uid());
create policy payments_admin_void on public.payments for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Invoice items a client may see: only those of invoices the client can already see.
drop policy if exists invoice_items_client_select on public.invoice_items;
create policy invoice_items_client_select on public.invoice_items for select to authenticated
  using (exists (select 1 from public.invoices i where i.id = invoice_id));

-- Calculated invoice view. security_invoker makes it follow the caller's own row-level rules,
-- so a client sees only their own invoices and the owner sees all.
create or replace view public.invoice_overview with (security_invoker = true) as
select
  i.id, i.number, i.client_id, i.project_id, i.status as stored_status, i.issue_date, i.due_date, i.currency,
  i.subtotal, i.discount, i.tax_percent, i.total, i.notes, i.payment_terms, i.payment_instructions,
  i.created_at,
  coalesce(p.paid, 0) as paid_amount,
  greatest(i.total - coalesce(p.paid, 0), 0) as balance,
  case
    when i.status::text = 'cancelled' then 'cancelled'
    when i.status::text = 'draft' then 'draft'
    when i.total > 0 and coalesce(p.paid, 0) >= i.total then 'paid'
    when i.due_date is not null and i.due_date < (now() at time zone 'Asia/Dhaka')::date then 'overdue'
    when coalesce(p.paid, 0) > 0 then 'partial'
    else 'sent'
  end as status
from public.invoices i
left join (
  select invoice_id, sum(amount) as paid from public.payments where status::text = 'paid' group by invoice_id
) p on p.invoice_id = i.id;
grant select on public.invoice_overview to authenticated;

-- =====================================================================
-- 7. Accounts: only the owner creates logins (public sign-up is also switched off in Supabase settings)
-- =====================================================================
-- Nothing to change here: every new auth user becomes a CLIENT profile by default (handle_new_user),
-- and only set_user_role() (owner only) can change a role.
