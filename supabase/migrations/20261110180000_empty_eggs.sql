-- Empty eggs: a batch can hide some shells with nothing inside.
-- empty_count is how many eggs in the campaign have no prize.
-- is_empty marks those eggs. Opening one claims the egg and does not create a wallet reward.
-- opened_by is the player who opened an empty egg.
-- Safe to re-run. Fresh databases that already have the columns from init skip the adds.

alter table public.campaigns add column if not exists empty_count integer not null default 0;
alter table public.eggs add column if not exists is_empty boolean not null default false;
alter table public.eggs add column if not exists opened_by uuid references public.profiles (id);

alter table public.campaigns drop constraint if exists campaigns_empty_count_nonnegative;
alter table public.campaigns add constraint campaigns_empty_count_nonnegative check (empty_count >= 0);

alter table public.campaigns drop constraint if exists campaigns_empty_within_batch;
alter table public.campaigns add constraint campaigns_empty_within_batch check (empty_count <= egg_count);

drop function if exists public.claim_egg(uuid, uuid, double precision, double precision);

create function public.claim_egg(
  p_egg_id uuid,
  p_player_id uuid,
  p_lat double precision,
  p_lng double precision
) returns jsonb
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

  if coalesce(e.is_empty, false) then
    update public.eggs set status = 'claimed', opened_by = p_player_id where id = e.id;
    return jsonb_build_object('outcome', 'empty', 'egg_id', e.id);
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
      return jsonb_build_object('outcome', 'prize', 'claim_id', new_id);
    exception when unique_violation then
      -- try another code
    end;
  end loop;

  raise exception 'code_collision';
end;
$$;

revoke all on function public.claim_egg(uuid, uuid, double precision, double precision) from public;
grant execute on function public.claim_egg(uuid, uuid, double precision, double precision) to service_role;
