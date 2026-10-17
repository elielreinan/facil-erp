'use client';

import { useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';
import { normalizeSearch } from '../../lib/validation';

type AuditEvent = {
  id: string;
  usuario_id: string;
  acao: string;
  entidade: string;
  entidade_id: string | null;
  centro_custo_id: string | null;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  criado_em: string;
  perfis: { nome: string } | { nome: string }[] | null;
  centros_custo: { nome: string } | { nome: string }[] | null;
};

function relationName(relation: AuditEvent['perfis'] | AuditEvent['centros_custo']) {
  return Array.isArray(relation) ? relation[0]?.nome : relation?.nome;
}

export default function AuditoriaPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadEvents() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error: queryError } = await supabase.from('auditoria_eventos')
        .select('id,usuario_id,acao,entidade,entidade_id,centro_custo_id,dados_anteriores,dados_novos,criado_em,perfis(nome),centros_custo(nome)')
        .order('criado_em', { ascending: false })
        .limit(200);
      if (queryError) throw queryError;
      setEvents((data ?? []) as AuditEvent[]);
    } catch (caughtError) {
      console.error('Falha ao carregar auditoria:', caughtError);
      setError('Não foi possível carregar os eventos de auditoria. O acesso depende da policy do seu perfil.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEvents(); }, []);

  const visibleEvents = useMemo(() => events.filter((event) => {
    const matchesAction = !action || event.acao === action;
    const haystack = `${event.acao} ${event.entidade} ${event.entidade_id ?? ''} ${event.usuario_id} ${relationName(event.perfis) ?? ''}`;
    return matchesAction && haystack.toLowerCase().includes(normalizeSearch(search).toLowerCase());
  }), [events, search, action]);
  const actionOptions = useMemo(() => Array.from(new Set(events.map((event) => event.acao))), [events]);

  return <ErpShell eyebrow="Governança" title="Auditoria">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-bold">Histórico de operações</h2><p className="mt-1 text-sm text-slate-500">Eventos append-only com snapshots, usuário e centro de custo. Exibindo até 200 eventos mais recentes permitidos pelo RLS.</p></div>
        <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-blue-700" disabled={loading} onClick={() => { setLoading(true); void loadEvents(); }} type="button">Atualizar</button>
      </div>
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      <div className="mt-4"><SearchFilters onSearchChange={setSearch} placeholder="Ação, entidade, usuário ou ID" search={search} filters={[{ label: 'Ação', value: action, options: actionOptions, onChange: setAction }]} /></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
        <thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Data</th><th className="pb-3">Usuário</th><th className="pb-3">Ação</th><th className="pb-3">Entidade</th><th className="pb-3">ID do registro</th><th className="pb-3">Centro de custo</th><th className="pb-3">Alterações</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{visibleEvents.map((event) => <tr key={event.id}>
          <td className="py-4 whitespace-nowrap">{new Date(event.criado_em).toLocaleString('pt-BR')}</td>
          <td className="py-4">{relationName(event.perfis) ?? event.usuario_id}</td>
          <td className="py-4">{event.acao}</td><td className="py-4">{event.entidade}</td>
          <td className="py-4 font-mono text-xs">{event.entidade_id ?? '—'}</td>
          <td className="py-4">{relationName(event.centros_custo) ?? '—'}</td>
          <td className="max-w-[28rem] py-4"><details><summary className="cursor-pointer font-semibold text-blue-700">Ver snapshots</summary><div className="mt-2 grid gap-2 md:grid-cols-2"><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs">{JSON.stringify(event.dados_anteriores, null, 2) ?? 'null'}</pre><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-50 p-2 text-xs">{JSON.stringify(event.dados_novos, null, 2) ?? 'null'}</pre></div></details></td>
        </tr>)}</tbody>
      </table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando eventos...</p>}{!loading && visibleEvents.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum evento encontrado ou permitido para este perfil.</p>}</div>
      <p className="mt-4 text-xs text-slate-500">Registros de auditoria não podem ser alterados nem excluídos pela interface.</p>
    </section>
  </ErpShell>;
}
