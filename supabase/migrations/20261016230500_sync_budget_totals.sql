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
        select sum(item.qtd_prevista * item.valor_previsto_unitario)
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
        select sum(item.qtd_prevista * item.valor_previsto_unitario)
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

create trigger orcamento_itens_sync_previsto_total
after insert or update or delete on public.orcamento_itens
for each row execute function public.sync_orcamento_previsto_total();

revoke all on function public.sync_orcamento_previsto_total()
  from public, anon, authenticated;
