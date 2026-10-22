'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { getCurrentProfile } from '../../lib/current-profile';
import {
  compareQuoteToBudget,
  decodeQuoteCsv,
  formatQuoteComparisonCsv,
  parseQuoteCsv,
  type BudgetComparisonItem,
  type PurchasePriceReference,
  type QuoteItem,
} from '../../lib/quote-comparison';
import {
  parseQuoteAgentResponse,
  type QuoteAgentProvider,
  type QuoteAgentResponse,
} from '../../lib/quote-agent';

type BudgetChoice = {
  id: string;
  name: string;
  status: string;
  items: BudgetComparisonItem[];
};

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const templateCsv = '\uFEFFitem;unidade;quantidade;valor_unitario\r\nCimento;saco;25;32,50\r\nAreia;m³;10;118,00\r\n';
const PURCHASE_PAGE_SIZE = 500;
const MAX_PURCHASE_ROWS = 5_000;

export default function ConferenciaPage() {
  const [budgets, setBudgets] = useState<BudgetChoice[]>([]);
  const [selectedBudgetId, setSelectedBudgetId] = useState('');
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [purchasePrices, setPurchasePrices] = useState<Record<string, PurchasePriceReference>>({});
  const [purchaseStatus, setPurchaseStatus] = useState<
    'checking' | 'ready' | 'restricted' | 'limited' | 'error'
  >('checking');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [agentProvider, setAgentProvider] = useState<QuoteAgentProvider>('openai');
  const [agentConsent, setAgentConsent] = useState(false);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [agentResult, setAgentResult] = useState<QuoteAgentResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { supabase, profile } = await getCurrentProfile();
        if (!profile) {
          window.location.replace('/login');
          return;
        }
        const [budgetResult, itemResult] = await Promise.all([
          supabase.from('orcamentos')
            .select('id,nome_projeto,status')
            .order('criado_em', { ascending: false }),
          supabase.from('orcamento_itens')
            .select('id,orcamento_id,insumo_id,qtd_prevista,valor_previsto_unitario,insumos(nome,unidade_medida)'),
        ]);
        if (budgetResult.error) throw budgetResult.error;
        if (itemResult.error) throw itemResult.error;

        const itemsByBudget = new Map<string, BudgetComparisonItem[]>();
        (itemResult.data ?? []).forEach((item) => {
          const relation = Array.isArray(item.insumos) ? item.insumos[0] : item.insumos;
          if (!relation) return;
          const items = itemsByBudget.get(item.orcamento_id) ?? [];
          items.push({
            id: item.id,
            supplyId: item.insumo_id,
            name: relation.nome,
            unit: relation.unidade_medida,
            quantity: Number(item.qtd_prevista),
            unitPrice: Number(item.valor_previsto_unitario),
          });
          itemsByBudget.set(item.orcamento_id, items);
        });

        const availableBudgets = (budgetResult.data ?? []).map((budget) => ({
          id: budget.id,
          name: budget.nome_projeto,
          status: budget.status,
          items: itemsByBudget.get(budget.id) ?? [],
        }));
        if (active) {
          setBudgets(availableBudgets);
          setSelectedBudgetId(availableBudgets[0]?.id ?? '');
        }
      } catch (caughtError: unknown) {
        console.error('Falha ao carregar dados para conferência:', caughtError);
        if (active) setError('Não foi possível carregar os orçamentos. Confira seu acesso e tente novamente.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const selectedBudget = budgets.find((budget) => budget.id === selectedBudgetId) ?? null;

  useEffect(() => {
    setAgentConsent(false);
    setAgentError('');
    setAgentResult(null);
  }, [selectedBudgetId]);

  useEffect(() => {
    let active = true;
    const budget = budgets.find((item) => item.id === selectedBudgetId);
    setPurchasePrices({});
    if (!budget) {
      setPurchaseStatus('ready');
      return () => { active = false; };
    }

    setPurchaseStatus('checking');
    void (async () => {
      try {
        const { supabase, profile } = await getCurrentProfile();
        if (!profile) {
          window.location.replace('/login');
          return;
        }
        const canReadPurchases = profile.nivel === 'NV3'
          || ['suprimentos', 'diretoria', 'admin'].includes(profile.setor);
        if (!canReadPurchases) {
          if (active) setPurchaseStatus('restricted');
          return;
        }

        const supplyIds = [...new Set(budget.items.map((item) => item.supplyId))];
        if (supplyIds.length === 0) {
          if (active) setPurchaseStatus('ready');
          return;
        }

        const latestPrices: Record<string, PurchasePriceReference> = {};
        let offset = 0;
        let reachedLimit = false;
        while (offset < MAX_PURCHASE_ROWS) {
          const { data, error: purchaseError } = await supabase
            .from('compras_historico')
            .select('id,insumo_id,valor_unitario,data_compra')
            .in('insumo_id', supplyIds)
            .order('data_compra', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + PURCHASE_PAGE_SIZE - 1);
          if (purchaseError) throw purchaseError;

          (data ?? []).forEach((purchase) => {
            if (latestPrices[purchase.insumo_id]) return;
            latestPrices[purchase.insumo_id] = {
              unitPrice: Number(purchase.valor_unitario),
              purchasedAt: purchase.data_compra,
            };
          });
          offset += data?.length ?? 0;
          if ((data?.length ?? 0) < PURCHASE_PAGE_SIZE
            || Object.keys(latestPrices).length === supplyIds.length) break;
          if (offset >= MAX_PURCHASE_ROWS) {
            reachedLimit = true;
            break;
          }
        }
        if (active) {
          setPurchasePrices(latestPrices);
          setPurchaseStatus(reachedLimit ? 'limited' : 'ready');
        }
      } catch (caughtError: unknown) {
        console.error('Falha ao carregar histórico de compras para conferência:', caughtError);
        if (active) setPurchaseStatus('error');
      }
    })();

    return () => {
      active = false;
    };
  }, [budgets, selectedBudgetId]);

  const comparison = useMemo(
    () => selectedBudget && quoteItems.length > 0
      ? compareQuoteToBudget(selectedBudget.items, quoteItems, purchasePrices)
      : null,
    [selectedBudget, quoteItems, purchasePrices],
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    setError('');
    setSuccess('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv') || file.size > 1_048_576) {
      setError('Selecione um arquivo CSV de até 1 MiB. PDF e imagem não são interpretados nesta versão.');
      return;
    }
    try {
      const items = parseQuoteCsv(decodeQuoteCsv(await file.arrayBuffer()));
      setQuoteItems(items);
      setFileName(file.name);
      setAgentConsent(false);
      setAgentError('');
      setAgentResult(null);
      setSuccess(`${items.length} itens carregados localmente. Nenhum arquivo foi enviado.`);
    } catch (caughtError: unknown) {
      setQuoteItems([]);
      setFileName('');
      setError(caughtError instanceof Error ? caughtError.message : 'Não foi possível ler o CSV.');
    }
  }

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'modelo-cotacao-facilerp.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function downloadReport() {
    if (!comparison || !selectedBudget) return;
    const url = URL.createObjectURL(new Blob(
      [formatQuoteComparisonCsv(comparison)],
      { type: 'text/csv;charset=utf-8' },
    ));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `conferencia-${selectedBudget.name.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function clearQuote() {
    setQuoteItems([]);
    setFileName('');
    setError('');
    setSuccess('');
    setAgentConsent(false);
    setAgentError('');
    setAgentResult(null);
  }

  async function requestAgentReview() {
    if (!selectedBudget || quoteItems.length === 0 || !agentConsent || agentLoading) return;
    if (quoteItems.length > 100 || selectedBudget.items.length > 100) {
      setAgentError('A análise do agente aceita no máximo 100 itens cotados e 100 itens no orçamento.');
      return;
    }

    setAgentLoading(true);
    setAgentError('');
    setAgentResult(null);
    setAgentConsent(false);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) {
        window.location.replace('/login');
        return;
      }
      const { data, error: invocationError } = await supabase.functions.invoke('quote-agent', {
        body: {
          provider: agentProvider,
          budgetId: selectedBudget.id,
          quoteItems,
        },
      });
      if (invocationError) {
        throw new Error('O serviço de IA não está configurado ou está indisponível. A comparação local continua funcionando.');
      }
      const result = parseQuoteAgentResponse(data?.result);
      if (!result) throw new Error('O agente retornou uma resposta que não pôde ser validada.');
      setAgentResult(result);
    } catch (caughtError: unknown) {
      setAgentError(caughtError instanceof Error
        ? caughtError.message
        : 'Não foi possível obter a análise do agente.');
    } finally {
      setAgentLoading(false);
    }
  }

  return (
    <ErpShell eyebrow="Módulo de apoio" title="Conferência de cotações">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-xl border border-blue-200 bg-blue-50 p-5 sm:p-6">
          <h2 className="text-lg font-bold text-blue-950">Compare a cotação com o orçamento previsto</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-blue-900">
            Importe os itens de uma cotação em CSV. O FacilERP compara nomes de insumos,
            unidades, quantidades e preços com o orçamento e, para perfis autorizados, com
            o preço unitário da última compra registrada. Diferenças, itens ausentes e excedentes
            são destacados para revisão; nada é alterado nos registros.
          </p>
          <p className="mt-2 text-xs leading-5 text-blue-800">
            A comparação padrão é local. A análise opcional por Claude ou ChatGPT só envia os itens
            estruturados ao provedor após sua confirmação. PDFs e imagens não são enviados nem processados.
          </p>
        </section>

        {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
        {success && <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{success}</p>}
        {purchaseStatus === 'restricted' && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            Seu perfil não tem leitura do histórico de compras. A conferência continuará usando somente o orçamento;
            as permissões por setor não foram ampliadas.
          </p>
        )}
        {purchaseStatus === 'checking' && (
          <p className="text-sm text-slate-500" role="status">Verificando se seu perfil pode consultar preços históricos...</p>
        )}
        {purchaseStatus === 'limited' && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
            A consulta atingiu o limite de 5.000 compras recentes. Para alguns insumos o histórico pode estar incompleto;
            valide diretamente no módulo Suprimentos.
          </p>
        )}
        {purchaseStatus === 'error' && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            Não foi possível consultar o histórico de compras. A comparação com orçamento continua disponível,
            mas os preços históricos não foram verificados.
          </p>
        )}
        {purchaseStatus === 'ready' && selectedBudget && selectedBudget.items.length > 0
          && purchasePrices
          && Object.keys(purchasePrices).length === 0 && (
          <p className="text-sm text-slate-500" role="status">
            Nenhuma compra histórica foi encontrada para os insumos deste orçamento.
          </p>
        )}

        <section className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-800" htmlFor="comparison-budget">
              1. Orçamento de referência
            </label>
            <select
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
              disabled={loading || agentLoading || budgets.length === 0}
              id="comparison-budget"
              onChange={(event) => setSelectedBudgetId(event.target.value)}
              value={selectedBudgetId}
            >
              <option value="">{loading ? 'Carregando orçamentos...' : 'Selecione um orçamento'}</option>
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.name} · {budget.status.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            {selectedBudget && (
              <p className="mt-2 text-xs text-slate-500">
                {selectedBudget.items.length} itens previstos para comparação.
              </p>
            )}
            {!loading && budgets.length === 0 && !error && (
              <p className="mt-2 text-sm text-slate-600">Cadastre um orçamento com itens previstos antes de iniciar a conferência.</p>
            )}
          </div>

          <div>
            <p className="mb-2 block text-sm font-semibold text-slate-800">2. Itens da cotação</p>
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedBudget || agentLoading}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Importar CSV
              </button>
              <input
                accept=".csv,text/csv,text/tab-separated-values"
                aria-label="Selecionar arquivo CSV da cotação"
                className="hidden"
                disabled={!selectedBudget}
                onChange={(event) => void handleFile(event)}
                ref={fileInputRef}
                type="file"
              />
              <button
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                disabled={agentLoading}
                onClick={downloadTemplate}
                type="button"
              >
                Baixar modelo CSV
              </button>
              {quoteItems.length > 0 && (
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  disabled={agentLoading}
                  onClick={clearQuote}
                  type="button"
                >
                  Limpar
                </button>
              )}
            </div>
            {fileName && <p className="mt-2 break-all text-xs text-slate-500">Arquivo lido: {fileName}</p>}
            <p className="mt-2 text-xs text-slate-500">
              Colunas: item, unidade (opcional), quantidade e valor_unitario. Aceita CSV com vírgula,
              ponto e vírgula ou tabulação (UTF-8 e UTF-16). Selecione um orçamento antes de importar.
            </p>
          </div>
        </section>

        {comparison && (
          <>
            <section aria-label="Resumo da conferência" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['Total previsto', currency.format(comparison.budgetTotal)],
                ['Total da cotação', currency.format(comparison.quoteTotal)],
                ['Diferença total', `${comparison.difference > 0 ? '+' : ''}${currency.format(comparison.difference)}`],
                ['Itens para revisar', String(comparison.flaggedCount)],
              ].map(([label, value]) => (
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
                  <p className="text-sm text-slate-500">{label}</p>
                  <p className="mt-2 break-words text-xl font-bold text-slate-900">{value}</p>
                </article>
              ))}
            </section>

            <section className="space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-bold text-violet-950">Revisão opcional por agente de IA</h2>
                <p className="mt-1 text-sm leading-6 text-violet-900">
                  Peça ao Claude ou ChatGPT uma segunda leitura das divergências. A resposta é sugestiva,
                  pode conter erros e não aprova compras nem altera registros.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-medium text-slate-800" htmlFor="quote-agent-provider">
                  Provedor
                </label>
                <select
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  disabled={agentLoading}
                  id="quote-agent-provider"
                  onChange={(event) => {
                    const provider = event.target.value;
                    if (provider !== 'openai' && provider !== 'anthropic') return;
                    setAgentProvider(provider);
                    setAgentConsent(false);
                    setAgentResult(null);
                    setAgentError('');
                  }}
                  value={agentProvider}
                >
                  <option value="openai">ChatGPT (OpenAI)</option>
                  <option value="anthropic">Claude (Anthropic)</option>
                </select>
              </div>
              <label className="flex items-start gap-3 text-sm leading-5 text-slate-800">
                <input
                  checked={agentConsent}
                  className="mt-1"
                  onChange={(event) => {
                    setAgentConsent(event.target.checked);
                    setAgentError('');
                    if (!event.target.checked) setAgentResult(null);
                  }}
                  type="checkbox"
                />
                <span>
                  Autorizo enviar ao provedor selecionado os nomes, unidades, quantidades e preços dos itens
                  desta cotação e do orçamento para análise. Não serão enviados o arquivo, nome do projeto,
                  identidade do usuário ou histórico de compras. O uso pode gerar cobrança na conta de API
                  configurada pelo responsável, e o tratamento dos dados segue os termos do provedor.
                </span>
              </label>
              <button
                className="rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!agentConsent || agentLoading || quoteItems.length === 0}
                onClick={() => void requestAgentReview()}
                type="button"
              >
                {agentLoading ? 'Consultando agente...' : 'Solicitar revisão ao agente'}
              </button>
              {agentError && <p className="text-sm text-red-800" role="alert">{agentError}</p>}
              {agentResult && (
                <div className="space-y-3 rounded-lg border border-violet-200 bg-white p-4" role="status">
                  <h3 className="font-semibold text-slate-900">Revisão do agente (confirme manualmente)</h3>
                  <p className="text-sm text-slate-700">{agentResult.summary}</p>
                  {agentResult.findings.length > 0 && (
                    <ul className="space-y-2 text-sm text-slate-700">
                      {agentResult.findings.map((finding, index) => (
                        <li className="border-l-2 border-violet-300 pl-3" key={`${finding.item}-${index}`}>
                          <span className="font-semibold">{finding.item}</span>
                          <span className="ml-2 text-xs uppercase text-violet-800">
                            {finding.severity === 'review' ? 'Revisar' : 'Informação'}
                          </span>
                          <p>{finding.message}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-xs leading-5 text-violet-900">
                Para proteger chaves e limitar custos, a conexão exige uma Edge Function Supabase publicada e
                chaves/modelos configurados somente como secrets no servidor. Nunca cole uma chave de API no app.
                Limite atual: 5 solicitações por usuário por dia, no máximo 100 itens por lista e resposta curta.
              </p>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
                <div>
                  <h2 className="font-bold text-slate-900">Resultado por item</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {comparison.matchedCount} itens relacionados · {comparison.flaggedCount} linhas sinalizadas
                  </p>
                </div>
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={downloadReport}
                  type="button"
                >
                  Exportar conferência CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Qtd. prevista / cotada</th>
                      <th className="px-4 py-3">Preço unitário previsto / cotado</th>
                      <th className="px-4 py-3">Última compra registrada</th>
                      <th className="px-4 py-3">Total cotado</th>
                      <th className="px-4 py-3">Conferência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.rows.map((row, index) => (
                      <tr className="border-t border-slate-100 align-top" key={`${row.name}-${index}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {row.name}
                          <span className="ml-1 text-xs text-slate-500">
                            ({row.unit}{row.quoteUnit ? ` / cotada: ${row.quoteUnit}` : ''})
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.budgetQuantity ?? '—'} / {row.quoteQuantity ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.budgetUnitPrice === null ? '—' : currency.format(row.budgetUnitPrice)}
                          {' / '}
                          {row.quoteUnitPrice === null ? '—' : currency.format(row.quoteUnitPrice)}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.latestPurchaseUnitPrice === null
                            ? purchaseStatus === 'ready'
                              ? 'Sem registro'
                              : purchaseStatus === 'limited'
                                ? 'Não verificado'
                                : '—'
                            : <>
                              {currency.format(row.latestPurchaseUnitPrice)}
                              {row.latestPurchaseAt && (
                                <span className="block text-xs text-slate-500">
                                  {new Date(row.latestPurchaseAt).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </>}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {row.quoteAmount === null ? '—' : currency.format(row.quoteAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            row.status === 'ok'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.status === 'divergence' || row.status === 'ambiguous'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-red-100 text-red-800'
                          }`}>
                            {row.status === 'ok' ? 'Compatível'
                              : row.status === 'divergence' ? 'Divergência'
                                : row.status === 'ambiguous' ? 'Revisão manual'
                                  : row.status === 'missing-from-quote' ? 'Ausente na cotação'
                                    : 'Fora do orçamento'}
                          </span>
                          {row.details.length > 0 && (
                            <ul className="mt-1 space-y-1 text-xs text-slate-600">
                              {row.details.map((detail) => <li key={detail}>{detail}</li>)}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-600">
                A conferência aponta correspondências exatas de nome e diferenças numéricas; confirme descrição,
                unidade, impostos, frete e condições comerciais no documento original antes de decidir.
              </p>
            </section>
          </>
        )}
      </div>
    </ErpShell>
  );
}
