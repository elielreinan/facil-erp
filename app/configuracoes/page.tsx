'use client';

import { useState } from 'react';
import { ErpShell } from '../../components/erp-shell';

const serverErrors = [
  ['14/10/2026 13:57:08', 'ERROR', 'Supabase request failed: timeout while loading nota_fiscal NF 004809'],
  ['14/10/2026 13:42:11', 'ERROR', 'Storage upload failed: invoice-004801.xml returned status 500'],
  ['14/10/2026 12:16:47', 'WARN', 'Database connection retry 2/3'],
];

export default function ConfiguracoesPage() {
  const [message, setMessage] = useState('');
  function savePreferences() {
    if (!window.confirm('Confirmar salvamento das preferências neste computador?')) return;
    setMessage('Preferências salvas em modo demonstração.');
  }
  function exportErrors() {
    const content = serverErrors.map((error) => `[${error[0]}] ${error[1]} ${error[2]}`).join('\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'facilerp-erros-servidor.txt';
    link.click();
    URL.revokeObjectURL(url);
    setMessage('Log de erros exportado.');
  }
  return <ErpShell eyebrow="Administração do aplicativo" title="Configurações">
    {message && <p className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
    <section aria-labelledby="preferences-title" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold" id="preferences-title">Preferências</h2>
      <p className="mt-1 text-sm text-slate-500">Ajustes locais da interface deste computador.</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4"><input aria-label="Ativar modo de alto contraste" className="mt-1 h-4 w-4 accent-blue-600" type="checkbox" /><span><span className="block text-sm font-semibold">Alto contraste</span><span className="mt-1 block text-xs text-slate-500">Facilita a leitura.</span></span></label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4"><input aria-label="Confirmar ações críticas" className="mt-1 h-4 w-4 accent-blue-600" defaultChecked type="checkbox" /><span><span className="block text-sm font-semibold">Confirmar ações críticas</span><span className="mt-1 block text-xs text-slate-500">Evita alterações acidentais.</span></span></label>
        <div><label className="mb-2 block text-sm font-semibold" htmlFor="density">Densidade da tela</label><select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100" defaultValue="comfortable" id="density"><option value="comfortable">Confortável</option><option value="compact">Compacta</option></select></div>
      </div>
      <button className="mt-5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={savePreferences} type="button">Salvar preferências</button>
    </section>
    <section aria-labelledby="diagnostics-title" className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-bold" id="diagnostics-title">Diagnóstico do servidor</h2><p className="mt-1 text-sm text-slate-500">Eventos de erro retornados pelos serviços do FacilERP.</p></div><span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">Versão 0.1.0</span></div>
      <div aria-label="Terminal de erros do servidor" className="mt-5 overflow-x-auto rounded-lg bg-[#0b1220] p-4 font-mono text-xs leading-6 text-slate-200" role="region" tabIndex={0}><div className="mb-3 border-b border-slate-700 pb-2 text-slate-400">$ facil-erp server --errors --tail=3</div>{serverErrors.map((error) => <div className="whitespace-nowrap" key={error[0]}><span className="text-slate-500">[{error[0]}]</span> <span className={error[1] === 'ERROR' ? 'text-red-400' : 'text-amber-300'}>{error[1]}</span> <span>{error[2]}</span></div>)}</div>
      <div className="mt-4 flex justify-end"><button className="text-sm font-bold text-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-300" onClick={exportErrors} type="button">Exportar erros</button></div>
    </section>
  </ErpShell>;
}
