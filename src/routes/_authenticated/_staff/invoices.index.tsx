import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, InvoicePill, PageHeader } from "@/components/clinic/staff-shell";
import { InvoiceDialog } from "@/components/clinic/invoice-dialog";
import { invoicesQuery } from "@/lib/data";
import { invoiceBalance, money } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_staff/invoices/")({
  head: () => ({ meta: [{ title: "الفواتير | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: InvoicesPage,
});

function InvoicesPage() {
  const { data: invoices = [], isLoading } = useQuery(invoicesQuery);
  const { data: s } = useSettings();
  const cur = s?.currency ?? "ر.س";
  const [filter, setFilter] = useState<"all" | "due" | "paid">("all");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const rows = invoices
    .map((i) => ({ ...i, b: invoiceBalance(Number(i.total), i.payments) }))
    .filter((i) => (filter === "all" ? true : filter === "paid" ? i.b.status === "paid" : i.b.due > 0))
    .filter((i) => !q.trim() || (i.patient?.full_name ?? "").includes(q.trim()) || String(i.number).includes(q.trim()));
  const totalDue = invoices.reduce((x, i) => x + invoiceBalance(Number(i.total), i.payments).due, 0);

  return (
    <>
      <PageHeader
        title="الفواتير"
        subtitle={<>إجمالي المستحقات: <b className="num text-foreground">{money(totalDue, cur)}</b></>}
        actions={<Button onClick={() => setOpen(true)}><Plus /> فاتورة جديدة</Button>}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex rounded-xl border border-border bg-card p-1">
          {([["all", "الكل"], ["due", "غير مسددة"], ["paid", "مدفوعة"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn("rounded-lg px-3 py-1.5 text-sm", filter === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>
          ))}
        </div>
        <div className="relative min-w-48 flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالمريض أو رقم الفاتورة" className="ps-9" />
        </div>
      </div>
      {isLoading ? <Empty>جاري التحميل…</Empty> : rows.length === 0 ? <Empty>لا توجد فواتير</Empty> : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {rows.map((i) => (
            <Link key={i.id} to="/invoices/$id" params={{ id: i.id }} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50">
              <div className="num w-14 shrink-0 text-sm font-semibold text-primary">#{i.number}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{i.patient?.full_name}</div>
                <div className="num text-xs text-muted-foreground">{i.issue_date}{i.b.due > 0 ? ` · متبقي ${money(i.b.due, cur)}` : ""}</div>
              </div>
              <div className="text-end">
                <div className="num text-sm font-semibold">{money(Number(i.total), cur)}</div>
                <InvoicePill status={i.b.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
      <InvoiceDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
