drop policy if exists "Suprimentos gerenciam centros de custo"
  on public.centros_custo;
create policy "Suprimentos gerenciam centros de custo"
  on public.centros_custo for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos'));

grant select, insert, update, delete on public.centros_custo to authenticated;

create or replace function public.list_active_profile_assignments()
returns table (id uuid, nome text)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select profile.id, profile.nome
  from public.perfis as profile
  where profile.ativo
    and public.is_profile_active()
    and (
      public.can_read_sector('ti')
      or public.can_read_sector('suprimentos')
    );
$$;

revoke all on function public.list_active_profile_assignments() from public, anon;
grant execute on function public.list_active_profile_assignments() to authenticated, service_role;
