import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { ChevronRight, MessageCircle, Printer, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty } from "@/components/clinic/staff-shell";
import { Field, NativeSelect } from "@/components/clinic/fields";
import { ToothMark } from "@/components/clinic/public-layout";
import { invoiceSelect, must, type InvoiceRow } from "@/lib/data";
import { invoiceBalance, money, PAY_METHODS, whatsappLink } from "@/lib/clinic";
import { zatcaQr } from "@/lib/accounting";
import { useSettings } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/_staff/invoices/$id")({
  head: () => ({ meta: [{ title: "فاتورة | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: InvoicePage,
});

function InvoicePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: s } = useSettings();
  const cur = s?.currency ?? "ر.س";
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", id],
    queryFn: async () => {
      const [inv, items] = await Promise.all([
        must(supabase.from("invoices").select(invoiceSelect).eq("id", id).single()) as Promise<InvoiceRow>,
        must(supabase.from("invoice_items").select("*").eq("invoice_id", id)),
      ]);
      return { inv, items };
    },
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");

  if (isLoading || !data) return <Empty>جاري التحميل…</Empty>;
  const { inv, items } = data;
  const b = invoiceBalance(Number(inv.total), inv.payments);

  async function addPayment() {
    const a = Number(amount);
    if (!a || a <= 0) return void toast.error("أدخل المبلغ");
    if (a > b.due) return void toast.error("المبلغ أكبر من المتبقي");
    const { error } = await supabase.from("payments").insert({ invoice_id: id, amount: a, method });
    if (error) return void toast.error(error.message);
    setAmount("");
    toast.success("تم تسجيل الدفعة");
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["patient"] });
  }

  async function remove() {
    if (!confirm("حذف الفاتورة نهائياً مع دفعاتها؟")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invoices"] });
    navigate({ to: "/invoices" });
  }

  const waMsg = `مرحباً ${inv.patient?.full_name ?? ""}، فاتورتك رقم ${inv.number} من ${s?.name ?? ""} بقيمة ${money(Number(inv.total), cur)}${b.due > 0 ? `، المتبقي ${money(b.due, cur)}` : "، مدفوعة بالكامل"}. شكراً لزيارتك.`;
  const wa = whatsappLink(inv.patient?.phone ?? "", waMsg);

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link to="/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronRight className="size-4" /> الفواتير</Link>
        <div className="flex gap-2">
          {wa && <Button asChild size="sm" variant="whatsapp"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle /> إرسال</a></Button>}
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer /> طباعة</Button>
          <Button size="icon" variant="ghost" onClick={remove} aria-label="حذف"><Trash2 className="text-destructive" /></Button>
        </div>
      </div>

      <article className="print-area relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {/* Brand band */}
        <div className="h-2 bg-gradient-to-l from-primary-deep via-primary to-primary/60" />

        {b.status === "paid" && (
          <div aria-hidden className="pointer-events-none absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 select-none rounded-2xl border-4 border-success/20 px-10 py-3 font-display text-6xl font-bold text-success/15">مدفوعة</div>
        )}

        <div className="p-6 md:p-10">
          <header className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-center gap-3.5">
              <ToothMark className="size-14" />
              <div>
                <div className="font-display text-xl font-bold leading-tight">{s?.name}</div>
                {s?.name_en && <div className="text-xs tracking-wide text-muted-foreground" dir="ltr">{s.name_en}</div>}
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {s?.address && <div>{s.address}</div>}
                  {s?.phone && <div className="num" dir="ltr" style={{ textAlign: "start" }}>{s.phone}</div>}
                </div>
              </div>
            </div>
            <div className="text-end">
              <div className="font-display text-2xl font-bold text-primary-deep">فاتورة ضريبية مبسطة</div>
              <div className="mt-1 text-xs text-muted-foreground">Simplified Tax Invoice</div>
              <div className="num mt-3 inline-flex items-center gap-2 rounded-full bg-primary-soft px-4 py-1.5 text-sm font-semibold text-primary-deep">
                <span className="text-xs font-normal text-muted-foreground">رقم</span> {inv.number}
              </div>
            </div>
          </header>

          <section className="mt-7 grid gap-px overflow-hidden rounded-xl border border-border bg-border text-sm sm:grid-cols-3">
            <Meta k="المريض" v={inv.patient?.full_name ?? "—"} sub={inv.patient?.phone} />
            <Meta k="تاريخ الإصدار" v={inv.issue_date} num />
            <Meta k="الرقم الضريبي" v={s?.vat_number || "—"} num />
          </section>

          <table className="num mt-7 w-full text-sm">
            <thead>
              <tr className="bg-primary-soft text-primary-deep">
                <th className="rounded-s-lg px-3 py-2.5 text-start font-semibold">البيان</th>
                <th className="px-3 py-2.5 text-center font-semibold">الكمية</th>
                <th className="px-3 py-2.5 text-center font-semibold">السعر</th>
                <th className="rounded-e-lg px-3 py-2.5 text-end font-semibold">المجموع</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={it.id} className={i % 2 ? "bg-muted/40" : ""}>
                  <td className="px-3 py-3">{it.description}</td>
                  <td className="px-3 py-3 text-center">{Number(it.qty)}</td>
                  <td className="px-3 py-3 text-center">{money(Number(it.unit_price), cur)}</td>
                  <td className="px-3 py-3 text-end font-medium">{money(Number(it.qty) * Number(it.unit_price), cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 grid items-end gap-6 sm:grid-cols-[1fr_300px]">
            <div className="order-2 flex items-center gap-4 sm:order-1">
              <div className="rounded-xl border border-border bg-white p-2">
                <QRCodeSVG value={zatcaQr(s?.name ?? "", s?.vat_number ?? "", new Date(inv.created_at).toISOString(), Number(inv.total), Number(inv.vat_amount))} size={96} level="M" />
              </div>
              <p className="max-w-[16rem] text-xs leading-relaxed text-muted-foreground">رمز الاستجابة السريعة للفاتورة الإلكترونية (هيئة الزكاة والضريبة والجمارك).</p>
            </div>
            <div className="num order-1 space-y-2 text-sm sm:order-2">
              <R k="المجموع" v={money(Number(inv.subtotal), cur)} />
              {Number(inv.discount) > 0 && <R k="الخصم" v={`− ${money(Number(inv.discount), cur)}`} />}
              <R k={`ضريبة القيمة المضافة ${Number(inv.vat_rate)}%`} v={money(Number(inv.vat_amount), cur)} />
              <div className="flex items-center justify-between rounded-xl bg-primary-deep px-4 py-3 text-primary-foreground">
                <span className="font-semibold">الإجمالي</span>
                <span className="font-display text-lg font-bold">{money(Number(inv.total), cur)}</span>
              </div>
              <R k="المدفوع" v={money(b.paid, cur)} />
              <div className={`flex justify-between font-semibold ${b.due > 0 ? "text-destructive" : "text-success"}`}><span>المتبقي</span><span>{money(b.due, cur)}</span></div>
            </div>
          </div>

          {inv.payments.length > 0 && (
            <div className="mt-6 rounded-xl border border-border p-4 text-xs">
              <div className="mb-2 font-semibold text-foreground">سجل الدفعات</div>
              <div className="num space-y-1 text-muted-foreground">
                {inv.payments.map((p) => (
                  <div key={p.id} className="flex justify-between"><span>{p.paid_on} · {PAY_METHODS[p.method as keyof typeof PAY_METHODS] ?? p.method}</span><span>{money(Number(p.amount), cur)}</span></div>
                ))}
              </div>
            </div>
          )}
          {inv.notes && <p className="mt-4 text-sm"><span className="text-muted-foreground">ملاحظات: </span>{inv.notes}</p>}

          <footer className="mt-10 border-t border-border pt-5 text-center">
            <div className="font-display text-base font-semibold text-primary-deep">شكراً لثقتكم بنا</div>
            {s?.invoice_footer && <p className="mt-1 text-sm text-muted-foreground">{s.invoice_footer}</p>}
          </footer>
        </div>
      </article>

      {b.due > 0 && (
        <div className="no-print mx-auto mt-4 max-w-3xl rounded-2xl border border-border bg-card p-4 shadow-soft">
          <div className="mb-3 flex items-center gap-2 font-semibold"><Wallet className="size-4 text-primary" /> تسجيل دفعة</div>
          <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
            <Field label={`المبلغ (المتبقي ${money(b.due, cur)})`}><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="الطريقة">
              <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Button onClick={addPayment}>تسجيل</Button>
          </div>
          <Button size="sm" variant="link" className="mt-1 px-0" onClick={() => setAmount(String(b.due))}>سداد كامل المتبقي</Button>
        </div>
      )}
    </>
  );
}

function R({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}

function Meta({ k, v, sub, num }: { k: string; v: string; sub?: string | null; num?: boolean }) {
  return (
    <div className="bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className={`mt-0.5 font-semibold ${num ? "num" : ""}`}>{v}</div>
      {sub && <div className="num text-xs text-muted-foreground" dir="ltr" style={{ textAlign: "start" }}>{sub}</div>}
    </div>
  );
}
