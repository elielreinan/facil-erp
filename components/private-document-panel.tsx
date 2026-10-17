'use client';

import { FormEvent, useState } from 'react';
import {
  type PrivateDocumentMetadata,
  validatePrivateDocument,
} from '../lib/private-documents';

export function PrivateDocumentPanel<TDocument extends PrivateDocumentMetadata>({
  documents,
  label,
  id,
  disabled,
  onUpload,
  onDownload,
  onDelete,
}: {
  documents: TDocument[];
  label: string;
  id?: string;
  disabled: boolean;
  onUpload: (file: File) => Promise<boolean>;
  onDownload: (document: TDocument) => Promise<void>;
  onDelete: (document: TDocument) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = id ?? `private-document-${label.replace(/[^a-z0-9]/gi, '-')}`;

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy || disabled) return;
    const formElement = event.currentTarget;
    setBusy(true);
    setError('');
    try {
      const uploaded = await onUpload(file);
      if (!uploaded) return;
      setFile(null);
      formElement.reset();
    } catch (caughtError) {
      console.error('Falha no fluxo de anexo privado:', caughtError);
      setError('Não foi possível concluir a operação com o documento.');
    } finally {
      setBusy(false);
    }
  }

  async function runDocumentAction(action: () => Promise<void>) {
    if (busy || disabled) return;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (caughtError) {
      console.error('Falha na operação do documento privado:', caughtError);
      setError('Não foi possível concluir a operação com o documento.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={label} className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold">{label}</h4>
      <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(event) => void submitUpload(event)}>
        <label className="sr-only" htmlFor={inputId}>Selecionar PDF ou XML</label>
        <input
          accept=".pdf,.xml,application/pdf,application/xml,text/xml"
          className="min-w-0 flex-1 text-xs"
          disabled={disabled || busy}
          id={inputId}
          onChange={(event) => {
            const selected = event.currentTarget.files?.[0] ?? null;
            setError('');
            if (!selected) {
              setFile(null);
              return;
            }
            try {
              validatePrivateDocument(selected);
              setFile(selected);
            } catch (caughtError) {
              setFile(null);
              setError(caughtError instanceof Error
                ? caughtError.message
                : 'O arquivo selecionado é inválido.');
            }
          }}
          type="file"
        />
        <button className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50" disabled={!file || disabled || busy} type="submit">
          {busy ? 'Aguarde...' : 'Enviar'}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-700" role="alert">{error}</p>}
      {documents.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {documents.map((document) => (
            <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs" key={document.id}>
              <span className="break-all">{document.nome_arquivo} · {Math.ceil(Number(document.tamanho_bytes) / 1024)} KB</span>
              <span className="flex gap-3">
                <button className="font-semibold text-blue-700" disabled={disabled || busy} onClick={() => void runDocumentAction(() => onDownload(document))} type="button">Baixar</button>
                <button className="font-semibold text-red-700" disabled={disabled || busy} onClick={() => void runDocumentAction(() => onDelete(document))} type="button">Excluir</button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-2 text-xs text-slate-500">Nenhum anexo privado.</p>}
    </section>
  );
}
