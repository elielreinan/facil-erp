alter table public.perfis
  add column if not exists must_change_password boolean not null default false;

create or replace function public.is_profile_active()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and ativo
      and not must_change_password
  );
$$;

create or replace function public.current_profile_sector()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select setor
  from public.perfis
  where id = auth.uid()
    and ativo
    and not must_change_password;
$$;

create or replace function public.current_profile_level()
returns varchar
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select nivel
  from public.perfis
  where id = auth.uid()
    and ativo
    and not must_change_password;
$$;

create or replace function public.can_manage(required_sector text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and ativo
      and not must_change_password
      and (nivel = 'NV3' or setor = 'admin' or setor = required_sector)
  );
$$;

create or replace function public.can_read_sector(required_sector text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and ativo
      and not must_change_password
      and (nivel = 'NV3' or setor in ('admin', 'diretoria', required_sector))
  );
$$;

create or replace function public.needs_password_rotation()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.perfis
    where id = auth.uid()
      and ativo
      and must_change_password
  );
$$;

revoke all on function public.is_profile_active() from public, anon;
grant execute on function public.is_profile_active() to authenticated, service_role;
revoke all on function public.current_profile_sector() from public, anon;
grant execute on function public.current_profile_sector() to authenticated, service_role;
revoke all on function public.current_profile_level() from public, anon;
grant execute on function public.current_profile_level() to authenticated, service_role;
revoke all on function public.can_manage(text) from public, anon;
grant execute on function public.can_manage(text) to authenticated, service_role;
revoke all on function public.can_read_sector(text) from public, anon;
grant execute on function public.can_read_sector(text) to authenticated, service_role;
revoke all on function public.needs_password_rotation() from public, anon;
grant execute on function public.needs_password_rotation() to authenticated, service_role;
