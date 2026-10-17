'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';
import { normalizeSearch, isSafeText } from '../../lib/validation';

type Profile = { id: string; nome: string };
type CostCenter = {
  id: string;
  codigo: string;
  nome: string;
  responsavel_perfil_id: string | null;
  ativo: boolean;
};

export default function CentrosCustoPage() {
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<CostCenter | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadData() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const [centerResult, profileResult] = await Promise.all([
        supabase.from('centros_custo')
          .select('id,codigo,nome,responsavel_perfil_id,ativo')
          .order('codigo'),
        supabase.rpc('list_active_profile_assignments'),
      ]);
      if (centerResult.error) throw centerResult.error;
      if (profileResult.error) throw profileResult.error;
      setCenters(centerResult.data ?? []);
      setProfiles(profileResult.data ?? []);
    } catch (caughtError) {
      console.error('Falha ao carregar centros de custo:', caughtError);
      setError('Não foi possível carregar os centros de custo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  const visibleCenters = useMemo(() => centers.filter((center) =>
    `${center.codigo} ${center.nome}`.toLowerCase().includes(normalizeSearch(search).toLowerCase())
    && (!status || (status === 'ativo' ? center.ativo : !center.ativo))
  ), [centers, search, status]);

  function openForm(center?: CostCenter) {
    setEditing(center ?? null);
    setFormOpen(true);
    setError('');
    setMessage('');
  }

  async function saveCenter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get('code') ?? '').trim().toUpperCase();
    const name = String(form.get('name') ?? '').trim();
    const responsibleId = String(form.get('responsible') ?? '') || null;
    if (!/^[A-Z0-9-]{2,20}$/.test(code) || !isSafeText(name, 120)
      || (responsibleId && !profiles.some((profile) => profile.id === responsibleId))) {
      setError('Informe código e nome válidos e um responsável ativo.');
      return;
    }
    if (!window.confirm(`Confirmar ${editing ? 'alteração' : 'criação'} do centro "${name}"?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const payload = { codigo: code, nome: name, responsavel_perfil_id: responsibleId };
      const result = editing
        ? await supabase.from('centros_custo').update(payload).eq('id', editing.id).select('id').maybeSingle()
        : await supabase.from('centros_custo').insert(payload).select('id').single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('The cost center was not saved.');
      setMessage(`Centro de custo ${editing ? 'atualizado' : 'criado'}.`);
      setFormOpen(false);
      setEditing(null);
      await loadData();
    } catch (caughtError) {
      console.error('Falha ao salvar centro de custo:', caughtError);
      setError('Não foi possível salvar. Confira se o código já está cadastrado e se sua função permite a operação.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleCenter(center: CostCenter) {
    const nextActive = !center.ativo;
    if (!window.confirm(`Confirmar ${nextActive ? 'reativação' : 'inativação'} do centro "${center.nome}"?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error: updateError } = await supabase.from('centros_custo')
        .update({ ativo: nextActive }).eq('id', center.id).select('id').maybeSingle();
      if (updateError) throw updateError;
      if (!data) throw new Error('The cost center status was not updated.');
      setMessage(`Centro "${center.nome}" ${nextActive ? 'reativado' : 'inativado'}.`);
      await loadData();
    } catch (caughtError) {
      console.error('Falha ao alterar centro de custo:', caughtError);
      setError('Não foi possível alterar o status do centro.');
    } finally {
      setSaving(false);
    }
  }

  return <ErpShell eyebrow="Cadastros" title="Centros de custo">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-bold">Centros de custo</h2><p className="mt-1 text-sm text-slate-500">Cadastro persistido; centros referenciados são inativados, não removidos fisicamente.</p></div>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => openForm()} type="button">Novo centro</button>
      </div>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {formOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-3" onSubmit={saveCenter}>
        <label className="text-xs font-semibold">Código<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editing?.codigo ?? ''} maxLength={20} name="code" required /></label>
        <label className="text-xs font-semibold">Nome<input className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editing?.nome ?? ''} maxLength={120} name="name" required /></label>
        <label className="text-xs font-semibold">Responsável<select className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm" defaultValue={editing?.responsavel_perfil_id ?? ''} name="responsible"><option value="">Sem responsável</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.nome}</option>)}</select></label>
        <div className="flex gap-2 sm:col-span-3"><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white" disabled={saving} type="submit">{saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar centro'}</button><button className="rounded border border-slate-300 px-4 py-2 text-sm" disabled={saving} onClick={() => { setFormOpen(false); setEditing(null); }} type="button">Cancelar</button></div>
      </form>}
      <SearchFilters onSearchChange={setSearch} placeholder="Código ou nome do centro" search={search} filters={[{ label: 'Status', value: status, options: ['ativo', 'inativo'], onChange: setStatus }]} />
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Código</th><th className="pb-3">Centro</th><th className="pb-3">Responsável</th><th className="pb-3">Status</th><th className="pb-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{visibleCenters.map((center) => <tr key={center.id}><td className="py-4">{center.codigo}</td><td className="py-4 font-semibold">{center.nome}</td><td className="py-4">{profiles.find((profile) => profile.id === center.responsavel_perfil_id)?.nome ?? '—'}</td><td className="py-4">{center.ativo ? 'Ativo' : 'Inativo'}</td><td className="py-4"><button className="mr-3 font-semibold text-blue-700" disabled={saving} onClick={() => openForm(center)} type="button">Editar</button><button className="font-semibold text-slate-700" disabled={saving} onClick={() => void toggleCenter(center)} type="button">{center.ativo ? 'Inativar' : 'Reativar'}</button></td></tr>)}</tbody></table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando centros...</p>}{!loading && visibleCenters.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum centro de custo encontrado.</p>}</div>
    </section>
  </ErpShell>;
}
