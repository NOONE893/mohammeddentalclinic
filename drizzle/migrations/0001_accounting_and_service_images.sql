-- Service photos
alter table public.services add column if not exists image_url text not null default '';

-- Chart of accounts
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  type text not null check (type in ('asset','liability','equity','revenue','expense')),
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.accounts to authenticated;
grant all on public.accounts to service_role;
alter table public.accounts enable row level security;
create policy "Staff read accounts" on public.accounts for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admins add accounts" on public.accounts for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins edit accounts" on public.accounts for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete custom accounts" on public.accounts for delete to authenticated using (public.has_role(auth.uid(), 'admin') and not is_system);

insert into public.accounts (code, name, type, is_system) values
  ('1010', 'الصندوق (نقد)', 'asset', true),
  ('1020', 'البنك', 'asset', true),
  ('1100', 'ذمم المرضى (مدينون)', 'asset', true),
  ('1200', 'المخزون والمستلزمات', 'asset', true),
  ('1500', 'الأجهزة والمعدات', 'asset', true),
  ('2100', 'ضريبة القيمة المضافة المستحقة', 'liability', true),
  ('2200', 'ذمم الموردين (دائنون)', 'liability', true),
  ('2300', 'رواتب مستحقة', 'liability', true),
  ('3000', 'رأس المال', 'equity', true),
  ('3100', 'المسحوبات الشخصية', 'equity', true),
  ('3200', 'الأرباح المحتجزة', 'equity', true),
  ('4100', 'إيرادات العلاج', 'revenue', true),
  ('4200', 'إيرادات أخرى', 'revenue', true),
  ('4900', 'خصومات ممنوحة', 'revenue', true),
  ('5100', 'رواتب وعمولات', 'expense', true),
  ('5200', 'إيجار', 'expense', true),
  ('5300', 'مستهلكات', 'expense', true),
  ('5400', 'مختبر أسنان', 'expense', true),
  ('5500', 'كهرباء وماء', 'expense', true),
  ('5600', 'صيانة أجهزة', 'expense', true),
  ('5700', 'تسويق', 'expense', true),
  ('5900', 'أخرى', 'expense', true);

-- Journal
create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no bigint generated always as identity (start with 1) unique,
  entry_date date not null default current_date,
  description text not null default '',
  source_type text not null default 'manual' check (source_type in ('invoice','payment','expense','manual')),
  source_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index journal_entries_date_idx on public.journal_entries (entry_date);
create index journal_entries_source_idx on public.journal_entries (source_type, source_id);
grant select on public.journal_entries to authenticated;
grant all on public.journal_entries to service_role;
alter table public.journal_entries enable row level security;
create policy "Staff read journal" on public.journal_entries for select to authenticated using (public.is_staff(auth.uid()));

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  debit numeric not null default 0 check (debit >= 0),
  credit numeric not null default 0 check (credit >= 0),
  memo text not null default ''
);
create index journal_lines_entry_idx on public.journal_lines (entry_id);
create index journal_lines_account_idx on public.journal_lines (account_id);
grant select on public.journal_lines to authenticated;
grant all on public.journal_lines to service_role;
alter table public.journal_lines enable row level security;
create policy "Staff read journal lines" on public.journal_lines for select to authenticated using (public.is_staff(auth.uid()));

-- Helpers
create or replace function public.acct(_code text) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.accounts where code = _code
$$;

create or replace function public.cash_account(_method text) returns uuid
language sql stable security definer set search_path = public as $$
  select public.acct(case when _method = 'cash' then '1010' else '1020' end)
$$;

-- Auto-posting: invoices (Dr receivables / Cr revenue + VAT, discount shown via contra-revenue)
create or replace function public.post_invoice() returns trigger
language plpgsql security definer set search_path = public as $$
declare e uuid; pname text;
begin
  delete from public.journal_entries where source_type = 'invoice' and source_id = coalesce(new.id, old.id);
  if tg_op = 'DELETE' then return old; end if;
  select full_name into pname from public.patients where id = new.patient_id;
  insert into public.journal_entries (entry_date, description, source_type, source_id)
    values (new.issue_date, 'فاتورة رقم ' || new.number || ' — ' || coalesce(pname, ''), 'invoice', new.id)
    returning id into e;
  insert into public.journal_lines (entry_id, account_id, debit, credit, memo) values
    (e, public.acct('1100'), new.total, 0, 'مستحق على المريض');
  if new.discount > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo) values
      (e, public.acct('4900'), new.discount, 0, 'خصم ممنوح');
  end if;
  insert into public.journal_lines (entry_id, account_id, debit, credit, memo) values
    (e, public.acct('4100'), 0, new.subtotal, 'إيراد علاج');
  if new.vat_amount > 0 then
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo) values
      (e, public.acct('2100'), 0, new.vat_amount, 'ضريبة القيمة المضافة');
  end if;
  return new;
end;
$$;
create trigger invoices_post after insert or update or delete on public.invoices
  for each row execute function public.post_invoice();

-- Payments (Dr cash/bank / Cr receivables)
create or replace function public.post_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare e uuid; inv record;
begin
  delete from public.journal_entries where source_type = 'payment' and source_id = coalesce(new.id, old.id);
  if tg_op = 'DELETE' then return old; end if;
  select i.number, p.full_name into inv from public.invoices i left join public.patients p on p.id = i.patient_id where i.id = new.invoice_id;
  insert into public.journal_entries (entry_date, description, source_type, source_id)
    values (new.paid_on, 'تحصيل دفعة — فاتورة ' || coalesce(inv.number::text, '') || ' — ' || coalesce(inv.full_name, ''), 'payment', new.id)
    returning id into e;
  insert into public.journal_lines (entry_id, account_id, debit, credit, memo) values
    (e, public.cash_account(new.method), new.amount, 0, 'تحصيل'),
    (e, public.acct('1100'), 0, new.amount, 'سداد ذمة مريض');
  return new;
end;
$$;
create trigger payments_post after insert or update or delete on public.payments
  for each row execute function public.post_payment();

-- Expenses (Dr expense account by category / Cr cash/bank)
create or replace function public.post_expense() returns trigger
language plpgsql security definer set search_path = public as $$
declare e uuid; exp_acct uuid;
begin
  delete from public.journal_entries where source_type = 'expense' and source_id = coalesce(new.id, old.id);
  if tg_op = 'DELETE' then return old; end if;
  select id into exp_acct from public.accounts where type = 'expense' and name = new.category limit 1;
  if exp_acct is null then exp_acct := public.acct('5900'); end if;
  insert into public.journal_entries (entry_date, description, source_type, source_id)
    values (new.spent_on, 'مصروف: ' || new.category || case when new.note <> '' then ' — ' || new.note else '' end, 'expense', new.id)
    returning id into e;
  insert into public.journal_lines (entry_id, account_id, debit, credit, memo) values
    (e, exp_acct, new.amount, 0, new.category),
    (e, public.cash_account(new.method), 0, new.amount, 'دفع');
  return new;
end;
$$;
create trigger expenses_post after insert or update or delete on public.expenses
  for each row execute function public.post_expense();

-- Manual journal entries (admin only, must balance)
create or replace function public.post_manual_entry(_date date, _description text, _lines jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare e uuid; td numeric; tc numeric; l jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'غير مصرح'; end if;
  if jsonb_array_length(_lines) < 2 then raise exception 'القيد يحتاج سطرين على الأقل'; end if;
  select coalesce(sum((x->>'debit')::numeric),0), coalesce(sum((x->>'credit')::numeric),0) into td, tc from jsonb_array_elements(_lines) x;
  if td <= 0 or round(td, 2) <> round(tc, 2) then raise exception 'القيد غير متوازن: مدين % / دائن %', td, tc; end if;
  insert into public.journal_entries (entry_date, description, source_type, created_by)
    values (_date, _description, 'manual', auth.uid()) returning id into e;
  for l in select * from jsonb_array_elements(_lines) loop
    insert into public.journal_lines (entry_id, account_id, debit, credit, memo)
      values (e, (l->>'account_id')::uuid, coalesce((l->>'debit')::numeric,0), coalesce((l->>'credit')::numeric,0), coalesce(l->>'memo',''));
  end loop;
  return e;
end;
$$;
grant execute on function public.post_manual_entry(date, text, jsonb) to authenticated;

create or replace function public.delete_manual_entry(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'غير مصرح'; end if;
  delete from public.journal_entries where id = _id and source_type = 'manual';
end;
$$;
grant execute on function public.delete_manual_entry(uuid) to authenticated;

-- Balances per account for a period (RLS applies through security invoker)
create or replace function public.account_balances(_from date, _to date)
returns table (account_id uuid, code text, name text, type text, debit numeric, credit numeric)
language sql stable security invoker set search_path = public as $$
  select a.id, a.code, a.name, a.type,
    coalesce(sum(l.debit) filter (where e.id is not null), 0),
    coalesce(sum(l.credit) filter (where e.id is not null), 0)
  from public.accounts a
  left join public.journal_lines l on l.account_id = a.id
  left join public.journal_entries e on e.id = l.entry_id and e.entry_date between _from and _to
  group by a.id, a.code, a.name, a.type
  order by a.code
$$;
grant execute on function public.account_balances(date, date) to authenticated;

-- Backfill entries for anything recorded before accounting existed
do $$
declare r record;
begin
  for r in select id from public.invoices loop update public.invoices set notes = notes where id = r.id; end loop;
  for r in select id from public.payments loop update public.payments set method = method where id = r.id; end loop;
  for r in select id from public.expenses loop update public.expenses set note = note where id = r.id; end loop;
end $$;