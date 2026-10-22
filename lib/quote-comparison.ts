export type BudgetComparisonItem = {
  id: string;
  supplyId: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

export type QuoteItem = {
  name: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
};

export type PurchasePriceReference = {
  unitPrice: number;
  purchasedAt: string;
};

export type QuoteComparisonRow = {
  name: string;
  unit: string;
  quoteUnit: string | null;
  budgetQuantity: number | null;
  quoteQuantity: number | null;
  budgetUnitPrice: number | null;
  quoteUnitPrice: number | null;
  latestPurchaseUnitPrice: number | null;
  latestPurchaseAt: string | null;
  budgetAmount: number | null;
  quoteAmount: number | null;
  status: 'ok' | 'divergence' | 'missing-from-quote' | 'not-budgeted' | 'ambiguous';
  details: string[];
};

export type QuoteComparison = {
  rows: QuoteComparisonRow[];
  budgetTotal: number;
  quoteTotal: number;
  difference: number;
  matchedCount: number;
  flaggedCount: number;
};

const MAX_CSV_BYTES = 1_048_576;
const MAX_DATA_ROWS = 250;

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ');
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseLocalizedNumber(value: string): number | null {
  let normalized = value.trim().replace(/[R$\s]/gi, '');
  if (!normalized) return null;

  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = normalized.replace(',', '.');
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseDelimitedRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(field);
      field = '';
      if (row.some((value) => value.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('O CSV contém aspas sem fechamento.');
  row.push(field);
  if (row.some((value) => value.trim() !== '')) rows.push(row);
  return rows;
}

function chooseDelimiter(header: string): string {
  let quoted = false;
  const counts = new Map<string, number>([
    [',', 0],
    [';', 0],
    ['\t', 0],
  ]);
  for (let index = 0; index < header.length; index += 1) {
    if (header[index] === '"') quoted = !quoted;
    const count = counts.get(header[index]);
    if (!quoted && count !== undefined) counts.set(header[index], count + 1);
  }
  return [...counts].reduce((best, current) => current[1] > best[1] ? current : best)[0];
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  return headers.findIndex((header) => {
    const normalized = normalize(header).replace(/[^a-z0-9]/g, '').replace(/(brl|rs|r|reais)$/, '');
    return aliases.includes(normalized);
  });
}

export function parseQuoteCsv(text: string): QuoteItem[] {
  if (new TextEncoder().encode(text).length > MAX_CSV_BYTES) {
    throw new Error('O CSV excede o limite de 1 MiB.');
  }

  const content = text.replace(/^\uFEFF/, '').trim();
  if (!content) throw new Error('O CSV está vazio.');

  const rows = parseDelimitedRows(content, chooseDelimiter(content.split(/\r?\n/, 1)[0]));
  const headers = rows[0].map((header) => header.trim());
  const nameIndex = findHeaderIndex(headers, [
    'item', 'insumo', 'produto', 'descricao', 'descricaodoitem', 'descricaodoproduto',
    'itemdescricao', 'produtodescricao', 'nomedoproduto', 'nome', 'name', 'description', 'product',
  ]);
  const unitIndex = findHeaderIndex(headers, [
    'unidade', 'unit', 'un', 'und', 'unidadedemedida', 'unidadeun', 'unidadeund', 'unitofmeasure',
  ]);
  const quantityIndex = findHeaderIndex(headers, [
    'quantidade', 'qtd', 'qty', 'quantity', 'quantidadecotada', 'qtdcotada',
    'quantidadefornecida', 'qtdfornecida',
  ]);
  const priceIndex = findHeaderIndex(headers, [
    'valorunitario', 'precounitario', 'preco', 'unitprice', 'priceperunit',
  ]);

  if (nameIndex < 0 || quantityIndex < 0 || priceIndex < 0) {
    throw new Error('Use as colunas item, quantidade e valor_unitario. Baixe o modelo CSV para ver o formato.');
  }

  const dataRows = rows.slice(1);
  if (dataRows.length === 0) throw new Error('O CSV precisa conter pelo menos um item.');
  if (dataRows.length > MAX_DATA_ROWS) {
    throw new Error(`O CSV pode conter no máximo ${MAX_DATA_ROWS} itens por conferência.`);
  }

  const items = dataRows.map((row, index) => {
    const line = index + 2;
    const name = (row[nameIndex] ?? '').trim();
    const quantity = parseLocalizedNumber(row[quantityIndex] ?? '');
    const unitPrice = parseLocalizedNumber(row[priceIndex] ?? '');
    if (!name || name.length > 160) {
      throw new Error(`Linha ${line}: informe um item com até 160 caracteres.`);
    }
    if (quantity === null || quantity <= 0 || quantity > 99_999_999_999.999) {
      throw new Error(`Linha ${line}: a quantidade deve ser positiva e válida.`);
    }
    if (unitPrice === null || unitPrice < 0 || unitPrice > 999_999_999_999.99) {
      throw new Error(`Linha ${line}: o valor unitário deve ser não negativo e válido.`);
    }
    const unit = unitIndex >= 0 ? (row[unitIndex] ?? '').trim() : '';
    if (unit.length > 30) throw new Error(`Linha ${line}: a unidade deve ter até 30 caracteres.`);
    return { name, unit: unit || undefined, quantity, unitPrice };
  });

  if (new Set(items.map((item) => normalize(item.name))).size !== items.length) {
    throw new Error('O CSV contém itens repetidos. Consolide cada insumo em uma única linha antes de importar.');
  }
  return items;
}

export function decodeQuoteCsv(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  }
  return new TextDecoder('utf-8').decode(bytes);
}

export function compareQuoteToBudget(
  budgetItems: BudgetComparisonItem[],
  quoteItems: QuoteItem[],
  purchasePrices: Readonly<Record<string, PurchasePriceReference>> = {},
): QuoteComparison {
  const budgetByName = new Map<string, BudgetComparisonItem[]>();
  const quoteByName = new Map<string, QuoteItem[]>();
  budgetItems.forEach((item) => {
    const key = normalize(item.name);
    budgetByName.set(key, [...(budgetByName.get(key) ?? []), item]);
  });
  quoteItems.forEach((item) => {
    const key = normalize(item.name);
    quoteByName.set(key, [...(quoteByName.get(key) ?? []), item]);
  });

  const rows: QuoteComparisonRow[] = [];
  let matchedCount = 0;
  for (const quote of quoteItems) {
    const key = normalize(quote.name);
    const candidates = budgetByName.get(key) ?? [];
    const duplicateQuote = (quoteByName.get(key)?.length ?? 0) > 1;

    if (candidates.length !== 1 || duplicateQuote) {
      const ambiguous = candidates.length > 1 || duplicateQuote;
      rows.push({
        name: quote.name,
        unit: candidates.length === 1 ? candidates[0].unit : '—',
        quoteUnit: quote.unit ?? null,
        budgetQuantity: candidates.length === 1 ? candidates[0].quantity : null,
        quoteQuantity: quote.quantity,
        budgetUnitPrice: candidates.length === 1 ? candidates[0].unitPrice : null,
        quoteUnitPrice: quote.unitPrice,
        latestPurchaseUnitPrice: candidates.length === 1
          ? purchasePrices[candidates[0].supplyId]?.unitPrice ?? null
          : null,
        latestPurchaseAt: candidates.length === 1
          ? purchasePrices[candidates[0].supplyId]?.purchasedAt ?? null
          : null,
        budgetAmount: candidates.length === 1
          ? roundCurrency(candidates[0].quantity * candidates[0].unitPrice)
          : null,
        quoteAmount: roundCurrency(quote.quantity * quote.unitPrice),
        status: ambiguous ? 'ambiguous' : 'not-budgeted',
        details: [ambiguous
          ? 'Nome repetido na cotação ou ambíguo no orçamento; confira manualmente.'
          : 'Item não encontrado no orçamento selecionado.'],
      });
      continue;
    }

    const budget = candidates[0];
    const details: string[] = [];
    const latestPurchase = purchasePrices[budget.supplyId];
    if (Math.abs(quote.quantity - budget.quantity) >= 0.0005) {
      details.push('Quantidade diferente do orçamento.');
    }
    if (roundCurrency(quote.unitPrice) !== roundCurrency(budget.unitPrice)) {
      details.push('Preço unitário diferente do orçamento.');
    }
    if (normalize(quote.name) !== normalize(budget.name)) {
      details.push('Confira se os itens correspondem ao mesmo insumo.');
    }
    if (quote.unit && normalize(quote.unit) !== normalize(budget.unit)) {
      details.push('Unidade de medida diferente do orçamento.');
    }
    if (latestPurchase && roundCurrency(quote.unitPrice) !== roundCurrency(latestPurchase.unitPrice)) {
      details.push('Preço cotado diferente da última compra registrada.');
    }
    matchedCount += 1;
    rows.push({
      name: quote.name,
      unit: budget.unit,
      quoteUnit: quote.unit ?? null,
      budgetQuantity: budget.quantity,
      quoteQuantity: quote.quantity,
      budgetUnitPrice: budget.unitPrice,
      quoteUnitPrice: quote.unitPrice,
      latestPurchaseUnitPrice: latestPurchase?.unitPrice ?? null,
      latestPurchaseAt: latestPurchase?.purchasedAt ?? null,
      budgetAmount: roundCurrency(budget.quantity * budget.unitPrice),
      quoteAmount: roundCurrency(quote.quantity * quote.unitPrice),
      status: details.length > 0 ? 'divergence' : 'ok',
      details,
    });
  }

  for (const budget of budgetItems) {
    if ((quoteByName.get(normalize(budget.name)) ?? []).length === 0) {
      rows.push({
        name: budget.name,
        unit: budget.unit,
        quoteUnit: null,
        budgetQuantity: budget.quantity,
        quoteQuantity: null,
        budgetUnitPrice: budget.unitPrice,
        quoteUnitPrice: null,
        latestPurchaseUnitPrice: purchasePrices[budget.supplyId]?.unitPrice ?? null,
        latestPurchaseAt: purchasePrices[budget.supplyId]?.purchasedAt ?? null,
        budgetAmount: roundCurrency(budget.quantity * budget.unitPrice),
        quoteAmount: null,
        status: 'missing-from-quote',
        details: ['Item previsto não aparece na cotação.'],
      });
    }
  }

  const budgetTotal = roundCurrency(budgetItems.reduce(
    (total, item) => total + roundCurrency(item.quantity * item.unitPrice),
    0,
  ));
  const quoteTotal = roundCurrency(quoteItems.reduce(
    (total, item) => total + roundCurrency(item.quantity * item.unitPrice),
    0,
  ));
  return {
    rows,
    budgetTotal,
    quoteTotal,
    difference: roundCurrency(quoteTotal - budgetTotal),
    matchedCount,
    flaggedCount: rows.filter((row) => row.status !== 'ok').length,
  };
}

export function formatQuoteComparisonCsv(comparison: QuoteComparison): string {
  const escape = (value: string | number | null) => {
    let field = value === null
      ? ''
      : typeof value === 'number'
        ? value.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
        : value;
    if (typeof value === 'string' && /^[\s]*[=+\-@]/.test(value)) field = `'${field}`;
    return `"${field.replace(/"/g, '""')}"`;
  };
  const rows = [
    ['Item', 'Unidade orçamento', 'Unidade cotação', 'Qtd. orçamento', 'Qtd. cotação', 'Unitário orçamento', 'Unitário cotação', 'Última compra unitária', 'Data da última compra', 'Total orçamento', 'Total cotação', 'Resultado'],
    ...comparison.rows.map((row) => [
      row.name,
      row.unit,
      row.quoteUnit,
      row.budgetQuantity,
      row.quoteQuantity,
      row.budgetUnitPrice,
      row.quoteUnitPrice,
      row.latestPurchaseUnitPrice,
      row.latestPurchaseAt,
      row.budgetAmount,
      row.quoteAmount,
      row.details.join(' ' ) || 'Sem divergência identificada',
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(escape).join(';')).join('\r\n')}`;
}
