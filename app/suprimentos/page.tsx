'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';
import { isSafeText, isValidIsoDate, normalizeSearch } from '../../lib/validation';

type Product = { id: string; nome: string; unidade_medida: string };
type CostCenter = { id: string; codigo: string; nome: string };
type Entry = { id: string; insumo_id: string; quantidade: number; valor_unitario: number; fornecedor: string; data_compra: string; centro_custo_id: string | null; insumos: { nome: string } | { nome: string }[] | null };

export default function SuprimentosPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const [entriesResult, productsResult, centersResult] = await Promise.all([
        supabase.from('compras_historico').select('id,insumo_id,quantidade,valor_unitario,fornecedor,data_compra,centro_custo_id,insumos(nome)').order('data_compra', { ascending: false }),
        supabase.from('insumos').select('id,nome,unidade_medida').eq('ativo', true).order('nome'),
        supabase.from('centros_custo').select('id,codigo,nome').eq('ativo', true).order('nome'),
      ]);
      if (entriesResult.error) throw entriesResult.error;
      if (productsResult.error) throw productsResult.error;
      if (centersResult.error) throw centersResult.error;
      setEntries((entriesResult.data ?? []) as Entry[]); setProducts(productsResult.data ?? []);
      setCenters(centersResult.data ?? []);
    } catch (caughtError) { console.error('Falha ao carregar suprimentos:', caughtError); setError('NÃ£o foi possÃ­vel carregar os dados de suprimentos.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(); }, []);

  const filteredEntries = useMemo(() => entries.filter((entry) => `${Array.isArray(entry.insumos) ? entry.insumos[0]?.nome ?? '' : entry.insumos?.nome ?? ''} ${entry.fornecedor}`.toLowerCase().includes(normalizeSearch(search).toLowerCase())), [entries, search]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const insumoId = String(data.get('insumoId') ?? '');
    const supplier = String(data.get('supplier') ?? '').trim();
    const centerId = String(data.get('centerId') ?? '') || null;
    const purchaseDate = String(data.get('purchaseDate') ?? '');
    const quantity = Number(data.get('quantity'));
    const unitValue = Number(data.get('unitValue'));
    if (!products.some((product) => product.id === insumoId) || !isSafeText(supplier, 150)
      || (centerId && !centers.some((center) => center.id === centerId))
      || !isValidIsoDate(purchaseDate)
      || !Number.isFinite(quantity) || quantity <= 0
      || !Number.isFinite(unitValue) || unitValue < 0) { setError('Informe insumo, fornecedor, centro, data, quantidade e valor unitário válidos.'); return; }
    if (!window.confirm(`Confirmar ${editingEntry ? 'alteração' : 'criação'} da entrada de suprimentos?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const payload = { insumo_id: insumoId, fornecedor: supplier, quantidade: quantity, valor_unitario: unitValue, centro_custo_id: centerId, data_compra: new Date(`${purchaseDate}T12:00:00`).toISOString() };
      const result = editingEntry
        ? await supabase.from('compras_historico').update(payload).eq('id', editingEntry.id).select('id').maybeSingle()
        : await supabase.from('compras_historico').insert({ ...payload, criado_por: profile.id });
      if (result.error) throw result.error;
      if (editingEntry && !result.data) throw new Error('The purchase entry was not updated.');
      setMessage(`Entrada ${editingEntry ? 'alterada' : 'persistida'} com sucesso.`); setError(''); setIsFormOpen(false); setEditingEntry(null); event.currentTarget.reset(); await loadData();
    } catch (caughtError) { console.error('Falha ao salvar entrada:', caughtError); setError('Não foi possível salvar a entrada. Verifique as permissões.'); }
    finally { setSaving(false); }
  }

  function openEntryForm(entry?: Entry) {
    setEditingEntry(entry ?? null);
    setIsFormOpen(true);
    setError('');
  }

  async function removeEntry(entry: Entry) {
    if (!window.confirm('Confirmar exclusão desta entrada de suprimentos?')) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error: deleteError } = await supabase.from('compras_historico').delete().eq('id', entry.id).select('id').maybeSingle();
      if (deleteError) throw deleteError;
      if (!data) throw new Error('The purchase entry was not deleted.');
      setMessage('Entrada excluída com sucesso.');
      await loadData();
    } catch (caughtError) {
      console.error('Falha ao excluir entrada:', caughtError);
      setError('Não foi possível excluir a entrada.');
    } finally { setSaving(false); }
  }

  return <ErpShell eyebrow="MÃ³dulo operacional" title="Suprimentos">
    <section className="grid gap-4 sm:grid-cols-3">{[['Entradas no mÃªs', `R$ ${entries.reduce((sum, entry) => sum + entry.quantidade * entry.valor_unitario, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`], ['Entradas registradas', String(entries.length)], ['Produtos disponÃ­veis', String(products.length)]].map(([label, value]) => <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-3 text-2xl font-bold">{value}</p></article>)}</section>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-bold">HistÃ³rico de entradas</h2><p className="mt-1 text-sm text-slate-500">Registros persistidos no Supabase.</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => setIsFormOpen((open) => !open)} type="button">{isFormOpen ? 'Fechar formulÃ¡rio' : 'Nova entrada'}</button></div>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}{error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
      {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-item">Insumo</label><select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-item" name="insumoId" required defaultValue={editingEntry?.insumo_id ?? ''}><option disabled value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.nome} ({product.unidade_medida})</option>)}</select></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-supplier">Fornecedor</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-supplier" defaultValue={editingEntry?.fornecedor ?? ''} name="supplier" required maxLength={150} /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-center">Centro de custo</label><select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-center" name="centerId" defaultValue={editingEntry?.centro_custo_id ?? ''}><option value="">Não informado</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.codigo} - {center.nome}</option>)}</select></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-date">Data da compra</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-date" defaultValue={editingEntry?.data_compra.slice(0, 10) ?? new Date().toISOString().slice(0, 10)} name="purchaseDate" required type="date" /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-quantity">Quantidade</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-quantity" min="0.001" defaultValue={editingEntry?.quantidade ?? ''} name="quantity" required step="0.001" type="number" /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="entry-value">Valor unitário</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="entry-value" min="0" defaultValue={editingEntry?.valor_unitario ?? ''} name="unitValue" required step="0.01" type="number" /></div><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-2" disabled={saving} type="submit">{saving ? 'Salvando...' : editingEntry ? 'Salvar alteração' : 'Salvar entrada'}</button></form>}
      <SearchFilters onSearchChange={setSearch} placeholder="Insumo ou fornecedor" search={search} filters={[]} /><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Data</th><th className="pb-3">Insumo</th><th className="pb-3">Fornecedor</th><th className="pb-3">Quantidade</th><th className="pb-3">Valor total</th><th className="pb-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredEntries.map((entry) => <tr key={entry.id}><td className="py-4">{new Date(entry.data_compra).toLocaleDateString('pt-BR')}</td><td className="py-4">{Array.isArray(entry.insumos) ? entry.insumos[0]?.nome ?? 'Insumo removido' : entry.insumos?.nome ?? 'Insumo removido'}</td><td className="py-4">{entry.fornecedor}</td><td className="py-4">{entry.quantidade}</td><td className="py-4">R$ {(entry.quantidade * entry.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td><td className="py-4"><button className="mr-3 font-semibold text-blue-700" onClick={() => openEntryForm(entry)} type="button">Editar</button><button className="font-semibold text-red-700" onClick={() => void removeEntry(entry)} type="button">Excluir</button></td></tr>)}</tbody></table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando entradas...</p>}{!loading && filteredEntries.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhuma entrada cadastrada.</p>}</div>
    </section>
  </ErpShell>;
}