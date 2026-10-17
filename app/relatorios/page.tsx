'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';
import { isSafeText, normalizeSearch } from '../../lib/validation';

type ReportType = 'compras' | 'previsto_realizado' | 'estoque' | 'fornecedores' | 'patrimonio';
type ReportDefinition = {
  type: ReportType;
  title: string;
  description: string;
  supportsPeriod: boolean;
  supportsCenter: boolean;
};
type ReportFilters = { period: string; centerId: string | null };
type SavedReport = {
  id: string;
  nome: string;
  tipo: ReportType;
  filtros: ReportFilters;
};
type CostCenter = { id: string; nome: string; codigo: string };
type ReportRow = Record<string, string | number | null>;
type ProfileAssignment = { id: string; nome: string };

const reportDefinitions: ReportDefinition[] = [
  { type: 'compras', title: 'Compras por período', description: 'Compare quantidades, valores, fornecedor e centro de custo.', supportsPeriod: true, supportsCenter: true },
  { type: 'previsto_realizado', title: 'Previsto x realizado', description: 'Compare os totais previstos e executados dos orçamentos.', supportsPeriod: true, supportsCenter: true },
  { type: 'estoque', title: 'Posição de estoque', description: 'Consulte os insumos e seus níveis mínimos cadastrados.', supportsPeriod: false, supportsCenter: false },
  { type: 'fornecedores', title: 'Mapa de fornecedores', description: 'Consulte situação cadastral e contatos dos fornecedores.', supportsPeriod: true, supportsCenter: false },
  { type: 'patrimonio', title: 'Patrimônio por setor', description: 'Consulte ativos, responsáveis, centro e status de manutenção.', supportsPeriod: true, supportsCenter: true },
];

function periodStart(period: string): string | null {
  const today = new Date();
  if (period === 'Este mês') return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  if (period === 'Últimos 90 dias') {
    const start = new Date(today);
    start.setDate(start.getDate() - 90);
    return start.toISOString().slice(0, 10);
  }
  if (period === 'Ano atual') return new Date(today.getFullYear(), 0, 1).toISOString().slice(0, 10);
  return null;
}

function downloadCsv(fileName: string, rows: ReportRow[]) {
  if (rows.length === 0) throw new Error('Não há registros para exportar.');
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [columns.map(escape).join(';'), ...rows.map((row) => columns.map((column) => escape(row[column])).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function parseProfileAssignments(value: unknown): ProfileAssignment[] {
  if (!Array.isArray(value)) throw new Error('The profile assignment lookup returned an invalid result.');
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null
      || !('id' in item) || typeof item.id !== 'string'
      || !('nome' in item) || typeof item.nome !== 'string') {
      throw new Error('The profile assignment lookup returned an invalid row.');
    }
    return { id: item.id, nome: item.nome };
  });
}

export default function RelatoriosPage() {
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [centerId, setCenterId] = useState('');
  const [editing, setEditing] = useState<SavedReport | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const [reportsResult, centersResult] = await Promise.all([
        supabase.from('relatorios_salvos').select('id,nome,tipo,filtros').order('nome'),
        supabase.from('centros_custo').select('id,nome,codigo').eq('ativo', true).order('nome'),
      ]);
      if (reportsResult.error) throw reportsResult.error;
      if (centersResult.error) throw centersResult.error;
      setSavedReports((reportsResult.data ?? []).map((item) => ({
        ...item,
        filtros: {
          period: typeof item.filtros?.period === 'string' ? item.filtros.period : '',
          centerId: typeof item.filtros?.centerId === 'string' ? item.filtros.centerId : null,
        },
      })) as SavedReport[]);
      setCenters(centersResult.data ?? []);
    } catch (caughtError) {
      console.error('Falha ao carregar relatórios salvos:', caughtError);
      setError('Não foi possível carregar os relatórios salvos.');
    }
  }

  useEffect(() => { void loadData(); }, []);

  const visibleReports = useMemo(() => savedReports.filter((report) =>
    `${report.nome} ${reportDefinitions.find((item) => item.type === report.tipo)?.title ?? report.tipo}`
      .toLowerCase().includes(normalizeSearch(search).toLowerCase())
  ), [savedReports, search]);

  async function saveReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const type = String(form.get('type') ?? '') as ReportType;
    const definition = reportDefinitions.find((item) => item.type === type);
    if (!isSafeText(name, 120) || !definition
      || (definition.supportsCenter && centerId && !centers.some((center) => center.id === centerId))) {
      setError('Informe um nome, tipo de relatório e filtros válidos.');
      return;
    }
    const filters: ReportFilters = {
      period: definition.supportsPeriod ? period : '',
      centerId: definition.supportsCenter ? centerId || null : null,
    };
    if (!window.confirm(`Confirmar ${editing ? 'alteração' : 'salvamento'} da consulta "${name}"?`)) return;
    setBusy(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const payload = { nome: name, tipo: type, filtros: filters };
      const result = editing
        ? await supabase.from('relatorios_salvos').update(payload)
          .eq('id', editing.id).select('id').maybeSingle()
        : await supabase.from('relatorios_salvos')
          .insert({ ...payload, criado_por: profile.id }).select('id').single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('The saved report was not persisted.');
      setMessage(`Consulta "${name}" ${editing ? 'alterada' : 'salva'}.`);
      setError('');
      setEditing(null);
      setFormOpen(false);
      await loadData();
    } catch (caughtError) {
      console.error('Falha ao salvar relatório:', caughtError);
      setError('Não foi possível salvar a consulta. Verifique as permissões.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteReport(report: SavedReport) {
    if (!window.confirm(`Excluir a consulta salva "${report.nome}"?`)) return;
    setBusy(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error: deleteError } = await supabase.from('relatorios_salvos')
        .delete().eq('id', report.id).select('id').maybeSingle();
      if (deleteError) throw deleteError;
      if (!data) throw new Error('The saved report was not deleted.');
      setMessage(`Consulta "${report.nome}" excluída.`);
      setError('');
      await loadData();
    } catch (caughtError) {
      console.error('Falha ao excluir relatório salvo:', caughtError);
      setError('Não foi possível excluir a consulta salva.');
    } finally {
      setBusy(false);
    }
  }

  async function runReport(definition: ReportDefinition, filters: ReportFilters) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const start = periodStart(filters.period);
      let rows: ReportRow[];
      if (definition.type === 'compras') {
        let query = supabase.from('compras_historico')
          .select('data_compra,insumo_id,quantidade,valor_unitario,fornecedor,centro_custo_id')
          .order('data_compra', { ascending: false });
        if (start) query = query.gte('data_compra', `${start}T00:00:00`);
        if (filters.centerId) query = query.eq('centro_custo_id', filters.centerId);
        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        const purchases = data ?? [];
        const supplyIds = Array.from(new Set(purchases.map((item) => item.insumo_id)));
        const centerIds = Array.from(new Set(purchases.map((item) => item.centro_custo_id).filter((id): id is string => Boolean(id))));
        const [suppliesResult, centersResult] = await Promise.all([
          supplyIds.length ? supabase.from('insumos').select('id,nome').in('id', supplyIds) : Promise.resolve({ data: [], error: null }),
          centerIds.length ? supabase.from('centros_custo').select('id,nome').in('id', centerIds) : Promise.resolve({ data: [], error: null }),
        ]);
        if (suppliesResult.error) throw suppliesResult.error;
        if (centersResult.error) throw centersResult.error;
        const supplyNames = new Map((suppliesResult.data ?? []).map((item) => [item.id, item.nome]));
        const centerNames = new Map((centersResult.data ?? []).map((item) => [item.id, item.nome]));
        rows = purchases.map((item) => ({
          Data: item.data_compra,
          Insumo: supplyNames.get(item.insumo_id) ?? 'Insumo indisponível',
          Quantidade: item.quantidade,
          'Valor unitário': item.valor_unitario,
          'Valor total': Number(item.quantidade) * Number(item.valor_unitario),
          Fornecedor: item.fornecedor,
          'Centro de custo': item.centro_custo_id ? centerNames.get(item.centro_custo_id) ?? '—' : '—',
        }));
      } else if (definition.type === 'previsto_realizado') {
        let query = supabase.from('orcamentos').select('id,nome_projeto,status,valor_previsto_total,criado_em,centro_custo_id')
          .order('criado_em', { ascending: false });
        if (start) query = query.gte('criado_em', `${start}T00:00:00`);
        if (filters.centerId) query = query.eq('centro_custo_id', filters.centerId);
        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        const budgets = data ?? [];
        const budgetIds = budgets.map((budget) => budget.id);
        const centerIds = Array.from(new Set(budgets.map((budget) => budget.centro_custo_id).filter((id): id is string => Boolean(id))));
        const [executedResult, centersResult] = await Promise.all([
          budgetIds.length
            ? supabase.from('executado_itens').select('orcamento_id,qtd_realizada,valor_realizado_unitario').in('orcamento_id', budgetIds)
            : Promise.resolve({ data: [], error: null }),
          centerIds.length
            ? supabase.from('centros_custo').select('id,nome').in('id', centerIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (executedResult.error) throw executedResult.error;
        if (centersResult.error) throw centersResult.error;
        const centerNames = new Map((centersResult.data ?? []).map((item) => [item.id, item.nome]));
        const totals = new Map<string, number>();
        (executedResult.data ?? []).forEach((item) => totals.set(
          item.orcamento_id,
          (totals.get(item.orcamento_id) ?? 0) + Number(item.qtd_realizada) * Number(item.valor_realizado_unitario),
        ));
        rows = budgets.map((budget) => ({
          Projeto: budget.nome_projeto,
          Status: budget.status,
          'Centro de custo': budget.centro_custo_id ? centerNames.get(budget.centro_custo_id) ?? '—' : '—',
          'Valor previsto': budget.valor_previsto_total,
          'Valor realizado': totals.get(budget.id) ?? 0,
          'Criado em': budget.criado_em,
        }));
      } else if (definition.type === 'estoque') {
        const { data, error: queryError } = await supabase.from('insumos')
          .select('codigo,nome,categoria,unidade_medida,estoque_minimo,ativo').order('nome');
        if (queryError) throw queryError;
        rows = (data ?? []).map((item) => ({
          Código: item.codigo,
          Insumo: item.nome,
          Categoria: item.categoria,
          Unidade: item.unidade_medida,
          'Estoque mínimo': item.estoque_minimo,
          Status: item.ativo ? 'Ativo' : 'Inativo',
        }));
      } else if (definition.type === 'fornecedores') {
        let query = supabase.from('fornecedores')
          .select('razao_social,nome_fantasia,cnpj,email,telefone,ativo,criado_em').order('razao_social');
        if (start) query = query.gte('criado_em', `${start}T00:00:00`);
        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        rows = (data ?? []).map((item) => ({
          'Razão social': item.razao_social,
          'Nome fantasia': item.nome_fantasia,
          CNPJ: item.cnpj,
          'E-mail': item.email,
          Telefone: item.telefone,
          Status: item.ativo ? 'Ativo' : 'Inativo',
          'Criado em': item.criado_em,
        }));
      } else {
        let query = supabase.from('patrimonio_ativos')
          .select('nome_item,tipo,numero_serie,status,data_aquisicao,centro_custo_id,responsavel_perfil_id')
          .order('nome_item');
        if (start) query = query.gte('data_aquisicao', start);
        if (filters.centerId) query = query.eq('centro_custo_id', filters.centerId);
        const { data, error: queryError } = await query;
        if (queryError) throw queryError;
        const assets = data ?? [];
        const profileIds = Array.from(new Set(assets.map((item) => item.responsavel_perfil_id).filter((id): id is string => Boolean(id))));
        const centerIds = Array.from(new Set(assets.map((item) => item.centro_custo_id).filter((id): id is string => Boolean(id))));
        const [profilesResult, centersResult] = await Promise.all([
          profileIds.length
            ? supabase.rpc('list_active_profile_assignments')
            : Promise.resolve({ data: [], error: null }),
          centerIds.length
            ? supabase.from('centros_custo').select('id,nome').in('id', centerIds)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (profilesResult.error) throw profilesResult.error;
        if (centersResult.error) throw centersResult.error;
        const profileNames = new Map(parseProfileAssignments(profilesResult.data).map((item) => [item.id, item.nome]));
        const centerNames = new Map((centersResult.data ?? []).map((item) => [item.id, item.nome]));
        rows = assets.map((item) => ({
          Item: item.nome_item,
          Tipo: item.tipo,
          Série: item.numero_serie,
          Status: item.status,
          Responsável: item.responsavel_perfil_id ? profileNames.get(item.responsavel_perfil_id) ?? item.responsavel_perfil_id : '—',
          'Centro de custo': item.centro_custo_id ? centerNames.get(item.centro_custo_id) ?? '—' : '—',
          'Data de aquisição': item.data_aquisicao,
        }));
      }
      downloadCsv(`facilerp-${definition.type}.csv`, rows);
      setMessage(`Relatório "${definition.title}" exportado com ${rows.length} registro(s).`);
    } catch (caughtError) {
      console.error('Falha ao gerar relatório:', caughtError);
      setError('Não foi possível gerar o relatório. Confira permissões e filtros.');
    } finally {
      setBusy(false);
    }
  }

  async function runSavedReport(report: SavedReport) {
    const definition = reportDefinitions.find((item) => item.type === report.tipo);
    if (!definition) {
      setError('O tipo desta consulta salva não é suportado.');
      return;
    }
    await runReport(definition, report.filtros);
  }

  return <ErpShell eyebrow="Análise gerencial" title="Relatórios">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-bold">Consultas salvas</h2><p className="mt-1 text-sm text-slate-500">Salve filtros, edite, exclua e exporte consultas com dados atuais do banco.</p></div>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" disabled={busy} onClick={() => { setEditing(null); setFormOpen(true); }} type="button">Salvar consulta</button>
      </div>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {formOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={saveReport}>
        <label className="text-xs font-semibold">Nome da consulta<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editing?.nome ?? ''} maxLength={120} name="name" required /></label>
        <label className="text-xs font-semibold">Tipo de relatório<select className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editing?.tipo ?? 'compras'} name="type">{reportDefinitions.map((definition) => <option key={definition.type} value={definition.type}>{definition.title}</option>)}</select></label>
        <label className="text-xs font-semibold">Período<select className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setPeriod(event.target.value)} value={period}><option value="">Todos</option><option>Este mês</option><option>Últimos 90 dias</option><option>Ano atual</option></select></label>
        <label className="text-xs font-semibold">Centro de custo<select className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" onChange={(event) => setCenterId(event.target.value)} value={centerId}><option value="">Todos</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.codigo} - {center.nome}</option>)}</select></label>
        <div className="flex gap-2 sm:col-span-2"><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white" disabled={busy} type="submit">{busy ? 'Salvando...' : editing ? 'Salvar alterações' : 'Salvar consulta'}</button><button className="rounded border border-slate-300 px-4 py-2 text-sm" disabled={busy} onClick={() => { setFormOpen(false); setEditing(null); }} type="button">Cancelar</button></div>
      </form>}
      <div className="mt-4"><SearchFilters onSearchChange={setSearch} placeholder="Buscar consultas salvas" search={search} /></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Consulta</th><th className="pb-3">Tipo</th><th className="pb-3">Filtros</th><th className="pb-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleReports.map((report) => {
        const definition = reportDefinitions.find((item) => item.type === report.tipo);
        const center = centers.find((item) => item.id === report.filtros.centerId);
        return <tr key={report.id}><td className="py-4 font-semibold">{report.nome}</td><td className="py-4">{definition?.title ?? report.tipo}</td><td className="py-4">{[report.filtros.period || 'Todos os períodos', center?.nome].filter(Boolean).join(' · ')}</td><td className="py-4"><button className="mr-3 font-semibold text-blue-700" disabled={busy} onClick={() => void runSavedReport(report)} type="button">{busy ? 'Processando...' : 'Gerar CSV'}</button><button className="mr-3 font-semibold text-blue-700" disabled={busy} onClick={() => { setEditing(report); setPeriod(report.filtros.period); setCenterId(report.filtros.centerId ?? ''); setFormOpen(true); setError(''); }} type="button">Editar</button><button className="font-semibold text-red-700" disabled={busy} onClick={() => void deleteReport(report)} type="button">Excluir</button></td></tr>;
      })}</tbody></table>{visibleReports.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhuma consulta salva.</p>}</div>
    </section>
    <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reportDefinitions.map((definition) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={definition.type}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-700">▥</div><h2 className="mt-4 font-bold">{definition.title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{definition.description}</p>
      <button className="mt-5 text-sm font-bold text-blue-700 hover:underline disabled:opacity-50" disabled={busy} onClick={() => void runReport(definition, { period, centerId: centerId || null })} type="button">{busy ? 'Processando...' : 'Gerar CSV'}</button>
    </article>)}</section>
  </ErpShell>;
}
