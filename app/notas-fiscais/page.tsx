'use client';

import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { ErpShell } from '../../components/erp-shell';
import { PrivateDocumentPanel } from '../../components/private-document-panel';
import { QrScanner } from '../../components/qr-scanner';
import { getCurrentProfile } from '../../lib/current-profile';
import {
  createPrivateDocumentPath,
  deletePrivateDocumentBatch,
  extractInvoiceAccessKey,
  findDuplicateInvoice,
  getInvoiceAccessKeyDetails,
  hasValidDocumentSignature,
  isValidInvoiceAccessKey,
  matchesInvoiceAccessKeyDetails,
  PRIVATE_DOCUMENT_BUCKET,
  type PrivateDocumentMetadata,
  uploadPrivateDocument,
  validatePrivateDocument,
} from '../../lib/private-documents';
import { isSafeText, isValidIsoDate } from '../../lib/validation';

type Invoice = { id: string; numero: string; serie: string | null; chave_acesso: string | null; fornecedor: string; valor_total: number; data_emissao: string; centro_custo_id: string; documents: PrivateDocumentMetadata[] };
type CostCenter = { id: string; codigo: string; nome: string; ativo: boolean };
type InvoiceDocument = PrivateDocumentMetadata & { nota_fiscal_id: string; criado_por: string };

export default function NotasFiscaisPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [centers, setCenters] = useState<CostCenter[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [scannedAccessKey, setScannedAccessKey] = useState('');
  const [matchedInvoice, setMatchedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const scannedDetails = getInvoiceAccessKeyDetails(scannedAccessKey);
  const visibleInvoices = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return invoices.filter((invoice) =>
      `${invoice.numero} ${invoice.serie ?? ''} ${invoice.fornecedor}`
        .toLocaleLowerCase('pt-BR')
        .includes(query),
    );
  }, [invoices, search]);

  async function loadData() {
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const [invoiceResult, centerResult, documentResult] = await Promise.all([
        supabase.from('notas_fiscais').select('id,numero,serie,chave_acesso,fornecedor,valor_total,data_emissao,centro_custo_id').order('data_emissao', { ascending: false }),
        supabase.from('centros_custo').select('id,codigo,nome,ativo').order('nome'),
        supabase.from('nota_fiscal_documentos').select('id,nota_fiscal_id,nome_arquivo,caminho_storage,tipo_mime,tamanho_bytes,criado_por'),
      ]);
      if (invoiceResult.error) throw invoiceResult.error; if (centerResult.error) throw centerResult.error; if (documentResult.error) throw documentResult.error;
      const documentsByInvoice = new Map<string, InvoiceDocument[]>();
      (documentResult.data ?? []).forEach((document) => {
        const existing = documentsByInvoice.get(document.nota_fiscal_id) ?? [];
        existing.push(document);
        documentsByInvoice.set(document.nota_fiscal_id, existing);
      });
      setInvoices((invoiceResult.data ?? []).map((invoice) => ({
        ...invoice,
        documents: documentsByInvoice.get(invoice.id) ?? [],
      })));
      setCenters(centerResult.data ?? []);
      setError('');
    } catch (caughtError) { console.error('Falha ao carregar notas fiscais:', caughtError); setError('Não foi possível carregar as notas fiscais.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void loadData(); }, []);

  function handleScan(value: string) {
    setIsScannerOpen(false);
    const accessKey = extractInvoiceAccessKey(value);
    setScannedCode(accessKey ?? 'Conteúdo QR não reconhecido');
    if (!accessKey) {
      setScannedAccessKey('');
      setMatchedInvoice(null);
      setError('O QR Code não contém uma chave de acesso fiscal de 44 dígitos reconhecida.');
      return;
    }
    const match = invoices.find((invoice) => invoice.chave_acesso === accessKey) ?? null;
    setScannedAccessKey(accessKey);
    setMatchedInvoice(match);
    if (match) {
      setIsFormOpen(false);
      setMessage(`A chave lida já pertence à NF ${match.numero}${match.serie ? `/${match.serie}` : ''}.`);
    } else {
      setEditingInvoice(null);
      setIsFormOpen(true);
      setMessage('Chave fiscal reconhecida. Revise os dados antes de salvar.');
    }
    setError('');
  }

  function openInvoiceForm(invoice?: Invoice) {
    setEditingInvoice(invoice ?? null);
    setScannedAccessKey(invoice?.chave_acesso ?? '');
    setMatchedInvoice(null);
    setIsFormOpen(true);
    setError('');
    setMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(event.currentTarget);
    const number = String(data.get('number') ?? '').trim();
    const supplier = String(data.get('supplier') ?? '').trim();
    const centerId = String(data.get('centerId') ?? '');
    const accessKeyInput = String(data.get('accessKey') ?? '').replace(/\D/g, '');
    const total = Number(data.get('total'));
    const issueDate = String(data.get('issueDate') ?? '');
    const series = String(data.get('series') ?? '').trim() || null;
    if (!isSafeText(number, 30) || !isSafeText(supplier, 150)
      || (!centers.some((center) => center.id === centerId && center.ativo)
        && centerId !== editingInvoice?.centro_custo_id)
      || !isValidIsoDate(issueDate)
      || !Number.isFinite(total) || total < 0 || total > 999_999_999_999.99
      || (accessKeyInput && !isValidInvoiceAccessKey(accessKeyInput))) {
      setError('Preencha número, fornecedor, chave de 44 dígitos (se informada), centro de custo, data e valor válidos.');
      return;
    }
    if (accessKeyInput && !matchesInvoiceAccessKeyDetails(accessKeyInput, {
      number,
      series,
      issueDate,
    })) {
      setError('Número, série e mês/ano de emissão não correspondem à chave fiscal informada.');
      return;
    }
    const duplicate = findDuplicateInvoice(invoices, {
      numero: number,
      serie: series,
      chave_acesso: accessKeyInput || null,
      fornecedor: supplier,
    }, editingInvoice?.id);
    if (duplicate) {
      setError(`Esta nota já está cadastrada como ${duplicate.numero}${duplicate.serie ? `/${duplicate.serie}` : ''}.`);
      return;
    }
    if (!window.confirm(`Confirmar ${editingInvoice ? 'alteração' : 'lançamento'} da NF ${number}?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const payload = { numero: number, serie: series, chave_acesso: accessKeyInput || null, fornecedor: supplier, valor_total: total, data_emissao: issueDate, centro_custo_id: centerId };
      const result = editingInvoice
        ? await supabase.from('notas_fiscais').update(payload).eq('id', editingInvoice.id).select('id').maybeSingle()
        : await supabase.from('notas_fiscais').insert({ ...payload, criado_por: profile.id }).select('id').single();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('The invoice was not saved.');
      setMessage(`NF ${number} ${editingInvoice ? 'alterada' : 'lançada'} com sucesso.`); setError(''); setIsFormOpen(false); setEditingInvoice(null); setScannedAccessKey(''); formElement.reset(); await loadData();
    } catch (caughtError) { console.error('Falha ao salvar nota fiscal:', caughtError); setError('Não foi possível salvar a NF. Verifique duplicidade, chave de acesso e permissões.'); }
    finally { setSaving(false); }
  }

  async function removeInvoice(invoice: Invoice) {
    if (!window.confirm(`Confirmar exclusão da NF ${invoice.numero}?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const deleteInvoice = async () => {
        const { data, error: deleteError } = await supabase.from('notas_fiscais')
          .delete().eq('id', invoice.id).select('id').maybeSingle();
        return { error: deleteError, deleted: Boolean(data) };
      };
      if (invoice.documents.length > 0) {
        await deletePrivateDocumentBatch(
          invoice.documents,
          (document) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).download(document.caminho_storage),
          (document) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([document.caminho_storage]),
          deleteInvoice,
          (document, backup) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(
            document.caminho_storage,
            backup,
            { contentType: document.tipo_mime, upsert: false },
          ),
        );
      } else {
        const result = await deleteInvoice();
        if (result.error) throw result.error;
        if (!result.deleted) throw new Error('The invoice was not deleted.');
      }
      setMessage(`NF ${invoice.numero} excluída com sucesso.`);
      await loadData();
    } catch (caughtError) {
      console.error('Falha ao excluir nota fiscal:', caughtError);
      setError('Não foi possível excluir a nota fiscal.');
    } finally {
      setSaving(false);
    }
  }

  async function downloadInvoiceDocument(document: PrivateDocumentMetadata) {
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      const { data, error: downloadError } = await supabase.storage.from(PRIVATE_DOCUMENT_BUCKET)
        .download(document.caminho_storage);
      if (downloadError) throw downloadError;
      if (!data) throw new Error('The private invoice document could not be downloaded.');
      const objectUrl = URL.createObjectURL(data);
      const anchor = window.document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = document.nome_arquivo;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } finally {
      setSaving(false);
    }
  }

  async function uploadInvoiceDocument(invoice: Invoice, file: File): Promise<boolean> {
    const details = validatePrivateDocument(file);
    if (!await hasValidDocumentSignature(file, details.contentType)) {
      throw new Error('The file content does not match its declared document type.');
    }
    if (!window.confirm(`Enviar "${details.fileName}" para a NF ${invoice.numero}?`)) return false;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return false; }
      const id = crypto.randomUUID();
      const storagePath = createPrivateDocumentPath(
        'notas-fiscais', invoice.id, profile.id, id, details.fileName,
      );
      const metadata = {
        id,
        nota_fiscal_id: invoice.id,
        nome_arquivo: details.fileName,
        caminho_storage: storagePath,
        tipo_mime: details.contentType,
        tamanho_bytes: details.size,
        criado_por: profile.id,
      };
      await uploadPrivateDocument(
        () => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(storagePath, file, {
          contentType: details.contentType,
          upsert: false,
        }),
        async () => await supabase.from('nota_fiscal_documentos').insert(metadata),
        () => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([storagePath]),
      );
      setMessage(`Documento anexado à NF ${invoice.numero} em armazenamento privado.`);
      await loadData();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function removeInvoiceDocument(document: PrivateDocumentMetadata) {
    if (!window.confirm(`Excluir permanentemente o documento "${document.nome_arquivo}"?`)) return;
    setSaving(true);
    try {
      const { supabase, profile } = await getCurrentProfile();
      if (!profile) { window.location.replace('/login'); return; }
      await deletePrivateDocumentBatch(
        [document],
        (item) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).download(item.caminho_storage),
        (item) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).remove([item.caminho_storage]),
        async () => {
          const { data, error: deleteError } = await supabase.from('nota_fiscal_documentos')
            .delete().eq('id', document.id).select('id').maybeSingle();
          return { error: deleteError, deleted: Boolean(data) };
        },
        (item, backup) => supabase.storage.from(PRIVATE_DOCUMENT_BUCKET).upload(
          item.caminho_storage,
          backup,
          { contentType: item.tipo_mime, upsert: false },
        ),
      );
      setMessage(`Documento "${document.nome_arquivo}" excluído.`);
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ErpShell eyebrow="Módulo financeiro" title="Notas fiscais">
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 sm:flex-row">
          <div>
            <h2 className="font-bold">Conferência de documentos</h2>
            <p className="mt-1 text-sm text-slate-500">Notas fiscais persistidas no Supabase.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700"
              disabled={saving}
              onClick={() => setIsScannerOpen((open) => !open)}
              type="button"
            >
              {isScannerOpen ? 'Fechar scanner' : 'Ler QR da NF'}
            </button>
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"
              disabled={saving}
              onClick={() => {
                if (isFormOpen) setIsFormOpen(false);
                else openInvoiceForm();
              }}
              type="button"
            >
              {isFormOpen ? 'Fechar formulário' : 'Lançar NF'}
            </button>
          </div>
        </div>
        {message && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
        {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700" role="alert">{error}</p>}
        {isScannerOpen && (
          <QrScanner
            description="Leia o QR Code fiscal e revise os dados antes de lançar a nota."
            onClose={() => setIsScannerOpen(false)}
            onDetected={handleScan}
            title="Ler QR Code da nota fiscal"
          />
        )}
        {scannedCode && (
          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Código lido para conferência</p>
            <p className="mt-1 break-all font-mono text-sm text-slate-800">{scannedCode}</p>
          </div>
        )}
        {matchedInvoice && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
            <p>Esta chave já existe na NF {matchedInvoice.numero}{matchedInvoice.serie ? `/${matchedInvoice.serie}` : ''}, emitida para {matchedInvoice.fornecedor}.</p>
            <button
              className="mt-2 font-semibold text-blue-700"
              onClick={() => {
                openInvoiceForm(matchedInvoice);
                setMatchedInvoice(null);
              }}
              type="button"
            >
              Abrir cadastro existente
            </button>
          </div>
        )}
        {isFormOpen && (
          <form
            key={`${editingInvoice?.id ?? 'new'}-${scannedAccessKey}`}
            className="mt-5 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 sm:grid-cols-3"
            onSubmit={handleSubmit}
          >
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="invoice-number">Número</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                defaultValue={editingInvoice?.numero ?? scannedDetails?.number ?? ''}
                id="invoice-number"
                maxLength={30}
                name="number"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="invoice-series">Série</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                defaultValue={editingInvoice?.serie ?? scannedDetails?.series ?? ''}
                id="invoice-series"
                maxLength={10}
                name="series"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="invoice-access-key">Chave de acesso (opcional)</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                defaultValue={editingInvoice?.chave_acesso ?? scannedAccessKey}
                id="invoice-access-key"
                inputMode="numeric"
                maxLength={54}
                name="accessKey"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="invoice-supplier">Fornecedor</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                defaultValue={editingInvoice?.fornecedor ?? ''}
                id="invoice-supplier"
                maxLength={150}
                name="supplier"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="invoice-total">Valor total</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                defaultValue={editingInvoice?.valor_total ?? ''}
                id="invoice-total"
                max="999999999999.99"
                min="0"
                name="total"
                required
                step="0.01"
                type="number"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="invoice-date">Emissão</label>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                defaultValue={editingInvoice?.data_emissao ?? ''}
                id="invoice-date"
                name="issueDate"
                required
                type="date"
              />
              {scannedDetails && !editingInvoice && (
                <p className="mt-1 text-xs text-slate-600">
                  A chave informa {scannedDetails.issueYearMonth}; confirme a data completa no documento.
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold" htmlFor="invoice-center">Centro de custo</label>
              <select
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                defaultValue={editingInvoice?.centro_custo_id ?? ''}
                id="invoice-center"
                name="centerId"
                required
              >
                <option disabled value="">Selecione</option>
                {centers.map((center) => (
                  <option
                    disabled={!center.ativo && center.id !== editingInvoice?.centro_custo_id}
                    key={center.id}
                    value={center.id}
                  >
                    {center.codigo} - {center.nome}{center.ativo ? '' : ' (inativo)'}
                  </option>
                ))}
              </select>
            </div>
            <button className="rounded bg-blue-700 px-4 py-2 text-sm font-bold text-white sm:col-span-3" disabled={saving} type="submit">
              {saving ? 'Salvando...' : editingInvoice ? 'Salvar alterações' : 'Salvar nota fiscal'}
            </button>
          </form>
        )}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ['Notas registradas', String(invoices.length)],
            ['Centros disponíveis', String(centers.filter((center) => center.ativo).length)],
            ['Valor acumulado', `R$ ${invoices.reduce((sum, invoice) => sum + invoice.valor_total, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ].map(([label, value]) => (
            <div className="rounded-lg bg-blue-50 p-4" key={label}>
              <p className="text-sm text-blue-700">{label}</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{value}</p>
            </div>
          ))}
        </div>
        <label className="sr-only" htmlFor="invoice-search">Buscar notas fiscais</label>
        <input
          aria-label="Buscar notas fiscais"
          className="mt-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-md"
          id="invoice-search"
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por número, série ou fornecedor"
          type="search"
          value={search}
        />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <caption className="sr-only">Notas fiscais e anexos privados</caption>
            <thead className="border-b text-xs uppercase text-slate-400">
              <tr><th className="pb-3" scope="col">Número</th><th className="pb-3" scope="col">Fornecedor</th><th className="pb-3" scope="col">Emissão</th><th className="pb-3" scope="col">Valor</th><th className="pb-3" scope="col">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleInvoices.map((invoice) => (
                <Fragment key={invoice.id}>
                  <tr>
                    <th className="py-4 text-left font-normal" scope="row">{invoice.numero}{invoice.serie ? `/${invoice.serie}` : ''}</th>
                    <td className="py-4">{invoice.fornecedor}</td>
                    <td className="py-4">{new Date(`${invoice.data_emissao}T00:00:00`).toLocaleDateString('pt-BR')}</td>
                    <td className="py-4">R$ {invoice.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="py-4">
                      <button className="mr-3 font-semibold text-blue-700" disabled={saving} onClick={() => openInvoiceForm(invoice)} type="button">Editar</button>
                      <button className="font-semibold text-red-700" disabled={saving} onClick={() => void removeInvoice(invoice)} type="button">Excluir</button>
                    </td>
                  </tr>
                  <tr>
                    <td className="pb-3" colSpan={5}>
                      <PrivateDocumentPanel
                        id={`invoice-documents-${invoice.id}`}
                        documents={invoice.documents}
                        disabled={saving}
                        label={`Anexos da NF ${invoice.numero}`}
                        onDelete={removeInvoiceDocument}
                        onDownload={downloadInvoiceDocument}
                        onUpload={(file) => uploadInvoiceDocument(invoice, file)}
                      />
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
          {loading && <p className="py-8 text-center text-sm text-slate-500">Carregando notas...</p>}
          {!loading && visibleInvoices.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              {invoices.length === 0 ? 'Nenhuma nota fiscal cadastrada.' : 'Nenhuma nota fiscal corresponde à busca.'}
            </p>
          )}
        </div>
      </section>
    </ErpShell>
  );
}