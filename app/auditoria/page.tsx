import { ErpShell } from '../../components/erp-shell';

export default function AuditoriaPage() {
  return <ErpShell eyebrow="Governança" title="Auditoria">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Histórico de operações</h2><p className="mt-1 text-sm text-slate-500">Cada alteração fica vinculada ao usuário, entidade e centro de custo.</p><p className="mt-8 text-center text-sm text-slate-500">Nenhum evento de auditoria registrado.</p></section>
  </ErpShell>;
}
