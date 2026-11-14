-- Roles & profiles
create type public.app_role as enum ('admin', 'staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create policy "Own profile readable" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Own profile editable" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins grant roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins revoke roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') and user_id <> auth.uid());

-- New user: profile + first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.email)
  on conflict (id) do nothing;
  if not exists (select 1 from public.user_roles) then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Clinic settings (single row)
create table public.clinic_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'عيادة د. محمد لطب الأسنان',
  name_en text not null default 'Dr. Mohammed Dental Clinic',
  tagline text not null default 'ابتسامتك تبدأ من هنا',
  about text not null default 'عيادة متخصصة في طب وتجميل الأسنان، نقدم رعاية متكاملة لجميع أفراد العائلة بأحدث الأجهزة وبأيدي فريق خبير.',
  phone text not null default '0500000000',
  whatsapp text not null default '0500000000',
  email text not null default '',
  address text not null default 'الرياض',
  map_url text not null default '',
  vat_number text not null default '',
  vat_rate numeric not null default 15,
  currency text not null default 'ر.س',
  open_time time not null default '09:00',
  close_time time not null default '21:00',
  slot_minutes int not null default 30,
  working_days int[] not null default '{6,0,1,2,3,4}',
  reminder_template text not null default 'مرحباً {name}، نذكّرك بموعدك في {clinic} يوم {date} الساعة {time}. للتأكيد أو التعديل يرجى الرد على هذه الرسالة.',
  invoice_footer text not null default 'نتمنى لكم دوام الصحة والابتسامة الجميلة',
  updated_at timestamptz not null default now()
);
grant select on public.clinic_settings to anon, authenticated;
grant update on public.clinic_settings to authenticated;
grant all on public.clinic_settings to service_role;
alter table public.clinic_settings enable row level security;
create policy "Settings public" on public.clinic_settings for select to anon, authenticated using (true);
create policy "Admins edit settings" on public.clinic_settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
insert into public.clinic_settings (id) values (1);

-- Doctors
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null default '',
  bio text not null default '',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.doctors to anon;
grant select, insert, update, delete on public.doctors to authenticated;
grant all on public.doctors to service_role;
alter table public.doctors enable row level security;
create policy "Active doctors public" on public.doctors for select to anon using (active);
create policy "Staff read doctors" on public.doctors for select to authenticated using (active or public.is_staff(auth.uid()));
create policy "Admins manage doctors" on public.doctors for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
insert into public.doctors (name, specialty, bio, sort) values
  ('د. محمد', 'استشاري طب وتجميل الأسنان', 'خبرة واسعة في الزراعة والتركيبات وتجميل الابتسامة.', 1);

-- Services
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  price numeric not null default 0,
  duration_min int not null default 30,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.services to anon;
grant select, insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;
create policy "Active services public" on public.services for select to anon using (active);
create policy "Staff read services" on public.services for select to authenticated using (active or public.is_staff(auth.uid()));
create policy "Admins manage services" on public.services for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
insert into public.services (name, description, price, duration_min, sort) values
  ('كشف واستشارة', 'فحص شامل وخطة علاج واضحة', 150, 30, 1),
  ('تنظيف وتلميع', 'إزالة الجير والتصبغات', 250, 30, 2),
  ('حشوة تجميلية', 'حشوات بلون السن الطبيعي', 350, 30, 3),
  ('علاج عصب', 'علاج جذور بأحدث التقنيات', 900, 60, 4),
  ('خلع', 'خلع بسيط وجراحي', 200, 30, 5),
  ('تاج زركون', 'تركيبات ثابتة بمظهر طبيعي', 1800, 60, 6),
  ('زراعة أسنان', 'تعويض الأسنان المفقودة بشكل دائم', 4500, 60, 7),
  ('تبييض الأسنان', 'ابتسامة أكثر إشراقاً في جلسة واحدة', 1200, 60, 8);

-- Patients
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null default '',
  gender text not null default '',
  birth_date date,
  national_id text not null default '',
  allergies text not null default '',
  medical_notes text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.patients to authenticated;
grant all on public.patients to service_role;
alter table public.patients enable row level security;
create policy "Staff manage patients" on public.patients for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.tooth_records (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  tooth int not null,
  status text not null default 'healthy',
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (patient_id, tooth)
);
grant select, insert, update, delete on public.tooth_records to authenticated;
grant all on public.tooth_records to service_role;
alter table public.tooth_records enable row level security;
create policy "Staff manage teeth" on public.tooth_records for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.treatment_items (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  title text not null,
  tooth int,
  price numeric not null default 0,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.treatment_items to authenticated;
grant all on public.treatment_items to service_role;
alter table public.treatment_items enable row level security;
create policy "Staff manage treatments" on public.treatment_items for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  appt_date date not null,
  appt_time time not null,
  duration_min int not null default 30,
  status text not null default 'booked',
  notes text not null default '',
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index appointments_date_idx on public.appointments (appt_date, appt_time);
grant select, insert, update, delete on public.appointments to authenticated;
grant all on public.appointments to service_role;
alter table public.appointments enable row level security;
create policy "Staff manage appointments" on public.appointments for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Online booking requests (public insert only)
create table public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone text not null check (char_length(phone) between 8 and 20),
  service_id uuid references public.services(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  req_date date not null,
  req_time time not null,
  notes text not null default '' check (char_length(notes) <= 500),
  status text not null default 'new',
  created_at timestamptz not null default now()
);
grant insert on public.booking_requests to anon, authenticated;
grant select, update, delete on public.booking_requests to authenticated;
grant all on public.booking_requests to service_role;
alter table public.booking_requests enable row level security;
create policy "Anyone can request booking" on public.booking_requests for insert to anon, authenticated
  with check (status = 'new');
create policy "Staff read requests" on public.booking_requests for select to authenticated using (public.is_staff(auth.uid()));
create policy "Staff update requests" on public.booking_requests for update to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
create policy "Staff delete requests" on public.booking_requests for delete to authenticated using (public.is_staff(auth.uid()));

create or replace function public.get_booked_slots(_date date, _doctor uuid default null)
returns table (slot time) language sql stable security definer set search_path = public as $$
  with taken as (
    select appt_time as t, doctor_id as d from public.appointments where appt_date = _date and status <> 'cancelled'
    union all
    select req_time, doctor_id from public.booking_requests where req_date = _date and status = 'new'
  )
  select distinct t from taken where _doctor is not null and (d = _doctor or d is null)
  union
  select t from taken where _doctor is null group by t
    having count(*) >= greatest((select count(*) from public.doctors where active), 1)
$$;
grant execute on function public.get_booked_slots(date, uuid) to anon, authenticated;

-- Invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity (start with 1001) unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  issue_date date not null default current_date,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  vat_rate numeric not null default 15,
  vat_amount numeric not null default 0,
  total numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;
alter table public.invoices enable row level security;
create policy "Staff manage invoices" on public.invoices for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0
);
grant select, insert, update, delete on public.invoice_items to authenticated;
grant all on public.invoice_items to service_role;
alter table public.invoice_items enable row level security;
create policy "Staff manage invoice items" on public.invoice_items for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'cash',
  paid_on date not null default current_date,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "Staff manage payments" on public.payments for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Expenses
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'أخرى',
  amount numeric not null check (amount > 0),
  method text not null default 'cash',
  spent_on date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
alter table public.expenses enable row level security;
create policy "Staff manage expenses" on public.expenses for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));

-- Inventory
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default 'قطعة',
  quantity numeric not null default 0,
  min_quantity numeric not null default 0,
  cost numeric not null default 0,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.inventory_items to authenticated;
grant all on public.inventory_items to service_role;
alter table public.inventory_items enable row level security;
create policy "Staff manage inventory" on public.inventory_items for all to authenticated
  using (public.is_staff(auth.uid())) with check (public.is_staff(auth.uid()));
insert into public.inventory_items (name, unit, quantity, min_quantity, cost) values
  ('مادة تخدير', 'أمبولة', 40, 100, 20),
  ('قفازات', 'علبة', 150, 12, 60),
  ('حشوات ضوئية', 'أنبوب', 6, 10, 45),
  ('أفلام أشعة', 'علبة', 60, 10, 30);