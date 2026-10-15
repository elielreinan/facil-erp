'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { isSafeText, normalizeSearch } from '../../lib/validation';

const products = [['INS-0025', 'Cabo flexível 2,5 mm²', 'Elétrica', 'Metro', '1.200', 'Ativo'], ['INS-0081', 'Eletroduto PVC 25 mm', 'Elétrica', 'Unidade', '350', 'Ativo'], ['INS-0142', 'Tubo PVC esgoto 100 mm', 'Hidráulica', 'Metro', '180', 'Estoque baixo']];

export default function ProdutosPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const filteredProducts = useMemo(() => products.filter((row) => `${row[0]} ${row[1]} ${row[2]}`.toLowerCase().includes(normalizeSearch(search).toLowerCase()) && (!category || row[2] === category)), [search, category]);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '');
    const code = String(form.get('code') ?? '');
    if (!isSafeText(name, 120) || !/^[A-Z0-9-]{3,40}$/.test(code)) {
      setFormError('Informe um nome válido e um código com letras maiúsculas, números ou hífen.');
      return;
    }
    if (!window.confirm(`Confirmar criação do produto "${name.trim()}"?`)) return;
    setFormError('');
    setIsFormOpen(false);
  }
  return <ErpShell eyebrow="Cadastros" title="Produtos e insumos">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between"><div><h2 className="font-bold">Catálogo de materiais</h2><p className="mt-1 text-sm text-slate-500">Cadastre produtos, unidade de medida, categoria e estoque mínimo.</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setIsFormOpen((open) => !open)} type="button">Novo produto</button></div>
      {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="product-code">Código</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm uppercase" id="product-code" maxLength={40} name="code" pattern="[A-Z0-9-]{3,40}" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="product-name">Nome do produto</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="product-name" maxLength={120} name="name" required /></div>{formError && <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">{formError}</p>}<div className="sm:col-span-2"><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white" type="submit">Validar cadastro</button></div></form>}
      <SearchFilters onSearchChange={setSearch} placeholder="Código, produto ou categoria" search={search} filters={[{ label: 'Categoria', value: category, options: ['Elétrica', 'Hidráulica'], onChange: setCategory }]} />
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Código</th><th className="pb-3">Produto</th><th className="pb-3">Categoria</th><th className="pb-3">Unidade</th><th className="pb-3">Estoque</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredProducts.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td className={`py-4 ${index === 1 ? 'font-semibold text-slate-800' : 'text-slate-600'}`} key={cell}>{cell}</td>)}</tr>)}</tbody></table></div>
    </section>
  </ErpShell>;
}
