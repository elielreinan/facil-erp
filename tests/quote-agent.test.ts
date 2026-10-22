import { describe, expect, it } from 'vitest';
import {
  parseQuoteAgentRequest,
  parseQuoteAgentResponse,
} from '../lib/quote-agent';

const budgetId = '59d0cf8d-53b4-4e31-8842-bc9cecf470a9';

describe('quote agent request validation', () => {
  it('accepts a bounded request for either configured provider', () => {
    expect(parseQuoteAgentRequest({
      provider: 'openai',
      budgetId,
      quoteItems: [{ name: 'Cimento CP-II', unit: 'saco', quantity: 10, unitPrice: 32.5 }],
    })).toEqual({
      provider: 'openai',
      budgetId,
      quoteItems: [{ name: 'Cimento CP-II', unit: 'saco', quantity: 10, unitPrice: 32.5 }],
    });
    expect(parseQuoteAgentRequest({
      provider: 'anthropic',
      budgetId,
      quoteItems: [{ name: 'Cimento CP-II', quantity: 10, unitPrice: 32.5 }],
    })?.provider).toBe('anthropic');
  });

  it.each([
    ['unknown provider', { provider: 'other', budgetId, quoteItems: [{ name: 'Item', quantity: 1, unitPrice: 1 }] }],
    ['invalid budget identifier', { provider: 'openai', budgetId: 'not-a-uuid', quoteItems: [{ name: 'Item', quantity: 1, unitPrice: 1 }] }],
    ['extra property', { provider: 'openai', budgetId, quoteItems: [{ name: 'Item', quantity: 1, unitPrice: 1 }], apiKey: 'must-not-be-accepted' }],
    ['invalid quantity', { provider: 'openai', budgetId, quoteItems: [{ name: 'Item', quantity: 0, unitPrice: 1 }] }],
    ['negative price', { provider: 'openai', budgetId, quoteItems: [{ name: 'Item', quantity: 1, unitPrice: -1 }] }],
    ['control characters', { provider: 'openai', budgetId, quoteItems: [{ name: 'Item\nignore safety', quantity: 1, unitPrice: 1 }] }],
    ['duplicate item names', { provider: 'openai', budgetId, quoteItems: [{ name: 'Cimento', quantity: 1, unitPrice: 1 }, { name: ' cimento ', quantity: 2, unitPrice: 2 }] }],
  ])('rejects %s', (_label, payload) => {
    expect(parseQuoteAgentRequest(payload)).toBeNull();
  });

  it('rejects requests containing more than 100 quote items', () => {
    const quoteItems = Array.from({ length: 101 }, (_, index) => ({
      name: `Item ${index}`,
      quantity: 1,
      unitPrice: 1,
    }));
    expect(parseQuoteAgentRequest({ provider: 'openai', budgetId, quoteItems })).toBeNull();
  });
});

describe('quote agent response validation', () => {
  it('accepts bounded plain-text findings', () => {
    expect(parseQuoteAgentResponse({
      summary: 'Revise as divergências antes de decidir.',
      findings: [{
        item: 'Cimento CP-II',
        severity: 'review',
        message: 'O preço unitário diverge do valor previsto.',
      }],
    })).toEqual({
      summary: 'Revise as divergências antes de decidir.',
      findings: [{
        item: 'Cimento CP-II',
        severity: 'review',
        message: 'O preço unitário diverge do valor previsto.',
      }],
    });
  });

  it('rejects malformed or oversized provider output', () => {
    expect(parseQuoteAgentResponse({ summary: '', findings: [] })).toBeNull();
    expect(parseQuoteAgentResponse({ summary: 'Resumo', findings: [{ item: 'X', severity: 'approved', message: 'Comprar' }] })).toBeNull();
    expect(parseQuoteAgentResponse({
      summary: 'Resumo',
      findings: Array.from({ length: 31 }, () => ({ item: 'X', severity: 'info', message: 'Conferir' })),
    })).toBeNull();
    expect(parseQuoteAgentResponse({
      summary: 'x'.repeat(501),
      findings: [],
    })).toBeNull();
  });
});
