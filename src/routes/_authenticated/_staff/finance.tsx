import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, PageHeader, Panel } from "@/components/clinic/staff-shell";
import { Field, NativeSelect } from "@/components/clinic/fields";
import { must } from "@/lib/data";
import { EXPENSE_CATEGORIES, isoDate, money, PAY_METHODS } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/_staff/finance")({
  head: () => ({ meta: [{ title: "الدخل والمصروفات | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: FinancePage,
});

function monthRange(ym: string) {
  const [y = 1970, m = 1] = ym.split("-").map(Number);
  return { from: `${ym}-01`, to: isoDate(new Date(y, m, 0)) };
}

function FinancePage() {
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const cur = s?.currency ?? "ر.س";
  const [ym, setYm] = useState(isoDate(new Date()).slice(0, 7));
  const { from, to } = monthRange(ym);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ category: EXPENSE_CATEGORIES[0] ?? "أخرى", amount: "", method: "cash", spent_on: isoDate(new Date()), note: "" });

  const payQ = useQuery({
    queryKey: ["payments", ym],
    queryFn: () => must(supabase.from("payments").select("amount,method,paid_on, invoice:invoices(number, patient:patients(full_name))").gte("paid_on", from).lte("paid_on", to).order("paid_on", { ascending: false })),
  });
  const expQ = useQuery({
    queryKey: ["expenses", ym],
    queryFn: () => must(supabase.from("expenses").select("*").gte("spent_on", from).lte("spent_on", to).order("spent_on", { ascending: false })),
  });

  const income = (payQ.data ?? []).reduce((x, p) => x + Number(p.amount), 0);
  const expenses = (expQ.data ?? []).reduce((x, e) => x + Number(e.amount), 0);
  const byMethod = Object.keys(PAY_METHODS).map((k) => ({ k, v: (payQ.data ?? []).filter((p) => p.method === k).reduce((x, p) => x + Number(p.amount), 0) }));
  const byCat = EXPENSE_CATEGORIES.map((c) => ({ c, v: (expQ.data ?? []).filter((e) => e.category === c).reduce((x, e) => x + Number(e.amount), 0) })).filter((x) => x.v > 0);
  const maxCat = Math.max(1, ...byCat.map((x) => x.v));

  async function addExpense() {
    const amount = Number(f.amount);
    if (!amount || amount <= 0) return void toast.error("أدخل المبلغ");
    const { error } = await supabase.from("expenses").insert({ ...f, amount });
    if (error) return void toast.error(error.message);
    toast.success("تم تسجيل المصروف");
    setOpen(false);
    setF((x) => ({ ...x, amount: "", note: "" }));
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }
  async function delExpense(id: string) {
    if (!confirm("حذف المصروف؟")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  return (
    <>
      <PageHeader
        title="الدخل والمصروفات"
        actions={<>
          <Input type="month" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} className="w-auto" />
          <Button onClick={() => setOpen(true)}><Plus /> مصروف</Button>
        </>}
      />

      <div className="mb-5 grid grid-cols-3 gap-3">
        <Box label="الدخل (محصّل)" value={money(income, cur)} icon={<ArrowDownLeft className="size-4 text-success" />} />
        <Box label="المصروفات" value={money(expenses, cur)} icon={<ArrowUpRight className="size-4 text-destructive" />} />
        <Box label="صافي الربح" value={money(income - expenses, cur)} strong tone={income - expenses >= 0 ? "text-success" : "text-destructive"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="الدخل حسب طريقة الدفع">
          <div className="grid grid-cols-3 gap-2 text-center">
            {byMethod.map((m) => (
              <div key={m.k} className="rounded-xl bg-muted/60 p-3">
                <div className="text-xs text-muted-foreground">{PAY_METHODS[m.k as keyof typeof PAY_METHODS]}</div>
                <div className="num mt-1 text-sm font-semibold">{money(m.v, cur)}</div>
              </div>
            ))}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-semibold">الدفعات</h3>
          {!payQ.data?.length ? <Empty>لا توجد دفعات هذا الشهر</Empty> : (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto text-sm">
              {payQ.data.map((p, i) => (
                <li key={i} className="flex justify-between gap-2 py-2">
                  <span className="truncate">{p.invoice?.patient?.full_name ?? "—"} <span className="num text-xs text-muted-foreground">#{p.invoice?.number} · {p.paid_on}</span></span>
                  <span className="num shrink-0 font-medium text-success">{money(Number(p.amount), cur)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="المصروفات حسب البند">
          {byCat.length === 0 ? <Empty>لا توجد مصروفات هذا الشهر</Empty> : (
            <div className="space-y-2.5">
              {byCat.map((x) => (
                <div key={x.c}>
                  <div className="flex justify-between text-sm"><span>{x.c}</span><span className="num">{money(x.v, cur)}</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(x.v / maxCat) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <h3 className="mb-2 mt-5 text-sm font-semibold">السجل</h3>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto text-sm">
            {(expQ.data ?? []).map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{e.category}{e.note ? ` — ${e.note}` : ""}</div>
                  <div className="num text-xs text-muted-foreground">{e.spent_on} · {PAY_METHODS[e.method as keyof typeof PAY_METHODS] ?? e.method}</div>
                </div>
                <span className="num font-medium text-destructive">{money(Number(e.amount), cur)}</span>
                <Button size="icon" variant="ghost" onClick={() => delExpense(e.id)} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>مصروف جديد</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="البند"><NativeSelect value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect></Field>
            <Field label={`المبلغ (${cur})`}><Input type="number" min={0} value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="الطريقة"><NativeSelect value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</NativeSelect></Field>
            <Field label="التاريخ"><Input type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} /></Field>
            <Field label="ملاحظة" className="col-span-2"><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          </div>
          <Button onClick={addExpense}>حفظ</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Box({ label, value, icon, strong, tone }: { label: string; value: string; icon?: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className={`rounded-2xl border border-border p-3 shadow-soft md:p-4 ${strong ? "bg-primary-soft" : "bg-card"}`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">{label}{icon}</div>
      <div className={`num mt-1.5 font-display text-base font-bold md:text-xl ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
