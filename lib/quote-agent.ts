import type { QuoteItem } from './quote-comparison';

export type QuoteAgentProvider = 'openai' | 'anthropic';

export type QuoteAgentRequest = {
  provider: QuoteAgentProvider;
  budgetId: string;
  quoteItems: QuoteItem[];
};

export type QuoteAgentFinding = {
  item: string;
  severity: 'info' | 'review';
  message: string;
};

export type QuoteAgentResponse = {
  summary: string;
  findings: QuoteAgentFinding[];
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_QUOTE_ITEMS = 100;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

export function parseQuoteAgentRequest(value: unknown): QuoteAgentRequest | null {
  if (!isRecord(value)
    || !hasExactKeys(value, ['provider', 'budgetId', 'quoteItems'])
    || (value.provider !== 'openai' && value.provider !== 'anthropic')
    || typeof value.budgetId !== 'string'
    || !UUID_PATTERN.test(value.budgetId)
    || !Array.isArray(value.quoteItems)
    || value.quoteItems.length < 1
    || value.quoteItems.length > MAX_QUOTE_ITEMS) {
    return null;
  }

  const quoteItems: QuoteItem[] = [];
  const seenNames = new Set<string>();
  for (const valueItem of value.quoteItems) {
    if (!isRecord(valueItem)
      || !hasExactKeys(valueItem, ['name', 'unit', 'quantity', 'unitPrice'])
      || typeof valueItem.name !== 'string'
      || valueItem.name.trim().length === 0
      || valueItem.name.length > 160
      || /[\u0000-\u001f\u007f]/.test(valueItem.name)
      || (valueItem.unit !== undefined
        && (typeof valueItem.unit !== 'string'
          || valueItem.unit.length > 30
          || /[\u0000-\u001f\u007f]/.test(valueItem.unit)))
      || typeof valueItem.quantity !== 'number'
      || !Number.isFinite(valueItem.quantity)
      || valueItem.quantity <= 0
      || valueItem.quantity > 99_999_999_999.999
      || typeof valueItem.unitPrice !== 'number'
      || !Number.isFinite(valueItem.unitPrice)
      || valueItem.unitPrice < 0
      || valueItem.unitPrice > 999_999_999_999.99) {
      return null;
    }

    const key = normalize(valueItem.name);
    if (seenNames.has(key)) return null;
    seenNames.add(key);
    quoteItems.push({
      name: valueItem.name.trim(),
      unit: typeof valueItem.unit === 'string' && valueItem.unit.trim()
        ? valueItem.unit.trim()
        : undefined,
      quantity: valueItem.quantity,
      unitPrice: valueItem.unitPrice,
    });
  }

  return {
    provider: value.provider,
    budgetId: value.budgetId,
    quoteItems,
  };
}

export function parseQuoteAgentResponse(value: unknown): QuoteAgentResponse | null {
  if (!isRecord(value)
    || !hasExactKeys(value, ['summary', 'findings'])
    || typeof value.summary !== 'string'
    || value.summary.trim().length === 0
    || value.summary.length > 500
    || !Array.isArray(value.findings)
    || value.findings.length > 30) {
    return null;
  }

  const findings: QuoteAgentFinding[] = [];
  for (const valueFinding of value.findings) {
    if (!isRecord(valueFinding)
      || !hasExactKeys(valueFinding, ['item', 'severity', 'message'])
      || typeof valueFinding.item !== 'string'
      || valueFinding.item.length > 160
      || /[\u0000-\u001f\u007f]/.test(valueFinding.item)
      || (valueFinding.severity !== 'info' && valueFinding.severity !== 'review')
      || typeof valueFinding.message !== 'string'
      || valueFinding.message.trim().length === 0
      || valueFinding.message.length > 500
      || /[\u0000-\u001f\u007f]/.test(valueFinding.message)) {
      return null;
    }
    findings.push({
      item: valueFinding.item,
      severity: valueFinding.severity,
      message: valueFinding.message,
    });
  }

  return { summary: value.summary, findings };
}
