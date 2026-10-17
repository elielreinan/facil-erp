'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { AssetLabel } from '../../components/asset-label';
import { ErpShell } from '../../components/erp-shell';
import { QrScanner } from '../../components/qr-scanner';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';
import { extractAssetId } from '../../lib/private-documents';
import { isSafeText, isValidIsoDate, normalizeSearch } from '../../lib/validation';

type AssetStatus = 'disponivel' | 'alocado' | 'manutencao';
type Asset = {
  id: string;
  nome_item: string;
  tipo: string;
  numero_serie: string;
  status: AssetStatus;
  data_aquisicao: string;
  responsavel_perfil_id: string | null;
  centro_custo_id: string | null;
};
type Profile = { id: string; nome: string };
type CostCenter = { id: string; codigo: string; nome: string };

const statuses: Array<{ value: AssetStatus; label: string }> = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'alocado', label: 'Alocado' },
  { value: 'manutencao', label: 'Em manutenção' },
];

export default function PatrimonioPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [lastScan, setLastScan] = useState('');
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);
  const [labelAsset, setLabelAsset] = useState<Asset | null>(null);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadAssets() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const [assetResult, profileResult, centerResult] = await Promise.all([
        supabase.from('patrimonio_ativos')
          .select('id,nome_item,tipo,numero_serie,status,data_aquisicao,responsavel_perfil_id,centro_custo_id')
          .order('nome_item'),
        supabase.rpc('list_active_profile_assignments'),
        supabase.from('centros_custo').select('id,codigo,nome').eq('ativo', true).order('nome'),
      ]);
      if (assetResult.error) throw assetResult.error;
      if (profileResult.error) throw profileResult.error;
      if (centerResult.error) throw centerResult.error;
      setAssets((assetResult.data ?? []) as Asset[]);
      setProfiles(profileResult.data ?? []);
      setCenters(centerResult.data ?? []);
    } catch (caughtError) {
      console.error('Falha ao carregar patrimônio:', caughtError);
      setError('Não foi possível carregar os ativos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAssets(); }, []);

  const filteredAssets = useMemo(() => assets.filter((asset) =>
    `${asset.nome_item} ${asset.tipo} ${asset.numero_serie}`.toLowerCase()
      .includes(normalizeSearch(search).toLowerCase())
    && (!statusFilter || asset.status === statusFilter)
  ), [assets, search, statusFilter]);

  function openAssetForm(asset?: Asset) {
    setEditingAsset(asset ?? null);
    setIsFormOpen(true);
    setError('');
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const type = String(form.get('type') ?? '').trim();
    const serial = String(form.get('serial') ?? '').trim();
    const acquisitionDate = String(form.get('acquisitionDate') ?? '');
    const status = String(form.get('status') ?? '') as AssetStatus;
    const responsibleId = String(form.get('responsible') ?? '') || null;
    const centerId = String(form.get('center') ?? '') || null;
    if (!isSafeText(name, 150) || !isSafeText(type, 80) || !isSafeText(serial, 100)
      || !statuses.some((item) => item.value === status)
      || !isValidIsoDate(acquisitionDate)
      || (responsibleId && !profiles.some((profile) => profile.id === responsibleId))
      || (centerId && !centers.some((center) => center.id === centerId))) {
      setError('Informe item, tipo, série, status e data válidos, e referências ativas.');
      return;
    }
    if (!window.confirm(`Confirmar ${editingAsset ? 'alteração' : 'criação'} do ativo "${name}"?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const payload = {
        nome_item: name,
        tipo: type,
        numero_serie: serial,
        status,
        data_aquisicao: acquisitionDate,
        responsavel_perfil_id: responsibleId,
        centro_custo_id: centerId,
      };
      const result = editingAsset
        ? await supabase.from('patrimonio_ativos').update(payload)
          .eq('id', editingAsset.id).select('id').maybeSingle()
        : await supabase.from('patrimonio_ativos')
          .insert({ ...payload, criado_por: profile.id }).select('id').single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('The asset was not saved.');
      setMessage(`Ativo "${name}" ${editingAsset ? 'alterado' : 'criado'} com sucesso.`);
      setError('');
      setIsFormOpen(false);
      setEditingAsset(null);
      await loadAssets();
    } catch (caughtError) {
      console.error('Falha ao salvar ativo:', caughtError);
      setError('Não foi possível salvar o ativo. Verifique número de série duplicado e permissões.');
    } finally {
      setSaving(false);
    }
  }

  async function removeAsset(asset: Asset) {
    if (!window.confirm(`Confirmar exclusão do ativo "${asset.nome_item}"?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error: deleteError } = await supabase.from('patrimonio_ativos')
        .delete().eq('id', asset.id).select('id').maybeSingle();
      if (deleteError) throw deleteError;
      if (!data) throw new Error('The asset was not deleted.');
      setMessage(`Ativo "${asset.nome_item}" excluído com sucesso.`);
      setError('');
      await loadAssets();
    } catch (caughtError) {
      console.error('Falha ao excluir ativo:', caughtError);
      setError('Não foi possível excluir o ativo.');
    } finally {
      setSaving(false);
    }
  }

  const handleScan = useCallback((value: string) => {
    const assetId = extractAssetId(value);
    const matchedAsset = assets.find((asset) => asset.id === assetId) ?? null;
    setScannedAsset(matchedAsset);
    setLastScan(matchedAsset
      ? `Etiqueta reconhecida para "${matchedAsset.nome_item}".`
      : 'A etiqueta não corresponde a um ativo visível para este perfil.');
    setIsScannerOpen(false);
    setMessage(matchedAsset
      ? 'Ativo encontrado nos registros autorizados. Revise os dados antes de abrir ou editar.'
      : 'Nenhum ativo autorizado corresponde ao identificador lido.');
    setError(matchedAsset ? '' : 'QR inválido ou ativo não acessível.');
  }, [assets]);

  return <ErpShell eyebrow="Módulo de ativos" title="Patrimônio">
    <section className="grid gap-4 sm:grid-cols-3">
      {[
        ['Total de ativos', assets.length],
        ['Em uso', assets.filter((asset) => asset.status === 'alocado').length],
        ['Em manutenção', assets.filter((asset) => asset.status === 'manutencao').length],
      ].map(([label, value]) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
        <p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold">{value}</p>
      </article>)}
    </section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div><h2 className="font-bold">Ativos registrados</h2><p className="mt-1 text-sm text-slate-500">Controle persistido de equipamentos.</p></div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700" disabled={saving} onClick={() => setIsScannerOpen((open) => !open)} type="button">{isScannerOpen ? 'Fechar scanner' : 'Ler etiqueta QR'}</button>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" disabled={saving} onClick={() => openAssetForm()} type="button">Novo ativo</button>
        </div>
      </div>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
      {lastScan && <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Consulta por etiqueta</p><p className="mt-1 text-sm text-slate-800">{lastScan}</p>{scannedAsset && <button className="mt-2 font-semibold text-blue-700" onClick={() => openAssetForm(scannedAsset)} type="button">Abrir ativo encontrado</button>}</div>}
      {isScannerOpen && <QrScanner onClose={() => setIsScannerOpen(false)} onDetected={handleScan} />}
      {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-xs font-semibold">Nome do item<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editingAsset?.nome_item ?? ''} maxLength={150} name="name" required /></label>
        <label className="text-xs font-semibold">Tipo<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editingAsset?.tipo ?? ''} maxLength={80} name="type" required /></label>
        <label className="text-xs font-semibold">Número de série<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editingAsset?.numero_serie ?? ''} maxLength={100} name="serial" required /></label>
        <label className="text-xs font-semibold">Data de aquisição<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editingAsset?.data_aquisicao ?? ''} name="acquisitionDate" required type="date" /></label>
        <label className="text-xs font-semibold">Status<select className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editingAsset?.status ?? 'disponivel'} name="status">{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="text-xs font-semibold">Responsável<select className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editingAsset?.responsavel_perfil_id ?? ''} name="responsible"><option value="">Sem responsável</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nome}</option>)}</select></label>
        <label className="text-xs font-semibold">Centro de custo<select className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editingAsset?.centro_custo_id ?? ''} name="center"><option value="">Sem centro</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.codigo} - {center.nome}</option>)}</select></label>
        <div className="flex gap-2 sm:col-span-2"><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white" disabled={saving} type="submit">{saving ? 'Salvando...' : editingAsset ? 'Salvar alterações' : 'Criar ativo'}</button><button className="rounded border border-slate-300 px-4 py-2 text-sm" disabled={saving} onClick={() => { setIsFormOpen(false); setEditingAsset(null); }} type="button">Cancelar</button></div>
      </form>}
      <div className="mt-5"><SearchFilters onSearchChange={setSearch} placeholder="Item, tipo ou número de série" search={search} filters={[{ label: 'Status', value: statusFilter, options: statuses.map((item) => item.value), onChange: setStatusFilter }]} /></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Item</th><th className="pb-3">Tipo</th><th className="pb-3">Série</th><th className="pb-3">Status</th><th className="pb-3">Responsável</th><th className="pb-3">Centro</th><th className="pb-3">Ações</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{filteredAssets.map((asset) => <tr key={asset.id}>
          <td className="py-4 font-semibold">{asset.nome_item}</td><td className="py-4">{asset.tipo}</td><td className="py-4">{asset.numero_serie}</td>
          <td className="py-4">{statuses.find((item) => item.value === asset.status)?.label ?? asset.status}</td>
          <td className="py-4">{profiles.find((profile) => profile.id === asset.responsavel_perfil_id)?.nome ?? '—'}</td>
          <td className="py-4">{centers.find((center) => center.id === asset.centro_custo_id)?.nome ?? '—'}</td>
          <td className="py-4"><button className="mr-3 font-semibold text-blue-700" disabled={saving} onClick={() => openAssetForm(asset)} type="button">Editar</button><button className="mr-3 font-semibold text-blue-700" onClick={() => setLabelAsset(asset)} type="button">Etiqueta</button><button className="font-semibold text-red-700" disabled={saving} onClick={() => void removeAsset(asset)} type="button">Excluir</button></td>
        </tr>)}</tbody>
      </table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando ativos...</p>}{!loading && filteredAssets.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum ativo encontrado.</p>}</div>
    </section>
    {labelAsset && <AssetLabel asset={labelAsset} onClose={() => setLabelAsset(null)} />}
  </ErpShell>;
}
