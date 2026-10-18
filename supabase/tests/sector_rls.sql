begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'rls-supply@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'rls-budget@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'rls-ti@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rls-director@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'rls-inactive@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'rls-nv3@example.test', '', now()),
  ('00000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'rls-temp-password@example.test', '', now());

insert into public.perfis (id, nome, email, setor, nivel, ativo, must_change_password)
values
  ('00000000-0000-4000-8000-000000000001', 'RLS Supply', 'rls-supply@example.test', 'suprimentos', 'NV1', true, false),
  ('00000000-0000-4000-8000-000000000002', 'RLS Budget', 'rls-budget@example.test', 'orcamentos', 'NV1', true, false),
  ('00000000-0000-4000-8000-000000000003', 'RLS TI', 'rls-ti@example.test', 'ti', 'NV1', true, false),
  ('00000000-0000-4000-8000-000000000004', 'RLS Director', 'rls-director@example.test', 'diretoria', 'NV1', true, false),
  ('00000000-0000-4000-8000-000000000005', 'RLS Inactive', 'rls-inactive@example.test', 'suprimentos', 'NV1', false, false),
  ('00000000-0000-4000-8000-000000000006', 'RLS NV3', 'rls-nv3@example.test', 'ti', 'NV3', true, false),
  ('00000000-0000-4000-8000-000000000007', 'RLS Temporary Password', 'rls-temp-password@example.test', 'diretoria', 'NV1', true, true);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

insert into public.centros_custo (id, codigo, nome)
values ('10000000-0000-4000-8000-000000000001', 'RLS-TEST', 'Centro RLS');
insert into public.insumos (id, nome, unidade_medida, categoria)
values ('20000000-0000-4000-8000-000000000001', 'Insumo RLS', 'un', 'Teste');
insert into public.fornecedores (id, razao_social, cnpj)
values ('30000000-0000-4000-8000-000000000001', 'Fornecedor RLS', '12345678901234');
insert into public.compras_historico (
  id, insumo_id, quantidade, valor_unitario, fornecedor, criado_por
) values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 1, 10, 'Fornecedor RLS',
  '00000000-0000-4000-8000-000000000001'
);
insert into public.orcamentos (id, nome_projeto, criado_por, centro_custo_id)
values (
  '50000000-0000-4000-8000-000000000001', 'Orcamento RLS',
  '00000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001'
);
insert into public.orcamento_itens (id, orcamento_id, insumo_id, qtd_prevista, valor_previsto_unitario)
values (
  '60000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 1, 10
);
insert into public.executado_itens (id, orcamento_id, insumo_id, qtd_realizada, valor_realizado_unitario)
values (
  '70000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', 1, 10
);
insert into public.patrimonio_ativos (
  id, nome_item, tipo, numero_serie, data_aquisicao, criado_por
) values (
  '80000000-0000-4000-8000-000000000001', 'Ativo RLS', 'Teste',
  'RLS-TEST-001', current_date, '00000000-0000-4000-8000-000000000003'
);
insert into public.notas_fiscais (
  id, numero, fornecedor, valor_total, data_emissao, centro_custo_id, criado_por
) values (
  '90000000-0000-4000-8000-000000000001', 'RLS-TEST-001', 'Fornecedor RLS',
  10, current_date, '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001'
);
insert into public.auditoria_eventos (id, usuario_id, acao, entidade)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'login', 'rls-test'),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'login', 'rls-test');
insert into public.relatorios_salvos (nome, tipo, criado_por)
values ('Relatorio pessoal RLS', 'compras', '00000000-0000-4000-8000-000000000001');
insert into public.orcamento_documentos (
  id, orcamento_id, nome_arquivo, caminho_storage, tipo_mime, tamanho_bytes, criado_por
) values (
  'b0000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000001',
  'rls-test.pdf',
  'orcamentos/50000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001-rls-test.pdf',
  'application/pdf', 10,
  '00000000-0000-4000-8000-000000000002'
);
insert into public.nota_fiscal_documentos (
  id, nota_fiscal_id, nome_arquivo, caminho_storage, tipo_mime, tamanho_bytes, criado_por
) values (
  'c0000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001',
  'rls-invoice.pdf',
  'notas-fiscais/90000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000001-rls-invoice.pdf',
  'application/pdf',
  10,
  '00000000-0000-4000-8000-000000000001'
);
insert into public.patrimonio_documentos (
  id, patrimonio_ativo_id, nome_arquivo, caminho_storage, tipo_mime, tamanho_bytes, criado_por
) values (
  'd0000000-0000-4000-8000-000000000001',
  '80000000-0000-4000-8000-000000000001',
  'rls-asset.pdf',
  'patrimonio/80000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000003/d0000000-0000-4000-8000-000000000001.pdf',
  'application/pdf',
  10,
  '00000000-0000-4000-8000-000000000003'
);
insert into storage.objects (bucket_id, name, owner, metadata)
values
  (
    'erp-private-documents',
    'orcamentos/50000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/b0000000-0000-4000-8000-000000000001-rls-test.pdf',
    '00000000-0000-4000-8000-000000000002',
    '{"mimetype":"application/pdf","size":10}'
  ),
  (
    'erp-private-documents',
    'notas-fiscais/90000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/c0000000-0000-4000-8000-000000000001-rls-invoice.pdf',
    '00000000-0000-4000-8000-000000000001',
    '{"mimetype":"application/pdf","size":10}'
  ),
  (
    'erp-private-documents',
    'patrimonio/80000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000003/d0000000-0000-4000-8000-000000000001.pdf',
    '00000000-0000-4000-8000-000000000003',
    '{"mimetype":"application/pdf","size":10}'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
do $$
declare
  created_id uuid;
begin
  if not public.is_valid_nfe_access_key('35261012345678000123550010000000011000000010')
    or public.is_valid_nfe_access_key('35261012345678000123550010000000011000000011') then
    raise exception 'invoice access-key check digit validation failed';
  end if;

  insert into public.notas_fiscais (
    numero, serie, chave_acesso, fornecedor, valor_total, data_emissao,
    centro_custo_id, criado_por
  ) values (
    'RLS-KEY-VALID', '1', '35261012345678000123550010000000011000000010',
    'Fornecedor Chave RLS', 10, '2026-10-17',
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  );
  begin
    insert into public.notas_fiscais (
      numero, serie, chave_acesso, fornecedor, valor_total, data_emissao,
      centro_custo_id, criado_por
    ) values (
      'RLS-KEY-INVALID', '1', '35261012345678000123550010000000011000000011',
      'Fornecedor Chave RLS', 10, '2026-10-17',
      '10000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000001'
    );
    raise exception 'invalid invoice access-key check digit was accepted';
  exception when check_violation then
    null;
  end;
  delete from public.notas_fiscais where numero = 'RLS-KEY-VALID';

  if (select count(*) from public.nota_fiscal_documentos) <> 1
    or (select count(*) from storage.objects where bucket_id = 'erp-private-documents') <> 1 then
    raise exception 'suprimentos cannot read linked invoice documents';
  end if;
  if exists (
    select 1 from public.auditoria_eventos
    where entidade = 'nota_fiscal_documentos'
      and (
        dados_novos ? 'nome_arquivo'
        or dados_novos ? 'caminho_storage'
        or dados_anteriores ? 'nome_arquivo'
        or dados_anteriores ? 'caminho_storage'
      )
  ) then
    raise exception 'private document names or storage paths leaked into audit snapshots';
  end if;
  begin
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'erp-private-documents',
      'orcamentos/50000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/denied.pdf',
      auth.uid(),
      '{"mimetype":"application/pdf","size":10}'
    );
    raise exception 'suprimentos unexpectedly uploaded a budget document';
  exception when insufficient_privilege then
    null;
  end;
  begin
    insert into storage.objects (bucket_id, name, owner, metadata)
    values (
      'erp-private-documents',
      'patrimonio/80000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/denied.pdf',
      auth.uid(),
      '{"mimetype":"application/pdf","size":10}'
    );
    raise exception 'suprimentos unexpectedly uploaded a private asset document';
  exception when insufficient_privilege then
    null;
  end;
  insert into storage.objects (bucket_id, name, owner, metadata)
  values (
    'erp-private-documents',
    'notas-fiscais/90000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/allowed.pdf',
    auth.uid(),
    '{"mimetype":"application/pdf","size":10}'
  );

  if (
      select count(*) from public.list_active_profile_assignments()
      where id in (
        '00000000-0000-4000-8000-000000000001',
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
        '00000000-0000-4000-8000-000000000004',
        '00000000-0000-4000-8000-000000000006'
      )
    ) <> 5
    or exists (
      select 1 from public.list_active_profile_assignments()
      where id = '00000000-0000-4000-8000-000000000005'
    ) then
    raise exception 'active profile assignment lookup leaked inactive profile';
  end if;

  insert into public.centros_custo (codigo, nome)
  values ('RLS-SUPPLY-CREATE', 'Criado por Suprimentos')
  returning id into created_id;
  update public.centros_custo set nome = 'Centro atualizado'
  where id = created_id;
  if not found then raise exception 'suprimentos could not update cost center'; end if;
  update public.centros_custo set ativo = false where id = created_id;
  if not found then raise exception 'suprimentos could not archive cost center'; end if;
  update public.centros_custo set ativo = true where id = created_id;
  if not found then raise exception 'suprimentos could not restore cost center'; end if;
  delete from public.centros_custo where id = created_id;
  if not found then raise exception 'suprimentos could not delete cost center'; end if;

  insert into public.insumos (nome, unidade_medida, categoria)
  values ('Insumo CRUD RLS', 'un', 'Teste')
  returning id into created_id;
  update public.insumos set categoria = 'Atualizado'
  where id = created_id;
  if not found then raise exception 'suprimentos could not update supply'; end if;
  update public.insumos set ativo = false where id = created_id;
  if not found then raise exception 'suprimentos could not archive supply'; end if;
  update public.insumos set ativo = true where id = created_id;
  if not found then raise exception 'suprimentos could not restore supply'; end if;
  delete from public.insumos where id = created_id;
  if not found then raise exception 'suprimentos could not delete supply'; end if;

  insert into public.fornecedores (razao_social, cnpj)
  values ('Fornecedor CRUD RLS', '12345678901235')
  returning id into created_id;
  update public.fornecedores set razao_social = 'Fornecedor atualizado'
  where id = created_id;
  if not found then raise exception 'suprimentos could not update supplier'; end if;
  update public.fornecedores set ativo = false where id = created_id;
  if not found then raise exception 'suprimentos could not archive supplier'; end if;
  update public.fornecedores set ativo = true where id = created_id;
  if not found then raise exception 'suprimentos could not restore supplier'; end if;
  delete from public.fornecedores where id = created_id;
  if not found then raise exception 'suprimentos could not delete supplier'; end if;

  insert into public.compras_historico (
    insumo_id, quantidade, valor_unitario, fornecedor, criado_por
  ) values (
    '20000000-0000-4000-8000-000000000001', 1, 2, 'Fornecedor CRUD RLS',
    '00000000-0000-4000-8000-000000000001'
  ) returning id into created_id;
  update public.compras_historico set quantidade = 2 where id = created_id;
  if not found then raise exception 'suprimentos could not update purchase'; end if;
  delete from public.compras_historico where id = created_id;
  if not found then raise exception 'suprimentos could not delete purchase'; end if;

  insert into public.notas_fiscais (
    numero, fornecedor, valor_total, data_emissao, centro_custo_id, criado_por
  ) values (
    'RLS-CRUD-001', 'Fornecedor CRUD RLS', 10, current_date,
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001'
  ) returning id into created_id;
  update public.notas_fiscais set valor_total = 11 where id = created_id;
  if not found then raise exception 'suprimentos could not update invoice'; end if;
  delete from public.notas_fiscais where id = created_id;
  if not found then raise exception 'suprimentos could not delete invoice'; end if;

  insert into public.relatorios_salvos (nome, tipo, criado_por)
  values ('Relatorio CRUD RLS', 'compras', auth.uid())
  returning id into created_id;
  update public.relatorios_salvos set nome = 'Relatorio atualizado'
  where id = created_id;
  if not found then raise exception 'owner could not update saved report'; end if;
  delete from public.relatorios_salvos where id = created_id;
  if not found then raise exception 'owner could not delete saved report'; end if;
end;
$$;

do $$
begin
  if (select count(*) from public.compras_historico) <> 1
    or (select count(*) from public.fornecedores) <> 1
    or (select count(*) from public.notas_fiscais) <> 1
    or (select count(*) from public.insumos) <> 1
    or (select count(*) from public.centros_custo) <> 1 then
    raise exception 'suprimentos read policy regression';
  end if;
  if (select count(*) from public.orcamentos) <> 0
    or (select count(*) from public.patrimonio_ativos) <> 0 then
    raise exception 'suprimentos can read another sector';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}', true);
do $$
declare
  created_id uuid;
  moved_budget_id uuid;
  first_line_id uuid;
begin
  if (select count(*) from public.orcamentos) <> 1
    or (select count(*) from public.orcamento_itens) <> 1
    or (select count(*) from public.executado_itens) <> 1
    or (select count(*) from public.orcamento_documentos) <> 1
    or (select count(*) from public.insumos) <> 1
    or (select count(*) from public.centros_custo) <> 1 then
    raise exception 'orcamentos read policy regression';
  end if;
  if (select count(*) from public.patrimonio_documentos) <> 0 then
    raise exception 'orcamentos can read another sector private documents';
  end if;
  if (select count(*) from public.orcamento_documentos) <> 1
    or (select count(*) from public.nota_fiscal_documentos) <> 0
    or (
      select count(*) from storage.objects
      where bucket_id = 'erp-private-documents'
        and (storage.foldername(name))[1] = 'orcamentos'
    ) <> 1 then
    raise exception 'orcamentos document storage access regression';
  end if;
  insert into storage.objects (bucket_id, name, owner, metadata)
  values (
    'erp-private-documents',
    'orcamentos/50000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000002/allowed.pdf',
    auth.uid(),
    '{"mimetype":"application/pdf","size":10}'
  );
  if (select count(*) from public.fornecedores) <> 0
    or (select count(*) from public.patrimonio_ativos) <> 0 then
    raise exception 'orcamentos can read another sector';
  end if;
  if (select count(*) from public.list_active_profile_assignments()) <> 0 then
    raise exception 'orcamentos can enumerate unrelated profile assignments';
  end if;
  update public.orcamentos set status = 'em_aprovacao'
  where id = '50000000-0000-4000-8000-000000000001';
  if not found then raise exception 'orcamentos could not update budget'; end if;
  insert into public.orcamentos (nome_projeto, criado_por)
  values ('Orcamento CRUD RLS', auth.uid())
  returning id into created_id;

  insert into public.orcamentos (nome_projeto, criado_por)
  values ('Orcamento arredondamento RLS', auth.uid())
  returning id into moved_budget_id;

  insert into public.orcamento_itens (
    orcamento_id, insumo_id, qtd_prevista, valor_previsto_unitario
  ) values (
    created_id, '20000000-0000-4000-8000-000000000001', 0.5, 0.01
  ) returning id into first_line_id;
  insert into public.orcamento_itens (
    orcamento_id, insumo_id, qtd_prevista, valor_previsto_unitario
  ) values (
    created_id, '20000000-0000-4000-8000-000000000001', 0.5, 0.01
  );
  if (select valor_previsto_total from public.orcamentos where id = created_id) <> 0.02 then
    raise exception 'planned budget totals must round each line before summing';
  end if;
  update public.orcamento_itens set qtd_prevista = 1.5 where id = first_line_id;
  if (select valor_previsto_total from public.orcamentos where id = created_id) <> 0.03 then
    raise exception 'planned budget total was not recalculated after item update';
  end if;
  update public.orcamento_itens set orcamento_id = moved_budget_id where id = first_line_id;
  if (select valor_previsto_total from public.orcamentos where id = created_id) <> 0.01
    or (select valor_previsto_total from public.orcamentos where id = moved_budget_id) <> 0.02 then
    raise exception 'planned budget totals were not recalculated when an item moved';
  end if;
  delete from public.orcamento_itens where id = first_line_id;
  if (select valor_previsto_total from public.orcamentos where id = moved_budget_id) <> 0 then
    raise exception 'planned budget total was not recalculated after item deletion';
  end if;
  delete from public.orcamentos where id = moved_budget_id;
  if not found then raise exception 'temporary budget used for rounding was not deleted'; end if;

  insert into public.orcamento_itens (
    orcamento_id, insumo_id, qtd_prevista, valor_previsto_unitario
  ) values (
    created_id, '20000000-0000-4000-8000-000000000001', 1, 10
  );
  insert into public.executado_itens (
    orcamento_id, insumo_id, qtd_realizada, valor_realizado_unitario
  ) values (
    created_id, '20000000-0000-4000-8000-000000000001', 1, 10
  );
  delete from public.orcamentos where id = created_id;
  if not found then raise exception 'orcamentos could not delete budget'; end if;
  if exists (select 1 from public.orcamento_itens where orcamento_id = created_id)
    or exists (select 1 from public.executado_itens where orcamento_id = created_id) then
    raise exception 'budget deletion did not cascade to its lines';
  end if;

  update public.orcamento_itens set qtd_prevista = 2
  where id = '60000000-0000-4000-8000-000000000001';
  if not found then raise exception 'orcamentos could not update planned line'; end if;
  delete from public.orcamento_itens
  where id = '60000000-0000-4000-8000-000000000001';
  if not found then raise exception 'orcamentos could not delete planned line'; end if;
  insert into public.orcamento_itens (orcamento_id, insumo_id, qtd_prevista, valor_previsto_unitario)
  values ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 10)
  returning id into created_id;
  delete from public.orcamento_itens where id = created_id;
  if not found then raise exception 'orcamentos could not create/delete planned line'; end if;

  update public.executado_itens set qtd_realizada = 2
  where id = '70000000-0000-4000-8000-000000000001';
  if not found then raise exception 'orcamentos could not update executed line'; end if;
  delete from public.executado_itens
  where id = '70000000-0000-4000-8000-000000000001';
  if not found then raise exception 'orcamentos could not delete executed line'; end if;
  insert into public.executado_itens (orcamento_id, insumo_id, qtd_realizada, valor_realizado_unitario)
  values ('50000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 10)
  returning id into created_id;
  delete from public.executado_itens where id = created_id;
  if not found then raise exception 'orcamentos could not create/delete executed line'; end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
do $$
declare
  created_id uuid;
begin
  if (select count(*) from public.patrimonio_ativos) <> 1
    or (select count(*) from public.orcamentos) <> 0
    or (select count(*) from public.compras_historico) <> 0
    or (select count(*) from public.insumos) <> 0 then
    raise exception 'TI read policy regression';
  end if;
  if (select count(*) from public.patrimonio_documentos) <> 1
    or (select count(*) from storage.objects where bucket_id = 'erp-private-documents') <> 1 then
    raise exception 'TI can read private documents from other sectors';
  end if;
  begin
    insert into public.patrimonio_documentos (
      patrimonio_ativo_id, nome_arquivo, caminho_storage, tipo_mime, tamanho_bytes, criado_por
    ) values (
      '80000000-0000-4000-8000-000000000001',
      'invalid-owner.pdf',
      'patrimonio/80000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000001/e0000000-0000-4000-8000-000000000001.pdf',
      'application/pdf',
      10,
      '00000000-0000-4000-8000-000000000001'
    );
    raise exception 'TI unexpectedly created metadata for another profile';
  exception when insufficient_privilege then
    null;
  end;
  insert into storage.objects (bucket_id, name, owner, metadata)
  values (
    'erp-private-documents',
    'patrimonio/80000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000003/e0000000-0000-4000-8000-000000000001.pdf',
    auth.uid(),
    '{"mimetype":"application/pdf","size":10}'
  );
  insert into public.patrimonio_documentos (
    id, patrimonio_ativo_id, nome_arquivo, caminho_storage, tipo_mime, tamanho_bytes, criado_por
  ) values (
    'e0000000-0000-4000-8000-000000000001',
    '80000000-0000-4000-8000-000000000001',
    'asset-crud.pdf',
    'patrimonio/80000000-0000-4000-8000-000000000001/00000000-0000-4000-8000-000000000003/e0000000-0000-4000-8000-000000000001.pdf',
    'application/pdf',
    10,
    auth.uid()
  );
  delete from public.patrimonio_documentos
  where id = 'e0000000-0000-4000-8000-000000000001';
  if not found then raise exception 'TI could not delete asset document metadata'; end if;
  insert into public.patrimonio_ativos (
    nome_item, tipo, numero_serie, data_aquisicao, criado_por
  ) values (
    'Ativo CRUD RLS', 'Teste', 'RLS-CRUD-ASSET', current_date, auth.uid()
  ) returning id into created_id;
  update public.patrimonio_ativos set status = 'manutencao'
  where id = created_id;
  if not found then raise exception 'TI could not update asset'; end if;
  delete from public.patrimonio_ativos where id = created_id;
  if not found then raise exception 'TI could not delete asset'; end if;
  begin
    insert into public.centros_custo (codigo, nome)
    values ('RLS-TI-DENIED', 'Não deve ser criado');
    raise exception 'TI unexpectedly wrote to cost centers';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.compras_historico) <> 1
    or (select count(*) from public.orcamentos) <> 1
    or (select count(*) from public.patrimonio_ativos) <> 1
    or (select count(*) from public.auditoria_eventos) < 2 then
    raise exception 'directoria broad read policy regression';
  end if;
  if (select count(*) from public.relatorios_salvos) <> 0 then
    raise exception 'directoria can read another user saved report';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'erp-private-documents') <> 3 then
    raise exception 'directoria cannot read authorized private documents';
  end if;
  begin
    insert into public.orcamentos (id, nome_projeto, criado_por)
    values (
      '50000000-0000-4000-8000-000000000004',
      'Unauthorized director budget',
      '00000000-0000-4000-8000-000000000004'
    );
    raise exception 'directoria unexpectedly wrote to the budgets sector';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.compras_historico) <> 1
    or (select count(*) from public.orcamentos) <> 1
    or (select count(*) from public.patrimonio_ativos) <> 1
    or (select count(*) from public.auditoria_eventos) < 2 then
    raise exception 'NV3 broad read policy regression';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'erp-private-documents') <> 3 then
    raise exception 'NV3 cannot read authorized private documents';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.compras_historico) <> 0
    or (select count(*) from public.centros_custo) <> 0
    or (select count(*) from public.perfis) <> 0
    or (select count(*) from storage.objects where bucket_id = 'erp-private-documents') <> 0 then
    raise exception 'inactive profile retained data access';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000007', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000007","role":"authenticated"}', true);
do $$
begin
  if not public.needs_password_rotation() or public.is_profile_active() then
    raise exception 'temporary-password profile rotation state regression';
  end if;
  if not has_table_privilege('service_role', 'public.perfis', 'SELECT')
    or not has_table_privilege('service_role', 'public.perfis', 'INSERT')
    or not has_table_privilege('service_role', 'public.perfis', 'UPDATE') then
    raise exception 'account-management service role has incorrect profile privileges';
  end if;
  if (select count(*) from public.perfis) <> 0
    or (select count(*) from public.compras_historico) <> 0
    or (select count(*) from storage.objects where bucket_id = 'erp-private-documents') <> 0 then
    raise exception 'temporary-password profile retained operational data access';
  end if;
end;
$$;

rollback;
