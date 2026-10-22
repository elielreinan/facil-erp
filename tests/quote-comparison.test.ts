import { describe, expect, it } from 'vitest';
import {
  compareQuoteToBudget,
  decodeQuoteCsv,
  formatQuoteComparisonCsv,
  parseQuoteCsv,
  type BudgetComparisonItem,
} from '../lib/quote-comparison';

const budgetItems: BudgetComparisonItem[] = [
  { id: 'cement', supplyId: 'supply-cement', name: 'Cimento CP-II', unit: 'saco', quantity: 10, unitPrice: 32.5 },
  { id: 'sand', supplyId: 'supply-sand', name: 'Areia média', unit: 'm³', quantity: 2, unitPrice: 118 },
];

function encodeUtf16(value: string, bigEndian = false): ArrayBuffer {
  const bytes = new Uint8Array(2 + value.length * 2);
  bytes[0] = bigEndian ? 0xfe : 0xff;
  bytes[1] = bigEndian ? 0xff : 0xfe;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    bytes[2 + index * 2] = bigEndian ? code >> 8 : code & 0xff;
    bytes[3 + index * 2] = bigEndian ? code & 0xff : code >> 8;
  }
  return bytes.buffer;
}

describe('quote comparison', () => {
  it('parses UTF-8 semicolon CSV with Brazilian decimal and thousands formats', () => {
    expect(parseQuoteCsv('\uFEFFitem;unidade;quantidade;valor_unitario\r\nCimento CP-II;saco;10;32,50\r\n"Aço, CA-50";kg;1,250;1.234,56\r\n')).toEqual([
      { name: 'Cimento CP-II', unit: 'saco', quantity: 10, unitPrice: 32.5 },
      { name: 'Aço, CA-50', unit: 'kg', quantity: 1.25, unitPrice: 1234.56 },
    ]);
  });

  it('accepts comma-delimited CSV with quoted fields', () => {
    expect(parseQuoteCsv('produto,quantidade,preço unitário\n"Aço, CA-50",2,12.75')).toEqual([
      { name: 'Aço, CA-50', quantity: 2, unitPrice: 12.75 },
    ]);
  });

  it.each([false, true])('imports Excel-style UTF-16 %s and tab-delimited CSV', (bigEndian) => {
    const csv = 'Descrição do item\tUnidade de medida\tQtd.\tPreço unitário\r\nCimento CP-II\tsaco\t10\t32,50\r\n';
    expect(parseQuoteCsv(decodeQuoteCsv(encodeUtf16(csv, bigEndian)))).toEqual([
      { name: 'Cimento CP-II', unit: 'saco', quantity: 10, unitPrice: 32.5 },
    ]);
  });

  it('recognizes common supplier headers with unit and currency suffixes', () => {
    expect(parseQuoteCsv(
      'Descrição do produto;Unidade (UN);Qtd. Cotada;Valor Unitário (R$)\nCimento CP-II;saco;10;32,50',
    )).toEqual([
      { name: 'Cimento CP-II', unit: 'saco', quantity: 10, unitPrice: 32.5 },
    ]);
  });

  it('rejects malformed, duplicated, oversized, or invalid input', () => {
    expect(() => parseQuoteCsv('item;quantidade;valor_unitario\nCimento;0;4')).toThrow('quantidade deve ser positiva');
    expect(() => parseQuoteCsv('item;quantidade;valor_unitario\nCimento;1;-1')).toThrow('valor unitário deve ser não negativo');
    expect(() => parseQuoteCsv('item;quantidade;valor_unitario\nCimento;1;4\ncimento;2;5')).toThrow('itens repetidos');
    expect(() => parseQuoteCsv('item;quantidade;valor_unitario\n"aberto;1;4')).toThrow('aspas sem fechamento');
    expect(() => parseQuoteCsv('item;quantidade;valor_unitario\nx;1;1'.repeat(100_000))).toThrow('1 MiB');
  });

  it('highlights price, quantity, missing and unbudgeted items without writing data', () => {
    const result = compareQuoteToBudget(budgetItems, [
      { name: 'CIMENTO cp-ii', quantity: 10, unitPrice: 35 },
      { name: 'Madeira', quantity: 1, unitPrice: 80 },
    ]);

    expect(result.rows.map((row) => row.status)).toEqual([
      'divergence',
      'not-budgeted',
      'missing-from-quote',
    ]);
    expect(result.rows[0].details).toContain('Preço unitário diferente do orçamento.');
    expect(result.budgetTotal).toBe(561);
    expect(result.quoteTotal).toBe(430);
    expect(result.difference).toBe(-131);
    expect(result.flaggedCount).toBe(3);
  });

  it('marks duplicate budget names as requiring manual review', () => {
    const result = compareQuoteToBudget(
      [budgetItems[0], { ...budgetItems[0], id: 'cement-2' }],
      [{ name: 'Cimento CP-II', quantity: 1, unitPrice: 30 }],
    );
    expect(result.rows[0].status).toBe('ambiguous');
  });

  it('compares a quoted price with the latest purchase reference when supplied', () => {
    const result = compareQuoteToBudget(
      [budgetItems[0]],
      [{ name: 'Cimento CP-II', unit: 'saco', quantity: 10, unitPrice: 35 }],
      {
        'supply-cement': { unitPrice: 30, purchasedAt: '2026-10-01T12:00:00Z' },
      },
    );

    expect(result.rows[0].latestPurchaseUnitPrice).toBe(30);
    expect(result.rows[0].latestPurchaseAt).toBe('2026-10-01T12:00:00Z');
    expect(result.rows[0].details).toContain('Preço cotado diferente da última compra registrada.');
  });

  it('exports the result as an escaped UTF-8 CSV report', () => {
    const result = compareQuoteToBudget(
      [{ ...budgetItems[0], name: 'Cimento "CP-II"' }],
      [{ name: 'Cimento "CP-II"', quantity: 10, unitPrice: 32.5 }],
    );
    const report = formatQuoteComparisonCsv(result);
    expect(report.startsWith('\uFEFF')).toBe(true);
    expect(report).toContain('"Cimento ""CP-II"""');
    expect(report).toContain('"32,5"');
    expect(report).toContain('"Sem divergência identificada"');
  });

  it('flags unit mismatch and neutralizes spreadsheet formulas in exported names', () => {
    const result = compareQuoteToBudget(
      [budgetItems[0]],
      [
        { name: 'Cimento CP-II', unit: 'kg', quantity: 10, unitPrice: 32.5 },
        { name: '=IMPORTAR()', quantity: 1, unitPrice: 0 },
      ],
    );

    expect(result.rows[0].details).toContain('Unidade de medida diferente do orçamento.');
    expect(formatQuoteComparisonCsv(result)).toContain(`"'=IMPORTAR()"`);
  });
});
