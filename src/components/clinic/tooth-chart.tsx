import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOWER_TEETH, TOOTH_STATUS, UPPER_TEETH, type ToothStatus } from "@/lib/clinic";
import { cn } from "@/lib/utils";

interface Rec { tooth: number; status: string; note: string }

export function ToothChart({ patientId, records }: { patientId: string; records: Rec[] }) {
  const qc = useQueryClient();
  const map = new Map(records.map((r) => [r.tooth, r]));
  const [sel, setSel] = useState<number | null>(null);
  const [status, setStatus] = useState<ToothStatus>("healthy");
  const [note, setNote] = useState("");

  function openTooth(t: number) {
    const r = map.get(t);
    setStatus((r?.status as ToothStatus) ?? "healthy");
    setNote(r?.note ?? "");
    setSel(t);
  }

  async function save() {
    if (sel == null) return;
    const { error } = await supabase
      .from("tooth_records")
      .upsert({ patient_id: patientId, tooth: sel, status, note, updated_at: new Date().toISOString() }, { onConflict: "patient_id,tooth" });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["patient", patientId] });
    setSel(null);
  }

  const Tooth = ({ t, upper }: { t: number; upper: boolean }) => {
    const r = map.get(t);
    const st = (r?.status as ToothStatus) ?? "healthy";
    return (
      <button
        type="button"
        onClick={() => openTooth(t)}
        className="group flex flex-col items-center gap-1"
        title={`${t} — ${TOOTH_STATUS[st].label}${r?.note ? ` — ${r.note}` : ""}`}
      >
        {!upper && <span className="num text-[10px] text-muted-foreground">{t}</span>}
        <span
          className={cn(
            "block h-7 w-full border-2 border-foreground/15 transition group-hover:scale-110 sm:h-9",
            upper ? "rounded-t-[40%] rounded-b-[55%]" : "rounded-t-[55%] rounded-b-[40%]",
            TOOTH_STATUS[st].cls,
            st === "missing" && "opacity-40",
            r?.note && "ring-2 ring-warning ring-offset-1",
          )}
        />
        {upper && <span className="num text-[10px] text-muted-foreground">{t}</span>}
      </button>
    );
  };

  return (
    <div>
      <div dir="ltr" className="space-y-3">
        <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5 sm:gap-1.5">
          {UPPER_TEETH.map((t) => <Tooth key={t} t={t} upper />)}
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5 sm:gap-1.5">
          {LOWER_TEETH.map((t) => <Tooth key={t} t={t} upper={false} />)}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5 text-xs">
        {Object.entries(TOOTH_STATUS).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5"><i className={cn("block size-3 rounded border border-foreground/15", v.cls)} />{v.label}</span>
        ))}
      </div>

      <Dialog open={sel != null} onOpenChange={(v) => !v && setSel(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>السن رقم <span className="num">{sel}</span></DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(TOOTH_STATUS).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setStatus(k as ToothStatus)}
                className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", status === k ? "border-primary bg-primary-soft font-semibold" : "border-border")}
              >
                <i className={cn("block size-4 rounded border border-foreground/15", v.cls)} />{v.label}
              </button>
            ))}
          </div>
          <Input placeholder="ملاحظة (اختياري)" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={save}>حفظ</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
