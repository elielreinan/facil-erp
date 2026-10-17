create extension if not exists "pgcrypto";

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  email text not null unique check (length(trim(email)) > 0),
  setor text not null check (setor in ('suprimentos', 'orcamentos', 'ti', 'diretoria', 'admin')),
  nivel varchar(3) not null default 'NV1' check (nivel in ('NV1', 'NV2', 'NV3')),
  ativo boolean not null default true
);

create table public.gfac_user_links (
  managed_user_id uuid primary key,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  criado_em timestamptz not null default timezone('utc', now())
);

create table public.gfac_m2m_nonces (
  jti uuid primary key,
  expires_at timestamptz not null,
  criado_em timestamptz not null default timezone('utc', now())
);

create table public.centros_custo (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(20) not null unique,
  nome text not null check (length(trim(nome)) > 0),
  responsavel_perfil_id uuid references public.perfis (id) on delete set null,
  ativo boolean not null default true
);

create table public.insumos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  unidade_medida varchar(30) not null check (length(trim(unidade_medida)) > 0),
  categoria text not null check (length(trim(categoria)) > 0),
  codigo varchar(40) unique,
  estoque_minimo numeric(14, 3) not null default 0 check (estoque_minimo >= 0),
  ativo boolean not null default true
);

create table public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null check (length(trim(razao_social)) > 0),
  nome_fantasia text,
  cnpj varchar(14) not null unique check (cnpj ~ '^[0-9]{14}$'),
  email text,
  telefone varchar(30),
  ativo boolean not null default true,
  criado_em timestamptz not null default timezone('utc', now())
);

create table public.compras_historico (
  id uuid primary key default gen_random_uuid(),
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  quantidade numeric(14, 3) not null check (quantidade > 0),
  valor_unitario numeric(14, 2) not null check (valor_unitario >= 0),
  fornecedor text not null check (length(trim(fornecedor)) > 0),
  data_compra timestamptz not null default timezone('utc', now()),
  centro_custo_id uuid references public.centros_custo (id) on delete restrict,
  criado_por uuid not null references public.perfis (id) on delete restrict
);

create table public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  nome_projeto text not null check (length(trim(nome_projeto)) > 0),
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_aprovacao', 'aprovado', 'encerrado', 'cancelado')),
  criado_em timestamptz not null default timezone('utc', now()),
  centro_custo_id uuid references public.centros_custo (id) on delete restrict,
  criado_por uuid not null references public.perfis (id) on delete restrict,
  valor_previsto_total numeric(14, 2) not null default 0 check (valor_previsto_total >= 0)
);

create table public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  qtd_prevista numeric(14, 3) not null check (qtd_prevista > 0),
  valor_previsto_unitario numeric(14, 2) not null check (valor_previsto_unitario >= 0)
);

create table public.executado_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  insumo_id uuid not null references public.insumos (id) on delete restrict,
  qtd_realizada numeric(14, 3) not null check (qtd_realizada > 0),
  valor_realizado_unitario numeric(14, 2) not null check (valor_realizado_unitario >= 0),
  data_registro timestamptz not null default timezone('utc', now())
);

create table public.patrimonio_ativos (
  id uuid primary key default gen_random_uuid(),
  nome_item text not null check (length(trim(nome_item)) > 0),
  tipo text not null check (length(trim(tipo)) > 0),
  numero_serie text not null unique check (length(trim(numero_serie)) > 0),
  status text not null default 'disponivel'
    check (status in ('disponivel', 'alocado', 'manutencao')),
  responsavel_perfil_id uuid references public.perfis (id) on delete set null,
  data_aquisicao date not null,
  centro_custo_id uuid references public.centros_custo (id) on delete restrict,
  criado_por uuid not null references public.perfis (id) on delete restrict
);

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

revoke all on function public.is_valid_nfe_access_key(text)
  from public, anon;
grant execute on function public.is_valid_nfe_access_key(text)
  to authenticated, service_role;

create table public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  numero varchar(30) not null,
  serie varchar(10),
  chave_acesso varchar(44) unique check (chave_acesso is null or public.is_valid_nfe_access_key(chave_acesso)),
  fornecedor text not null check (length(trim(fornecedor)) > 0),
  valor_total numeric(14, 2) not null check (valor_total >= 0),
  data_emissao date not null,
  arquivo_url text,
  centro_custo_id uuid not null references public.centros_custo (id) on delete restrict,
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now()),
  unique (numero, serie, fornecedor)
);

create unique index notas_fiscais_identity_normalized_idx
  on public.notas_fiscais (
    lower(trim(numero)),
    lower(trim(coalesce(serie, ''))),
    lower(trim(fornecedor))
  );

create table public.auditoria_eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis (id) on delete restrict,
  acao varchar(20) not null check (acao in ('criou', 'alterou', 'excluiu', 'aprovou', 'rejeitou', 'login')),
  entidade varchar(80) not null,
  entidade_id uuid,
  centro_custo_id uuid references public.centros_custo (id) on delete set null,
  dados_anteriores jsonb,
  dados_novos jsonb,
  criado_em timestamptz not null default timezone('utc', now())
);

create table public.relatorios_salvos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  tipo varchar(40) not null check (tipo in ('compras', 'previsto_realizado', 'estoque', 'fornecedores', 'patrimonio')),
  filtros jsonb not null default '{}'::jsonb,
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now())
);

create table public.orcamento_documentos (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos (id) on delete cascade,
  nome_arquivo text not null check (length(trim(nome_arquivo)) > 0),
  caminho_storage text not null unique,
  tipo_mime varchar(120) not null,
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 10485760),
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now())
);

create table public.nota_fiscal_documentos (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references public.notas_fiscais (id) on delete cascade,
  nome_arquivo text not null check (length(trim(nome_arquivo)) > 0),
  caminho_storage text not null unique,
  tipo_mime varchar(120) not null check (tipo_mime in ('application/pdf', 'application/xml', 'text/xml')),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 10485760),
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now())
);

create table public.patrimonio_documentos (
  id uuid primary key default gen_random_uuid(),
  patrimonio_ativo_id uuid not null references public.patrimonio_ativos (id) on delete cascade,
  nome_arquivo text not null check (length(trim(nome_arquivo)) > 0),
  caminho_storage text not null unique check (
    caminho_storage ~ '^patrimonio/[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|xml)$'
  ),
  tipo_mime varchar(120) not null check (tipo_mime in ('application/pdf', 'application/xml', 'text/xml')),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 10485760),
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now())
);

create index nota_fiscal_documentos_nota_id_idx
  on public.nota_fiscal_documentos (nota_fiscal_id);
create index patrimonio_documentos_ativo_id_idx
  on public.patrimonio_documentos (patrimonio_ativo_id);

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

create trigger orcamento_itens_sync_previsto_total
after insert or update or delete on public.orcamento_itens
for each row execute function public.sync_orcamento_previsto_total();

create index compras_historico_insumo_id_idx on public.compras_historico (insumo_id);
create index compras_historico_data_compra_idx on public.compras_historico (data_compra);
create index orcamento_itens_orcamento_id_idx on public.orcamento_itens (orcamento_id);
create index orcamento_itens_insumo_id_idx on public.orcamento_itens (insumo_id);
create index executado_itens_orcamento_id_idx on public.executado_itens (orcamento_id);
create index executado_itens_insumo_id_idx on public.executado_itens (insumo_id);
create index patrimonio_ativos_responsavel_perfil_id_idx
  on public.patrimonio_ativos (responsavel_perfil_id);
create index notas_fiscais_centro_custo_id_idx on public.notas_fiscais (centro_custo_id);
create index auditoria_eventos_usuario_id_idx on public.auditoria_eventos (usuario_id);
create index auditoria_eventos_criado_em_idx on public.auditoria_eventos (criado_em);
create index fornecedores_ativo_idx on public.fornecedores (ativo);
create index relatorios_salvos_criado_por_idx on public.relatorios_salvos (criado_por);

alter table public.perfis enable row level security;
alter table public.insumos enable row level security;
alter table public.compras_historico enable row level security;
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;
alter table public.executado_itens enable row level security;
alter table public.patrimonio_ativos enable row level security;
alter table public.centros_custo enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.auditoria_eventos enable row level security;
alter table public.fornecedores enable row level security;
alter table public.relatorios_salvos enable row level security;
alter table public.orcamento_documentos enable row level security;
alter table public.nota_fiscal_documentos enable row level security;
alter table public.patrimonio_documentos enable row level security;

revoke all on all tables in schema public from anon;
revoke references, trigger, truncate, maintain
  on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke references, trigger, truncate, maintain on tables from anon, authenticated;

grant usage on schema public to authenticated;
revoke all on function public.sync_orcamento_previsto_total()
  from public, anon, authenticated;
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
  public.orcamento_documentos,
  public.nota_fiscal_documentos,
  public.patrimonio_documentos
to authenticated;

create or replace function public.current_profile_sector()
returns text language sql stable security definer set search_path = pg_catalog, public
as $$ select setor from public.perfis where id = auth.uid() and ativo; $$;

create or replace function public.current_profile_level()
returns varchar language sql stable security definer set search_path = pg_catalog, public
as $$ select nivel from public.perfis where id = auth.uid() and ativo; $$;

create or replace function public.is_profile_active()
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$ select exists (select 1 from public.perfis where id = auth.uid() and ativo); $$;

create or replace function public.can_manage(required_sector text)
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid()
      and ativo
      and (nivel = 'NV3' or setor = 'admin' or setor = required_sector)
  );
$$;

create or replace function public.can_read_sector(required_sector text)
returns boolean language sql stable security definer set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid()
      and ativo
      and (nivel = 'NV3' or setor in ('admin', 'diretoria', required_sector))
  );
$$;

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

revoke all on function public.can_read_sector(text) from public, anon;
grant execute on function public.can_read_sector(text) to authenticated, service_role;

create policy "Usuários autenticados podem ler o próprio perfil"
  on public.perfis for select to authenticated using (id = auth.uid());

create policy "Setores autorizados podem ler insumos"
  on public.insumos for select to authenticated
  using (public.can_read_sector('suprimentos') or public.can_read_sector('orcamentos'));

create policy "Setores autorizados podem ler histórico de compras"
  on public.compras_historico for select to authenticated
  using (public.can_read_sector('suprimentos'));

create policy "Setores autorizados podem ler orçamentos"
  on public.orcamentos for select to authenticated
  using (public.can_read_sector('orcamentos'));

create policy "Setores autorizados podem ler itens de orçamento"
  on public.orcamento_itens for select to authenticated
  using (public.can_read_sector('orcamentos'));

create policy "Setores autorizados podem ler itens executados"
  on public.executado_itens for select to authenticated
  using (public.can_read_sector('orcamentos'));

create policy "Setores autorizados podem ler ativos patrimoniais"
  on public.patrimonio_ativos for select to authenticated
  using (public.can_read_sector('ti'));

create policy "Usuários autenticados podem ler centros de custo"
  on public.centros_custo for select to authenticated using (true);

create policy "Suprimentos gerenciam centros de custo"
  on public.centros_custo for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos'));

create policy "Setores autorizados podem ler notas fiscais"
  on public.notas_fiscais for select to authenticated
  using (public.can_read_sector('suprimentos'));

create policy "Usuários autenticados podem ler a própria auditoria"
  on public.auditoria_eventos for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.can_read_sector('diretoria')
  );

create policy "Setores autorizados podem ler fornecedores"
  on public.fornecedores for select to authenticated
  using (public.can_read_sector('suprimentos'));

create policy "Usuários autenticados podem ler relatórios salvos"
  on public.relatorios_salvos for select to authenticated
  using (criado_por = auth.uid());

create policy "Suprimentos gerenciam insumos"
  on public.insumos for all to authenticated
  using (public.can_manage('suprimentos')) with check (public.can_manage('suprimentos'));

create policy "Suprimentos gerenciam fornecedores"
  on public.fornecedores for all to authenticated
  using (public.can_manage('suprimentos')) with check (public.can_manage('suprimentos'));

create policy "Suprimentos gerenciam compras"
  on public.compras_historico for all to authenticated
  using (public.can_manage('suprimentos')) with check (public.can_manage('suprimentos') and criado_por = auth.uid());

create policy "Orçamentos gerenciam orçamentos"
  on public.orcamentos for all to authenticated
  using (public.can_manage('orcamentos')) with check (public.can_manage('orcamentos') and criado_por = auth.uid());

create policy "Orçamentos gerenciam itens previstos"
  on public.orcamento_itens for all to authenticated
  using (public.can_manage('orcamentos')) with check (public.can_manage('orcamentos'));

create policy "Orçamentos gerenciam itens executados"
  on public.executado_itens for all to authenticated
  using (public.can_manage('orcamentos')) with check (public.can_manage('orcamentos'));

create policy "Suprimentos gerenciam notas fiscais"
  on public.notas_fiscais for all to authenticated
  using (public.can_manage('suprimentos')) with check (public.can_manage('suprimentos') and criado_por = auth.uid());

create policy "TI gerencia ativos"
  on public.patrimonio_ativos for all to authenticated
  using (public.can_manage('ti')) with check (public.can_manage('ti') and criado_por = auth.uid());

create policy "Usuários gerenciam próprios relatórios"
  on public.relatorios_salvos for insert to authenticated
  with check (criado_por = auth.uid());

create policy "Usuários alteram próprios relatórios"
  on public.relatorios_salvos for update to authenticated
  using (criado_por = auth.uid()) with check (criado_por = auth.uid());

create policy "Usuários excluem próprios relatórios"
  on public.relatorios_salvos for delete to authenticated
  using (criado_por = auth.uid());

create policy "Setores autorizados podem ler documentos de orçamento"
  on public.orcamento_documentos for select to authenticated
  using (public.can_read_sector('orcamentos'));

create policy "Orçamentos gerenciam documentos de orçamento"
  on public.orcamento_documentos for all to authenticated
  using (public.can_manage('orcamentos'))
  with check (public.can_manage('orcamentos') and criado_por = auth.uid());

create policy "Setores autorizados podem ler documentos fiscais"
  on public.nota_fiscal_documentos for select to authenticated
  using (public.can_read_sector('suprimentos'));

create policy "Suprimentos gerenciam documentos fiscais"
  on public.nota_fiscal_documentos for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos') and criado_por = auth.uid());

create policy "Setores autorizados podem ler documentos patrimoniais"
  on public.patrimonio_documentos for select to authenticated
  using (public.can_read_sector('ti'));

create policy "TI gerencia documentos patrimoniais"
  on public.patrimonio_documentos for all to authenticated
  using (public.can_manage('ti'))
  with check (
    public.can_manage('ti')
    and criado_por = auth.uid()
    and exists (
      select 1 from public.patrimonio_ativos as asset
      where asset.id = patrimonio_ativo_id
    )
  );

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
    'orcamento_documentos',
    'nota_fiscal_documentos',
    'patrimonio_documentos'
  ]
  loop
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.is_profile_active()) with check (public.is_profile_active())',
      'Require active profile',
      relation_name
    );
  end loop;
end;
$$;

alter table public.gfac_user_links enable row level security;
alter table public.gfac_m2m_nonces enable row level security;
revoke all on public.gfac_user_links, public.gfac_m2m_nonces
  from public, anon, authenticated;
grant all on public.gfac_user_links, public.gfac_m2m_nonces to service_role;
revoke all on function public.is_profile_active() from public, anon;
grant execute on function public.is_profile_active() to authenticated, service_role;

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

create or replace function public.audit_private_document_change()
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
begin
  if actor_id is null then
    raise exception 'Authenticated user is required for audited changes.'
      using errcode = '28000';
  end if;
  if tg_op <> 'INSERT' then
    old_data := to_jsonb(old) - array['nome_arquivo', 'caminho_storage', 'criado_por'];
  end if;
  if tg_op <> 'DELETE' then
    new_data := to_jsonb(new) - array['nome_arquivo', 'caminho_storage', 'criado_por'];
  end if;
  record_id := coalesce((new_data ->> 'id')::uuid, (old_data ->> 'id')::uuid);
  insert into public.auditoria_eventos (
    usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos
  ) values (
    actor_id,
    case tg_op when 'INSERT' then 'criou' when 'UPDATE' then 'alterou' else 'excluiu' end,
    tg_table_name,
    record_id,
    old_data,
    new_data
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.audit_private_document_change()
  from public, anon, authenticated;

create trigger audit_centros_custo_change
after insert or update or delete on public.centros_custo
for each row execute function public.audit_operational_change();
create trigger audit_insumos_change
after insert or update or delete on public.insumos
for each row execute function public.audit_operational_change();
create trigger audit_fornecedores_change
after insert or update or delete on public.fornecedores
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
for each row execute function public.audit_private_document_change();
create trigger audit_nota_fiscal_documentos_change
after insert or update or delete on public.nota_fiscal_documentos
for each row execute function public.audit_private_document_change();
create trigger audit_patrimonio_documentos_change
after insert or update or delete on public.patrimonio_documentos
for each row execute function public.audit_private_document_change();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'erp-private-documents',
  'erp-private-documents',
  false,
  10485760,
  array['application/pdf', 'application/xml', 'text/xml']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Authorized sectors read linked private documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'erp-private-documents'
    and (
      (
        (storage.foldername(name))[1] = 'orcamentos'
        and public.can_read_sector('orcamentos')
        and exists (
          select 1 from public.orcamento_documentos as document
          where document.caminho_storage = storage.objects.name
        )
      )
      or (
        (storage.foldername(name))[1] = 'notas-fiscais'
        and public.can_read_sector('suprimentos')
        and exists (
          select 1 from public.nota_fiscal_documentos as document
          where document.caminho_storage = storage.objects.name
        )
      )
      or (
        (storage.foldername(name))[1] = 'patrimonio'
        and public.can_read_sector('ti')
        and exists (
          select 1 from public.patrimonio_documentos as document
          where document.caminho_storage = storage.objects.name
        )
      )
    )
  );

create policy "Authorized sectors upload private documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'erp-private-documents'
    and (storage.foldername(name))[3] = auth.uid()::text
    and (
      (
        (storage.foldername(name))[1] = 'orcamentos'
        and public.can_manage('orcamentos')
        and (
          (
            (storage.foldername(name))[3] = auth.uid()::text
            and exists (
              select 1 from public.orcamentos as budget
              where budget.id::text = (storage.foldername(name))[2]
            )
          )
          or exists (
            select 1 from public.orcamento_documentos as document
            where document.caminho_storage = storage.objects.name
          )
        )
      )
      or (
        (storage.foldername(name))[1] = 'notas-fiscais'
        and public.can_manage('suprimentos')
        and (
          (
            (storage.foldername(name))[3] = auth.uid()::text
            and exists (
              select 1 from public.notas_fiscais as invoice
              where invoice.id::text = (storage.foldername(name))[2]
            )
          )
          or exists (
            select 1 from public.nota_fiscal_documentos as document
            where document.caminho_storage = storage.objects.name
          )
        )
      )
      or (
        (storage.foldername(name))[1] = 'patrimonio'
        and public.can_manage('ti')
        and exists (
          select 1 from public.patrimonio_ativos as asset
          where asset.id::text = (storage.foldername(name))[2]
        )
      )
    )
  );

create policy "Authorized sectors delete linked private documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'erp-private-documents'
    and (
      (
        (storage.foldername(name))[1] = 'orcamentos'
        and public.can_manage('orcamentos')
        and (
          (storage.foldername(name))[3] = auth.uid()::text
          or exists (
            select 1 from public.orcamento_documentos as document
            where document.caminho_storage = storage.objects.name
          )
        )
      )
      or (
        (storage.foldername(name))[1] = 'notas-fiscais'
        and public.can_manage('suprimentos')
        and (
          (storage.foldername(name))[3] = auth.uid()::text
          or exists (
            select 1 from public.nota_fiscal_documentos as document
            where document.caminho_storage = storage.objects.name
          )
        )
      )
      or (
        (storage.foldername(name))[1] = 'patrimonio'
        and public.can_manage('ti')
        and (
          (storage.foldername(name))[3] = auth.uid()::text
          or exists (
            select 1 from public.patrimonio_documentos as document
            where document.caminho_storage = storage.objects.name
          )
        )
      )
    )
  );
