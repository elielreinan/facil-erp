'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { SearchFilters } from '../../components/search-filters';
import { getCurrentProfile } from '../../lib/current-profile';
import { isSafeText, isValidCnpj, maskCnpj, maskPhone, normalizeSearch } from '../../lib/validation';

type Supplier = { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string; email: string | null; telefone: string | null; ativo: boolean };

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [cnpj, setCnpj] = useState('');
  const [phone, setPhone] = useState('');

  async function loadSuppliers() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error } = await supabase.from('fornecedores').select('id,razao_social,nome_fantasia,cnpj,email,telefone,ativo').order('razao_social');
      if (error) throw error;
      setSuppliers(data ?? []);
    } catch (caughtError) {
      console.error('Falha ao carregar fornecedores:', caughtError);
      setFormError('Não foi possível carregar os fornecedores.');
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadSuppliers(); }, []);

  const filteredSuppliers = useMemo(() => suppliers.filter((supplier) => `${supplier.razao_social} ${supplier.nome_fantasia ?? ''} ${supplier.cnpj} ${supplier.email ?? ''}`.toLowerCase().includes(normalizeSearch(search).toLowerCase()) && (!status || (status === 'ativo' ? supplier.ativo : !supplier.ativo))), [search, status, suppliers]);

  function openForm(supplier?: Supplier) {
    setEditing(supplier ?? null);
    setCnpj(supplier ? maskCnpj(supplier.cnpj) : '');
    setPhone(supplier?.telefone ? maskPhone(supplier.telefone) : '');
    setFormError('');
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const tradeName = String(form.get('tradeName') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const cleanCnpj = cnpj.replace(/\D/g, '');
    const cleanPhone = phone.replace(/\D/g, '');
    if (!isSafeText(name, 150) || !isValidCnpj(cnpj) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || cleanPhone.length < 10) {
      setFormError('Preencha razão social, CNPJ, e-mail e telefone válidos.'); return;
    }
    if (!window.confirm(`Confirmar ${editing ? 'alteração' : 'criação'} do fornecedor "${name}"?`)) return;
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const payload = { razao_social: name, nome_fantasia: tradeName || null, cnpj: cleanCnpj, email, telefone: cleanPhone };
      const result = editing ? await supabase.from('fornecedores').update(payload).eq('id', editing.id) : await supabase.from('fornecedores').insert(payload);
      if (result.error) throw result.error;
      setMessage(`Fornecedor ${editing ? 'alterado' : 'criado'} com sucesso.`);
      setIsFormOpen(false); setEditing(null); await loadSuppliers();
    } catch (caughtError) {
      console.error('Falha ao salvar fornecedor:', caughtError);
      setFormError('Não foi possível salvar. Verifique CNPJ duplicado e permissões.');
    }
  }

  async function toggleSupplier(supplier: Supplier) {
    if (!window.confirm(`Confirmar ${supplier.ativo ? 'inativação' : 'ativação'} de "${supplier.razao_social}"?`)) return;
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { error } = await supabase.from('fornecedores').update({ ativo: !supplier.ativo }).eq('id', supplier.id);
      if (error) throw error;
      await loadSuppliers();
    } catch (caughtError) { console.error('Falha ao alterar status do fornecedor:', caughtError); setFormError('Não foi possível alterar o status.'); }
  }

  return <ErpShell eyebrow="Cadastros" title="Fornecedores">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between"><div><h2 className="font-bold">Base de fornecedores</h2><p className="mt-1 text-sm text-slate-500">Registros persistidos no Supabase.</p></div><button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white" onClick={() => openForm()} type="button">Novo fornecedor</button></div>
      {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
      {isFormOpen && <form className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-2" onSubmit={handleSubmit}><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-name">Razão social</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-name" maxLength={150} name="name" required defaultValue={editing?.razao_social ?? ''} /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-trade">Nome fantasia</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-trade" maxLength={150} name="tradeName" defaultValue={editing?.nome_fantasia ?? ''} /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-cnpj">CNPJ</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-cnpj" inputMode="numeric" maxLength={18} onChange={(event) => setCnpj(maskCnpj(event.target.value))} required value={cnpj} /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-email">E-mail</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-email" maxLength={150} name="email" required type="email" defaultValue={editing?.email ?? ''} /></div><div><label className="mb-1 block text-xs font-semibold" htmlFor="supplier-phone">Telefone</label><input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" id="supplier-phone" inputMode="tel" maxLength={15} onChange={(event) => setPhone(maskPhone(event.target.value))} required value={phone} /></div>{formError && <p className="text-sm font-medium text-red-700 sm:col-span-2" role="alert">{formError}</p>}<div className="flex gap-2 sm:col-span-2"><button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white" type="submit">Salvar</button><button className="rounded border border-slate-300 px-4 py-2 text-sm" onClick={() => setIsFormOpen(false)} type="button">Cancelar</button></div></form>}
      <div className="mt-5 grid gap-4 sm:grid-cols-3"><div className="rounded-lg bg-blue-50 p-4"><p className="text-sm text-blue-700">Fornecedores ativos</p><p className="mt-1 text-2xl font-bold text-blue-900">{suppliers.filter((supplier) => supplier.ativo).length}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-sm text-slate-700">Total cadastrado</p><p className="mt-1 text-2xl font-bold text-slate-900">{suppliers.length}</p></div><div className="rounded-lg bg-amber-50 p-4"><p className="text-sm text-amber-700">Inativos</p><p className="mt-1 text-2xl font-bold text-amber-900">{suppliers.filter((supplier) => !supplier.ativo).length}</p></div></div>
      <SearchFilters onSearchChange={setSearch} placeholder="Razão social, CNPJ ou e-mail" search={search} filters={[{ label: 'Status', value: status, options: ['ativo', 'inativo'], onChange: setStatus }]} />
      <div className="mt-6 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-400"><tr><th className="pb-3">Fornecedor</th><th className="pb-3">CNPJ</th><th className="pb-3">Contato</th><th className="pb-3">Status</th><th className="pb-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{!loading && filteredSuppliers.map((supplier) => <tr key={supplier.id}><td className="py-4 font-semibold text-slate-800">{supplier.nome_fantasia || supplier.razao_social}</td><td className="py-4 text-slate-600">{supplier.cnpj}</td><td className="py-4 text-slate-600">{supplier.email ?? '-'}</td><td className="py-4">{supplier.ativo ? 'Ativo' : 'Inativo'}</td><td className="flex gap-2 py-4"><button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => openForm(supplier)} type="button">Editar</button><button className="rounded border border-slate-300 px-2 py-1 text-xs" onClick={() => void toggleSupplier(supplier)} type="button">{supplier.ativo ? 'Inativar' : 'Ativar'}</button></td></tr>)}</tbody></table>{loading && <p className="py-8 text-center text-sm text-slate-500">Carregando fornecedores...</p>}{!loading && filteredSuppliers.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum fornecedor cadastrado.</p>}</div>
    </section>
  </ErpShell>;
}
