'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { normalizeSearch } from '../../lib/validation';

const entries = [['14/10/2026', 'Cabo flexível 2,5 mm²', 'Eletro Mais', 'Obras - Torre Norte', 'R$ 4.680,00'], ['13/10/2026', 'Eletroduto PVC 25 mm', 'Constrular', 'Obras - Torre Norte', 'R$ 2.975,00'], ['11/10/2026', 'Disjuntor tripolar 63A', 'Casa Elétrica', 'Manutenção', 'R$ 3.840,00']];

export default function SuprimentosPage() {
  const [search, setSearch] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const filteredEntries = useMemo(() => entries.filter((row) => `${row[1]} ${row[2]} ${row[3]}`.toLowerCase().includes(normalizeSearch(search).toLowerCase()) && (!costCenter || row[3] === costCenter)), [search, costCenter]);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const quantity = Number(data.get('quantity'));
    const value = Number(data.get('value'));
    if (!data.get('item') || !data.get('supplier') || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(value) || value < 0) {
      setError('Informe insumo, fornecedor, quantidade e valor válidos.');
      return;
    }
    if (!window.confirm('Confirmar criação da entrada de suprimentos?')) return;
    setError('');
    setMessage('Entrada criada em modo demonstração.');
    setIsFormOpen(false);
    event.currentTarget.reset();
  }
  return <ErpShell eyebrow="Módulo operacional" title="Suprimentos">
    <section className="grid gap-4 sm:grid-cols-3">
      {[
        ['Entradas no mês', 'R$ 48.750,00', '+12,5%'],
        ['Itens cadastrados', '1.284', '23 abaixo do mínimo'],
        ['Fornecedores ativos', '42', '3 em análise'],
      ].map(([label, value, detail]) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-2 text-xs font-semibold text-emerald-600">{detail}</p></article>)}
    </section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between"><div><h2 className="font-bold">Histórico de entradas</h2><p className="mt-1 text-sm text-slate-500">Insumos recebidos, fornecedor, NF e centro de custo</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => { setIsFormOpen((open) => !open); setMessage(''); }} type="button">{isFormOpen ? 'Fechar formulário' : 'Nova entrada'}</button></div>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
      {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-item">Insumo</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-item" name="item" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-supplier">Fornecedor</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-supplier" name="supplier" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-quantity">Quantidade</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-quantity" min="0.001" name="quantity" required step="0.001" type="number" /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-value">Valor total</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-value" min="0" name="value" required step="0.01" type="number" /></div>{error && <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">{error}</p>}<button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-2" type="submit">Salvar entrada</button></form>}
      <SearchFilters onSearchChange={setSearch} placeholder="Insumo, fornecedor ou centro de custo" search={search} filters={[{ label: 'Centro de custo', value: costCenter, options: ['Obras - Torre Norte', 'Manutenção'], onChange: setCostCenter }]} />
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Data</th><th className="pb-3">Insumo</th><th className="pb-3">Fornecedor</th><th className="pb-3">Centro de custo</th><th className="pb-3">Valor</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredEntries.map((row) => <tr key={row[0] + row[1]}>{row.map((cell) => <td className="py-4 text-slate-600" key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
    </section>
  </ErpShell>;
}
