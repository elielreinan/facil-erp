'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';
import { isSafeText } from '../../lib/validation';

type BudgetDocument = {
  name: string;
  type: string;
  size: string;
};

type Budget = {
  id: string;
  name: string;
  center: string;
  status: string;
  planned: number;
  realized: number;
  manager: string;
  updatedAt: string;
  items: number;
  documents: BudgetDocument[];
};

export default function OrcamentosPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedBudget, setExpandedBudget] = useState<string | null>(null);
  const [attachedDocuments, setAttachedDocuments] = useState<Record<string, BudgetDocument[]>>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  async function loadBudgets() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error } = await supabase.from('orcamentos').select('id,nome_projeto,status,valor_previsto_total,criado_em').order('criado_em', { ascending: false });
      if (error) throw error;
      setBudgets((data ?? []).map((budget) => ({ id: budget.id, name: budget.nome_projeto, center: 'Não informado', status: budget.status, planned: budget.valor_previsto_total, realized: 0, manager: 'Não informado', updatedAt: new Date(budget.criado_em).toLocaleDateString('pt-BR'), items: 0, documents: [] })));
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
  }, [search, statusFilter]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const projectName = String(form.get('projectName') ?? '');
    const costCenter = String(form.get('costCenter') ?? '');
    const plannedValue = Number(form.get('plannedValue'));

    if (!isSafeText(projectName, 150) || !isSafeText(costCenter, 100) || !Number.isFinite(plannedValue) || plannedValue <= 0) {
      setFormError('Informe um projeto, centro de custo e valor previsto válidos.');
      setSuccessMessage('');
      return;
    }
    if (!window.confirm(`Confirmar criação do orçamento "${projectName.trim()}"?`)) return;

    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { error } = await supabase.from('orcamentos').insert({ nome_projeto: projectName.trim(), valor_previsto_total: plannedValue, criado_por: profile.id });
      if (error) throw error;
      setFormError(''); setSuccessMessage(`Orçamento "${projectName.trim()}" criado com sucesso.`); setIsFormOpen(false); event.currentTarget.reset(); await loadBudgets();
    } catch (caughtError) { console.error('Falha ao criar orçamento:', caughtError); setFormError('Não foi possível salvar o orçamento.'); }
  }

  function handleDocumentChange(event: FormEvent<HTMLInputElement>, budgetName: string) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    const allowedExtensions = ['.csv', '.doc', '.docx', '.pdf', '.xls', '.xlsx', '.xml'];
    const extension = `.${file.name.split('.').pop()?.toLowerCase()}`;
    if (!allowedExtensions.includes(extension) || file.size > 10 * 1024 * 1024) {
      setSuccessMessage('Documento não anexado. Use PDF, planilha, DOC, XML ou CSV de até 10 MB.');
      input.value = '';
      return;
    }
    if (!window.confirm(`Confirmar anexo do documento "${file.name}" ao orçamento "${budgetName}"?`)) {
      input.value = '';
      return;
    }
    const documentData = { name: file.name, type: extension === '.pdf' ? 'PDF' : 'Documento', size: `${Math.ceil(file.size / 1024)} KB` };
    setAttachedDocuments((current) => ({ ...current, [budgetName]: [...(current[budgetName] ?? []), documentData] }));
    setSuccessMessage(`Documento "${file.name}" validado. O upload persistente depende do Storage privado.`);
    input.value = '';
  }

  return (
    <ErpShell eyebrow="Módulo de planejamento" title="Orçamentos">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">Lista de orçamentos</h2>
            <p className="mt-1 text-sm text-slate-500">Acompanhe previsto x realizado sem ocupar espaço com cartões individuais.</p>
          </div>
          {isFormOpen ? <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => setIsFormOpen(false)} type="button">Fechar formulário</button> : <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={() => { setIsFormOpen(true); setSuccessMessage(''); }} type="button">Novo orçamento</button>}
        </div>
        <SearchFilters
          filters={[{ label: 'Status', value: statusFilter, options: [], onChange: setStatusFilter }]}
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
                const percentage = Math.round((budget.realized / budget.planned) * 1000) / 10;
                const statusClass = budget.status === 'Atenção' ? 'bg-amber-50 text-amber-700' : budget.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700';
                return (
                  <Fragment key={budget.name}>
                  <tr className="hover:bg-slate-50">
                    <th className="px-4 py-4 font-semibold text-slate-900" scope="row">{budget.name}</th>
                    <td className="px-4 py-4 text-slate-600">{budget.center}</td>
                    <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass}`}>{budget.status}</span></td>
                    <td className="px-4 py-4 text-right font-medium text-slate-700">R$ {budget.planned.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-4 text-right font-medium text-slate-700">R$ {budget.realized.toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-2 min-w-20 flex-1 rounded-full bg-slate-100" aria-label={`${percentage}% executado`} role="progressbar" aria-valuemax={100} aria-valuemin={0} aria-valuenow={percentage}>
                          <div className={`h-full rounded-full ${budget.status === 'Atenção' ? 'bg-amber-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-slate-600">{percentage.toString().replace('.', ',')}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        aria-expanded={expandedBudget === budget.name}
                        className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300"
                        onClick={() => setExpandedBudget(expandedBudget === budget.name ? null : budget.name)}
                        type="button"
                      >
                        {expandedBudget === budget.name ? 'Ocultar detalhes' : 'Ver detalhes'}
                      </button>
                    </td>
                  </tr>
                  {expandedBudget === budget.name && (
                    <tr className="bg-blue-50/50">
                      <td className="px-4 pb-4 pt-1" colSpan={7}>
                        <div className="rounded-lg border border-blue-100 bg-white p-4 text-sm">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Responsável</span><span className="font-medium text-slate-800">{budget.manager}</span></div>
                            <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Última atualização</span><span className="font-medium text-slate-800">{budget.updatedAt}</span></div>
                            <div><span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Itens do orçamento</span><span className="font-medium text-slate-800">{budget.items} insumos</span></div>
                          </div>
                          <div className="mt-5 border-t border-slate-100 pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <h3 className="font-semibold text-slate-800">Documentos anexados</h3>
                                <p className="mt-1 text-xs text-slate-500">Planilhas, PDF, DOC, XML e CSV de até 10 MB.</p>
                              </div>
                              <label className="cursor-pointer rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                                Anexar documento
                                <input accept=".csv,.doc,.docx,.pdf,.xls,.xlsx,.xml" className="sr-only" onChange={(event) => handleDocumentChange(event, budget.name)} type="file" />
                              </label>
                            </div>
                            <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
                              {[...budget.documents, ...(attachedDocuments[budget.name] ?? [])].length > 0 ? [...budget.documents, ...(attachedDocuments[budget.name] ?? [])].map((document) => (
                                <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3" key={`${budget.name}-${document.name}`}>
                                  <div><p className="font-medium text-slate-700">{document.name}</p><p className="text-xs text-slate-500">{document.type} · {document.size}</p></div>
                                  <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setSuccessMessage(`Visualização demonstrativa de "${document.name}".`)} type="button">Visualizar</button>
                                </div>
                              )) : <p className="px-3 py-4 text-xs text-slate-500">Nenhum documento anexado a este orçamento.</p>}
                            </div>
                          </div>
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
          <form className="mt-5 grid gap-4 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold" htmlFor="project-name">Nome do projeto</label>
              <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" id="project-name" maxLength={150} name="projectName" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="cost-center">Centro de custo</label>
              <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" defaultValue="" id="cost-center" name="costCenter" required>
                <option disabled value="">Selecione</option>
                <option>Obras - Torre Norte</option>
                <option>Manutenção</option>
                <option>TI - Equipamentos</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="planned-value">Valor previsto</label>
              <input className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" id="planned-value" min="0.01" name="plannedValue" required step="0.01" type="number" />
            </div>
            {formError && <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">{formError}</p>}
            <div className="sm:col-span-2"><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800" type="submit">Salvar orçamento</button></div>
          </form>
        )}
      </section>
    </ErpShell>
  );
}
