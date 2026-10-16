'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { QrScanner } from '../../components/qr-scanner';
import { getCurrentProfile } from '../../lib/current-profile';

type Invoice = { id: string; numero: string; serie: string | null; fornecedor: string; valor_total: number; data_emissao: string };
type CostCenter = { id: string; codigo: string; nome: string };

export default function NotasFiscaisPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const [invoiceResult, centerResult] = await Promise.all([
        supabase.from('notas_fiscais').select('id,numero,serie,fornecedor,valor_total,data_emissao').order('data_emissao', { ascending: false }),
        supabase.from('centros_custo').select('id,codigo,nome').eq('ativo', true).order('nome'),
      ]);
      if (invoiceResult.error) throw invoiceResult.error; if (centerResult.error) throw centerResult.error;
      setInvoices(invoiceResult.data ?? []); setCenters(centerResult.data ?? []);
    } catch (caughtError) { console.error('Falha ao carregar notas fiscais:', caughtError); setError('Não foi possível carregar as notas fiscais.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(); }, []);

  function handleScan(value: string) {
    setScannedCode(value);
    setIsScannerOpen(false);
    setIsFormOpen(true);
    setMessage('Código lido. Revise os dados da nota antes de salvar.');
    setError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const number = String(data.get('number') ?? '').trim();
    const supplier = String(data.get('supplier') ?? '').trim();
    const centerId = String(data.get('centerId') ?? '');
    const total = Number(data.get('total'));
    const issueDate = String(data.get('issueDate') ?? '');
    if (!number || !supplier || !centerId || !issueDate || !Number.isFinite(total) || total < 0) { setError('Preencha número, fornecedor, centro de custo, data e valor válidos.'); return; }
    if (!window.confirm(`Confirmar lançamento da NF ${number}?`)) return;
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { error: insertError } = await supabase.from('notas_fiscais').insert({ numero: number, serie: String(data.get('series') ?? '').trim() || null, fornecedor: supplier, valor_total: total, data_emissao: issueDate, centro_custo_id: centerId, criado_por: profile.id });
      if (insertError) throw insertError;
      setMessage(`NF ${number} lançada com sucesso.`); setError(''); setIsFormOpen(false); event.currentTarget.reset(); await loadData();
    } catch (caughtError) { console.error('Falha ao lançar nota fiscal:', caughtError); setError('Não foi possível salvar a NF. Verifique duplicidade e permissões.'); }
  }

  return <ErpShell eyebrow="Módulo financeiro" title="Notas fiscais"><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="font-bold">Conferência de documentos</h2><p className="mt-1 text-sm text-slate-500">Notas fiscais persistidas no Supabase.</p></div><div className="flex flex-wrap gap-2"><button className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700" onClick={() => setIsScannerOpen((open) => !open)} type="button">{isScannerOpen ? 'Fechar scanner' : 'Ler QR da NF'}</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setIsFormOpen((open) => !open)} type="button">{isFormOpen ? 'Fechar formulário' : 'Lançar NF'}</button></div></div>{message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}{isScannerOpen && <QrScanner description="Leia o QR Code fiscal e revise os dados antes de lançar a nota." onClose={() => setIsScannerOpen(false)} onDetected={handleScan} title="Ler QR Code da nota fiscal" />}{scannedCode && <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Código lido para conferência</p><p className="mt-1 break-all font-mono text-sm text-slate-800">{scannedCode}</p></div>}{isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-3" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-number">Número</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-number" name="number" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-series">Série</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-series" name="series" /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-supplier">Fornecedor</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-supplier" name="supplier" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-total">Valor total</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-total" min="0" name="total" required step="0.01" type="number" /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-date">Emissão</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-date" name="issueDate" required type="date" /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="invoice-center">Centro de custo</label><select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="invoice-center" name="centerId" required defaultValue=""><option disabled value="">Selecione</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.codigo} - {center.nome}</option>)}</select></div><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-3" type="submit">Salvar nota fiscal</button></form>}<div className="mt-6 grid gap-4 sm:grid-cols-3">{[['Notas registradas', String(invoices.length)], ['Centros disponíveis', String(centers.length)], ['Valor acumulado', `R$ ${invoices.reduce((sum, invoice) => sum + invoice.valor_total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`]].map(([label, value]) => <div className="rounded-lg bg-blue-50 p-4" key={label}><p className="text-sm text-blue-700">{label}</p><p className="mt-1 text-2xl font-bold text-blue-900">{value}</p></div>)}</div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Número</th><th className="pb-3">Fornecedor</th><th className="pb-3">Emissão</th><th className="pb-3">Valor</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => <tr key={invoice.id}><td className="py-4">{invoice.numero}{invoice.serie ? `/${invoice.serie}` : ''}</td><td className="py-4">{invoice.fornecedor}</td><td className="py-4">{new Date(`${invoice.data_emissao}T00:00:00`).toLocaleDateString('pt-BR')}</td><td className="py-4">R$ {invoice.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando notas...</p>}{!loading && invoices.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhuma nota fiscal cadastrada.</p>}</div></section></ErpShell>;
}
