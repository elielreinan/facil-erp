'use client';

import { useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';

export default function RelatoriosPage() {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [message, setMessage] = useState('');
  const reportTypes = [['Compras por período', 'Compare valores por fornecedor, produto e centro de custo.'], ['Previsto x realizado', 'Identifique desvios de quantidade e valor nos orçamentos.'], ['Posição de estoque', 'Veja itens abaixo do estoque mínimo e consumo histórico.'], ['Mapa de fornecedores', 'Analise volume comprado e recorrência por fornecedor.'], ['Patrimônio por setor', 'Consulte ativos, responsáveis e status de manutenção.']].filter(([name, description]) => `${name} ${description}`.toLowerCase().includes(search.toLowerCase()));
  async function generateReport(name: string) {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const table = name === 'Compras por período' ? 'compras_historico' : name === 'Previsto x realizado' ? 'orcamentos' : name === 'Posição de estoque' ? 'insumos' : name === 'Mapa de fornecedores' ? 'fornecedores' : 'patrimonio_ativos';
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
      if (error) throw error;
      setMessage(`Relatório "${name}" consultado com dados reais: ${count ?? 0} registro(s)${period ? ` no filtro ${period.toLowerCase()}` : ''}.`);
    } catch (caughtError) {
      console.error('Falha ao gerar relatório:', caughtError);
      setMessage('Não foi possível consultar os dados do relatório.');
    }
  }
  function exportReportCatalog() {
    const rows = [['Relatório', 'Descrição', 'Período selecionado'], ...reportTypes.map(([name, description]) => [name, description, period || 'Todos'])];
    const csv = rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(';')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = 'facilerp-catalogo-relatorios.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage('Catálogo de relatórios exportado localmente.');
  }
  return <ErpShell eyebrow="Análise gerencial" title="Relatórios">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><SearchFilters onSearchChange={setSearch} placeholder="Nome ou finalidade do relatório" search={search} filters={[{ label: 'Período', value: period, options: ['Este mês', 'Últimos 90 dias', 'Ano atual'], onChange: setPeriod }]} /><button className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={exportReportCatalog} type="button">Exportar catálogo</button></div>
    {message && <p aria-live="polite" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
    <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reportTypes.map(([name, description]) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={name}><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-700">▥</div><h2 className="mt-4 font-bold">{name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><button className="mt-5 text-sm font-bold text-blue-700 hover:underline" onClick={() => void generateReport(name)} type="button">Consultar dados</button></article>)}</section>
  </ErpShell>;
}
