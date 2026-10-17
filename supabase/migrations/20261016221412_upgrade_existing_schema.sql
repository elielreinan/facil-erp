create or replace function public.current_profile_sector()
returns text
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select setor from public.perfis where id = auth.uid();
$$;

create or replace function public.current_profile_level()
returns varchar
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select nivel from public.perfis where id = auth.uid();
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
      and (nivel = 'NV3' or setor = 'admin' or setor = required_sector)
  );
$$;

alter table public.orcamentos
  add column if not exists valor_previsto_total numeric(14, 2) not null default 0
  check (valor_previsto_total >= 0);

update public.orcamentos as orcamento
set valor_previsto_total = coalesce(
  (
    select sum(item.qtd_prevista * item.valor_previsto_unitario)
    from public.orcamento_itens as item
    where item.orcamento_id = orcamento.id
  ),
  0
);

create table if not exists public.orcamento_documentos (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  nome_arquivo text not null check (length(trim(nome_arquivo)) > 0),
  caminho_storage text not null unique,
  tipo_mime varchar(120) not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 10485760),
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now())
);

create index if not exists orcamento_documentos_orcamento_id_idx
  on public.orcamento_documentos (orcamento_id);
create index if not exists orcamento_documentos_criado_por_idx
  on public.orcamento_documentos (criado_por);

alter table public.orcamento_documentos enable row level security;

revoke all on all tables in schema public from anon;
revoke references, trigger, truncate, maintain
  on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke references, trigger, truncate, maintain on tables from anon, authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.perfis,
  public.centros_custo,
  public.insumos,
  public.fornecedores,
  public.compras_historico,
  public.orcamentos,
  public.orcamento_itens,
  public.executado_itens,
  public.patrimonio_ativos,
  public.notas_fiscais,
  public.auditoria_eventos,
  public.relatorios_salvos,
  public.orcamento_documentos
to authenticated;

drop policy if exists "Usuários autenticados podem ler perfis" on public.perfis;
drop policy if exists "Usuários autenticados podem ler o próprio perfil" on public.perfis;
create policy "Usuários autenticados podem ler o próprio perfil"
  on public.perfis for select to authenticated
  using (id = auth.uid());

drop policy if exists "Suprimentos gerenciam insumos" on public.insumos;
create policy "Suprimentos gerenciam insumos"
  on public.insumos for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos'));

drop policy if exists "Suprimentos gerenciam fornecedores" on public.fornecedores;
create policy "Suprimentos gerenciam fornecedores"
  on public.fornecedores for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos'));

drop policy if exists "Suprimentos gerenciam compras" on public.compras_historico;
create policy "Suprimentos gerenciam compras"
  on public.compras_historico for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos') and criado_por = auth.uid());

drop policy if exists "Orçamentos gerenciam orçamentos" on public.orcamentos;
create policy "Orçamentos gerenciam orçamentos"
  on public.orcamentos for all to authenticated
  using (public.can_manage('orcamentos'))
  with check (public.can_manage('orcamentos') and criado_por = auth.uid());

drop policy if exists "Orçamentos gerenciam itens previstos" on public.orcamento_itens;
create policy "Orçamentos gerenciam itens previstos"
  on public.orcamento_itens for all to authenticated
  using (public.can_manage('orcamentos'))
  with check (public.can_manage('orcamentos'));

drop policy if exists "Orçamentos gerenciam itens executados" on public.executado_itens;
create policy "Orçamentos gerenciam itens executados"
  on public.executado_itens for all to authenticated
  using (public.can_manage('orcamentos'))
  with check (public.can_manage('orcamentos'));

drop policy if exists "Suprimentos gerenciam notas fiscais" on public.notas_fiscais;
create policy "Suprimentos gerenciam notas fiscais"
  on public.notas_fiscais for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos') and criado_por = auth.uid());

drop policy if exists "TI gerencia ativos" on public.patrimonio_ativos;
create policy "TI gerencia ativos"
  on public.patrimonio_ativos for all to authenticated
  using (public.can_manage('ti'))
  with check (public.can_manage('ti') and criado_por = auth.uid());

drop policy if exists "Usuários gerenciam próprios relatórios" on public.relatorios_salvos;
create policy "Usuários gerenciam próprios relatórios"
  on public.relatorios_salvos for insert to authenticated
  with check (criado_por = auth.uid());

drop policy if exists "Usuários alteram próprios relatórios" on public.relatorios_salvos;
create policy "Usuários alteram próprios relatórios"
  on public.relatorios_salvos for update to authenticated
  using (criado_por = auth.uid())
  with check (criado_por = auth.uid());

drop policy if exists "Usuários excluem próprios relatórios" on public.relatorios_salvos;
create policy "Usuários excluem próprios relatórios"
  on public.relatorios_salvos for delete to authenticated
  using (criado_por = auth.uid());

drop policy if exists "Usuários autenticados podem ler documentos de orçamento"
  on public.orcamento_documentos;
create policy "Usuários autenticados podem ler documentos de orçamento"
  on public.orcamento_documentos for select to authenticated
  using (true);

drop policy if exists "Orçamentos gerenciam documentos de orçamento"
  on public.orcamento_documentos;
create policy "Orçamentos gerenciam documentos de orçamento"
  on public.orcamento_documentos for all to authenticated
  using (public.can_manage('orcamentos'))
  with check (public.can_manage('orcamentos') and criado_por = auth.uid());
