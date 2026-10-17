create or replace function public.is_valid_nfe_access_key(p_access_key text)
returns boolean
language plpgsql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
declare
  idx integer;
  weight integer := 2;
  total integer := 0;
  remainder integer;
  expected_digit integer;
begin
  if p_access_key !~ '^[0-9]{44}$' then
    return false;
  end if;

  for idx in reverse 43..1 loop
    total := total + substring(p_access_key, idx, 1)::integer * weight;
    weight := case when weight = 9 then 2 else weight + 1 end;
  end loop;

  remainder := mod(total, 11);
  expected_digit := case when remainder < 2 then 0 else 11 - remainder end;
  return expected_digit = substring(p_access_key, 44, 1)::integer;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.notas_fiscais
    where chave_acesso is not null
      and not public.is_valid_nfe_access_key(chave_acesso)
  ) then
    raise exception 'Existing invoice access keys with invalid check digits must be corrected before applying this migration.';
  end if;
end;
$$;

alter table public.notas_fiscais
  drop constraint if exists notas_fiscais_chave_acesso_check;

alter table public.notas_fiscais
  add constraint notas_fiscais_chave_acesso_check
  check (chave_acesso is null or public.is_valid_nfe_access_key(chave_acesso));

create or replace function public.sync_orcamento_previsto_total()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  old_orcamento_id uuid;
  new_orcamento_id uuid;
begin
  if tg_op <> 'INSERT' then
    old_orcamento_id := old.orcamento_id;
  end if;
  if tg_op <> 'DELETE' then
    new_orcamento_id := new.orcamento_id;
  end if;

  if old_orcamento_id is not null then
    perform 1
      from public.orcamentos
      where id = old_orcamento_id
      for update;
    update public.orcamentos
      set valor_previsto_total = coalesce((
        select sum(round(item.qtd_prevista * item.valor_previsto_unitario, 2))
        from public.orcamento_itens as item
        where item.orcamento_id = old_orcamento_id
      ), 0)
      where id = old_orcamento_id;
  end if;

  if new_orcamento_id is not null and new_orcamento_id is distinct from old_orcamento_id then
    perform 1
      from public.orcamentos
      where id = new_orcamento_id
      for update;
    update public.orcamentos
      set valor_previsto_total = coalesce((
        select sum(round(item.qtd_prevista * item.valor_previsto_unitario, 2))
        from public.orcamento_itens as item
        where item.orcamento_id = new_orcamento_id
      ), 0)
      where id = new_orcamento_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.is_valid_nfe_access_key(text)
  from public, anon;
grant execute on function public.is_valid_nfe_access_key(text)
  to authenticated, service_role;

revoke all on function public.sync_orcamento_previsto_total()
  from public, anon, authenticated;
