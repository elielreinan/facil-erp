'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { QrScanner } from '../../components/qr-scanner';
import { getCurrentProfile } from '../../lib/current-profile';

type Asset = { id: string; nome_item: string; tipo: string; numero_serie: string; status: string; data_aquisicao: string };

export default function PatrimonioPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadAssets() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error: queryError } = await supabase.from('patrimonio_ativos').select('id,nome_item,tipo,numero_serie,status,data_aquisicao').order('nome_item');
      if (queryError) throw queryError;
      setAssets(data ?? []);
    } catch (caughtError) { console.error('Falha ao carregar patrimônio:', caughtError); setError('Não foi possível carregar os ativos.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadAssets(); }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const type = String(data.get('type') ?? '').trim();
    const serial = String(data.get('serial') ?? '').trim();
    const acquisitionDate = String(data.get('acquisitionDate') ?? '');
    if (name.length < 3 || type.length < 2 || serial.length < 3 || !acquisitionDate) { setError('Informe item, tipo, número de série e data válidos.'); return; }
    if (!window.confirm(`Confirmar criação do ativo "${name}"?`)) return;
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { error: insertError } = await supabase.from('patrimonio_ativos').insert({ nome_item: name, tipo: type, numero_serie: serial, data_aquisicao: acquisitionDate, criado_por: profile.id });
      if (insertError) throw insertError;
      setMessage(`Ativo "${name}" criado com sucesso.`); setError(''); setIsFormOpen(false); event.currentTarget.reset(); await loadAssets();
    } catch (caughtError) { console.error('Falha ao criar ativo:', caughtError); setError('Não foi possível salvar o ativo. Verifique número de série e permissões.'); }
  }

  const handleScan = useCallback((value: string) => {
    setLastScan(value);
    setIsScannerOpen(false);
    setMessage('Etiqueta lida. Confira o conteúdo antes de usar qualquer ação.');
    setError('');
  }, []);

  return <ErpShell eyebrow="Módulo de ativos" title="Patrimônio"><section className="grid gap-4 sm:grid-cols-3">{[['Total de ativos', assets.length], ['Em uso', assets.filter((asset) => asset.status === 'alocado').length], ['Em manutenção', assets.filter((asset) => asset.status === 'manutencao').length]].map(([label, value]) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p></article>)}</section><section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><h2 className="font-bold">Ativos registrados</h2><p className="mt-1 text-sm text-slate-500">Controle persistido de equipamentos.</p></div><div className="flex flex-wrap gap-2"><button className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700" onClick={() => setIsScannerOpen((open) => !open)} type="button">{isScannerOpen ? 'Fechar scanner' : 'Ler etiqueta QR'}</button><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setIsFormOpen((open) => !open)} type="button">{isFormOpen ? 'Fechar formulário' : 'Novo ativo'}</button></div></div>{message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}{lastScan && <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Última leitura</p><p className="mt-1 break-all font-mono text-sm text-slate-800">{lastScan}</p></div>}{isScannerOpen && <QrScanner onClose={() => setIsScannerOpen(false)} onDetected={handleScan} />}{isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="asset-name">Nome do item</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="asset-name" name="name" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="asset-type">Tipo</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="asset-type" name="type" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="asset-serial">Número de série</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="asset-serial" name="serial" required /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="asset-date">Data de aquisição</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="asset-date" name="acquisitionDate" required type="date" /></div><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-2" type="submit">Salvar ativo</button></form>}<div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Item</th><th className="pb-3">Tipo</th><th className="pb-3">Série</th><th className="pb-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{assets.map((asset) => <tr key={asset.id}><td className="py-4 font-semibold">{asset.nome_item}</td><td className="py-4">{asset.tipo}</td><td className="py-4">{asset.numero_serie}</td><td className="py-4">{asset.status}</td></tr>)}</tbody></table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando ativos...</p>}{!loading && assets.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum ativo cadastrado.</p>}</div></section></ErpShell>;
}
