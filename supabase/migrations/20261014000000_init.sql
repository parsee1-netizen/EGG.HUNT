-- EggDrop: businesses hide GPS eggs, players claim them, businesses redeem a one-time code.
-- Apply in the Supabase SQL editor or with the Supabase CLI.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key,
  role text not null check (role in ('player', 'business')),
  display_name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  name text not null,
  address text not null default '',
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id),
  name text not null,
  reward_type text not null check (reward_type in ('discount', 'gift_card')),
  reward_label text not null,
  reward_detail text not null,
  reward_title text not null,
  radius_m integer not null check (radius_m > 0),
  egg_count integer not null check (egg_count > 0),
  amount_cents integer not null check (amount_cents >= 0),
  status text not null default 'pending_payment' check (status in ('draft', 'pending_payment', 'active')),
  stripe_session_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists public.eggs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id),
  business_id uuid not null references public.businesses (id),
  business_name text not null,
  lat double precision not null,
  lng double precision not null,
  reward_type text not null check (reward_type in ('discount', 'gift_card')),
  reward_label text not null,
  reward_detail text not null,
  reward_title text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'claimed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  egg_id uuid not null unique references public.eggs (id),
  campaign_id uuid not null references public.campaigns (id),
  player_id uuid not null references public.profiles (id),
  business_id uuid not null references public.businesses (id),
  business_name text not null,
  code text not null unique,
  token text not null unique,
  status text not null default 'active' check (status in ('active', 'redeemed')),
  reward_type text not null check (reward_type in ('discount', 'gift_card')),
  reward_label text not null,
  reward_detail text not null,
  reward_title text not null,
  claimed_at timestamptz not null default now(),
  redeemed_at timestamptz,
  expires_at timestamptz not null
);

create table if not exists public.redemptions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id),
  business_id uuid not null references public.businesses (id),
  campaign_id uuid not null references public.campaigns (id),
  player_id uuid not null references public.profiles (id),
  redeemed_by uuid not null references public.profiles (id),
  redeemed_at timestamptz not null default now()
);

create index if not exists eggs_business_status_idx on public.eggs (business_id, status);
create index if not exists eggs_status_lat_lng_idx on public.eggs (status, lat, lng);
create index if not exists claims_player_idx on public.claims (player_id);
create index if not exists claims_business_idx on public.claims (business_id);
create index if not exists redemptions_business_idx on public.redemptions (business_id);
create index if not exists campaigns_business_idx on public.campaigns (business_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.distance_m(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) returns double precision
language sql
immutable
as $$
  with h as (
    select least(1::double precision, power(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)) as v
  )
  select 2 * 6371000 * atan2(sqrt(v), sqrt(1 - v)) from h;
$$;

create or replace function public.make_egg_code() returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := 'EGG-';
  i int;
begin
  for i in 1..4 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  result := result || '-';
  for i in 1..2 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

-- Claim is atomic: the egg flips to claimed only if it is active and the player is within 50 m.
create or replace function public.claim_egg(
  p_egg_id uuid,
  p_player_id uuid,
  p_lat double precision,
  p_lng double precision
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.eggs%rowtype;
  dist double precision;
  new_id uuid;
  bname text;
  new_code text;
  attempt int;
begin
  select * into e from public.eggs where id = p_egg_id for update;
  if not found then
    raise exception 'not_found';
  end if;
  if e.status <> 'active' then
    raise exception 'unavailable';
  end if;
  if e.expires_at < now() then
    raise exception 'expired';
  end if;
  if not exists (select 1 from public.profiles where id = p_player_id) then
    raise exception 'not_found';
  end if;

  dist := public.distance_m(p_lat, p_lng, e.lat, e.lng);
  if dist > 50 then
    raise exception 'too_far:%', round(dist);
  end if;

  update public.eggs set status = 'claimed' where id = e.id;
  select name into bname from public.businesses where id = e.business_id;

  for attempt in 1..6 loop
    new_code := public.make_egg_code();
    begin
      insert into public.claims (
        egg_id, campaign_id, player_id, business_id, business_name,
        code, token, status,
        reward_type, reward_label, reward_detail, reward_title,
        expires_at
      ) values (
        e.id, e.campaign_id, p_player_id, e.business_id, bname,
        new_code, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
        'active',
        e.reward_type, e.reward_label, e.reward_detail, e.reward_title,
        e.expires_at
      ) returning id into new_id;
      return new_id;
    exception when unique_violation then
      -- try another code
    end;
  end loop;

  raise exception 'code_collision';
end;
$$;

-- Redeem is one-time. A second scan raises already_redeemed.
create or replace function public.redeem_claim(
  p_token_or_code text,
  p_business_id uuid,
  p_redeemed_by uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.claims%rowtype;
  needle text := upper(trim(p_token_or_code));
  new_id uuid;
begin
  select * into c from public.claims
    where token = trim(p_token_or_code) or code = needle
    for update;
  if not found then
    raise exception 'not_found';
  end if;
  if c.business_id <> p_business_id then
    raise exception 'wrong_business:%', c.business_name;
  end if;
  if c.status = 'redeemed' then
    raise exception 'already_redeemed';
  end if;
  if c.expires_at < now() then
    raise exception 'expired';
  end if;

  update public.claims
    set status = 'redeemed', redeemed_at = now()
    where id = c.id;

  insert into public.redemptions (claim_id, business_id, campaign_id, player_id, redeemed_by)
  values (c.id, c.business_id, c.campaign_id, c.player_id, p_redeemed_by)
  returning id into new_id;

  return new_id;
end;
$$;

-- Stripe webhook (and the success-page confirm) call this. Running it twice is safe.
create or replace function public.activate_campaign(
  p_campaign_id uuid,
  p_session text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.campaigns
    set status = 'active',
        paid_at = coalesce(paid_at, now()),
        stripe_session_id = coalesce(p_session, stripe_session_id)
    where id = p_campaign_id;
  if not found then
    raise exception 'not_found';
  end if;

  update public.eggs
    set status = 'active'
    where campaign_id = p_campaign_id and status = 'pending';
end;
$$;

revoke all on function public.claim_egg(uuid, uuid, double precision, double precision) from public;
revoke all on function public.redeem_claim(text, uuid, uuid) from public;
revoke all on function public.activate_campaign(uuid, text) from public;
grant execute on function public.claim_egg(uuid, uuid, double precision, double precision) to service_role;
grant execute on function public.redeem_claim(text, uuid, uuid) to service_role;
grant execute on function public.activate_campaign(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security. The Next.js server uses the service role, which bypasses
-- these policies. They lock down the anon/authenticated keys.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.campaigns enable row level security;
alter table public.eggs enable row level security;
alter table public.claims enable row level security;
alter table public.redemptions enable row level security;

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select using (auth.uid() = id);

drop policy if exists businesses_read on public.businesses;
create policy businesses_read on public.businesses
  for select using (true);

drop policy if exists campaigns_owner on public.campaigns;
create policy campaigns_owner on public.campaigns
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists eggs_read on public.eggs;
create policy eggs_read on public.eggs
  for select using (
    status = 'active'
    or exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists claims_player on public.claims;
create policy claims_player on public.claims
  for select using (player_id = auth.uid());

drop policy if exists claims_business on public.claims;
create policy claims_business on public.claims
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

drop policy if exists redemptions_business on public.redemptions;
create policy redemptions_business on public.redemptions
  for select using (
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- Create a player profile when someone signs up. Business owners are promoted by the seed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, display_name, email)
  values (
    new.id,
    'player',
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'drop trigger if exists on_auth_user_created on auth.users';
    execute 'create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user()';
  end if;
end $$;
