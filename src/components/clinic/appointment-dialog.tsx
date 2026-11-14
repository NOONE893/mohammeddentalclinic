import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "@/components/clinic/fields";
import { doctorsQuery, patientsQuery, servicesQuery, type ApptRow } from "@/lib/data";
import { APPT_STATUS, generateSlots, hhmm, isoDate, timeLabel } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointment?: ApptRow | null | undefined;
  defaults?: { date?: string | undefined; time?: string | undefined; patientId?: string | undefined };
}

export function AppointmentDialog({ open, onOpenChange, appointment, defaults }: Props) {
  const qc = useQueryClient();
  const { data: settings } = useSettings();
  const { data: patients = [] } = useQuery(patientsQuery);
  const { data: doctors = [] } = useQuery(doctorsQuery);
  const { data: services = [] } = useQuery(servicesQuery);

  const [patientId, setPatientId] = useState("");
  const [newPatient, setNewPatient] = useState(false);
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [search, setSearch] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(isoDate(new Date()));
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [status, setStatus] = useState("booked");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const a = appointment;
    setPatientId(a?.patient_id ?? defaults?.patientId ?? "");
    setNewPatient(false);
    setPName("");
    setPPhone("");
    setSearch("");
    setDoctorId(a?.doctor_id ?? doctors.find((d) => d.active)?.id ?? "");
    setServiceId(a?.service_id ?? "");
    setDate(a?.appt_date ?? defaults?.date ?? isoDate(new Date()));
    setTime(a ? hhmm(a.appt_time) : defaults?.time ?? "");
    setDuration(a?.duration_min ?? settings?.slot_minutes ?? 30);
    setStatus(a?.status ?? "booked");
    setNotes(a?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, appointment]);

  const slots = useMemo(
    () => (settings ? generateSlots(hhmm(settings.open_time), hhmm(settings.close_time), settings.slot_minutes) : []),
    [settings],
  );

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return patients.slice(0, 30);
    return patients.filter((p) => p.full_name.includes(q) || p.phone.includes(q)).slice(0, 30);
  }, [patients, search]);

  async function save() {
    if (!time) return void toast.error("اختر الوقت");
    setBusy(true);
    try {
      let pid = patientId;
      if (newPatient) {
        if (pName.trim().length < 2) throw new Error("اكتب اسم المريض");
        const { data, error } = await supabase.from("patients").insert({ full_name: pName.trim(), phone: pPhone.trim() }).select("id").single();
        if (error) throw error;
        pid = data.id;
      }
      if (!pid) throw new Error("اختر المريض");
      const row = {
        patient_id: pid,
        doctor_id: doctorId || null,
        service_id: serviceId || null,
        appt_date: date,
        appt_time: time,
        duration_min: duration,
        status,
        notes,
      };
      const { error } = appointment
        ? await supabase.from("appointments").update(row).eq("id", appointment.id)
        : await supabase.from("appointments").insert(row);
      if (error) throw error;
      toast.success(appointment ? "تم تحديث الموعد" : "تم حجز الموعد");
      qc.invalidateQueries({ queryKey: ["appointments"] });
      qc.invalidateQueries({ queryKey: ["patients"] });
      qc.invalidateQueries({ queryKey: ["patient"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!appointment || !confirm("حذف هذا الموعد؟")) return;
    const { error } = await supabase.from("appointments").delete().eq("id", appointment.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["patient"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? "تعديل الموعد" : "موعد جديد"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {!appointment && (
            <div className="space-y-2 rounded-xl bg-muted/60 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">المريض</span>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNewPatient((v) => !v)}>
                  <UserPlus /> {newPatient ? "اختيار مريض حالي" : "مريض جديد"}
                </Button>
              </div>
              {newPatient ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="الاسم" value={pName} onChange={(e) => setPName(e.target.value)} />
                  <Input placeholder="الجوال" dir="ltr" value={pPhone} onChange={(e) => setPPhone(e.target.value)} />
                </div>
              ) : (
                <>
                  <Input placeholder="ابحث بالاسم أو الجوال…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <NativeSelect value={patientId} onChange={(e) => setPatientId(e.target.value)}>
                    <option value="">— اختر المريض —</option>
                    {filtered.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name}{p.phone ? ` · ${p.phone}` : ""}</option>
                    ))}
                  </NativeSelect>
                </>
              )}
            </div>
          )}
          {appointment && (
            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <span className="text-muted-foreground">المريض: </span><b>{appointment.patient?.full_name}</b>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="التاريخ"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="الوقت">
              <NativeSelect value={time} onChange={(e) => setTime(e.target.value)}>
                <option value="">— اختر —</option>
                {time && !slots.includes(time) && <option value={time}>{timeLabel(time)}</option>}
                {slots.map((t) => <option key={t} value={t}>{timeLabel(t)}</option>)}
              </NativeSelect>
            </Field>
            <Field label="الطبيب">
              <NativeSelect value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                <option value="">— بدون —</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="الخدمة">
              <NativeSelect
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  const sv = services.find((s) => s.id === e.target.value);
                  if (sv) setDuration(sv.duration_min);
                }}
              >
                <option value="">— بدون —</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="المدة (دقيقة)"><Input type="number" min={5} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} /></Field>
            <Field label="الحالة">
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </NativeSelect>
            </Field>
          </div>
          <Field label="ملاحظات"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً: يحتاج تخدير إضافي" /></Field>
          <div className="flex gap-2">
            <Button onClick={save} disabled={busy} className="flex-1">
              {busy && <Loader2 className="animate-spin" />} حفظ
            </Button>
            {appointment && <Button variant="outline" size="icon" onClick={remove} aria-label="حذف"><Trash2 className="text-destructive" /></Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
