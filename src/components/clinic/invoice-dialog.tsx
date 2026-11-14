import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/clinic/fields";
import { patientsQuery, servicesQuery } from "@/lib/data";
import { calcInvoice, money, PAY_METHODS } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";

export interface DraftLine { description: string; qty: number; unit_price: number }

export function InvoiceDialog({
  open, onOpenChange, patientId, lines: initialLines,
}: { open: boolean; onOpenChange: (v: boolean) => void; patientId?: string | undefined; lines?: DraftLine[] | undefined }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: s } = useSettings();
  const { data: patients = [] } = useQuery(patientsQuery);
  const { data: services = [] } = useQuery(servicesQuery);
  const [pid, setPid] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paidNow, setPaidNow] = useState(0);
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPid(patientId ?? "");
    setLines(initialLines?.length ? initialLines : [{ description: "", qty: 1, unit_price: 0 }]);
    setDiscount(0);
    setPaidNow(0);
    setMethod("cash");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const vatRate = Number(s?.vat_rate ?? 15);
  const totals = useMemo(() => calcInvoice(lines, discount, vatRate), [lines, discount, vatRate]);
  const cur = s?.currency ?? "ر.س";

  const upd = (i: number, patch: Partial<DraftLine>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  async function save() {
    if (!pid) return void toast.error("اختر المريض");
    const valid = lines.filter((l) => l.description.trim() && l.qty > 0);
    if (!valid.length) return void toast.error("أضف بنداً واحداً على الأقل");
    if (paidNow > totals.total) return void toast.error("المبلغ المدفوع أكبر من الإجمالي");
    setBusy(true);
    try {
      const t = calcInvoice(valid, discount, vatRate);
      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({ patient_id: pid, subtotal: t.subtotal, discount: t.discount, vat_rate: vatRate, vat_amount: t.vat, total: t.total, notes })
        .select("id")
        .single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("invoice_items").insert(valid.map((l) => ({ ...l, invoice_id: inv.id })));
      if (e2) throw e2;
      if (paidNow > 0) {
        const { error: e3 } = await supabase.from("payments").insert({ invoice_id: inv.id, amount: paidNow, method });
        if (e3) throw e3;
      }
      toast.success("تم إنشاء الفاتورة");
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      onOpenChange(false);
      navigate({ to: "/invoices/$id", params: { id: inv.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>فاتورة جديدة</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="المريض">
            <NativeSelect value={pid} onChange={(e) => setPid(e.target.value)} disabled={!!patientId}>
              <option value="">— اختر المريض —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.phone ? ` · ${p.phone}` : ""}</option>)}
            </NativeSelect>
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">البنود</span>
              <NativeSelect
                className="h-8 w-auto text-xs"
                value=""
                onChange={(e) => {
                  const sv = services.find((x) => x.id === e.target.value);
                  if (sv) setLines((ls) => [...ls.filter((l) => l.description.trim()), { description: sv.name, qty: 1, unit_price: Number(sv.price) }]);
                }}
              >
                <option value="">+ إضافة خدمة</option>
                {services.map((sv) => <option key={sv.id} value={sv.id}>{sv.name} — {money(Number(sv.price), cur)}</option>)}
              </NativeSelect>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_4rem_6rem_auto] items-center gap-2">
                <Input placeholder="الوصف" value={l.description} onChange={(e) => upd(i, { description: e.target.value })} />
                <Input type="number" min={1} value={l.qty} onChange={(e) => upd(i, { qty: Number(e.target.value) })} aria-label="الكمية" />
                <Input type="number" min={0} value={l.unit_price} onChange={(e) => upd(i, { unit_price: Number(e.target.value) })} aria-label="السعر" />
                <Button size="icon" variant="ghost" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setLines((ls) => [...ls, { description: "", qty: 1, unit_price: 0 }])}><Plus /> بند يدوي</Button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={`الخصم (${cur})`}><Input type="number" min={0} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></Field>
            <Field label={`مدفوع الآن (${cur})`}><Input type="number" min={0} value={paidNow} onChange={(e) => setPaidNow(Number(e.target.value))} /></Field>
            <Field label="طريقة الدفع">
              <NativeSelect value={method} onChange={(e) => setMethod(e.target.value)}>
                {Object.entries(PAY_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </Field>
            <Field label="ملاحظات" className="col-span-2 sm:col-span-3"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>

          <div className="num space-y-1 rounded-xl bg-muted/60 p-4 text-sm">
            <Row k="المجموع" v={money(totals.subtotal, cur)} />
            {totals.discount > 0 && <Row k="الخصم" v={`− ${money(totals.discount, cur)}`} />}
            <Row k={`ضريبة القيمة المضافة ${vatRate}%`} v={money(totals.vat, cur)} />
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold"><span>الإجمالي</span><span>{money(totals.total, cur)}</span></div>
          </div>
          <Button onClick={save} disabled={busy} className="w-full">{busy && <Loader2 className="animate-spin" />} حفظ الفاتورة</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
}
