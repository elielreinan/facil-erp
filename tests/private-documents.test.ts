import { describe, expect, it } from 'vitest';
import {
  createPrivateDocumentPath,
  deletePrivateDocumentBatch,
  extractAssetId,
  extractInvoiceAccessKey,
  getInvoiceAccessKeyDetails,
  findDuplicateInvoice,
  hasValidDocumentSignature,
  isValidInvoiceAccessKey,
  matchesInvoiceAccessKeyDetails,
  uploadPrivateDocument,
  validatePrivateDocument,
} from '../lib/private-documents';

const accessKey = '35261012345678000123550010000000011000000010';
const assetId = '80000000-0000-4000-8000-000000000001';

describe('private document and QR helpers', () => {
  it('extracts only a 44-digit invoice key from supported QR formats', () => {
    const supportedQrContents = [
      accessKey,
      `https://www.nfe.fazenda.gov.br/consulta?chNFe=${accessKey}`,
      `https://www.sefaz.rs.gov.br/NFCE/QRCode?p=${accessKey}|2|1|1|`,
      `chNFe=${accessKey}`,
      `chave=${accessKey}`,
    ];
    supportedQrContents.forEach((content) => {
      expect(extractInvoiceAccessKey(content)).toBe(accessKey);
    });
    expect(isValidInvoiceAccessKey(accessKey)).toBe(true);
    expect(isValidInvoiceAccessKey(`${accessKey.slice(0, 43)}1`)).toBe(false);
    expect(extractInvoiceAccessKey('https://example.test/?token=secret')).toBeNull();
    expect(extractInvoiceAccessKey(`https://example.test/?token=${accessKey}`)).toBeNull();
    expect(extractInvoiceAccessKey(`https://example.test/?chNFe=${accessKey.slice(0, 43)}1`)).toBeNull();
    expect(getInvoiceAccessKeyDetails(accessKey)).toEqual({
      number: '1',
      series: '1',
      issueYearMonth: '2026-10',
    });
    expect(matchesInvoiceAccessKeyDetails(accessKey, {
      number: '000000001',
      series: '001',
      issueDate: '2026-10-31',
    })).toBe(true);
    expect(matchesInvoiceAccessKeyDetails(accessKey, {
      number: '2',
      series: '1',
      issueDate: '2026-10-31',
    })).toBe(false);
    expect(matchesInvoiceAccessKeyDetails(accessKey, {
      number: '1',
      series: '1',
      issueDate: '2026-09-30',
    })).toBe(false);
  });

  it('resolves only UUID asset identifiers from labels', () => {
    expect(extractAssetId(assetId)).toBe(assetId);
    expect(extractAssetId(`facilerp://patrimonio/${assetId}`)).toBe(assetId);
    expect(extractAssetId(`https://facilerp.test/asset?asset=${assetId}`)).toBe(assetId);
    expect(extractAssetId(`facilerp://outro/${assetId}`)).toBeNull();
    expect(extractAssetId(`facilerp://patrimonio/${assetId}?redirect=https://evil.test`)).toBeNull();
    expect(extractAssetId('https://facilerp.test/?asset=1')).toBeNull();
  });

  it('creates a private Storage path scoped to each asset and uploader', () => {
    expect(createPrivateDocumentPath(
      'patrimonio',
      assetId,
      '90000000-0000-4000-8000-000000000001',
      'a0000000-0000-4000-8000-000000000001',
      'manual de uso.pdf',
    )).toBe('patrimonio/80000000-0000-4000-8000-000000000001/90000000-0000-4000-8000-000000000001/a0000000-0000-4000-8000-000000000001.pdf');
  });

  it('checks document extension, MIME, size and leading file signature', async () => {
    const validPdf = new File(['%PDF-1.7\nbody'], 'invoice.pdf', { type: 'application/pdf' });
    const mislabeledPdf = new File(['<html>not a PDF'], 'invoice.pdf', { type: 'application/pdf' });
    expect(validatePrivateDocument(validPdf).contentType).toBe('application/pdf');
    await expect(hasValidDocumentSignature(validPdf, 'application/pdf')).resolves.toBe(true);
    await expect(hasValidDocumentSignature(mislabeledPdf, 'application/pdf')).resolves.toBe(false);
    expect(() => validatePrivateDocument(
      new File(['text'], 'invoice.pdf', { type: 'text/plain' }),
    )).toThrow('extensão e tipo compatíveis');
  });

  it('detects invoice duplicates by access key or normalized invoice identity', () => {
    const registered = [{
      id: 'invoice-1',
      numero: ' 001 ',
      serie: null,
      chave_acesso: accessKey,
      fornecedor: 'Empresa Exemplo',
    }];

    expect(findDuplicateInvoice(registered, {
      numero: '99',
      serie: null,
      chave_acesso: accessKey,
      fornecedor: 'Outra empresa',
    })?.id).toBe('invoice-1');
    expect(findDuplicateInvoice(registered, {
      numero: '001',
      serie: '',
      chave_acesso: null,
      fornecedor: 'empresa exemplo',
    })?.id).toBe('invoice-1');
    expect(findDuplicateInvoice(registered, {
      numero: '001',
      serie: null,
      chave_acesso: accessKey,
      fornecedor: 'Empresa Exemplo',
    }, 'invoice-1')).toBeNull();
  });

  it('removes an uploaded object when saving its metadata fails', async () => {
    const operations: string[] = [];
    await expect(uploadPrivateDocument(
      async () => { operations.push('upload'); return { error: null }; },
      async () => { operations.push('metadata'); return { error: { message: 'metadata failed' } }; },
      async () => { operations.push('rollback'); return { error: null }; },
    )).rejects.toThrow('metadata failed');
    expect(operations).toEqual(['upload', 'metadata', 'rollback']);
  });

  it('restores previously removed objects when database deletion fails', async () => {
    const operations: string[] = [];
    const blob = new Blob(['private document']);
    await expect(deletePrivateDocumentBatch(
      [{ id: 'document-1', caminho_storage: 'path-1' }],
      async () => ({ data: blob, error: null }),
      async () => { operations.push('remove'); return { error: null }; },
      async () => ({ error: { message: 'database failed' }, deleted: false }),
      async (_document, backup) => {
        expect(backup).toBe(blob);
        operations.push('restore');
        return { error: null };
      },
    )).rejects.toThrow('database failed');
    expect(operations).toEqual(['remove', 'restore']);
  });
});
