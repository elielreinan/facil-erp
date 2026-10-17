create table if not exists public.patrimonio_documentos (
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

create index if not exists patrimonio_documentos_ativo_id_idx
  on public.patrimonio_documentos (patrimonio_ativo_id);

alter table public.patrimonio_documentos enable row level security;
revoke all on public.patrimonio_documentos from public, anon;
grant select, insert, update, delete on public.patrimonio_documentos to authenticated;

drop policy if exists "Setores autorizados podem ler documentos patrimoniais"
  on public.patrimonio_documentos;
create policy "Setores autorizados podem ler documentos patrimoniais"
  on public.patrimonio_documentos for select to authenticated
  using (public.can_read_sector('ti'));

drop policy if exists "TI gerencia documentos patrimoniais"
  on public.patrimonio_documentos;
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

drop policy if exists "Require active profile" on public.patrimonio_documentos;
create policy "Require active profile"
  on public.patrimonio_documentos as restrictive for all to authenticated
  using (public.is_profile_active())
  with check (public.is_profile_active());

drop policy if exists "Authorized sectors read linked private documents"
  on storage.objects;
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

drop policy if exists "Authorized sectors upload private documents"
  on storage.objects;
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
          exists (
            select 1 from public.orcamentos as budget
            where budget.id::text = (storage.foldername(name))[2]
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
          exists (
            select 1 from public.notas_fiscais as invoice
            where invoice.id::text = (storage.foldername(name))[2]
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

drop policy if exists "Authorized sectors delete linked private documents"
  on storage.objects;
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

drop trigger if exists audit_patrimonio_documentos_change
  on public.patrimonio_documentos;
create trigger audit_patrimonio_documentos_change
after insert or update or delete on public.patrimonio_documentos
for each row execute function public.audit_private_document_change();
