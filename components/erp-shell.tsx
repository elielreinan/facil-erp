'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

const modules = [
  ['boxes', 'Suprimentos', '/suprimentos'],
  ['package', 'Produtos', '/produtos'],
  ['building', 'Fornecedores', '/fornecedores'],
  ['file', 'Notas fiscais', '/notas-fiscais'],
  ['chart', 'Orçamentos', '/orcamentos'],
  ['report', 'Relatórios', '/relatorios'],
  ['monitor', 'Patrimônio', '/patrimonio'],
  ['history', 'Auditoria', '/auditoria'],
  ['settings', 'Configurações', '/configuracoes'],
];

function ModuleIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    boxes: 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9Zm8 4.5 8-4.5M12 12v9M4 7.5 12 12',
    package: 'm12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 0v9m8-4.5-8 4.5m-8-4.5 8 4.5',
    building: 'M4 21V5l8-2 8 2v16M4 21h16M8 8h2m4 0h2M8 12h2m4 0h2M8 16h2m4 0h2',
    file: 'M6 3h9l3 3v15H6V3Zm9 0v4h4M9 12h6m-6 4h6',
    chart: 'M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8',
    report: 'M5 3h14v18H5V3Zm3 4h8M8 11h8M8 15h5',
    monitor: 'M4 4h16v12H4V4Zm6 16h4m-6 0h8',
    history: 'M4 12a8 8 0 1 0 2.3-5.6L4 8.7M4 4v4.7h4.7M12 8v4l2.5 1.5',
    settings: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-5v2m0 13v2m9-8h-2m-14 0H3m15.4-6.4-1.4 1.4M7 17l-1.4 1.4m12.8 0L17 17M7 7 5.6 5.6',
  };
  return <svg aria-hidden="true" className="h-5 w-5" fill="none" focusable="false" viewBox="0 0 24 24"><path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>;
}

export function ErpShell({ children, eyebrow, title }: {
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [highContrast, setHighContrast] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const applyPreferences = () => {
      setHighContrast(localStorage.getItem('facilerp.highContrast') === 'true');
      setCompact(localStorage.getItem('facilerp.density') === 'compact');
    };
    applyPreferences();
    window.addEventListener('facilerp:preferences-changed', applyPreferences);
    let active = true;
    getSupabaseClient().auth.getUser().then(({ data, error }) => {
      if (active && (error || !data.user)) router.replace('/login');
    }).catch((error: unknown) => {
      console.error('Falha ao validar sessão:', error);
      if (active) router.replace('/login');
    });
    return () => {
      active = false;
      window.removeEventListener('facilerp:preferences-changed', applyPreferences);
    };
  }, [router]);

  return (
    <main className={`min-h-screen bg-[#f5f7fb] text-slate-900 ${highContrast ? 'erp-high-contrast' : ''} ${compact ? 'erp-compact' : ''}`}>
      <aside className="fixed inset-y-0 left-0 z-20 flex w-56 flex-col bg-[#102a43] text-white shadow-xl sm:w-64">
        <div className="border-b border-white/10 px-6 py-6">
          <p className="text-xs font-bold tracking-[0.22em] text-blue-300">FACIL ERP</p>
          <p className="mt-2 text-xs text-slate-300">Gestão integrada</p>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Módulos</p>
          {modules.map(([icon, label, href]) => (
            <Link
              aria-current={pathname === href ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2 focus:ring-offset-[#102a43] ${pathname === href ? 'bg-blue-600 font-semibold' : 'text-slate-300 hover:bg-white/10'}`}
              href={href}
              key={href}
            >
              <span className="w-5 text-center text-base"><ModuleIcon name={icon} /></span>{label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/10 p-3">
            <div aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-xs font-bold">AD</div>
            <div><p className="text-sm font-semibold">Administrador</p><p className="text-[11px] text-slate-300">NV3 · Diretoria</p></div>
          </div>
        </div>
      </aside>
      <div className="pl-56 sm:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
          <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">{eyebrow}</p><h1 className="mt-1 text-xl font-bold">{title}</h1></div>
          <div className="flex items-center gap-3"><span className="hidden text-sm text-slate-500 sm:block">Ambiente corporativo</span><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">AD</div></div>
        </header>
        <div className="p-5 sm:p-8">{children}</div>
      </div>
    </main>
  );
}
