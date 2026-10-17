alter table public.perfis
  add column if not exists ativo boolean not null default true;

create table if not exists public.gfac_user_links (
  managed_user_id uuid primary key,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  criado_em timestamptz not null default timezone('utc', now())
);

alter table public.gfac_user_links enable row level security;
revoke all on public.gfac_user_links from public, anon, authenticated;
grant all on public.gfac_user_links to service_role;

create table if not exists public.gfac_m2m_nonces (
  jti uuid primary key,
  expires_at timestamptz not null,
  criado_em timestamptz not null default timezone('utc', now())
);

alter table public.gfac_m2m_nonces enable row level security;
revoke all on public.gfac_m2m_nonces from public, anon, authenticated;
grant all on public.gfac_m2m_nonces to service_role;

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
  );
$$;

create or replace function public.current_profile_sector()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select setor from public.perfis where id = auth.uid() and ativo;
$$;

create or replace function public.current_profile_level()
returns varchar
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select nivel from public.perfis where id = auth.uid() and ativo;
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
      and (nivel = 'NV3' or setor = 'admin' or setor = required_sector)
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

do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'perfis',
    'centros_custo',
    'insumos',
    'fornecedores',
    'compras_historico',
    'orcamentos',
    'orcamento_itens',
    'executado_itens',
    'patrimonio_ativos',
    'notas_fiscais',
    'auditoria_eventos',
    'relatorios_salvos',
    'orcamento_documentos'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Require active profile',
      relation_name
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_profile_active()) with check (public.is_profile_active())',
      'Require active profile',
      relation_name
    );
  end loop;
end;
$$;
