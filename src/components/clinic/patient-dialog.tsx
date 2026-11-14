import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/clinic/fields";
import type { Patient } from "@/lib/data";

export function PatientDialog({
  open, onOpenChange, patient, onCreated,
}: { open: boolean; onOpenChange: (v: boolean) => void; patient?: Patient | null; onCreated?: (id: string) => void }) {
  const qc = useQueryClient();
  const empty = { full_name: "", phone: "", gender: "", birth_date: "", national_id: "", allergies: "", medical_notes: "", notes: "" };
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setF(patient ? {
      full_name: patient.full_name, phone: patient.phone, gender: patient.gender, birth_date: patient.birth_date ?? "",
      national_id: patient.national_id, allergies: patient.allergies, medical_notes: patient.medical_notes, notes: patient.notes,
    } : empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient]);

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    if (f.full_name.trim().length < 2) return void toast.error("اكتب اسم المريض");
    setBusy(true);
    const row = { ...f, full_name: f.full_name.trim(), phone: f.phone.trim(), birth_date: f.birth_date || null };
    const res = patient
      ? await supabase.from("patients").update(row).eq("id", patient.id).select("id").single()
      : await supabase.from("patients").insert(row).select("id").single();
    setBusy(false);
    if (res.error) return void toast.error(res.error.message);
    toast.success(patient ? "تم تحديث بيانات المريض" : "تمت إضافة المريض");
    qc.invalidateQueries({ queryKey: ["patients"] });
    qc.invalidateQueries({ queryKey: ["patient", res.data.id] });
    onOpenChange(false);
    if (!patient) onCreated?.(res.data.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{patient ? "تعديل بيانات المريض" : "مريض جديد"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="الاسم الكامل" className="col-span-2"><Input value={f.full_name} onChange={set("full_name")} /></Field>
          <Field label="الجوال"><Input dir="ltr" inputMode="tel" value={f.phone} onChange={set("phone")} placeholder="05xxxxxxxx" /></Field>
          <Field label="الجنس">
            <NativeSelect value={f.gender} onChange={set("gender")}>
              <option value="">—</option><option value="male">ذكر</option><option value="female">أنثى</option>
            </NativeSelect>
          </Field>
          <Field label="تاريخ الميلاد"><Input type="date" value={f.birth_date} onChange={set("birth_date")} /></Field>
          <Field label="رقم الهوية / الإقامة"><Input dir="ltr" value={f.national_id} onChange={set("national_id")} /></Field>
          <Field label="الحساسية" className="col-span-2"><Input value={f.allergies} onChange={set("allergies")} placeholder="مثلاً: بنسلين" /></Field>
          <Field label="التاريخ المرضي" className="col-span-2"><Textarea value={f.medical_notes} onChange={set("medical_notes")} placeholder="سكري، ضغط، حمل، أدوية حالية…" /></Field>
          <Field label="ملاحظات" className="col-span-2"><Textarea value={f.notes} onChange={set("notes")} /></Field>
        </div>
        <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} حفظ</Button>
      </DialogContent>
    </Dialog>
  );
}
