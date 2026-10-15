'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getSupabaseClient } from '../../lib/supabase';
import { isSafeText, normalizeSearch } from '../../lib/validation';

type Product = {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: string;
  unidade_medida: string;
  estoque_minimo: number;
  ativo: boolean;
};

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function loadProducts() {
    try {
      const { data, error: queryError } = await getSupabaseClient().from('insumos').select('id,codigo,nome,categoria,unidade_medida,estoque_minimo,ativo').order('nome');
      if (queryError) throw queryError;
      setProducts(data ?? []);
    } catch (queryError) {
      console.error('Falha ao carregar produtos:', queryError);
      setError('Não foi possível carregar os produtos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadProducts(); }, []);

  const filteredProducts = useMemo(() => products.filter((product) => `${product.codigo ?? ''} ${product.nome} ${product.categoria}`.toLowerCase().includes(normalizeSearch(search).toLowerCase()) && (!category || product.categoria === category)), [products, search, category]);

  function openForm(product?: Product) {
    setEditing(product ?? null);
    setError('');
    setMessage('');
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      codigo: String(data.get('code') ?? '').trim().toUpperCase(),
      nome: String(data.get('name') ?? '').trim(),
      categoria: String(data.get('category') ?? '').trim(),
      unidade_medida: String(data.get('unit') ?? '').trim(),
      estoque_minimo: Number(data.get('minimumStock')),
    };
    if (!isSafeText(payload.nome, 120) || !isSafeText(payload.categoria, 80) || !isSafeText(payload.unidade_medida, 30) || !/^[A-Z0-9-]{3,40}$/.test(payload.codigo) || !Number.isFinite(payload.estoque_minimo) || payload.estoque_minimo < 0) {
      setError('Preencha código, nome, categoria, unidade e estoque mínimo válidos.');
      return;
    }
    const action = editing ? 'alteração' : 'criação';
    if (!window.confirm(`Confirmar ${action} do produto "${payload.nome}"?`)) return;
    try {
      const client = getSupabaseClient();
      const result = editing ? await client.from('insumos').update(payload).eq('id', editing.id) : await client.from('insumos').insert(payload);
      if (result.error) throw result.error;
      setMessage(`Produto ${editing ? 'alterado' : 'criado'} com sucesso.`);
      setIsFormOpen(false);
      setEditing(null);
      event.currentTarget.reset();
      await loadProducts();
    } catch (queryError) {
      console.error('Falha ao salvar produto:', queryError);
      setError('Não foi possível salvar o produto.');
    }
  }

  async function removeProduct(product: Product) {
    if (!window.confirm(`Confirmar exclusão do produto "${product.nome}"?`)) return;
    const { error: queryError } = await getSupabaseClient().from('insumos').delete().eq('id', product.id);
    if (queryError) {
      console.error('Falha ao excluir produto:', queryError);
      setError('Não foi possível excluir o produto.');
      return;
    }
    setMessage('Produto excluído com sucesso.');
    await loadProducts();
  }

  return <ErpShell eyebrow="Cadastros" title="Produtos e insumos">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Catálogo de materiais</h2><p className="mt-1 text-sm text-slate-500">Dados carregados do Supabase.</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => openForm()} type="button">{isFormOpen ? 'Fechar formulário' : 'Novo produto'}</button></div>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{message}</p>}
      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{error}</p>}
      {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><input defaultValue={editing?.codigo ?? ''} className="rounded border border-slate-300 px-3 py-2 text-sm uppercase" maxLength={40} name="code" placeholder="Código" required /><input defaultValue={editing?.nome ?? ''} className="rounded border border-slate-300 px-3 py-2 text-sm" maxLength={120} name="name" placeholder="Nome" required /><input defaultValue={editing?.categoria ?? ''} className="rounded border border-slate-300 px-3 py-2 text-sm" name="category" placeholder="Categoria" required /><input defaultValue={editing?.unidade_medida ?? ''} className="rounded border border-slate-300 px-3 py-2 text-sm" name="unit" placeholder="Unidade de medida" required /><input defaultValue={editing?.estoque_minimo ?? 0} className="rounded border border-slate-300 px-3 py-2 text-sm" min="0" name="minimumStock" placeholder="Estoque mínimo" required step="0.001" type="number" /><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-2" type="submit">{editing ? 'Salvar alteração' : 'Criar produto'}</button></form>}
      <SearchFilters onSearchChange={setSearch} placeholder="Código, produto ou categoria" search={search} filters={[{ label: 'Categoria', value: category, options: Array.from(new Set(products.map((product) => product.categoria))), onChange: setCategory }]} />
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Código</th><th className="pb-3">Produto</th><th className="pb-3">Categoria</th><th className="pb-3">Unidade</th><th className="pb-3">Estoque mínimo</th><th className="pb-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{!loading && filteredProducts.map((product) => <tr key={product.id}><td className="py-4 text-slate-600">{product.codigo}</td><th className="py-4 font-semibold text-slate-800">{product.nome}</th><td className="py-4 text-slate-600">{product.categoria}</td><td className="py-4 text-slate-600">{product.unidade_medida}</td><td className="py-4 text-slate-600">{product.estoque_minimo}</td><td className="py-4"><button className="mr-3 font-semibold text-blue-700" onClick={() => openForm(product)} type="button">Editar</button><button className="font-semibold text-red-700" onClick={() => void removeProduct(product)} type="button">Excluir</button></td></tr>)}</tbody></table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando produtos...</p>}{!loading && filteredProducts.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum produto cadastrado.</p>}</div>
    </section>
  </ErpShell>;
}
