// Pure clinic helpers (money, schedule, WhatsApp). Kept framework-free so they can be unit tested.

export const APPT_STATUS = {
  booked: { label: "محجوز", tone: "info" },
  arrived: { label: "حضر", tone: "success" },
  done: { label: "مكتمل", tone: "primary" },
  noshow: { label: "لم يحضر", tone: "destructive" },
  cancelled: { label: "ملغي", tone: "muted" },
} as const;
export type ApptStatus = keyof typeof APPT_STATUS;

export const TOOTH_STATUS = {
  healthy: { label: "سليم", cls: "bg-tooth-healthy" },
  caries: { label: "تسوس", cls: "bg-tooth-caries" },
  filling: { label: "حشوة", cls: "bg-tooth-filling" },
  crown: { label: "تاج", cls: "bg-tooth-crown" },
  rct: { label: "علاج عصب", cls: "bg-tooth-rct" },
  missing: { label: "مخلوع", cls: "bg-tooth-missing" },
  implant: { label: "زرعة", cls: "bg-tooth-implant" },
  bridge: { label: "جسر", cls: "bg-tooth-bridge" },
} as const;
export type ToothStatus = keyof typeof TOOTH_STATUS;

export const TREATMENT_STATUS = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  done: "منفّذ",
} as const;

export const PAY_METHODS = { cash: "نقد", card: "بطاقة / مدى", transfer: "تحويل بنكي" } as const;

export const EXPENSE_CATEGORIES = [
  "إيجار",
  "رواتب وعمولات",
  "مستهلكات",
  "مختبر أسنان",
  "كهرباء وماء",
  "صيانة أجهزة",
  "تسويق",
  "أخرى",
];

/** FDI numbering for the adult chart, in display order (patient's right on the left of the chart). */
export const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface InvoiceLine {
  qty: number;
  unit_price: number;
}

/** Invoice totals: VAT is applied after the discount; discount can never exceed the subtotal. */
export function calcInvoice(lines: InvoiceLine[], discount: number, vatRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0), 0));
  const disc = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const taxable = round2(subtotal - disc);
  const vat = round2((taxable * (Number(vatRate) || 0)) / 100);
  return { subtotal, discount: disc, taxable, vat, total: round2(taxable + vat) };
}

export function invoiceBalance(total: number, payments: { amount: number }[]) {
  const paid = round2(payments.reduce((s, p) => s + Number(p.amount), 0));
  const due = round2(Math.max(Number(total) - paid, 0));
  return { paid, due, status: due === 0 ? "paid" : paid > 0 ? "partial" : "unpaid" } as const;
}

const toMin = (t: string) => {
  const [h = 0, m = 0] = t.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** All bookable start times between open and close (last slot must finish by closing time). */
export function generateSlots(open: string, close: string, stepMin: number): string[] {
  const step = Math.max(5, Number(stepMin) || 30);
  const out: string[] = [];
  for (let m = toMin(open); m + step <= toMin(close); m += step) out.push(toHHMM(m));
  return out;
}

/** "09:00:00" -> "09:00" */
export const hhmm = (t: string) => t.slice(0, 5);

/** 24h -> Arabic 12h label, e.g. "14:30" -> "2:30 م" */
export function timeLabel(t: string) {
  const [h = 0, m = 0] = hhmm(t).split(":").map(Number);
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Local date -> YYYY-MM-DD without timezone shifts. */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dateLabel(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", opts);
}

export const WEEK_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

/** Saudi-style local numbers (05xxxxxxxx) -> international digits for wa.me (9665xxxxxxxx). */
export function toWhatsAppNumber(phone: string, countryCode = "966") {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith(countryCode)) return d;
  if (d.startsWith("0")) d = d.slice(1);
  return countryCode + d;
}

export function fillTemplate(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

export function whatsappLink(phone: string, message?: string) {
  const n = toWhatsAppNumber(phone);
  if (!n) return "";
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function money(n: number, currency = "ر.س") {
  return `${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;
}

export function ageFrom(birth: string | null) {
  if (!birth) return null;
  const b = new Date(birth);
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a;
}
