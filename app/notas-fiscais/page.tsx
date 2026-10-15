'use client';

import { FormEvent, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';

export default function NotasFiscaisPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const number = String(data.get('number') ?? '').trim();
    const total = Number(data.get('total'));
    if (!number || !Number.isFinite(total) || total < 0) {
      setError('Informe o número da nota e um valor total válido.');
      return;
    }
    if (!window.confirm(`Confirmar lançamento da NF ${number}?`)) return;
    setError('');
    setMessage(`NF ${number} lançada em modo demonstração.`);
    setIsFormOpen(false);
    event.currentTarget.reset();
  }
  return <ErpShell eyebrow="Módulo financeiro" title="Notas fiscais">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex justify-between"><div><h2 className="font-bold">Conferência de documentos</h2><p className="mt-1 text-sm text-slate-500">Registre NF, fornecedor, arquivo e centro de custo.</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setIsFormOpen((open) => !open)} type="button">{isFormOpen ? 'Fechar formulário' : 'Lançar NF'}</button></div>
    {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
    {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-3" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-number">Número da NF</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-number" name="number" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-supplier">Fornecedor</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-supplier" name="supplier" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-total">Valor total</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-total" min="0" name="total" required step="0.01" type="number" /></div>{error && <p className="text-sm font-medium text-red-700 sm:col-span-3" role="alert">{error}</p>}<button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-3" type="submit">Salvar nota fiscal</button></form>}
    <div className="mt-6 grid gap-4 sm:grid-cols-3">{[['Pendentes', '0', 'bg-amber-50 text-amber-700'], ['Conferidas', '0', 'bg-emerald-50 text-emerald-700'], ['Valor no mês', 'R$ 0,00', 'bg-blue-50 text-blue-700']].map(([label, value, style]) => <div className={`rounded-lg p-4 ${style}`} key={label}><p className="text-sm">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}</div><p className="mt-5 text-center text-sm text-slate-500">Nenhuma nota fiscal cadastrada.</p></section>
  </ErpShell>;
}
