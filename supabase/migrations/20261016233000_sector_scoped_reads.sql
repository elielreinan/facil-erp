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
      and (
        nivel = 'NV3'
        or setor in ('admin', 'diretoria', required_sector)
      )
  );
$$;

revoke all on function public.can_read_sector(text) from public, anon;
grant execute on function public.can_read_sector(text) to authenticated, service_role;

drop policy if exists "Usuários autenticados podem ler insumos" on public.insumos;
create policy "Setores autorizados podem ler insumos"
  on public.insumos for select to authenticated
  using (
    public.can_read_sector('suprimentos')
    or public.can_read_sector('orcamentos')
  );

drop policy if exists "Usuários autenticados podem ler histórico de compras"
  on public.compras_historico;
create policy "Setores autorizados podem ler histórico de compras"
  on public.compras_historico for select to authenticated
  using (public.can_read_sector('suprimentos'));

drop policy if exists "Usuários autenticados podem ler orçamentos" on public.orcamentos;
create policy "Setores autorizados podem ler orçamentos"
  on public.orcamentos for select to authenticated
  using (public.can_read_sector('orcamentos'));

drop policy if exists "Usuários autenticados podem ler itens de orçamento"
  on public.orcamento_itens;
create policy "Setores autorizados podem ler itens de orçamento"
  on public.orcamento_itens for select to authenticated
  using (public.can_read_sector('orcamentos'));

drop policy if exists "Usuários autenticados podem ler itens executados"
  on public.executado_itens;
create policy "Setores autorizados podem ler itens executados"
  on public.executado_itens for select to authenticated
  using (public.can_read_sector('orcamentos'));

drop policy if exists "Usuários autenticados podem ler ativos patrimoniais"
  on public.patrimonio_ativos;
create policy "Setores autorizados podem ler ativos patrimoniais"
  on public.patrimonio_ativos for select to authenticated
  using (public.can_read_sector('ti'));

drop policy if exists "Usuários autenticados podem ler notas fiscais"
  on public.notas_fiscais;
create policy "Setores autorizados podem ler notas fiscais"
  on public.notas_fiscais for select to authenticated
  using (public.can_read_sector('suprimentos'));

drop policy if exists "Usuários autenticados podem ler a própria auditoria"
  on public.auditoria_eventos;
create policy "Usuários autorizados podem ler auditoria"
  on public.auditoria_eventos for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.can_read_sector('diretoria')
  );

drop policy if exists "Usuários autenticados podem ler fornecedores"
  on public.fornecedores;
create policy "Setores autorizados podem ler fornecedores"
  on public.fornecedores for select to authenticated
  using (public.can_read_sector('suprimentos'));

drop policy if exists "Usuários autenticados podem ler documentos de orçamento"
  on public.orcamento_documentos;
create policy "Setores autorizados podem ler documentos de orçamento"
  on public.orcamento_documentos for select to authenticated
  using (public.can_read_sector('orcamentos'));
