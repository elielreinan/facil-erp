export type BudgetAmountLine = {
  quantity: number;
  unitValue: number;
};

export function calculateLineAmount(quantity: number, unitValue: number): number {
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitValue) || unitValue < 0) {
    return 0;
  }
  return Math.round(quantity * unitValue * 100) / 100;
}

export function sumLineAmounts(lines: BudgetAmountLine[]): number {
  const cents = lines.reduce(
    (total, line) => total + Math.round(calculateLineAmount(line.quantity, line.unitValue) * 100),
    0,
  );
  return cents / 100;
}
