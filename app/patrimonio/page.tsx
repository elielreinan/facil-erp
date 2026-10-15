'use client';

import { FormEvent, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';

export default function PatrimonioPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const serial = String(data.get('serial') ?? '').trim();
    if (name.length < 3 || serial.length < 3) {
      setError('Informe o nome do ativo e um número de série válido.');
      return;
    }
    if (!window.confirm(`Confirmar criação do ativo "${name}"?`)) return;
    setError('');
    setMessage(`Ativo "${name}" criado em modo demonstração.`);
    setIsFormOpen(false);
    event.currentTarget.reset();
  }
  return <ErpShell eyebrow="Módulo de ativos" title="Patrimônio">
    <section className="grid gap-4 sm:grid-cols-3">{[['Total de ativos', '0'], ['Em uso', '0'], ['Em manutenção', '0']].map(([label, value]) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></article>)}</section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex justify-between"><div><h2 className="font-bold">Ativos registrados</h2><p className="mt-1 text-sm text-slate-500">Controle de notebooks, monitores e periféricos.</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setIsFormOpen((open) => !open)} type="button">{isFormOpen ? 'Fechar formulário' : 'Novo ativo'}</button></div>
    {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
    {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="asset-name">Nome do item</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="asset-name" name="name" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="asset-serial">Número de série</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="asset-serial" name="serial" required /></div>{error && <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">{error}</p>}<button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-2" type="submit">Salvar ativo</button></form>}
    <div className="mt-5 space-y-3"><p className="py-8 text-center text-sm text-slate-500">Nenhum ativo cadastrado.</p></div></section>
  </ErpShell>;
}
