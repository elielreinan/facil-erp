import { ErpShell } from '../../components/erp-shell';

export default function AuditoriaPage() {
  return <ErpShell eyebrow="Governança" title="Auditoria">
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Histórico de operações</h2><p className="mt-1 text-sm text-slate-500">Cada alteração fica vinculada ao usuário, entidade e centro de custo.</p><div className="mt-5 space-y-3">{[['Hoje, 14:32', 'Administrador', 'alterou', 'Nota fiscal NF 004821', 'Obras - Torre Norte'], ['Hoje, 11:08', 'Mariana Costa', 'criou', 'Orçamento Residencial Torre Norte', 'Obras - Torre Norte'], ['Ontem, 16:45', 'Rafael Souza', 'registrou', 'Ativo Notebook Lenovo E14', 'TI - Equipamentos']].map((event) => <div className="grid gap-2 rounded-lg border border-slate-200 p-4 text-sm sm:grid-cols-[130px_1fr_1fr_1fr] sm:items-center" key={event[0] + event[3]}><span className="text-xs text-slate-400">{event[0]}</span><span className="font-semibold">{event[1]}</span><span className="text-slate-600">{event[2]} {event[3]}</span><span className="text-xs text-slate-500">{event[4]}</span></div>)}</div></section>
  </ErpShell>;
}
