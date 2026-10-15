'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { isSafeText, isValidCnpj, maskCnpj, maskPhone, normalizeSearch } from '../../lib/validation';

const suppliers: string[][] = [];

export default function FornecedoresPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');
  const filteredSuppliers = useMemo(() => suppliers.filter((row) => `${row[0]} ${row[1]} ${row[2]}`.toLowerCase().includes(normalizeSearch(search).toLowerCase()) && (!status || row[4] === status)), [search, status]);
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '');
    const email = String(form.get('email') ?? '');
    if (!isSafeText(name, 150) || !isValidCnpj(cnpj) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.length < 14) {
      setFormError('Preencha razão social, CNPJ válido, e-mail válido e telefone completo.');
      return;
    }
    if (!window.confirm(`Confirmar criação do fornecedor "${name.trim()}"?`)) return;
    setFormError('');
    setIsFormOpen(false);
  }
  return <ErpShell eyebrow="Cadastros" title="Fornecedores">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between"><div><h2 className="font-bold">Base de fornecedores</h2><p className="mt-1 text-sm text-slate-500">Consulte empresas habilitadas para compras e orçamentos.</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setIsFormOpen((open) => !open)} type="button">Novo fornecedor</button></div>
      {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-name">Razão social</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-name" maxLength={150} name="name" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-cnpj">CNPJ</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-cnpj" inputMode="numeric" maxLength={18} onChange={(event) => setCnpj(maskCnpj(event.target.value))} placeholder="00.000.000/0000-00" required value={cnpj} /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-email">E-mail</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-email" maxLength={150} name="email" required type="email" /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-phone">Telefone</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-phone" inputMode="tel" maxLength={15} onChange={(event) => setPhone(maskPhone(event.target.value))} placeholder="(00) 00000-0000" required value={phone} /></div>{formError && <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">{formError}</p>}<div className="sm:col-span-2"><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white" type="submit">Validar cadastro</button></div></form>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-lg bg-blue-50 p-4"><p className="text-sm text-blue-700">Fornecedores ativos</p><p className="mt-1 text-2xl font-bold text-blue-900">0</p></div><div className="rounded-lg bg-emerald-50 p-4"><p className="text-sm text-emerald-700">Cotações no mês</p><p className="mt-1 text-2xl font-bold text-emerald-900">0</p></div><div className="rounded-lg bg-amber-50 p-4"><p className="text-sm text-amber-700">Em avaliação</p><p className="mt-1 text-2xl font-bold text-amber-900">0</p></div></div>
      <SearchFilters onSearchChange={setSearch} placeholder="Razão social, CNPJ ou e-mail" search={search} filters={[{ label: 'Status', value: status, options: [], onChange: setStatus }]} />
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Fornecedor</th><th className="pb-3">CNPJ</th><th className="pb-3">Contato</th><th className="pb-3">Última compra</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredSuppliers.map((row) => <tr key={row[1]}>{row.map((cell, index) => <td className={`py-4 ${index === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}`} key={cell}>{cell}</td>)}</tr>)}</tbody></table><p className="py-8 text-center text-sm text-slate-500">Nenhum fornecedor cadastrado.</p></div>
    </section>
  </ErpShell>;
}
