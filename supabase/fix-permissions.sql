-- Execute no projeto Supabase do FacilERP quando a Data API retornar 403/42501.
-- Este script somente garante privilégios; o RLS continua obrigatório.

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

select pg_notify('pgrst', 'reload schema');
