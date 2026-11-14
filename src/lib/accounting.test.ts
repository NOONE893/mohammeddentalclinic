import { describe, expect, it } from "vitest";
import { balanceSheet, entryTotals, incomeStatement, trialBalance, zatcaQr, type BalanceRow } from "./accounting";

// Invoice 1000 + 15% VAT with 100 discount, half collected in cash, rent 300 paid from bank, capital 5000 in bank.
const rows: BalanceRow[] = [
  { account_id: "1", code: "1010", name: "الصندوق", type: "asset", debit: 517.5, credit: 0 },
  { account_id: "2", code: "1020", name: "البنك", type: "asset", debit: 5000, credit: 300 },
  { account_id: "3", code: "1100", name: "ذمم المرضى", type: "asset", debit: 1035, credit: 517.5 },
  { account_id: "4", code: "2100", name: "ضريبة", type: "liability", debit: 0, credit: 135 },
  { account_id: "5", code: "3000", name: "رأس المال", type: "equity", debit: 0, credit: 5000 },
  { account_id: "6", code: "4100", name: "إيرادات", type: "revenue", debit: 0, credit: 1000 },
  { account_id: "7", code: "4900", name: "خصومات", type: "revenue", debit: 100, credit: 0 },
  { account_id: "8", code: "5200", name: "إيجار", type: "expense", debit: 300, credit: 0 },
];

describe("accounting reports", () => {
  it("trial balance debits equal credits", () => {
    const tb = trialBalance(rows);
    expect(tb.totalDebit).toBe(tb.totalCredit);
    expect(tb.balanced).toBe(true);
  });
  it("income statement nets discounts from revenue", () => {
    const is = incomeStatement(rows);
    expect(is.totalRevenue).toBe(900);
    expect(is.totalExpenses).toBe(300);
    expect(is.netIncome).toBe(600);
  });
  it("balance sheet: assets = liabilities + equity (incl. current profit)", () => {
    const bs = balanceSheet(rows);
    expect(bs.totalAssets).toBe(5735);
    expect(bs.totalLiabilities).toBe(135);
    expect(bs.totalEquity).toBe(5600);
    expect(bs.balanced).toBe(true);
  });
});

describe("manual journal entries", () => {
  it("accepts only balanced entries", () => {
    expect(entryTotals([{ account_id: "a", debit: 100, credit: 0 }, { account_id: "b", debit: 0, credit: 100 }]).balanced).toBe(true);
    expect(entryTotals([{ account_id: "a", debit: 100, credit: 0 }, { account_id: "b", debit: 0, credit: 90 }]).balanced).toBe(false);
  });
});

describe("ZATCA QR", () => {
  it("encodes seller and totals as TLV base64", () => {
    const decoded = Uint8Array.from(atob(zatcaQr("A", "3", "T", 115, 15)), (c) => c.charCodeAt(0));
    expect(Array.from(decoded.slice(0, 3))).toEqual([1, 1, 65]);
    expect(new TextDecoder().decode(decoded)).toContain("115.00");
  });
});
