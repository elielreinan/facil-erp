create table if not exists public.nota_fiscal_documentos (
  id uuid primary key default gen_random_uuid(),
  nota_fiscal_id uuid not null references public.notas_fiscais (id) on delete cascade,
  nome_arquivo text not null check (length(trim(nome_arquivo)) > 0),
  caminho_storage text not null unique,
  tipo_mime varchar(120) not null check (tipo_mime in ('application/pdf', 'application/xml', 'text/xml')),
  tamanho_bytes bigint not null check (tamanho_bytes > 0 and tamanho_bytes <= 10485760),
  criado_por uuid not null references public.perfis (id) on delete restrict,
  criado_em timestamptz not null default timezone('utc', now())
);

create index if not exists nota_fiscal_documentos_nota_id_idx
  on public.nota_fiscal_documentos (nota_fiscal_id);

do $$
begin
  if exists (
    select 1
    from public.notas_fiscais
    group by lower(trim(numero)), lower(trim(coalesce(serie, ''))), lower(trim(fornecedor))
    having count(*) > 1
  ) then
    raise exception 'Duplicate invoice identities must be resolved before enabling normalized duplicate protection.';
  end if;
end;
$$;

create unique index if not exists notas_fiscais_identity_normalized_idx
  on public.notas_fiscais (
    lower(trim(numero)),
    lower(trim(coalesce(serie, ''))),
    lower(trim(fornecedor))
  );

alter table public.nota_fiscal_documentos enable row level security;
revoke all on public.nota_fiscal_documentos from public, anon;
grant select, insert, update, delete on public.nota_fiscal_documentos to authenticated;

drop policy if exists "Setores autorizados podem ler documentos fiscais"
  on public.nota_fiscal_documentos;
create policy "Setores autorizados podem ler documentos fiscais"
  on public.nota_fiscal_documentos for select to authenticated
  using (public.can_read_sector('suprimentos'));

drop policy if exists "Suprimentos gerenciam documentos fiscais"
  on public.nota_fiscal_documentos;
create policy "Suprimentos gerenciam documentos fiscais"
  on public.nota_fiscal_documentos for all to authenticated
  using (public.can_manage('suprimentos'))
  with check (public.can_manage('suprimentos') and criado_por = auth.uid());

drop policy if exists "Require active profile" on public.nota_fiscal_documentos;
create policy "Require active profile"
  on public.nota_fiscal_documentos as restrictive for all to authenticated
  using (public.is_profile_active())
  with check (public.is_profile_active());

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
          select 1
          from public.orcamento_documentos as document
          where document.caminho_storage = storage.objects.name
        )
      )
      or (
        (storage.foldername(name))[1] = 'notas-fiscais'
        and public.can_read_sector('suprimentos')
        and exists (
          select 1
          from public.nota_fiscal_documentos as document
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
    )
  );

drop trigger if exists audit_nota_fiscal_documentos_change
  on public.nota_fiscal_documentos;
drop trigger if exists audit_orcamento_documentos_change
  on public.orcamento_documentos;

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

create trigger audit_orcamento_documentos_change
after insert or update or delete on public.orcamento_documentos
for each row execute function public.audit_private_document_change();

create trigger audit_nota_fiscal_documentos_change
after insert or update or delete on public.nota_fiscal_documentos
for each row execute function public.audit_private_document_change();
