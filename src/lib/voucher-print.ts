// Opens a clean, elegant printable voucher (receipt / payment) in a new window.

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface VoucherData {
  kind: "receipt" | "payment";
  no: string | number;
  date: string;
  party: string; // patient (receipt) or payee (payment)
  amount: string; // already formatted with currency
  method: string;
  category?: string;
  note?: string;
  clinic: { name: string; address?: string; phone?: string; vat?: string };
  by?: string;
}

export function printVoucher(v: VoucherData) {
  const rec = v.kind === "receipt";
  const accent = rec ? "#0f766e" : "#9a3412";
  const w = window.open("", "_blank", "width=820,height=700");
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${rec ? "سند قبض" : "سند صرف"} ${esc(v.no)}</title>
<style>
@page{size:A5 landscape;margin:10mm}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;font-family:"IBM Plex Sans Arabic",Tahoma,"Segoe UI",sans-serif;color:#1c2b30;background:#fff}
.v{border:2px solid ${accent};border-radius:14px;overflow:hidden;max-width:760px;margin:0 auto}
.top{background:${accent};color:#fff;padding:14px 22px;display:flex;justify-content:space-between;align-items:center}
.top h1{margin:0;font-size:22px}.top small{opacity:.85;display:block;font-size:12px;margin-top:2px}
.no{background:#fff;color:${accent};border-radius:10px;padding:6px 16px;text-align:center;font-weight:700}
.no span{display:block;font-size:11px;font-weight:400;color:#667}
.body{padding:18px 22px}
.row{display:flex;gap:10px;padding:9px 0;border-bottom:1px dashed #c9d4d7;font-size:15px}
.row b{width:120px;color:#5d7078;font-weight:500;flex-shrink:0}
.amt{margin:16px 0 6px;background:#f2f7f7;border-radius:10px;padding:12px 18px;display:flex;justify-content:space-between;align-items:center}
.amt strong{font-size:26px;color:${accent}}
.sign{display:flex;justify-content:space-between;margin-top:34px;font-size:13px;color:#5d7078}
.sign div{width:42%;border-top:1px solid #9fb0b5;padding-top:6px;text-align:center}
.foot{text-align:center;font-size:11px;color:#8a9ba0;padding:0 0 12px}
</style></head><body><div class="v">
<div class="top"><div><h1>${esc(v.clinic.name)}</h1><small>${esc([v.clinic.address, v.clinic.phone].filter(Boolean).join(" · "))}${v.clinic.vat ? ` · الرقم الضريبي ${esc(v.clinic.vat)}` : ""}</small></div>
<div class="no"><span>${rec ? "سند قبض" : "سند صرف"}</span>${esc(v.no)}</div></div>
<div class="body">
<div class="row"><b>التاريخ</b><span>${esc(v.date)}</span></div>
<div class="row"><b>${rec ? "استلمنا من" : "صُرف إلى"}</b><span>${esc(v.party || "—")}</span></div>
<div class="row"><b>${rec ? "طريقة الدفع" : "طريقة الصرف"}</b><span>${esc(v.method)}</span></div>
${v.category ? `<div class="row"><b>التصنيف</b><span>${esc(v.category)}</span></div>` : ""}
<div class="row"><b>البيان</b><span>${esc(v.note || "—")}</span></div>
<div class="amt"><span>المبلغ</span><strong>${esc(v.amount)}</strong></div>
<div class="sign"><div>${rec ? "المستلم" : "أمين الصندوق"}${v.by ? `: ${esc(v.by)}` : ""}</div><div>${rec ? "توقيع المريض" : "توقيع المستفيد"}</div></div>
</div><div class="foot">${esc(v.clinic.name)}</div></div>
<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
  w.document.close();
  return true;
}
