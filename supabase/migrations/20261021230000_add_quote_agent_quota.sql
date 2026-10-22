create table public.quote_agent_daily_usage (
  user_id uuid not null references public.perfis (id) on delete cascade,
  usage_date date not null,
  request_count integer not null check (request_count between 1 and 5),
  primary key (user_id, usage_date)
);

alter table public.quote_agent_daily_usage enable row level security;
revoke all on table public.quote_agent_daily_usage from public, anon, authenticated, service_role;

create or replace function public.consume_quote_agent_daily_quota(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  updated_count integer;
begin
  if p_user_id is null then
    return false;
  end if;

  insert into public.quote_agent_daily_usage (user_id, usage_date, request_count)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, usage_date)
  do update set request_count = public.quote_agent_daily_usage.request_count + 1
  where public.quote_agent_daily_usage.request_count < 5
  returning request_count into updated_count;

  return updated_count is not null;
end;
$$;

revoke all on function public.consume_quote_agent_daily_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_quote_agent_daily_quota(uuid) to service_role;
