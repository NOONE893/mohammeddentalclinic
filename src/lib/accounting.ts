// Pure double-entry helpers used by the accounting reports.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";

export const ACCOUNT_TYPES: Record<AccountType, string> = {
  asset: "الأصول",
  liability: "الخصوم",
  equity: "حقوق الملكية",
  revenue: "الإيرادات",
  expense: "المصروفات",
};

export interface BalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Assets and expenses grow with debits; liabilities, equity and revenue grow with credits. */
export function isDebitNormal(type: string) {
  return type === "asset" || type === "expense";
}

export function balanceOf(row: Pick<BalanceRow, "type" | "debit" | "credit">) {
  const d = Number(row.debit) || 0;
  const c = Number(row.credit) || 0;
  return r2(isDebitNormal(row.type) ? d - c : c - d);
}

export function trialBalance(rows: BalanceRow[]) {
  const lines = rows
    .map((r) => {
      const net = r2((Number(r.debit) || 0) - (Number(r.credit) || 0));
      return { ...r, debitBal: net > 0 ? net : 0, creditBal: net < 0 ? -net : 0 };
    })
    .filter((r) => r.debitBal !== 0 || r.creditBal !== 0);
  const totalDebit = r2(lines.reduce((s, l) => s + l.debitBal, 0));
  const totalCredit = r2(lines.reduce((s, l) => s + l.creditBal, 0));
  return { lines, totalDebit, totalCredit, balanced: totalDebit === totalCredit };
}

export function incomeStatement(rows: BalanceRow[]) {
  const revenue = rows.filter((r) => r.type === "revenue").map((r) => ({ ...r, amount: balanceOf(r) })).filter((r) => r.amount !== 0);
  const expenses = rows.filter((r) => r.type === "expense").map((r) => ({ ...r, amount: balanceOf(r) })).filter((r) => r.amount !== 0);
  const totalRevenue = r2(revenue.reduce((s, r) => s + r.amount, 0));
  const totalExpenses = r2(expenses.reduce((s, r) => s + r.amount, 0));
  return { revenue, expenses, totalRevenue, totalExpenses, netIncome: r2(totalRevenue - totalExpenses) };
}

/** Balance sheet as of a date: unclosed profit for all time up to that date is shown inside equity. */
export function balanceSheet(rows: BalanceRow[]) {
  const pick = (t: AccountType) => rows.filter((r) => r.type === t).map((r) => ({ ...r, amount: balanceOf(r) })).filter((r) => r.amount !== 0);
  const assets = pick("asset");
  const liabilities = pick("liability");
  const equity = pick("equity");
  const earnings = incomeStatement(rows).netIncome;
  const totalAssets = r2(assets.reduce((s, r) => s + r.amount, 0));
  const totalLiabilities = r2(liabilities.reduce((s, r) => s + r.amount, 0));
  const totalEquity = r2(equity.reduce((s, r) => s + r.amount, 0) + earnings);
  return {
    assets, liabilities, equity, earnings, totalAssets, totalLiabilities, totalEquity,
    balanced: totalAssets === r2(totalLiabilities + totalEquity),
  };
}

export interface DraftJournalLine { account_id: string; debit: number; credit: number }

export function entryTotals(lines: DraftJournalLine[]) {
  const debit = r2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const credit = r2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  const valid = lines.filter((l) => l.account_id && ((Number(l.debit) || 0) > 0) !== ((Number(l.credit) || 0) > 0));
  return { debit, credit, balanced: debit > 0 && debit === credit && valid.length === lines.length && lines.length >= 2 };
}

/** ZATCA (Saudi e-invoicing phase 1) QR payload: TLV fields encoded as base64. */
export function zatcaQr(seller: string, vatNumber: string, timestampIso: string, total: number, vat: number) {
  const enc = new TextEncoder();
  const fields = [seller, vatNumber, timestampIso, total.toFixed(2), vat.toFixed(2)];
  const bytes: number[] = [];
  fields.forEach((v, i) => {
    const b = enc.encode(v);
    bytes.push(i + 1, b.length, ...b);
  });
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
