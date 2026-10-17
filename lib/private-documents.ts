import { isValidIsoDate } from './validation';

export const PRIVATE_DOCUMENT_BUCKET = 'erp-private-documents';
export const PRIVATE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const PRIVATE_DOCUMENT_MIME_TYPES = ['application/pdf', 'application/xml', 'text/xml'] as const;

export type PrivateDocumentMetadata = {
  id: string;
  nome_arquivo: string;
  caminho_storage: string;
  tipo_mime: string;
  tamanho_bytes: number;
};

export type PrivateDocumentDetails = {
  fileName: string;
  contentType: (typeof PRIVATE_DOCUMENT_MIME_TYPES)[number];
  size: number;
};

export type LinkedPrivateDocument = PrivateDocumentMetadata & { tipo_mime: string };

export function validatePrivateDocument(file: File): PrivateDocumentDetails {
  if (!file.size || file.size > PRIVATE_DOCUMENT_MAX_BYTES) {
    throw new Error('O arquivo deve ter entre 1 byte e 10 MB.');
  }

  const extension = file.name.toLowerCase().split('.').pop();
  const contentType = file.type || (
    extension === 'pdf' ? 'application/pdf' :
      extension === 'xml' ? 'application/xml' : ''
  );
  const isPdf = extension === 'pdf' && contentType === 'application/pdf';
  const isXml = extension === 'xml' && ['application/xml', 'text/xml'].includes(contentType);
  if (!isPdf && !isXml) {
    throw new Error('São aceitos somente arquivos PDF ou XML com extensão e tipo compatíveis.');
  }

  const fileName = file.name
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  if (!fileName || fileName === '.' || fileName === '..') {
    throw new Error('O nome do arquivo é inválido.');
  }

  return {
    fileName,
    contentType: contentType as PrivateDocumentDetails['contentType'],
    size: file.size,
  };
}

export async function hasValidDocumentSignature(
  file: File,
  contentType: PrivateDocumentDetails['contentType'],
): Promise<boolean> {
  const prefix = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  if (contentType === 'application/pdf') {
    return prefix.length >= 5
      && prefix[0] === 0x25
      && prefix[1] === 0x50
      && prefix[2] === 0x44
      && prefix[3] === 0x46
      && prefix[4] === 0x2d;
  }

  const text = new TextDecoder().decode(prefix).replace(/^\uFEFF/, '').trimStart();
  return text.startsWith('<');
}

export function createPrivateDocumentPath(
  category: 'orcamentos' | 'notas-fiscais',
  parentId: string,
  profileId: string,
  documentId: string,
  fileName: string,
): string {
  const extension = fileName.toLowerCase().endsWith('.xml') ? 'xml' : 'pdf';
  return `${category}/${parentId}/${profileId}/${documentId}.${extension}`;
}

export function extractInvoiceAccessKey(value: string): string | null {
  const candidate = value.trim();
  if (isValidInvoiceAccessKey(candidate)) return candidate;

  try {
    const parsedUrl = new URL(candidate);
    const queryKey = parsedUrl.searchParams.get('chNFe')
      ?? parsedUrl.searchParams.get('chave')
      ?? parsedUrl.searchParams.get('p')?.split('|')[0];
    if (queryKey && isValidInvoiceAccessKey(queryKey)) return queryKey;
  } catch {
    const embeddedKey = candidate.match(/(?:^|[?&|])(?:chNFe|chave|p)=?(\d{44})(?:[|&]|$)/i)?.[1];
    if (embeddedKey && isValidInvoiceAccessKey(embeddedKey)) return embeddedKey;
  }

  return null;
}

export function isValidInvoiceAccessKey(value: string): boolean {
  if (!/^\d{44}$/.test(value)) return false;
  let weight = 2;
  let sum = 0;
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(value[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  const checkDigit = remainder < 2 ? 0 : 11 - remainder;
  return checkDigit === Number(value[43]);
}

export function getInvoiceAccessKeyDetails(value: string): {
  number: string;
  series: string | null;
  issueYearMonth: string;
} | null {
  if (!isValidInvoiceAccessKey(value)) return null;
  const number = value.slice(25, 34).replace(/^0+(?=\d)/, '');
  const seriesValue = value.slice(22, 25).replace(/^0+(?=\d)/, '');

  return {
    number,
    series: seriesValue === '0' ? null : seriesValue,
    issueYearMonth: `20${value.slice(2, 4)}-${value.slice(4, 6)}`,
  };
}

export function matchesInvoiceAccessKeyDetails(
  value: string,
  invoice: { number: string; series: string | null; issueDate: string },
): boolean {
  const details = getInvoiceAccessKeyDetails(value);
  if (!details || !isValidIsoDate(invoice.issueDate)) return false;

  return details.number === invoice.number.trim().replace(/^0+(?=\d)/, '')
    && details.series === (invoice.series?.trim().replace(/^0+(?=\d)/, '') || null)
    && details.issueYearMonth === invoice.issueDate.slice(0, 7);
}

export function extractAssetId(value: string): string | null {
  const candidate = value.trim();
  const isUuid = (text: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text);
  if (isUuid(candidate)) return candidate;

  try {
    const parsedUrl = new URL(candidate);
    const id = parsedUrl.searchParams.get('asset');
    return id && isUuid(id) ? id : null;
  } catch {
    return null;
  }
}

export type InvoiceIdentity = {
  id: string;
  numero: string;
  serie: string | null;
  chave_acesso: string | null;
  fornecedor: string;
};

export function findDuplicateInvoice(
  invoices: InvoiceIdentity[],
  candidate: Omit<InvoiceIdentity, 'id'>,
  excludingId?: string,
): InvoiceIdentity | null {
  return invoices.find((invoice) => invoice.id !== excludingId && (
    Boolean(candidate.chave_acesso && invoice.chave_acesso === candidate.chave_acesso)
    || (
      invoice.numero.trim().toLowerCase() === candidate.numero.trim().toLowerCase()
      && (invoice.serie ?? '').trim().toLowerCase() === (candidate.serie ?? '').trim().toLowerCase()
      && invoice.fornecedor.trim().toLowerCase() === candidate.fornecedor.trim().toLowerCase()
    )
  )) ?? null;
}

export async function uploadPrivateDocument(
  uploadObject: () => Promise<{ error: { message: string } | null }>,
  saveMetadata: () => Promise<{ error: { message: string } | null }>,
  removeObject: () => Promise<{ error: { message: string } | null }>,
): Promise<void> {
  let uploadError: string | null = null;
  try {
    const uploadResult = await uploadObject();
    uploadError = uploadResult.error?.message ?? null;
  } catch (caughtError) {
    uploadError = caughtError instanceof Error ? caughtError.message : 'The private upload failed.';
  }
  if (uploadError) {
    const rollbackError = await removeAfterFailure(removeObject);
    if (rollbackError) {
      throw new Error(`Upload status is uncertain and cleanup failed: ${rollbackError}`);
    }
    throw new Error(uploadError);
  }

  let metadataError: string | null = null;
  try {
    const metadataResult = await saveMetadata();
    metadataError = metadataResult.error?.message ?? null;
  } catch (caughtError) {
    metadataError = caughtError instanceof Error ? caughtError.message : 'Document metadata could not be saved.';
  }
  if (!metadataError) return;

  const rollbackError = await removeAfterFailure(removeObject);
  if (rollbackError) {
    throw new Error(`Metadata could not be saved and the uploaded file could not be removed: ${rollbackError}`);
  }
  throw new Error(metadataError);
}

export async function deletePrivateDocument(
  downloadObject: () => Promise<{ data: Blob | null; error: { message: string } | null }>,
  removeObject: () => Promise<{ error: { message: string } | null }>,
  deleteMetadata: () => Promise<{ error: { message: string } | null; deleted: boolean }>,
  restoreObject: (backup: Blob) => Promise<{ error: { message: string } | null }>,
): Promise<void> {
  await deletePrivateDocumentBatch(
    [{ id: 'document', caminho_storage: '' }],
    async () => downloadObject(),
    async () => removeObject(),
    async () => deleteMetadata(),
    async (_document, backup) => restoreObject(backup),
  );
}

export async function deletePrivateDocumentBatch<T extends { id: string; caminho_storage: string }>(
  documents: T[],
  downloadObject: (document: T) => Promise<{ data: Blob | null; error: { message: string } | null }>,
  removeObject: (document: T) => Promise<{ error: { message: string } | null }>,
  deleteMetadata: () => Promise<{ error: { message: string } | null; deleted: boolean }>,
  restoreObject: (document: T, backup: Blob) => Promise<{ error: { message: string } | null }>,
): Promise<void> {
  const backups: Array<{ document: T; blob: Blob }> = [];
  for (const document of documents) {
    const result = await downloadObject(document);
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error(`Private file ${document.id} could not be backed up.`);
    backups.push({ document, blob: result.data });
  }

  const removed: typeof backups = [];
  for (const backup of backups) {
    const result = await removeObject(backup.document);
    if (result.error) {
      const rollbackErrors = await restoreRemovedDocuments(removed, restoreObject);
      if (rollbackErrors.length) {
        throw new Error(`File removal failed and rollback was incomplete: ${rollbackErrors.join('; ')}`);
      }
      throw new Error(result.error.message);
    }
    removed.push(backup);
  }

  const metadataResult = await deleteMetadata();
  if (!metadataResult.error && metadataResult.deleted) return;

  const rollbackErrors = await restoreRemovedDocuments(removed, restoreObject);
  if (rollbackErrors.length) {
    throw new Error(`Metadata deletion failed and rollback was incomplete: ${rollbackErrors.join('; ')}`);
  }
  if (metadataResult.error) throw new Error(metadataResult.error.message);
  throw new Error('Document metadata was not deleted.');
}

async function restoreRemovedDocuments<T extends { id: string; caminho_storage: string }>(
  documents: Array<{ document: T; blob: Blob }>,
  restoreObject: (document: T, backup: Blob) => Promise<{ error: { message: string } | null }>,
): Promise<string[]> {
  const errors: string[] = [];
  for (const { document, blob } of documents.reverse()) {
    try {
      const result = await restoreObject(document, blob);
      if (result.error) errors.push(`${document.id}: ${result.error.message}`);
    } catch (caughtError) {
      const detail = caughtError instanceof Error ? caughtError.message : 'Unknown restoration failure.';
      errors.push(`${document.id}: ${detail}`);
    }
  }
  return errors;
}

async function removeAfterFailure(
  removeObject: () => Promise<{ error: { message: string } | null }>,
): Promise<string | null> {
  try {
    const result = await removeObject();
    return result.error?.message ?? null;
  } catch (caughtError) {
    return caughtError instanceof Error ? caughtError.message : 'Unknown object cleanup failure.';
  }
}
