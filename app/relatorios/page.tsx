'use client';

import { useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';

export default function RelatoriosPage() {
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('');
  const [message, setMessage] = useState('');
  const reportTypes = [['Compras por período', 'Compare valores por fornecedor, produto e centro de custo.'], ['Previsto x realizado', 'Identifique desvios de quantidade e valor nos orçamentos.'], ['Posição de estoque', 'Veja itens abaixo do estoque mínimo e consumo histórico.'], ['Mapa de fornecedores', 'Analise volume comprado e recorrência por fornecedor.'], ['Patrimônio por setor', 'Consulte ativos, responsáveis e status de manutenção.']].filter(([name, description]) => `${name} ${description}`.toLowerCase().includes(search.toLowerCase()));
  return <ErpShell eyebrow="Análise gerencial" title="Relatórios">
    <SearchFilters onSearchChange={setSearch} placeholder="Nome ou finalidade do relatório" search={search} filters={[{ label: 'Período', value: period, options: ['Este mês', 'Últimos 90 dias', 'Ano atual'], onChange: setPeriod }]} />
    {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
    <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{reportTypes.map(([name, description]) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={name}><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg text-blue-700">▥</div><h2 className="mt-4 font-bold">{name}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{description}</p><button className="mt-5 text-sm font-bold text-blue-700 hover:underline" onClick={() => setMessage(`Relatório "${name}" gerado em modo demonstração${period ? ` para ${period.toLowerCase()}` : ''}.`)} type="button">Gerar relatório</button></article>)}</section>
  </ErpShell>;
}
