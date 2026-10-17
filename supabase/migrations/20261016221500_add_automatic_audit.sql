create or replace function public.audit_operational_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  old_data jsonb;
  new_data jsonb;
  record_id uuid;
  cost_center_id uuid;
begin
  if actor_id is null then
    raise exception 'Authenticated user is required for audited changes.'
      using errcode = '28000';
  end if;

  if tg_op <> 'INSERT' then
    old_data := to_jsonb(old);
  end if;
  if tg_op <> 'DELETE' then
    new_data := to_jsonb(new);
  end if;

  record_id := coalesce((new_data ->> 'id')::uuid, (old_data ->> 'id')::uuid);
  cost_center_id := nullif(
    coalesce(new_data ->> 'centro_custo_id', old_data ->> 'centro_custo_id'),
    ''
  )::uuid;

  insert into public.auditoria_eventos (
    usuario_id,
    acao,
    entidade,
    entidade_id,
    centro_custo_id,
    dados_anteriores,
    dados_novos
  )
  values (
    actor_id,
    case tg_op
      when 'INSERT' then 'criou'
      when 'UPDATE' then 'alterou'
      else 'excluiu'
    end,
    tg_table_name,
    record_id,
    cost_center_id,
    old_data,
    new_data
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_operational_change() from public, anon, authenticated;

create trigger audit_insumos_change
after insert or update or delete on public.insumos
for each row execute function public.audit_operational_change();
create trigger audit_fornecedores_change
after insert or update or delete on public.fornecedores
for each row execute function public.audit_operational_change();
create trigger audit_centros_custo_change
after insert or update or delete on public.centros_custo
for each row execute function public.audit_operational_change();
create trigger audit_compras_historico_change
after insert or update or delete on public.compras_historico
for each row execute function public.audit_operational_change();
create trigger audit_orcamentos_change
after insert or update or delete on public.orcamentos
for each row execute function public.audit_operational_change();
create trigger audit_orcamento_itens_change
after insert or update or delete on public.orcamento_itens
for each row execute function public.audit_operational_change();
create trigger audit_executado_itens_change
after insert or update or delete on public.executado_itens
for each row execute function public.audit_operational_change();
create trigger audit_patrimonio_ativos_change
after insert or update or delete on public.patrimonio_ativos
for each row execute function public.audit_operational_change();
create trigger audit_notas_fiscais_change
after insert or update or delete on public.notas_fiscais
for each row execute function public.audit_operational_change();
create trigger audit_relatorios_salvos_change
after insert or update or delete on public.relatorios_salvos
for each row execute function public.audit_operational_change();
create trigger audit_orcamento_documentos_change
after insert or update or delete on public.orcamento_documentos
for each row execute function public.audit_operational_change();
