-- ملف إعداد قاعدة البيانات للتقويم وسندات القبض/الصرف.
-- شغّله مرة واحدة من Supabase → SQL Editor (أو الصقه في محادثة Lovable واطلب تنفيذه كـ Migration).
-- آمن: لا يحذف ولا يعدّل أي بيانات موجودة.

-- 1) ملف حالة التقويم (حالة واحدة لكل مريض)
create table if not exists public.ortho_cases (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  case_date date not null default current_date,
  complaint text not null default '',
  exam jsonb not null default '{}'::jsonb,     -- { key: {v: "القيمة", n: "ملاحظات"} }
  photos jsonb not null default '{}'::jsonb,   -- { key: ["patientId/key/file.jpg", ...] }
  ceph text not null default '',
  diagnosis text not null default '',
  plan text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ortho_cases to authenticated;
grant all on public.ortho_cases to service_role;
alter table public.ortho_cases enable row level security;
drop policy if exists "Staff manage ortho cases" on public.ortho_cases;
create policy "Staff manage ortho cases" on public.ortho_cases for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- 2) مخزن صور التقويم (خاص، للموظفين فقط)
insert into storage.buckets (id, name, public) values ('ortho-photos', 'ortho-photos', false)
  on conflict (id) do nothing;
drop policy if exists "Staff read ortho photos" on storage.objects;
drop policy if exists "Staff upload ortho photos" on storage.objects;
drop policy if exists "Staff delete ortho photos" on storage.objects;
create policy "Staff read ortho photos" on storage.objects for select to authenticated
  using (bucket_id = 'ortho-photos' and public.is_staff(auth.uid()));
create policy "Staff upload ortho photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'ortho-photos' and public.is_staff(auth.uid()));
create policy "Staff delete ortho photos" on storage.objects for delete to authenticated
  using (bucket_id = 'ortho-photos' and public.is_staff(auth.uid()));

-- 3) أرقام تسلسلية للسندات (الدفعات = سندات قبض، المصروفات = سندات صرف)
alter table public.payments  add column if not exists voucher_no bigint generated always as identity;
alter table public.expenses  add column if not exists voucher_no bigint generated always as identity;
alter table public.expenses  add column if not exists payee text not null default '';
