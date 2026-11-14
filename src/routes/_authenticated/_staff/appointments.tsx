import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, PageHeader, Pill } from "@/components/clinic/staff-shell";
import { NativeSelect } from "@/components/clinic/fields";
import { AppointmentDialog } from "@/components/clinic/appointment-dialog";
import { ReminderButton } from "@/components/clinic/reminder";
import { appointmentsByDate, doctorsQuery, type ApptRow } from "@/lib/data";
import { APPT_STATUS, dateLabel, generateSlots, hhmm, isoDate, timeLabel } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_staff/appointments")({
  head: () => ({ meta: [{ title: "المواعيد | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: AppointmentsPage,
});

function shift(iso: string, days: number) {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + days));
}

function AppointmentsPage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(isoDate(new Date()));
  const [doctor, setDoctor] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; appt?: ApptRow | null | undefined; time?: string | undefined }>({ open: false });
  const { data: settings } = useSettings();
  const { data: doctors = [] } = useQuery(doctorsQuery);
  const { data: appts = [], isLoading } = useQuery(appointmentsByDate(date));

  const list = appts.filter((a) => !doctor || a.doctor_id === doctor);
  const slots = useMemo(
    () => (settings ? generateSlots(hhmm(settings.open_time), hhmm(settings.close_time), settings.slot_minutes) : []),
    [settings],
  );
  const byTime = new Map<string, ApptRow[]>();
  for (const a of list) {
    const k = hhmm(a.appt_time);
    byTime.set(k, [...(byTime.get(k) ?? []), a]);
  }
  const times = Array.from(new Set([...slots, ...byTime.keys()])).sort();
  const isToday = date === isoDate(new Date());
  const counts = Object.fromEntries(Object.keys(APPT_STATUS).map((k) => [k, list.filter((a) => a.status === k).length]));

  async function setStatus(a: ApptRow, status: string) {
    const { error } = await supabase.from("appointments").update({ status }).eq("id", a.id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["appointments"] });
  }

  return (
    <>
      <PageHeader
        title="المواعيد"
        subtitle={`${list.filter((a) => a.status !== "cancelled").length} موعد · ${dateLabel(date)}`}
        actions={<Button onClick={() => setDialog({ open: true })}><Plus /> موعد جديد</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-xl border border-border bg-card p-1">
          <Button size="icon" variant="ghost" onClick={() => setDate(shift(date, -1))} aria-label="اليوم السابق"><ChevronRight /></Button>
          <Button size="sm" variant={isToday ? "soft" : "ghost"} onClick={() => setDate(isoDate(new Date()))}>اليوم</Button>
          <Button size="icon" variant="ghost" onClick={() => setDate(shift(date, 1))} aria-label="اليوم التالي"><ChevronLeft /></Button>
        </div>
        <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-auto" />
        <NativeSelect value={doctor} onChange={(e) => setDoctor(e.target.value)} className="w-auto">
          <option value="">كل الأطباء</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </NativeSelect>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(APPT_STATUS).map(([k, v]) => counts[k] ? <Pill key={k} tone={v.tone}>{v.label}: {counts[k]}</Pill> : null)}
      </div>

      {settings && !settings.working_days.includes(new Date(date).getDay()) && (
        <div className="mb-4 rounded-xl bg-sand px-4 py-3 text-sm text-sand-foreground">هذا اليوم إجازة حسب ساعات العمل.</div>
      )}

      {isLoading ? (
        <Empty>جاري التحميل…</Empty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {times.map((t) => {
            const items = byTime.get(t) ?? [];
            return (
              <div key={t} className="flex gap-3 border-b border-dashed border-border px-3 py-2 last:border-0">
                <div className="num w-16 shrink-0 pt-2 text-xs text-muted-foreground">{timeLabel(t)}</div>
                <div className="flex-1 space-y-2">
                  {items.map((a) => {
                    const st = APPT_STATUS[a.status as keyof typeof APPT_STATUS] ?? APPT_STATUS.booked;
                    return (
                      <div key={a.id} className={cn("rounded-xl border-s-4 bg-muted/50 p-3", a.status === "cancelled" ? "border-muted-foreground/30 opacity-60" : "border-primary")}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link to="/patients/$id" params={{ id: a.patient_id }} className="font-semibold hover:text-primary">{a.patient?.full_name}</Link>
                            <div className="text-xs text-muted-foreground">
                              {a.service?.name ?? "—"}{a.doctor ? ` · ${a.doctor.name}` : ""} · {a.duration_min} د
                            </div>
                          </div>
                          <Pill tone={st.tone}>{st.label}</Pill>
                        </div>
                        {a.notes && <div className="mt-2 inline-block rounded-md bg-sand px-2 py-0.5 text-xs text-sand-foreground">📝 {a.notes}</div>}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <NativeSelect value={a.status} onChange={(e) => setStatus(a, e.target.value)} className="h-8 w-auto text-xs">
                            {Object.entries(APPT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </NativeSelect>
                          {a.status === "booked" && <ReminderButton a={a} />}
                          <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, appt: a })}><Pencil /> تعديل</Button>
                        </div>
                      </div>
                    );
                  })}
                  {items.length === 0 && (
                    <button
                      onClick={() => setDialog({ open: true, time: t })}
                      className="w-full rounded-xl py-2 text-start text-xs text-muted-foreground/60 hover:bg-primary-soft/50 hover:text-primary"
                    >
                      + متاح
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AppointmentDialog
        open={dialog.open}
        onOpenChange={(v) => setDialog((d) => ({ ...d, open: v }))}
        appointment={dialog.appt}
        defaults={dialog.time ? { date, time: dialog.time } : { date }}
      />
    </>
  );
}
