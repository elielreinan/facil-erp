create extension if not exists "pgcrypto";

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  email text not null unique check (length(trim(email)) > 0),
  setor text not null check (setor in ('suprimentos', 'orcamentos', 'ti', 'diretoria', 'admin')),
  nivel varchar(3) not null default 'NV1' check (nivel in ('NV1', 'NV2', 'NV3'))
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
  criado_por uuid not null references public.perfis (id) on delete restrict
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

create table public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  numero varchar(30) not null,
  serie varchar(10),
  chave_acesso varchar(44) unique check (chave_acesso is null or chave_acesso ~ '^[0-9]{44}$'),
  fornecedor text not null check (length(trim(fornecedor)) > 0),
  valor_total numeric(14, 2) not null check (valor_total >= 0),
  data_emissao date not null,
  arquivo_url text,
  centro_custo_id uuid not null references public.centros_custo (id) on delete restrict,
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now()),
  unique (numero, serie, fornecedor)
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

create policy "Usuários autenticados podem ler perfis"
  on public.perfis for select to authenticated using (true);

create policy "Usuários autenticados podem ler insumos"
  on public.insumos for select to authenticated using (true);

create policy "Usuários autenticados podem ler histórico de compras"
  on public.compras_historico for select to authenticated using (true);

create policy "Usuários autenticados podem ler orçamentos"
  on public.orcamentos for select to authenticated using (true);

create policy "Usuários autenticados podem ler itens de orçamento"
  on public.orcamento_itens for select to authenticated using (true);

create policy "Usuários autenticados podem ler itens executados"
  on public.executado_itens for select to authenticated using (true);

create policy "Usuários autenticados podem ler ativos patrimoniais"
  on public.patrimonio_ativos for select to authenticated using (true);

create policy "Usuários autenticados podem ler centros de custo"
  on public.centros_custo for select to authenticated using (true);

create policy "Usuários autenticados podem ler notas fiscais"
  on public.notas_fiscais for select to authenticated using (true);

create policy "Usuários autenticados podem ler a própria auditoria"
  on public.auditoria_eventos for select to authenticated
  using (usuario_id = auth.uid());

create policy "Usuários autenticados podem ler fornecedores"
  on public.fornecedores for select to authenticated using (true);

create policy "Usuários autenticados podem ler relatórios salvos"
  on public.relatorios_salvos for select to authenticated
  using (criado_por = auth.uid());

create policy "Usuários autenticados podem gerenciar insumos"
  on public.insumos for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar fornecedores"
  on public.fornecedores for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar compras"
  on public.compras_historico for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar orçamentos"
  on public.orcamentos for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar itens de orçamento"
  on public.orcamento_itens for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar itens executados"
  on public.executado_itens for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar notas fiscais"
  on public.notas_fiscais for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar ativos"
  on public.patrimonio_ativos for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem gerenciar relatórios"
  on public.relatorios_salvos for all to authenticated using (true) with check (true);

create policy "Usuários autenticados podem ler documentos de orçamento"
  on public.orcamento_documentos for select to authenticated using (true);

create policy "Usuários autenticados podem gerenciar documentos de orçamento"
  on public.orcamento_documentos for all to authenticated using (true) with check (true);
