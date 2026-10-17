import { describe, expect, it } from 'vitest';
import { isSafeText, isValidCnpj, isValidIsoDate, maskCnpj, maskPhone, normalizeSearch } from '../lib/validation';

describe('validation helpers', () => {
  it('formats CNPJ and phone values', () => {
    expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(maskPhone('11987654321')).toBe('(11) 98765-4321');
  });

  it('validates a real CNPJ and rejects invalid values', () => {
    expect(isValidCnpj('11.222.333/0001-13')).toBe(true);
    expect(isValidCnpj('11.222.333/0001-14')).toBe(false);
    expect(isValidCnpj('11111111111111')).toBe(false);
  });

  it('blocks unsafe text and limits searches', () => {
    expect(isSafeText('Fornecedor válido', 30)).toBe(true);
    expect(isSafeText('<script>', 30)).toBe(false);
    expect(normalizeSearch('  produto  ')).toBe('produto');
    expect(normalizeSearch('x'.repeat(110))).toHaveLength(100);
  });

  it('validates calendar dates without accepting normalized invalid dates', () => {
    expect(isValidIsoDate('2024-02-29')).toBe(true);
    expect(isValidIsoDate('2025-02-29')).toBe(false);
    expect(isValidIsoDate('2025-13-01')).toBe(false);
    expect(isValidIsoDate('2025-2-01')).toBe(false);
  });
});
