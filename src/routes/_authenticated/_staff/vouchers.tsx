import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Plus, Printer, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, PageHeader, Panel } from "@/components/clinic/staff-shell";
import { Field, NativeSelect } from "@/components/clinic/fields";
import { invoicesQuery, must, patientsQuery, type InvoiceRow } from "@/lib/data";
import { EXPENSE_CATEGORIES, invoiceBalance, isoDate, money, PAY_METHODS } from "@/lib/clinic";
import { printVoucher } from "@/lib/voucher-print";
import { useMe, useSettings } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_staff/vouchers")({
  head: () => ({ meta: [{ title: "السندات والصندوق | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: VouchersPage,
});

interface Receipt { id: string; amount: number; method: string; paid_on: string; created_at: string; voucher_no?: number | null; invoice: { number: number; patient: { id: string; full_name: string } | null } | null }
interface Expense { id: string; amount: number; method: string; spent_on: string; created_at: string; category: string; note: string; payee?: string; voucher_no?: number | null }

const payLabel = (m: string) => PAY_METHODS[m as keyof typeof PAY_METHODS] ?? m;

function VouchersPage() {
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const { data: me } = useMe();
  const cur = s?.currency ?? "ر.س";
  const today = isoDate(new Date());
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [recOpen, setRecOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  const recQ = useQuery({
    queryKey: ["payments", "vouchers"],
    queryFn: () => must(supabase.from("payments").select("*, invoice:invoices(number, patient:patients(id,full_name))").order("paid_on", { ascending: false }).order("created_at", { ascending: false })) as unknown as Promise<Receipt[]>,
  });
  const expQ = useQuery({
    queryKey: ["expenses", "vouchers"],
    queryFn: () => must(supabase.from("expenses").select("*").order("spent_on", { ascending: false }).order("created_at", { ascending: false })) as unknown as Promise<Expense[]>,
  });
  const receipts = recQ.data ?? [];
  const expenses = expQ.data ?? [];
  const inRange = (d: string) => d >= from && d <= to;
  const rIn = receipts.filter((r) => inRange(r.paid_on));
  const eIn = expenses.filter((e) => inRange(e.spent_on));

  const clinic = { name: s?.name ?? "العيادة", address: s?.address, phone: s?.phone, vat: s?.vat_number };
  const refresh = () => { qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["expenses"] }); qc.invalidateQueries({ queryKey: ["invoices"] }); };

  const printReceipt = (r: Receipt) => printVoucher({ kind: "receipt", no: r.voucher_no ? `ق-${r.voucher_no}` : r.id.slice(0, 6), date: r.paid_on, party: r.invoice?.patient?.full_name ?? "", amount: money(Number(r.amount), cur), method: payLabel(r.method), note: r.invoice ? `سداد فاتورة رقم ${r.invoice.number}` : "", clinic, by: me?.name }) || toast.error("اسمح بالنوافذ المنبثقة للطباعة");
  const printPayment = (e: Expense) => printVoucher({ kind: "payment", no: e.voucher_no ? `ص-${e.voucher_no}` : e.id.slice(0, 6), date: e.spent_on, party: e.payee ?? "", amount: money(Number(e.amount), cur), method: payLabel(e.method), category: e.category, note: e.note, clinic, by: me?.name }) || toast.error("اسمح بالنوافذ المنبثقة للطباعة");

  async function del(table: "payments" | "expenses", id: string) {
    if (!confirm("حذف السند نهائياً؟")) return;
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) return void toast.error(error.message);
    refresh();
  }

  return (
    <>
      <PageHeader
        title="السندات والصندوق"
        subtitle="سندات القبض والصرف وحركة الصندوق"
        actions={<>
          <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-auto" aria-label="من" />
          <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-auto" aria-label="إلى" />
        </>}
      />
      <Tabs defaultValue="receipts" dir="rtl">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="receipts">سندات القبض</TabsTrigger>
          <TabsTrigger value="payments">سندات الصرف</TabsTrigger>
          {me?.isAdmin && <TabsTrigger value="box">الصندوق</TabsTrigger>}
        </TabsList>

        <TabsContent value="receipts">
          <Panel title={`سندات القبض (${rIn.length})`} action={<Button size="sm" onClick={() => setRecOpen(true)}><Plus /> سند قبض</Button>}>
            {!rIn.length ? <Empty>لا توجد سندات قبض في هذه الفترة</Empty> : (
              <ul className="divide-y divide-border text-sm">
                {rIn.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.invoice?.patient?.full_name ?? "—"}</div>
                      <div className="num text-xs text-muted-foreground">{r.voucher_no ? `ق-${r.voucher_no} · ` : ""}{r.paid_on} · {payLabel(r.method)}{r.invoice ? ` · فاتورة ${r.invoice.number}` : ""}</div>
                    </div>
                    <span className="num font-semibold text-success">{money(Number(r.amount), cur)}</span>
                    <Button size="icon" variant="ghost" onClick={() => printReceipt(r)} aria-label="طباعة"><Printer /></Button>
                    {me?.isAdmin && <Button size="icon" variant="ghost" onClick={() => del("payments", r.id)} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="payments">
          <Panel title={`سندات الصرف (${eIn.length})`} action={<Button size="sm" onClick={() => setPayOpen(true)}><Plus /> سند صرف</Button>}>
            {!eIn.length ? <Empty>لا توجد سندات صرف في هذه الفترة</Empty> : (
              <ul className="divide-y divide-border text-sm">
                {eIn.map((e) => (
                  <li key={e.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{e.payee || e.category}{e.note ? ` — ${e.note}` : ""}</div>
                      <div className="num text-xs text-muted-foreground">{e.voucher_no ? `ص-${e.voucher_no} · ` : ""}{e.spent_on} · {e.category} · {payLabel(e.method)}</div>
                    </div>
                    <span className="num font-semibold text-destructive">{money(Number(e.amount), cur)}</span>
                    <Button size="icon" variant="ghost" onClick={() => printPayment(e)} aria-label="طباعة"><Printer /></Button>
                    {me?.isAdmin && <Button size="icon" variant="ghost" onClick={() => del("expenses", e.id)} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        {me?.isAdmin && (
          <TabsContent value="box">
            <CashBox receipts={receipts} expenses={expenses} from={from} to={to} cur={cur} />
          </TabsContent>
        )}
      </Tabs>

      <ReceiptDialog open={recOpen} onOpenChange={setRecOpen} cur={cur} onDone={refresh} />
      <PaymentDialog open={payOpen} onOpenChange={setPayOpen} cur={cur} onDone={refresh} />
    </>
  );
}

function CashBox({ receipts, expenses, from, to, cur }: { receipts: Receipt[]; expenses: Expense[]; from: string; to: string; cur: string }) {
  const sum = (xs: { amount: number }[]) => xs.reduce((a, x) => a + Number(x.amount), 0);
  const opening = sum(receipts.filter((r) => r.paid_on < from)) - sum(expenses.filter((e) => e.spent_on < from));
  const rIn = receipts.filter((r) => r.paid_on >= from && r.paid_on <= to);
  const eIn = expenses.filter((e) => e.spent_on >= from && e.spent_on <= to);
  const moves = useMemo(() => {
    const all = [
      ...rIn.map((r) => ({ d: r.paid_on, t: r.created_at, txt: `قبض ${r.voucher_no ? `ق-${r.voucher_no}` : ""} — ${r.invoice?.patient?.full_name ?? ""}`, inn: Number(r.amount), out: 0 })),
      ...eIn.map((e) => ({ d: e.spent_on, t: e.created_at, txt: `صرف ${e.voucher_no ? `ص-${e.voucher_no}` : ""} — ${e.payee || e.category}`, inn: 0, out: Number(e.amount) })),
    ].sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
    let bal = opening;
    return all.map((m) => ({ ...m, bal: (bal += m.inn - m.out) }));
  }, [rIn, eIn, opening]);
  const tin = sum(rIn), tout = sum(eIn), close = opening + tin - tout;
  const byMethod = Object.keys(PAY_METHODS).map((k) => ({ k, v: rIn.filter((r) => r.method === k).reduce((a, r) => a + Number(r.amount), 0) - eIn.filter((e) => e.method === k).reduce((a, e) => a + Number(e.amount), 0) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="رصيد أول الفترة" v={money(opening, cur)} />
        <Stat label="الوارد" v={money(tin, cur)} icon={<ArrowDownLeft className="size-4 text-success" />} />
        <Stat label="الصادر" v={money(tout, cur)} icon={<ArrowUpRight className="size-4 text-destructive" />} />
        <Stat label="رصيد الصندوق" v={money(close, cur)} strong tone={close >= 0 ? "text-success" : "text-destructive"} />
      </div>
      <Panel title="صافي الحركة حسب طريقة الدفع">
        <div className="grid grid-cols-3 gap-2 text-center">
          {byMethod.map((m) => (
            <div key={m.k} className="rounded-xl bg-muted/60 p-3"><div className="text-xs text-muted-foreground">{payLabel(m.k)}</div><div className="num mt-1 text-sm font-semibold">{money(m.v, cur)}</div></div>
          ))}
        </div>
      </Panel>
      <Panel title="كشف الحركة">
        {!moves.length ? <Empty>لا توجد حركات في هذه الفترة</Empty> : (
          <div className="overflow-x-auto">
            <table className="num w-full text-sm">
              <thead><tr className="border-b border-border text-muted-foreground"><th className="py-2 text-start font-medium">التاريخ</th><th className="py-2 text-start font-medium">البيان</th><th className="py-2 text-end font-medium">وارد</th><th className="py-2 text-end font-medium">صادر</th><th className="py-2 text-end font-medium">الرصيد</th></tr></thead>
              <tbody>
                {moves.map((m, i) => (
                  <tr key={i} className="border-b border-border/60">
                    <td className="py-2">{m.d}</td><td className="py-2">{m.txt}</td>
                    <td className="py-2 text-end text-success">{m.inn ? money(m.inn, cur) : ""}</td>
                    <td className="py-2 text-end text-destructive">{m.out ? money(m.out, cur) : ""}</td>
                    <td className="py-2 text-end font-medium">{money(m.bal, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Stat({ label, v, icon, strong, tone }: { label: string; v: string; icon?: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border p-3 shadow-soft md:p-4", strong ? "bg-primary-soft" : "bg-card")}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">{label}{icon}</div>
      <div className={cn("num mt-1.5 font-display text-base font-bold md:text-xl", tone)}>{v}</div>
    </div>
  );
}

function ReceiptDialog({ open, onOpenChange, cur, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; cur: string; onDone: () => void }) {
  const { data: patients = [] } = useQuery(patientsQuery);
  const { data: invoices = [] } = useQuery(invoicesQuery);
  const [patientId, setPatientId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(isoDate(new Date()));
  const open_ = useMemo(() => invoices.filter((i: InvoiceRow) => i.patient_id === patientId && invoiceBalance(Number(i.total), i.payments).due > 0), [invoices, patientId]);
  const inv = open_.find((i) => i.id === invoiceId);
  const due = inv ? invoiceBalance(Number(inv.total), inv.payments).due : 0;

  async function save() {
    const a = Number(amount);
    if (!inv) return void toast.error("اختر المريض والفاتورة");
    if (!(a > 0)) return void toast.error("المبلغ يجب أن يكون أكبر من صفر");
    if (a > due) return void toast.error("المبلغ أكبر من المتبقي على الفاتورة");
    const { error } = await supabase.from("payments").insert({ invoice_id: inv.id, amount: a, method, paid_on: date });
    if (error) return void toast.error(error.message);
    toast.success("تم حفظ سند القبض");
    setAmount(""); setInvoiceId(""); onOpenChange(false); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>سند قبض جديد</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المريض" className="col-span-2">
            <NativeSelect value={patientId} onChange={(e) => { setPatientId(e.target.value); setInvoiceId(""); }}>
              <option value="">— اختر —</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </NativeSelect>
          </Field>
          <Field label="الفاتورة" className="col-span-2">
            <NativeSelect value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} disabled={!patientId}>
              <option value="">{patientId && !open_.length ? "لا توجد فواتير مستحقة" : "— اختر —"}</option>
              {open_.map((i) => <option key={i.id} value={i.id}>#{i.number} · المتبقي {money(invoiceBalance(Number(i.total), i.payments).due, cur)}</option>)}
            </NativeSelect>
          </Field>
          <Field label={`المبلغ (${cur})`}><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
          <Field label="الطريقة"><NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
          <Field label="التاريخ" className="col-span-2"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        {inv && <Button variant="link" className="justify-start px-0" onClick={() => setAmount(String(due))}>سداد كامل المتبقي ({money(due, cur)})</Button>}
        <Button onClick={save}>حفظ السند</Button>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ open, onOpenChange, cur, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; cur: string; onDone: () => void }) {
  const [f, setF] = useState({ payee: "", category: EXPENSE_CATEGORIES[0] ?? "أخرى", amount: "", method: "cash", spent_on: isoDate(new Date()), note: "" });
  async function save() {
    const amount = Number(f.amount);
    if (!f.payee.trim()) return void toast.error("اكتب اسم المستفيد");
    if (!(amount > 0)) return void toast.error("المبلغ يجب أن يكون أكبر من صفر");
    const { error } = await supabase.from("expenses").insert({ ...f, payee: f.payee.trim(), amount } as never);
    if (error) return void toast.error(error.message);
    toast.success("تم حفظ سند الصرف");
    setF((x) => ({ ...x, payee: "", amount: "", note: "" })); onOpenChange(false); onDone();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>سند صرف جديد</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="المستفيد" className="col-span-2"><Input value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} /></Field>
          <Field label="التصنيف"><NativeSelect value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
          <Field label={`المبلغ (${cur})`}><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
          <Field label="الطريقة"><NativeSelect value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
          <Field label="التاريخ"><Input type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} /></Field>
          <Field label="البيان" className="col-span-2"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        </div>
        <Button onClick={save}>حفظ السند</Button>
      </DialogContent>
    </Dialog>
  );
}
