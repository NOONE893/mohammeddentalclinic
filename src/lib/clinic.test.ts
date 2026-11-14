import { describe, expect, it } from "vitest";
import { calcInvoice, generateSlots, invoiceBalance, toWhatsAppNumber, fillTemplate } from "./clinic";

describe("calcInvoice", () => {
  it("applies 15% VAT after the discount", () => {
    const r = calcInvoice([{ qty: 1, unit_price: 1000 }, { qty: 2, unit_price: 100 }], 200, 15);
    expect(r.subtotal).toBe(1200);
    expect(r.taxable).toBe(1000);
    expect(r.vat).toBe(150);
    expect(r.total).toBe(1150);
  });
  it("never lets the discount exceed the subtotal", () => {
    expect(calcInvoice([{ qty: 1, unit_price: 100 }], 500, 15).total).toBe(0);
  });
});

describe("invoiceBalance", () => {
  it("marks partially paid invoices with the remaining amount", () => {
    expect(invoiceBalance(1150, [{ amount: 500 }])).toEqual({ paid: 500, due: 650, status: "partial" });
  });
  it("marks fully paid invoices as paid", () => {
    expect(invoiceBalance(300, [{ amount: 100 }, { amount: 200 }]).status).toBe("paid");
  });
});

describe("generateSlots", () => {
  it("stops so the last appointment ends by closing time", () => {
    expect(generateSlots("09:00", "11:00", 30)).toEqual(["09:00", "09:30", "10:00", "10:30"]);
  });
});

describe("WhatsApp helpers", () => {
  it("converts a Saudi mobile number to international format", () => {
    expect(toWhatsAppNumber("0551234567")).toBe("966551234567");
    expect(toWhatsAppNumber("+966 55 123 4567")).toBe("966551234567");
  });
  it("fills reminder placeholders", () => {
    expect(fillTemplate("مرحباً {name} الساعة {time}", { name: "سارة", time: "4:00 م" })).toBe("مرحباً سارة الساعة 4:00 م");
  });
});
