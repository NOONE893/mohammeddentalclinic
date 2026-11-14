import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, Loader2, Plus, Printer, Scale, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, PageHeader, Panel, Pill } from "@/components/clinic/staff-shell";
import { Field, NativeSelect } from "@/components/clinic/fields";
import { must } from "@/lib/data";
import { isoDate, money } from "@/lib/clinic";
import {
  ACCOUNT_TYPES, balanceOf, balanceSheet, entryTotals, incomeStatement, isDebitNormal, trialBalance,
  type AccountType, type BalanceRow, type DraftJournalLine,
} from "@/lib/accounting";
import { useMe, useSettings } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_staff/accounting")({
  head: () => ({ meta: [{ title: "المحاسبة | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: AccountingPage,
});

const SOURCE_LABEL: Record<string, { l: string; t: "info" | "success" | "warning" | "primary" }> = {
  invoice: { l: "فاتورة", t: "info" },
  payment: { l: "تحصيل", t: "success" },
  expense: { l: "مصروف", t: "warning" },
  manual: { l: "يدوي", t: "primary" },
};

const balancesQuery = (from: string, to: string) => ({
  queryKey: ["accounting", "balances", from, to],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("account_balances", { _from: from, _to: to });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit) })) as BalanceRow[];
  },
});

function dayBefore(iso: string) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d - 1));
}

function AccountingPage() {
  const today = isoDate(new Date());
  const [from, setFrom] = useState(today.slice(0, 4) + "-01-01");
  const [to, setTo] = useState(today);
  const { data: s } = useSettings();
  const cur = s?.currency ?? "ر.س";
  const { data: me } = useMe();

  const period = useQuery(balancesQuery(from, to));
  const asOf = useQuery(balancesQuery("1900-01-01", to));

  return (
    <>
      <PageHeader
        title="المحاسبة"
        subtitle="قيود مزدوجة تُسجَّل تلقائياً من الفواتير والتحصيلات والمصروفات"
        actions={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="w-auto" aria-label="من" />
            <span className="text-muted-foreground">—</span>
            <Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="w-auto" aria-label="إلى" />
            <Button variant="outline" size="icon" onClick={() => window.print()} aria-label="طباعة"><Printer /></Button>
          </div>
        }
      />
      <Tabs defaultValue="journal" dir="rtl">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto no-print">
          <TabsTrigger value="journal">القيود اليومية</TabsTrigger>
          <TabsTrigger value="ledger">دفتر الأستاذ</TabsTrigger>
          <TabsTrigger value="trial">ميزان المراجعة</TabsTrigger>
          <TabsTrigger value="income">قائمة الدخل</TabsTrigger>
          <TabsTrigger value="balance">الميزانية العمومية</TabsTrigger>
          <TabsTrigger value="accounts">دليل الحسابات</TabsTrigger>
        </TabsList>
        <TabsContent value="journal"><Journal from={from} to={to} cur={cur} isAdmin={!!me?.isAdmin} /></TabsContent>
        <TabsContent value="ledger"><Ledger from={from} to={to} cur={cur} accounts={asOf.data ?? []} /></TabsContent>
        <TabsContent value="trial"><TrialBalance rows={period.data} cur={cur} from={from} to={to} /></TabsContent>
        <TabsContent value="income"><IncomeStatement rows={period.data} cur={cur} from={from} to={to} /></TabsContent>
        <TabsContent value="balance"><BalanceSheet rows={asOf.data} cur={cur} to={to} /></TabsContent>
        <TabsContent value="accounts"><Accounts rows={asOf.data} cur={cur} isAdmin={!!me?.isAdmin} /></TabsContent>
      </Tabs>
    </>
  );
}

/* ---------------- Journal ---------------- */

type EntryRow = {
  id: string; entry_no: number; entry_date: string; description: string; source_type: string;
  journal_lines: { id: string; debit: number; credit: number; memo: string; account: { code: string; name: string } | null }[];
};

function Journal({ from, to, cur, isAdmin }: { from: string; to: string; cur: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [src, setSrc] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["accounting", "journal", from, to],
    queryFn: () =>
      must(
        supabase
          .from("journal_entries")
          .select("id,entry_no,entry_date,description,source_type, journal_lines(id,debit,credit,memo, account:accounts(code,name))")
          .gte("entry_date", from)
          .lte("entry_date", to)
          .order("entry_date", { ascending: false })
          .order("entry_no", { ascending: false })
          .limit(500),
      ) as Promise<EntryRow[]>,
  });
  const list = (data ?? []).filter((e) => !src || e.source_type === src);

  async function del(id: string) {
    if (!confirm("حذف هذا القيد اليدوي؟")) return;
    const { error } = await supabase.rpc("delete_manual_entry", { _id: id });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["accounting"] });
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 no-print">
        <NativeSelect value={src} onChange={(e) => setSrc(e.target.value)} className="w-auto">
          <option value="">كل القيود</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
        </NativeSelect>
        <span className="text-sm text-muted-foreground">{list.length} قيد</span>
        {isAdmin && <Button className="ms-auto" onClick={() => setOpen(true)}><Plus /> قيد يدوي</Button>}
      </div>
      {isLoading ? <Empty>جاري التحميل…</Empty> : list.length === 0 ? <Empty>لا توجد قيود في هذه الفترة</Empty> : (
        <div className="space-y-3">
          {list.map((e) => {
            const sl = SOURCE_LABEL[e.source_type] ?? SOURCE_LABEL["manual"]!;
            const lines = [...e.journal_lines].sort((a, b) => Number(b.debit) - Number(a.debit));
            return (
              <div key={e.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                  <span className="num font-display text-sm font-bold text-primary">قيد #{e.entry_no}</span>
                  <span className="num text-xs text-muted-foreground">{e.entry_date}</span>
                  <Pill tone={sl.t}>{sl.l}</Pill>
                  <span className="min-w-0 flex-1 truncate text-sm">{e.description}</span>
                  {isAdmin && e.source_type === "manual" && (
                    <Button size="icon" variant="ghost" className="size-7 no-print" onClick={() => del(e.id)} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
                  )}
                </div>
                <table className="num w-full text-sm">
                  <tbody>
                    {lines.map((l) => (
                      <tr key={l.id} className="border-b border-border/50 last:border-0">
                        <td className={cn("px-4 py-2", Number(l.credit) > 0 && "ps-10")}>
                          <span className="text-muted-foreground">{l.account?.code}</span> {Number(l.credit) > 0 ? "إلى " : "من "}{l.account?.name}
                          {l.memo && <span className="ms-2 text-xs text-muted-foreground">({l.memo})</span>}
                        </td>
                        <td className="w-28 px-2 py-2 text-end">{Number(l.debit) > 0 ? money(Number(l.debit), cur) : ""}</td>
                        <td className="w-28 px-4 py-2 text-end">{Number(l.credit) > 0 ? money(Number(l.credit), cur) : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
      {isAdmin && <ManualEntryDialog open={open} onOpenChange={setOpen} cur={cur} />}
    </>
  );
}

function ManualEntryDialog({ open, onOpenChange, cur }: { open: boolean; onOpenChange: (v: boolean) => void; cur: string }) {
  const qc = useQueryClient();
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounting", "accounts"],
    queryFn: () => must(supabase.from("accounts").select("id,code,name,type").order("code")),
  });
  const [date, setDate] = useState(isoDate(new Date()));
  const [desc, setDesc] = useState("");
  const [lines, setLines] = useState<(DraftJournalLine & { memo: string })[]>([
    { account_id: "", debit: 0, credit: 0, memo: "" },
    { account_id: "", debit: 0, credit: 0, memo: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const t = entryTotals(lines);
  const upd = (i: number, p: Partial<DraftJournalLine & { memo: string }>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function save() {
    if (!desc.trim()) return void toast.error("اكتب بيان القيد");
    if (!t.balanced) return void toast.error("القيد غير متوازن أو به سطر ناقص");
    setBusy(true);
    const { error } = await supabase.rpc("post_manual_entry", { _date: date, _description: desc.trim(), _lines: lines });
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("تم ترحيل القيد");
    qc.invalidateQueries({ queryKey: ["accounting"] });
    setDesc("");
    setLines([{ account_id: "", debit: 0, credit: 0, memo: "" }, { account_id: "", debit: 0, credit: 0, memo: "" }]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>قيد يومية يدوي</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">مثل: رأس المال الافتتاحي، شراء جهاز، سحوبات المالك، رواتب مستحقة، إيداع النقد في البنك.</p>
        <div className="grid grid-cols-[10rem_1fr] gap-2">
          <Field label="التاريخ"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="البيان"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثلاً: إيداع رأس المال في البنك" /></Field>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2 px-1 text-xs text-muted-foreground"><span>الحساب</span><span>مدين</span><span>دائن</span><span className="w-9" /></div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_6rem_auto] gap-2">
              <NativeSelect value={l.account_id} onChange={(e) => upd(i, { account_id: e.target.value })}>
                <option value="">— اختر الحساب —</option>
                {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((tp) => (
                  <optgroup key={tp} label={ACCOUNT_TYPES[tp]}>
                    {accounts.filter((a) => a.type === tp).map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                  </optgroup>
                ))}
              </NativeSelect>
              <Input type="number" min={0} value={l.debit || ""} onChange={(e) => upd(i, { debit: Number(e.target.value), credit: 0 })} />
              <Input type="number" min={0} value={l.credit || ""} onChange={(e) => upd(i, { credit: Number(e.target.value), debit: 0 })} />
              <Button size="icon" variant="ghost" disabled={lines.length <= 2} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, { account_id: "", debit: 0, credit: 0, memo: "" }])}><Plus /> سطر</Button>
        </div>
        <div className={cn("num flex items-center justify-between rounded-xl px-4 py-3 text-sm", t.balanced ? "bg-success/10" : "bg-destructive/10")}>
          <span className="flex items-center gap-2 font-medium">
            {t.balanced ? <CheckCircle2 className="size-4 text-success" /> : <AlertTriangle className="size-4 text-destructive" />}
            {t.balanced ? "القيد متوازن" : `الفرق ${money(Math.abs(t.debit - t.credit), cur)}`}
          </span>
          <span>مدين {money(t.debit, cur)} · دائن {money(t.credit, cur)}</span>
        </div>
        <Button onClick={save} disabled={busy || !t.balanced}>{busy && <Loader2 className="animate-spin" />} ترحيل القيد</Button>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Ledger ---------------- */

function Ledger({ from, to, cur, accounts }: { from: string; to: string; cur: string; accounts: BalanceRow[] }) {
  const [acc, setAcc] = useState("");
  const account = accounts.find((a) => a.account_id === acc);
  const opening = useQuery({ ...balancesQuery("1900-01-01", dayBefore(from)), enabled: !!acc });
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["accounting", "ledger", acc, from, to],
    enabled: !!acc,
    queryFn: async () => {
      const rows = await must(
        supabase
          .from("journal_lines")
          .select("id,debit,credit,memo, entry:journal_entries!inner(entry_no,entry_date,description)")
          .eq("account_id", acc)
          .gte("entry.entry_date", from)
          .lte("entry.entry_date", to),
      );
      return rows.sort((a, b) => (a.entry.entry_date + String(a.entry.entry_no).padStart(9, "0")).localeCompare(b.entry.entry_date + String(b.entry.entry_no).padStart(9, "0")));
    },
  });
  const openRow = opening.data?.find((r) => r.account_id === acc);
  const openBal = openRow ? balanceOf(openRow) : 0;
  const debitNormal = account ? isDebitNormal(account.type) : true;
  let running = openBal;

  return (
    <Panel>
      <NativeSelect value={acc} onChange={(e) => setAcc(e.target.value)} className="mb-4 sm:max-w-sm">
        <option value="">— اختر الحساب لعرض حركته —</option>
        {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.code} — {a.name}</option>)}
      </NativeSelect>
      {!acc ? <Empty><BookOpen className="mx-auto mb-2 size-6" />اختر حساباً</Empty> : isLoading ? <Empty>جاري التحميل…</Empty> : (
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="py-2 text-start font-medium">التاريخ</th>
                <th className="py-2 text-start font-medium">القيد</th>
                <th className="py-2 text-start font-medium">البيان</th>
                <th className="py-2 text-end font-medium">مدين</th>
                <th className="py-2 text-end font-medium">دائن</th>
                <th className="py-2 text-end font-medium">الرصيد</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border bg-muted/40">
                <td colSpan={5} className="py-2 font-medium">رصيد أول المدة</td>
                <td className="py-2 text-end font-semibold">{money(openBal, cur)}</td>
              </tr>
              {lines.map((l) => {
                const d = Number(l.debit), c = Number(l.credit);
                running = Math.round((running + (debitNormal ? d - c : c - d)) * 100) / 100;
                return (
                  <tr key={l.id} className="border-b border-border/50">
                    <td className="py-2">{l.entry.entry_date}</td>
                    <td className="py-2 text-primary">#{l.entry.entry_no}</td>
                    <td className="max-w-[16rem] truncate py-2">{l.entry.description}</td>
                    <td className="py-2 text-end">{d ? money(d, cur) : ""}</td>
                    <td className="py-2 text-end">{c ? money(c, cur) : ""}</td>
                    <td className="py-2 text-end font-medium">{money(running, cur)}</td>
                  </tr>
                );
              })}
              <tr className="bg-primary-soft font-semibold">
                <td colSpan={5} className="py-2.5">رصيد آخر المدة</td>
                <td className="py-2.5 text-end">{money(running, cur)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Reports ---------------- */

function ReportHead({ title, sub }: { title: string; sub: string }) {
  const { data: s } = useSettings();
  return (
    <div className="mb-4 border-b border-border pb-3 text-center">
      <div className="text-xs text-muted-foreground">{s?.name}</div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <div className="num text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function TrialBalance({ rows, cur, from, to }: { rows: BalanceRow[] | undefined; cur: string; from: string; to: string }) {
  const tb = useMemo(() => trialBalance(rows ?? []), [rows]);
  return (
    <Panel className="print-area">
      <ReportHead title="ميزان المراجعة" sub={`من ${from} إلى ${to}`} />
      {!tb.lines.length ? <Empty>لا توجد حركات في هذه الفترة</Empty> : (
        <table className="num w-full text-sm">
          <thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="py-2 text-start font-medium">الحساب</th><th className="py-2 text-end font-medium">مدين</th><th className="py-2 text-end font-medium">دائن</th></tr></thead>
          <tbody>
            {tb.lines.map((l) => (
              <tr key={l.account_id} className="border-b border-border/50">
                <td className="py-2"><span className="text-muted-foreground">{l.code}</span> {l.name}</td>
                <td className="py-2 text-end">{l.debitBal ? money(l.debitBal, cur) : ""}</td>
                <td className="py-2 text-end">{l.creditBal ? money(l.creditBal, cur) : ""}</td>
              </tr>
            ))}
            <tr className="bg-primary-soft font-bold">
              <td className="py-2.5">الإجمالي</td>
              <td className="py-2.5 text-end">{money(tb.totalDebit, cur)}</td>
              <td className="py-2.5 text-end">{money(tb.totalCredit, cur)}</td>
            </tr>
          </tbody>
        </table>
      )}
      <BalancedBadge ok={tb.balanced} />
    </Panel>
  );
}

function BalancedBadge({ ok, label = "الميزان متوازن" }: { ok: boolean; label?: string }) {
  return (
    <div className={cn("mt-4 flex items-center gap-2 text-sm font-medium", ok ? "text-success" : "text-destructive")}>
      {ok ? <Scale className="size-4" /> : <AlertTriangle className="size-4" />} {ok ? label : "يوجد فرق — راجع القيود"}
    </div>
  );
}

function Section({ title, items, total, cur, totalLabel }: { title: string; items: { account_id: string; code: string; name: string; amount: number }[]; total: number; cur: string; totalLabel: string }) {
  return (
    <div className="mb-5">
      <h3 className="mb-1 text-sm font-semibold text-primary">{title}</h3>
      <table className="num w-full text-sm">
        <tbody>
          {items.length === 0 && <tr><td className="py-1.5 text-muted-foreground">—</td></tr>}
          {items.map((i) => (
            <tr key={i.account_id} className="border-b border-border/50">
              <td className="py-1.5 ps-3">{i.name}</td>
              <td className={cn("py-1.5 text-end", i.amount < 0 && "text-destructive")}>{money(i.amount, cur)}</td>
            </tr>
          ))}
          <tr className="font-semibold"><td className="py-2">{totalLabel}</td><td className="py-2 text-end">{money(total, cur)}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function IncomeStatement({ rows, cur, from, to }: { rows: BalanceRow[] | undefined; cur: string; from: string; to: string }) {
  const is = useMemo(() => incomeStatement(rows ?? []), [rows]);
  return (
    <Panel className="print-area mx-auto max-w-2xl">
      <ReportHead title="قائمة الدخل" sub={`للفترة من ${from} إلى ${to}`} />
      <Section title="الإيرادات" items={is.revenue} total={is.totalRevenue} cur={cur} totalLabel="صافي الإيرادات" />
      <Section title="المصروفات" items={is.expenses} total={is.totalExpenses} cur={cur} totalLabel="إجمالي المصروفات" />
      <div className={cn("num flex justify-between rounded-xl px-4 py-3 font-display text-lg font-bold", is.netIncome >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
        <span>{is.netIncome >= 0 ? "صافي الربح" : "صافي الخسارة"}</span><span>{money(Math.abs(is.netIncome), cur)}</span>
      </div>
    </Panel>
  );
}

function BalanceSheet({ rows, cur, to }: { rows: BalanceRow[] | undefined; cur: string; to: string }) {
  const bs = useMemo(() => balanceSheet(rows ?? []), [rows]);
  return (
    <Panel className="print-area">
      <ReportHead title="الميزانية العمومية (قائمة المركز المالي)" sub={`كما في ${to}`} />
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <Section title="الأصول" items={bs.assets} total={bs.totalAssets} cur={cur} totalLabel="إجمالي الأصول" />
        </div>
        <div>
          <Section title="الخصوم" items={bs.liabilities} total={bs.totalLiabilities} cur={cur} totalLabel="إجمالي الخصوم" />
          <Section
            title="حقوق الملكية"
            items={[...bs.equity, { account_id: "earnings", code: "", name: "أرباح (خسائر) الفترة غير المرحّلة", amount: bs.earnings }]}
            total={bs.totalEquity}
            cur={cur}
            totalLabel="إجمالي حقوق الملكية"
          />
          <div className="num flex justify-between rounded-xl bg-primary-soft px-4 py-3 font-bold">
            <span>الخصوم + حقوق الملكية</span><span>{money(bs.totalLiabilities + bs.totalEquity, cur)}</span>
          </div>
        </div>
      </div>
      <BalancedBadge ok={bs.balanced} label="الأصول = الخصوم + حقوق الملكية" />
    </Panel>
  );
}

/* ---------------- Chart of accounts ---------------- */

function Accounts({ rows, cur, isAdmin }: { rows: BalanceRow[] | undefined; cur: string; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ code: "", name: "", type: "expense" as AccountType });
  const { data: meta = [] } = useQuery({
    queryKey: ["accounting", "accounts-meta"],
    queryFn: () => must(supabase.from("accounts").select("id,is_system")),
  });
  const system = new Set(meta.filter((m) => m.is_system).map((m) => m.id));

  async function add() {
    if (!/^\d{3,6}$/.test(f.code) || !f.name.trim()) return void toast.error("أدخل رقم حساب (3-6 أرقام) واسماً");
    const { error } = await supabase.from("accounts").insert({ code: f.code, name: f.name.trim(), type: f.type });
    if (error) return void toast.error(error.message.includes("duplicate") ? "رقم الحساب مستخدم" : error.message);
    setF({ code: "", name: "", type: f.type });
    qc.invalidateQueries({ queryKey: ["accounting"] });
  }
  async function del(id: string) {
    if (!confirm("حذف الحساب؟")) return;
    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) return void toast.error("لا يمكن حذف حساب عليه قيود");
    qc.invalidateQueries({ queryKey: ["accounting"] });
  }

  return (
    <div className="space-y-4">
      {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((tp) => {
        const list = (rows ?? []).filter((r) => r.type === tp);
        return (
          <Panel key={tp} title={ACCOUNT_TYPES[tp]}>
            <table className="num w-full text-sm">
              <tbody>
                {list.map((a) => (
                  <tr key={a.account_id} className="border-b border-border/50 last:border-0">
                    <td className="w-16 py-2 text-muted-foreground">{a.code}</td>
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 text-end font-medium">{money(balanceOf(a), cur)}</td>
                    <td className="w-10 py-2 text-end">
                      {isAdmin && !system.has(a.account_id) && (
                        <Button size="icon" variant="ghost" className="size-7" onClick={() => del(a.account_id)} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        );
      })}
      {isAdmin && (
        <Panel title="إضافة حساب">
          <div className="grid grid-cols-[6rem_1fr_9rem_auto] gap-2">
            <Input placeholder="الرقم" inputMode="numeric" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} />
            <Input placeholder="اسم الحساب" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            <NativeSelect value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as AccountType })}>
              {(Object.keys(ACCOUNT_TYPES) as AccountType[]).map((t) => <option key={t} value={t}>{ACCOUNT_TYPES[t]}</option>)}
            </NativeSelect>
            <Button onClick={add}><Plus /> إضافة</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">بنود المصروفات المضافة هنا تظهر تلقائياً في نموذج تسجيل المصروف.</p>
        </Panel>
      )}
    </div>
  );
}
