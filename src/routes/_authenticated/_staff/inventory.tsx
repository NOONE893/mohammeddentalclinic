import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, PageHeader, Pill } from "@/components/clinic/staff-shell";
import { Field } from "@/components/clinic/fields";
import { inventoryQuery } from "@/lib/data";
import { money } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/_staff/inventory")({
  head: () => ({ meta: [{ title: "المخزون | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: InventoryPage,
});

type Item = Tables<"inventory_items">;

function InventoryPage() {
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const { data: items = [], isLoading } = useQuery(inventoryQuery);
  const [edit, setEdit] = useState<{ open: boolean; item?: Item | undefined }>({ open: false });
  const [f, setF] = useState({ name: "", unit: "قطعة", quantity: "0", min_quantity: "0", cost: "0" });
  const low = items.filter((i) => Number(i.quantity) <= Number(i.min_quantity));

  function openEdit(item?: Item) {
    setF(item ? { name: item.name, unit: item.unit, quantity: String(item.quantity), min_quantity: String(item.min_quantity), cost: String(item.cost) } : { name: "", unit: "قطعة", quantity: "0", min_quantity: "0", cost: "0" });
    setEdit({ open: true, item });
  }

  async function save() {
    if (!f.name.trim()) return void toast.error("اكتب اسم الصنف");
    const row = { name: f.name.trim(), unit: f.unit, quantity: Number(f.quantity) || 0, min_quantity: Number(f.min_quantity) || 0, cost: Number(f.cost) || 0 };
    const { error } = edit.item ? await supabase.from("inventory_items").update(row).eq("id", edit.item.id) : await supabase.from("inventory_items").insert(row);
    if (error) return void toast.error(error.message);
    setEdit({ open: false });
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }
  async function adjust(i: Item, d: number) {
    const { error } = await supabase.from("inventory_items").update({ quantity: Math.max(0, Number(i.quantity) + d) }).eq("id", i.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }
  async function del(i: Item) {
    if (!confirm(`حذف ${i.name}؟`)) return;
    const { error } = await supabase.from("inventory_items").delete().eq("id", i.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  return (
    <>
      <PageHeader title="المخزون" subtitle={low.length ? `${low.length} صنف وصل للحد الأدنى` : "كل الأصناف متوفرة"} actions={<Button onClick={() => openEdit()}><Plus /> صنف جديد</Button>} />
      {isLoading ? <Empty>جاري التحميل…</Empty> : items.length === 0 ? <Empty>لا توجد أصناف</Empty> : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {items.map((i) => {
            const isLow = Number(i.quantity) <= Number(i.min_quantity);
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 font-semibold">{i.name} {isLow && <Pill tone="warning">منخفض</Pill>}</div>
                  <div className="num text-xs text-muted-foreground">الحد الأدنى {Number(i.min_quantity)} · التكلفة {money(Number(i.cost), s?.currency)}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" onClick={() => adjust(i, -1)} aria-label="إنقاص"><Minus /></Button>
                  <span className="num w-20 text-center text-sm font-semibold">{Number(i.quantity)} {i.unit}</span>
                  <Button size="icon" variant="outline" onClick={() => adjust(i, 1)} aria-label="زيادة"><Plus /></Button>
                </div>
                <div className="flex">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(i)} aria-label="تعديل"><Pencil /></Button>
                  <Button size="icon" variant="ghost" onClick={() => del(i)} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={edit.open} onOpenChange={(v) => setEdit((x) => ({ ...x, open: v }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{edit.item ? "تعديل صنف" : "صنف جديد"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الاسم" className="col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="الوحدة"><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></Field>
            <Field label="الكمية"><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
            <Field label="الحد الأدنى"><Input type="number" value={f.min_quantity} onChange={(e) => setF({ ...f, min_quantity: e.target.value })} /></Field>
            <Field label="تكلفة الوحدة"><Input type="number" value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
          </div>
          <Button onClick={save}>حفظ</Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
