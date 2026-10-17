'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { PrivateDocumentPanel } from '../../components/private-document-panel';
import { SearchFilters } from '../../components/search-filters';
import { calculateLineAmount } from '../../lib/budget-calculations';
import { getCurrentProfile } from '../../lib/current-profile';
import {
  createPrivateDocumentPath,
  deletePrivateDocument,
  deletePrivateDocumentBatch,
  hasValidDocumentSignature,
  PRIVATE_DOCUMENT_BUCKET,
  type PrivateDocumentMetadata,
  uploadPrivateDocument,
  validatePrivateDocument,
} from '../../lib/private-documents';
import { isSafeText, isValidIsoDate } from '../../lib/validation';

type BudgetDocument = PrivateDocumentMetadata;

type BudgetLine = {
  id: string;
  insumo_id: string;
  qtd_prevista: number;
  valor_previsto_unitario: number;
  insumos: { nome: string; unidade_medida: string } | { nome: string; unidade_medida: string }[] | null;
};

type ExecutedLine = {
  id: string;
  insumo_id: string;
  qtd_realizada: number;
  valor_realizado_unitario: number;
  data_registro: string;
  insumos: { nome: string; unidade_medida: string } | { nome: string; unidade_medida: string }[] | null;
};

type CostCenter = { id: string; nome: string; ativo: boolean };
type Supply = { id: string; nome: string; unidade_medida: string };
type EditingLine = {
  id: string;
  budgetId: string;
  kind: 'planned' | 'executed';
  supplyId: string;
  quantity: number;
  unitValue: number;
  registeredAt?: string;
};

type Budget = {
  id: string;
  name: string;
  centerId: string | null;
  center: string;
  status: string;
  planned: number;
  realized: number;
  updatedAt: string;
  items: BudgetLine[];
  executedItems: ExecutedLine[];
  documents: BudgetDocument[];
};

export default function OrcamentosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [editingLine, setEditingLine] = useState<EditingLine | null>(null);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  async function loadBudgets() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const [budgetResult, executedResult, plannedResult, centersResult, suppliesResult, documentsResult] = await Promise.all([
        supabase.from('orcamentos').select('id,nome_projeto,status,valor_previsto_total,criado_em,centro_custo_id,centros_custo(nome)').order('criado_em', { ascending: false }),
        supabase.from('executado_itens').select('id,orcamento_id,insumo_id,qtd_realizada,valor_realizado_unitario,data_registro,insumos(nome,unidade_medida)'),
        supabase.from('orcamento_itens').select('id,orcamento_id,insumo_id,qtd_prevista,valor_previsto_unitario,insumos(nome,unidade_medida)'),
        supabase.from('centros_custo').select('id,nome,ativo').order('nome'),
        supabase.from('insumos').select('id,nome,unidade_medida').eq('ativo', true).order('nome'),
        supabase.from('orcamento_documentos').select('id,orcamento_id,nome_arquivo,caminho_storage,tipo_mime,tamanho_bytes'),
      ]);
      if (budgetResult.error) throw budgetResult.error;
      if (executedResult.error) throw executedResult.error;
      if (plannedResult.error) throw plannedResult.error;
      if (centersResult.error) throw centersResult.error;
      if (suppliesResult.error) throw suppliesResult.error;
      if (documentsResult.error) throw documentsResult.error;
      const centers = centersResult.data ?? [];
      setCostCenters(centers.filter((center) => center.ativo));
      setSupplies(suppliesResult.data ?? []);
      const executedByBudget = new Map<string, ExecutedLine[]>();
      (executedResult.data ?? []).forEach((item) => {
        const existing = executedByBudget.get(item.orcamento_id) ?? [];
        existing.push(item as ExecutedLine);
        executedByBudget.set(item.orcamento_id, existing);
      });
      const plannedByBudget = new Map<string, BudgetLine[]>();
      (plannedResult.data ?? []).forEach((item) => {
        const existing = plannedByBudget.get(item.orcamento_id) ?? [];
        existing.push(item as BudgetLine);
        plannedByBudget.set(item.orcamento_id, existing);
      });
      const documentsByBudget = new Map<string, BudgetDocument[]>();
      (documentsResult.data ?? []).forEach((document) => {
        const existing = documentsByBudget.get(document.orcamento_id) ?? [];
        existing.push(document);
        documentsByBudget.set(document.orcamento_id, existing);
      });
      setBudgets((budgetResult.data ?? []).map((budget) => {
        const center = centers.find((item) => item.id === budget.centro_custo_id);
        const executedItems = executedByBudget.get(budget.id) ?? [];
        return {
          id: budget.id,
          name: budget.nome_projeto,
          centerId: budget.centro_custo_id,
          center: center?.nome ?? 'Não informado',
          status: budget.status,
          planned: Number(budget.valor_previsto_total),
          realized: executedItems.reduce(
            (total, item) => total + calculateLineAmount(Number(item.qtd_realizada), Number(item.valor_realizado_unitario)),
            0,
          ),
          updatedAt: new Date(budget.criado_em).toLocaleDateString('pt-BR'),
          items: plannedByBudget.get(budget.id) ?? [],
          executedItems,
          documents: documentsByBudget.get(budget.id) ?? [],
        };
      }));
    } catch (caughtError) { console.error('Falha ao carregar orçamentos:', caughtError); setFormError('Não foi possível carregar os orçamentos.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadBudgets(); }, []);
  const filteredBudgets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return budgets.filter((budget) => {
      const matchesSearch = !normalizedSearch || `${budget.name} ${budget.center}`.toLowerCase().includes(normalizedSearch);
      return matchesSearch && (!statusFilter || budget.status === statusFilter);
    });
  }, [budgets, search, statusFilter]);
  const statusOptions = useMemo(() => Array.from(new Set(budgets.map((budget) => budget.status).filter(Boolean))), [budgets]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const projectName = String(form.get('projectName') ?? '');
    const costCenterId = String(form.get('costCenter') ?? '') || null;
    const status = String(form.get('budgetStatus') ?? 'rascunho');

    if (!isSafeText(projectName, 150)) {
      setFormError('Informe um nome de projeto válido.');
      setSuccessMessage('');
      return;
    }
    if (costCenterId && !costCenters.some((center) => center.id === costCenterId)
      && costCenterId !== editingBudget?.centerId) {
      setFormError('Selecione um centro de custo válido.');
      setSuccessMessage('');
      return;
    }
    if (!['rascunho', 'em_aprovacao', 'aprovado', 'encerrado', 'cancelado'].includes(status)) {
      setFormError('Selecione um status válido.');
      return;
    }
    if (!window.confirm(`Confirmar ${editingBudget ? 'alteração' : 'criação'} do orçamento "${projectName.trim()}"?`)) return;

    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const payload = {
        nome_projeto: projectName.trim(),
        centro_custo_id: costCenterId,
        status,
      };
      const result = editingBudget
        ? await supabase.from('orcamentos').update(payload)
          .eq('id', editingBudget.id).select('id').maybeSingle()
        : await supabase.from('orcamentos').insert({
          ...payload,
          valor_previsto_total: 0,
          criado_por: profile.id,
        }).select('id').single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('The budget was not saved.');
      setFormError(''); setSuccessMessage(`Orçamento "${projectName.trim()}" ${editingBudget ? 'alterado' : 'criado'} com sucesso.`); setIsFormOpen(false); setEditingBudget(null); formElement.reset(); await loadBudgets();
    } catch (caughtError) { console.error('Falha ao criar orçamento:', caughtError); setFormError('Não foi possível salvar o orçamento.'); }
    finally { setSaving(false); }
  }

  function openBudgetForm(budget?: Budget) {
    setEditingBudget(budget ?? null);
    setIsFormOpen(true);
    setFormError('');
    setSuccessMessage('');
  }

  async function removeBudget(budget: Budget) {
    if (!window.confirm(`Excluir o orçamento "${budget.name}" e todos os seus itens? Esta ação será auditada e não poderá ser desfeita.`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      if (budget.documents.length > 0) {
        await deletePrivateDocumentBatch(
          budget.documents,
          (document) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).download(document.caminho_storage),
          (document) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([document.caminho_storage]),
          async () => {
            const { data, error } = await supabase.from('orcamentos')
              .delete().eq('id', budget.id).select('id').maybeSingle();
            return { error, deleted: Boolean(data) };
          },
          (document, backup) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(
            document.caminho_storage,
            backup,
            { contentType: document.tipo_mime, upsert: false },
          ),
        );
      } else {
        const { data, error } = await supabase.from('orcamentos')
          .delete().eq('id', budget.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('The budget was not deleted.');
      }
      if (expandedBudget === budget.id) setExpandedBudget(null);
      setSuccessMessage(`Orçamento "${budget.name}" excluído.`);
      setFormError('');
      await loadBudgets();
    } catch (caughtError) {
      console.error('Falha ao excluir orçamento:', caughtError);
      setFormError('Não foi possível excluir o orçamento. Verifique suas permissões.');
    } finally {
      setSaving(false);
    }
  }

  async function handleLineSubmit(event: FormEvent<HTMLFormElement>, budget: Budget, kind: 'planned' | 'executed') {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const existingEdit = editingLine?.budgetId === budget.id && editingLine.kind === kind
      ? editingLine
      : null;
    const supplyId = String(form.get('supplyId') ?? '');
    const quantity = Number(form.get('quantity'));
    const unitValue = Number(form.get('unitValue'));
    const registeredAt = String(form.get('registeredAt') ?? '');
    if (!supplies.some((supply) => supply.id === supplyId) ||
      !Number.isFinite(quantity) || quantity <= 0 || quantity > 99_999_999_999.999 ||
      !Number.isFinite(unitValue) || unitValue < 0 || unitValue > 999_999_999_999.99 ||
      (kind === 'executed' && !isValidIsoDate(registeredAt))) {
      setFormError('Informe um insumo, quantidade e valor unitário válidos.');
      return;
    }
    const operation = existingEdit ? 'alteração' : 'lançamento';
    if (!window.confirm(`Confirmar ${operation} ${kind === 'planned' ? 'previsto' : 'realizado'} para "${budget.name}"?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      if (kind === 'planned') {
        if (existingEdit) {
          const { data, error } = await supabase.from('orcamento_itens').update({
            insumo_id: supplyId,
            qtd_prevista: quantity,
            valor_previsto_unitario: unitValue,
          }).eq('id', existingEdit.id).eq('orcamento_id', budget.id).select('id').maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('The planned budget item was not updated.');
        } else {
          const { error } = await supabase.from('orcamento_itens').insert({
            orcamento_id: budget.id,
            insumo_id: supplyId,
            qtd_prevista: quantity,
            valor_previsto_unitario: unitValue,
          });
          if (error) throw error;
        }
      } else if (existingEdit) {
        const { data, error } = await supabase.from('executado_itens').update({
            insumo_id: supplyId,
            qtd_realizada: quantity,
            valor_realizado_unitario: unitValue,
            data_registro: `${registeredAt}T12:00:00.000Z`,
        }).eq('id', existingEdit.id).eq('orcamento_id', budget.id).select('id').maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('The executed budget item was not updated.');
      } else {
        const { error } = await supabase.from('executado_itens').insert({
            orcamento_id: budget.id,
            insumo_id: supplyId,
            qtd_realizada: quantity,
            valor_realizado_unitario: unitValue,
            data_registro: `${registeredAt}T12:00:00.000Z`,
          });
        if (error) throw error;
      }
      setEditingLine(null);
      formElement.reset();
      setFormError('');
      setSuccessMessage(`Item ${kind === 'planned' ? 'previsto' : 'realizado'} ${existingEdit ? 'alterado' : 'registrado'}.`);
      await loadBudgets();
    } catch (caughtError) {
      console.error('Falha ao registrar item de orçamento:', caughtError);
      setFormError('Não foi possível registrar o item do orçamento.');
    } finally { setSaving(false); }
  }

  async function removeLine(budget: Budget, lineId: string, kind: 'planned' | 'executed') {
    if (!window.confirm('Confirmar exclusão deste item?')) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const table = kind === 'planned' ? 'orcamento_itens' : 'executado_itens';
      const { data, error } = await supabase.from(table)
        .delete()
        .eq('id', lineId)
        .eq('orcamento_id', budget.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The budget item was not deleted.');
      if (editingLine?.id === lineId) setEditingLine(null);
      setFormError('');
      setSuccessMessage('Item excluído.');
      await loadBudgets();
    } catch (caughtError) {
      console.error('Falha ao excluir item de orçamento:', caughtError);
      setFormError('Não foi possível excluir o item do orçamento.');
    } finally { setSaving(false); }
  }

  async function downloadBudgetDocument(document: BudgetDocument) {
    setSaving(true);
    try {
    const { supabase, profile } = await getCurrentProfile();
    if (!profile) { window.location.replace('/login'); return; }
    const { data, error } = await supabase.storage.from(PRIVATE_DOCUMENT_BUCKET)
      .download(document.caminho_storage);
    if (error) throw error;
    if (!data) throw new Error('The private document could not be downloaded.');
    const objectUrl = URL.createObjectURL(data);
    const anchor = window.document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = document.nome_arquivo;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } finally {
      setSaving(false);
    }
  }

  async function uploadBudgetDocument(budget: Budget, file: File): Promise<boolean> {
    const details = validatePrivateDocument(file);
    if (!await hasValidDocumentSignature(file, details.contentType)) {
      throw new Error('The file content does not match its declared document type.');
    }
    if (!window.confirm(`Enviar "${details.fileName}" para o orçamento "${budget.name}"?`)) return false;
    setSaving(true);
    try {
    const { supabase, profile } = await getCurrentProfile();
    if (!profile) { window.location.replace('/login'); return false; }
    const id = crypto.randomUUID();
    const storagePath = createPrivateDocumentPath(
      'orcamentos', budget.id, profile.id, id, details.fileName,
    );
    const metadata = {
      id,
      orcamento_id: budget.id,
      nome_arquivo: details.fileName,
      caminho_storage: storagePath,
      tipo_mime: details.contentType,
      tamanho_bytes: details.size,
      criado_por: profile.id,
    };
    await uploadPrivateDocument(
      () => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(storagePath, file, {
        contentType: details.contentType,
        upsert: false,
      }),
      async () => await supabase.from('orcamento_documentos').insert(metadata),
      () => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([storagePath]),
    );
    setSuccessMessage('Documento do orçamento enviado com acesso privado.');
    await loadBudgets();
    return true;
    } finally {
      setSaving(false);
    }
  }

  async function removeBudgetDocument(document: BudgetDocument) {
    if (!window.confirm(`Excluir permanentemente o documento "${document.nome_arquivo}"?`)) return;
    setSaving(true);
    try {
    const { supabase, profile } = await getCurrentProfile();
    if (!profile) { window.location.replace('/login'); return; }
    await deletePrivateDocument(
      () => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).download(document.caminho_storage),
      () => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([document.caminho_storage]),
      async () => {
        const { data, error } = await supabase.from('orcamento_documentos')
          .delete().eq('id', document.id).select('id').maybeSingle();
        return { error, deleted: Boolean(data) };
      },
      (backup) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(
        document.caminho_storage,
        backup,
        { contentType: document.tipo_mime, upsert: false },
      ),
    );
    setSuccessMessage('Documento do orçamento excluído.');
    await loadBudgets();
    } finally {
      setSaving(false);
    }
  }

  function supplyName(item: BudgetLine | ExecutedLine): string {
    const supply = Array.isArray(item.insumos) ? item.insumos[0] : item.insumos;
    return supply?.nome ?? 'Insumo indisponível';
  }

  function supplyUnit(item: BudgetLine | ExecutedLine): string {
    const supply = Array.isArray(item.insumos) ? item.insumos[0] : item.insumos;
    return supply?.unidade_medida ?? '';
  }

  return (
    <ErpShell eyebrow="Módulo de planejamento" title="Orçamentos">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">Lista de orçamentos</h2>
            <p className="mt-1 text-sm text-slate-500">Acompanhe previsto x realizado sem ocupar espaço com cartões individuais.</p>
          </div>
          {isFormOpen ? <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => { setIsFormOpen(false); setEditingBudget(null); }} type="button">Fechar formulário</button> : <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => openBudgetForm()} type="button">Novo orçamento</button>}
        </div>
        <SearchFilters
          filters={[{ label: 'Status', value: statusFilter, options: statusOptions, onChange: setStatusFilter }]}
          onSearchChange={setSearch}
          placeholder="Buscar por projeto ou centro de custo"
          search={search}
        />
        {successMessage && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{successMessage}</p>}
        <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-[760px] w-full text-left text-sm">
            <caption className="sr-only">Orçamentos e acompanhamento de execução</caption>
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold" scope="col">Projeto</th>
                <th className="px-4 py-3 font-semibold" scope="col">Centro de custo</th>
                <th className="px-4 py-3 font-semibold" scope="col">Status</th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">Previsto</th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">Realizado</th>
                <th className="w-48 px-4 py-3 font-semibold" scope="col">Execução</th>
                <th className="px-4 py-3 text-right font-semibold" scope="col">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBudgets.map((budget) => {
                const percentage = budget.planned > 0 ? Math.round((budget.realized / budget.planned) * 1000) / 10 : 0;
                const statusLabels: Record<string, string> = {
                  rascunho: 'Rascunho',
                  em_aprovacao: 'Em aprovação',
                  aprovado: 'Aprovado',
                  encerrado: 'Encerrado',
                  cancelado: 'Cancelado',
                };
                const statusClass = budget.status === 'em_aprovacao' ? 'bg-amber-50 text-amber-700' : budget.status === 'encerrado' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700';
                return (
                  <Fragment key={budget.id}>
                  <tr className="hover:bg-slate-50">
                    <th className="px-4 py-4 font-semibold text-slate-900" scope="row">{budget.name}</th>
                    <td className="px-4 py-4 text-slate-600">{budget.center}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{statusLabels[budget.status] ?? budget.status}</span></td>
                    <td className="px-4 py-4 text-right font-medium text-slate-700">R$ {budget.planned.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-700">R$ {budget.realized.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 min-w-20 flex-1 rounded-full bg-slate-100" aria-label={`${percentage}% executado`} role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={Math.min(percentage, 100)}>
                          <div className={`h-full rounded-full ${budget.status === 'Atenção' ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-slate-600">{percentage.toString().replace('.', ',')}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                      <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-blue-700" disabled={saving} onClick={() => openBudgetForm(budget)} type="button">Editar</button>
                      <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700" disabled={saving} onClick={() => void removeBudget(budget)} type="button">Excluir</button>
                      <button
                        aria-expanded={expandedBudget === budget.id}
                        className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        onClick={() => setExpandedBudget(expandedBudget === budget.id ? null : budget.id)}
                        type="button"
                      >
                        {expandedBudget === budget.id ? 'Ocultar detalhes' : 'Ver detalhes'}
                      </button>
                      </div>
                    </td>
                  </tr>
                  {expandedBudget === budget.id && (
                    <tr className="bg-blue-50/50">
                      <td className="px-4 pb-4 pt-1" colSpan={7}>
                        <div className="rounded-lg border border-blue-100 bg-white p-4 text-sm">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Centro de custo</span><span className="font-medium text-slate-800">{budget.center}</span></div>
                            <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Criado em</span><span className="font-medium text-slate-800">{budget.updatedAt}</span></div>
                            <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Itens previstos</span><span className="font-medium text-slate-800">{budget.items.length}</span></div>
                          </div>
                          <div className="mt-5 grid gap-5 border-t border-slate-100 pt-4 lg:grid-cols-2">
                            {([
                              { kind: 'planned', title: 'Itens previstos', lines: budget.items },
                              { kind: 'executed', title: 'Itens realizados', lines: budget.executedItems },
                            ] as const).map(({ kind, title, lines }) => (
                              <section className="rounded-lg border border-slate-200 p-4" key={kind}>
                                <h3 className="font-semibold text-slate-800">{title}</h3>
                                <div className="mt-3 space-y-2">
                                  {lines.map((line) => {
                                    const quantity = 'qtd_prevista' in line
                                      ? line.qtd_prevista
                                      : line.qtd_realizada;
                                    const unitValue = 'valor_previsto_unitario' in line
                                      ? line.valor_previsto_unitario
                                      : line.valor_realizado_unitario;
                                    const amount = calculateLineAmount(Number(quantity), Number(unitValue));
                                    return (
                                      <div className="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2" key={line.id}>
                                        <div className="min-w-0">
                                          <p className="truncate font-medium text-slate-700">{supplyName(line)}</p>
                                          <p className="text-xs text-slate-500">{quantity} {supplyUnit(line)} × R$ {Number(unitValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <span className="whitespace-nowrap font-semibold">R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                          <button aria-label={`Editar ${supplyName(line)}`} className="rounded border border-slate-300 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50" disabled={saving} onClick={() => setEditingLine({
                                            id: line.id,
                                            budgetId: budget.id,
                                            kind,
                                            supplyId: line.insumo_id,
                                            quantity: Number(quantity),
                                            unitValue: Number(unitValue),
                                            ...(kind === 'executed' && 'data_registro' in line ? {
                                              registeredAt: line.data_registro.slice(0, 10),
                                            } : {}),
                                          })} type="button">Editar</button>
                                          <button aria-label={`Excluir ${supplyName(line)}`} className="rounded border border-slate-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50" disabled={saving} onClick={() => void removeLine(budget, line.id, kind)} type="button">Excluir</button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {lines.length === 0 && <p className="text-xs text-slate-500">Nenhum item registrado.</p>}
                                </div>
                                {supplies.length > 0 ? (
                                  <form className="mt-4 grid gap-2 sm:grid-cols-2" key={`${kind}-${budget.id}-${editingLine?.budgetId === budget.id && editingLine.kind === kind ? editingLine.id : 'new'}`} onSubmit={(event) => void handleLineSubmit(event, budget, kind)}>
                                    <label className="sr-only" htmlFor={`${kind}-supply-${budget.id}`}>Insumo</label>
                                    <select className="rounded border border-slate-300 px-2 py-2 text-sm sm:col-span-2" defaultValue={editingLine?.budgetId === budget.id && editingLine.kind === kind ? editingLine.supplyId : ''} id={`${kind}-supply-${budget.id}`} name="supplyId" required>
                                      <option disabled value="">Selecione o insumo</option>
                                      {supplies.map((supply) => <option key={supply.id} value={supply.id}>{supply.nome} ({supply.unidade_medida})</option>)}
                                    </select>
                                    <label className="sr-only" htmlFor={`${kind}-quantity-${budget.id}`}>Quantidade</label>
                                    <input className="rounded border border-slate-300 px-2 py-2 text-sm" defaultValue={editingLine?.budgetId === budget.id && editingLine.kind === kind ? editingLine.quantity : ''} id={`${kind}-quantity-${budget.id}`} max="99999999999.999" min="0.001" name="quantity" placeholder="Quantidade" required step="0.001" type="number" />
                                    <label className="sr-only" htmlFor={`${kind}-unit-value-${budget.id}`}>Valor unitário</label>
                                    <input className="rounded border border-slate-300 px-2 py-2 text-sm" defaultValue={editingLine?.budgetId === budget.id && editingLine.kind === kind ? editingLine.unitValue : ''} id={`${kind}-unit-value-${budget.id}`} max="999999999999.99" min="0" name="unitValue" placeholder="Valor unitário" required step="0.01" type="number" />
                                    {kind === 'executed' && <label className="text-xs font-semibold sm:col-span-2">Data de realização<input className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm" defaultValue={editingLine?.budgetId === budget.id && editingLine.kind === kind ? editingLine.registeredAt : new Date().toISOString().slice(0, 10)} id={`${kind}-registered-at-${budget.id}`} name="registeredAt" required type="date" /></label>}
                                    <div className="flex gap-2 sm:col-span-2">
                                      <button className="flex-1 rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={saving} type="submit">{editingLine?.budgetId === budget.id && editingLine.kind === kind ? 'Salvar alteração' : 'Registrar item'}</button>
                                      {editingLine?.budgetId === budget.id && editingLine.kind === kind && <button className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold" onClick={() => setEditingLine(null)} type="button">Cancelar</button>}
                                    </div>
                                  </form>
                                ) : <p className="mt-3 text-xs text-slate-500">Cadastre insumos ativos para registrar itens.</p>}
                              </section>
                            ))}
                          </div>
                          <PrivateDocumentPanel
                            documents={budget.documents}
                            disabled={saving}
                            label={`Documentos do orçamento ${budget.name}`}
                            onDelete={removeBudgetDocument}
                            onDownload={downloadBudgetDocument}
                            onUpload={(file) => uploadBudgetDocument(budget, file)}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {loading && <p className="px-4 py-8 text-center text-sm text-slate-500">Carregando orçamentos...</p>}
          {!loading && filteredBudgets.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhum orçamento cadastrado.</p>}
        </div>
        {isFormOpen && (
          <form key={editingBudget?.id ?? 'new'} className="mt-5 grid gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold" htmlFor="project-name">Nome do projeto</label>
              <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" defaultValue={editingBudget?.name ?? ''} id="project-name" maxLength={150} name="projectName" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="cost-center">Centro de custo</label>
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" defaultValue={editingBudget?.centerId ?? ''} id="cost-center" name="costCenter">
                <option value="">Sem centro de custo</option>
                {costCenters.map((center) => <option key={center.id} value={center.id}>{center.nome}</option>)}
                {editingBudget?.centerId && !costCenters.some((center) => center.id === editingBudget.centerId) && (
                  <option value={editingBudget.centerId}>{editingBudget.center} (inativo, atual)</option>
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="budget-status">Status</label>
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" defaultValue={editingBudget?.status ?? 'rascunho'} id="budget-status" name="budgetStatus">
                <option value="rascunho">Rascunho</option>
                <option value="em_aprovacao">Em aprovação</option>
                <option value="aprovado">Aprovado</option>
                <option value="encerrado">Encerrado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <p className="text-xs text-slate-600">O total previsto será calculado automaticamente a partir dos itens previstos registrados.</p>
            {formError && <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">{formError}</p>}
            <div className="flex gap-2 sm:col-span-2"><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50" disabled={saving} type="submit">{saving ? 'Salvando...' : editingBudget ? 'Salvar alterações' : 'Criar orçamento'}</button><button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" disabled={saving} onClick={() => { setIsFormOpen(false); setEditingBudget(null); }} type="button">Cancelar</button></div>
          </form>
        )}
      </section>
    </ErpShell>
  );
}
