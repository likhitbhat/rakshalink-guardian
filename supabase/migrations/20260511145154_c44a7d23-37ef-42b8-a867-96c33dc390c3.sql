-- Roles enum and helper
create type public.app_role as enum ('user', 'guardian');
create type public.alert_status as enum ('active', 'resolved', 'cancelled');
create type public.alert_type as enum ('sos', 'fall', 'voice', 'deadman', 'manual');
create type public.zone_type as enum ('home', 'school', 'work', 'custom');
create type public.link_status as enum ('pending', 'active', 'revoked');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  role app_role not null default 'user',
  avatar_url text,
  safety_score int not null default 85,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "view own profile" on public.profiles for select using (auth.uid() = id);
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles for update using (auth.uid() = id);

-- emergency contacts
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relation text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.emergency_contacts enable row level security;
create policy "manage own contacts" on public.emergency_contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- safe zones
create table public.safe_zones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type zone_type not null default 'custom',
  lat double precision not null,
  lng double precision not null,
  radius_m int not null default 200,
  notify_enter boolean not null default true,
  notify_exit boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.safe_zones enable row level security;
create policy "manage own zones" on public.safe_zones for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- devices
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'RakshaLink Pendant',
  mac text,
  paired boolean not null default false,
  battery int not null default 100,
  signal int not null default 90,
  firmware text default '1.0.0',
  last_seen timestamptz default now(),
  created_at timestamptz not null default now()
);
alter table public.devices enable row level security;
create policy "manage own devices" on public.devices for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- guardian links
create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references auth.users(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status link_status not null default 'active',
  label text,
  created_at timestamptz not null default now(),
  unique(guardian_id, user_id)
);
alter table public.guardian_links enable row level security;
create policy "guardian sees own links" on public.guardian_links for select using (auth.uid() = guardian_id or auth.uid() = user_id);
create policy "guardian inserts own links" on public.guardian_links for insert with check (auth.uid() = guardian_id);
create policy "guardian updates own links" on public.guardian_links for update using (auth.uid() = guardian_id or auth.uid() = user_id);
create policy "guardian deletes own links" on public.guardian_links for delete using (auth.uid() = guardian_id or auth.uid() = user_id);

-- helper: is_guardian_of
create or replace function public.is_guardian_of(_guardian uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.guardian_links
    where guardian_id = _guardian and user_id = _user and status = 'active');
$$;

-- emergency alerts
create table public.emergency_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type alert_type not null default 'sos',
  status alert_status not null default 'active',
  lat double precision,
  lng double precision,
  notes text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.emergency_alerts enable row level security;
create policy "owner manages alerts" on public.emergency_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "guardian views alerts" on public.emergency_alerts for select using (public.is_guardian_of(auth.uid(), user_id));

-- live locations
create table public.live_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  battery int,
  recorded_at timestamptz not null default now()
);
create index on public.live_locations(user_id, recorded_at desc);
alter table public.live_locations enable row level security;
create policy "owner manages loc" on public.live_locations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "guardian views loc" on public.live_locations for select using (public.is_guardian_of(auth.uid(), user_id));

-- auto-create profile trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'user')
  );
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- realtime
alter publication supabase_realtime add table public.emergency_alerts;
alter publication supabase_realtime add table public.live_locations;