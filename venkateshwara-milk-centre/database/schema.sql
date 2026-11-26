-- Venkateshwara Milk Centre schema (PostgreSQL / Supabase)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  phone text,
  role text not null check (role in ('admin','collector','farmer')),
  created_at timestamptz not null default now()
);

create table farmers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete set null, -- login account (optional)
  name text not null check (char_length(name) between 2 and 100),
  phone text,
  village text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table milk_collections (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references farmers(id) on delete restrict,
  collector_id uuid not null references profiles(id),
  collection_date date not null,
  shift smallint not null check (shift in (1,2)),            -- 1 = morning, 2 = evening
  quantity_litres numeric(6,2) not null check (quantity_litres > 0),
  fat numeric(4,2) check (fat between 0 and 15),
  rate_per_litre numeric(6,2) not null check (rate_per_litre >= 0),
  amount numeric(10,2) generated always as (round(quantity_litres * rate_per_litre, 2)) stored,
  created_at timestamptz not null default now(),
  unique (farmer_id, collection_date, shift)                   -- one entry per farmer per shift
);
create index on milk_collections (collection_date);
create index on milk_collections (farmer_id, collection_date);

-- The API uses the service key; block all direct client access.
alter table profiles enable row level security;
alter table farmers enable row level security;
alter table milk_collections enable row level security;
