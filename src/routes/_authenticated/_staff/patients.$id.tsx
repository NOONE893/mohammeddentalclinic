import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CalendarPlus, ChevronRight, MessageCircle, Pencil, Phone, Plus, Receipt, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, InvoicePill, Panel, Pill } from "@/components/clinic/staff-shell";
import { NativeSelect } from "@/components/clinic/fields";
import { PatientDialog } from "@/components/clinic/patient-dialog";
import { AppointmentDialog } from "@/components/clinic/appointment-dialog";
import { InvoiceDialog, type DraftLine } from "@/components/clinic/invoice-dialog";
import { ToothChart } from "@/components/clinic/tooth-chart";
import { apptSelect, invoiceSelect, must, servicesQuery, type ApptRow, type InvoiceRow } from "@/lib/data";
import { ageFrom, APPT_STATUS, dateLabel, hhmm, invoiceBalance, money, timeLabel, TREATMENT_STATUS, whatsappLink } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/_staff/patients/$id")({
  head: () => ({ meta: [{ title: "ملف المريض | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: PatientPage,
});

function PatientPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const cur = s?.currency ?? "ر.س";
  const { data: services = [] } = useQuery(servicesQuery);

  const { data, isLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const [patient, teeth, plan, appts, invoices] = await Promise.all([
        must(supabase.from("patients").select("*").eq("id", id).single()),
        must(supabase.from("tooth_records").select("tooth,status,note").eq("patient_id", id)),
        must(supabase.from("treatment_items").select("*").eq("patient_id", id).order("created_at")),
        must(supabase.from("appointments").select(apptSelect).eq("patient_id", id).order("appt_date", { ascending: false }).order("appt_time", { ascending: false })) as Promise<ApptRow[]>,
        must(supabase.from("invoices").select(invoiceSelect).eq("patient_id", id).order("number", { ascending: false })) as Promise<InvoiceRow[]>,
      ]);
      return { patient, teeth, plan, appts, invoices };
    },
  });

  const [edit, setEdit] = useState(false);
  const [appt, setAppt] = useState<{ open: boolean; a?: ApptRow | null }>({ open: false });
  const [inv, setInv] = useState<{ open: boolean; lines?: DraftLine[] }>({ open: false });
  const [newItem, setNewItem] = useState({ title: "", tooth: "", price: "" });

  if (isLoading || !data) return <Empty>جاري التحميل…</Empty>;
  const p = data.patient;
  const age = ageFrom(p.birth_date);
  const wa = whatsappLink(p.phone, `مرحباً ${p.full_name}،`);
  const planTotal = data.plan.reduce((x, i) => x + Number(i.price), 0);
  const balance = data.invoices.reduce((x, i) => x + invoiceBalance(Number(i.total), i.payments).due, 0);

  async function addItem() {
    if (!newItem.title.trim()) return void toast.error("اكتب اسم الإجراء");
    const { error } = await supabase.from("treatment_items").insert({
      patient_id: id,
      title: newItem.title.trim(),
      tooth: newItem.tooth ? Number(newItem.tooth) : null,
      price: Number(newItem.price) || 0,
    });
    if (error) return void toast.error(error.message);
    setNewItem({ title: "", tooth: "", price: "" });
    qc.invalidateQueries({ queryKey: ["patient", id] });
  }
  async function updItem(itemId: string, status: string) {
    const { error } = await supabase.from("treatment_items").update({ status }).eq("id", itemId);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["patient", id] });
  }
  async function delItem(itemId: string) {
    const { error } = await supabase.from("treatment_items").delete().eq("id", itemId);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["patient", id] });
  }

  return (
    <>
      <Link to="/patients" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-4" /> المرضى
      </Link>

      <div className="mb-5 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-start gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft font-display text-2xl font-bold text-primary">{p.full_name.charAt(0)}</div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{p.full_name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {p.phone && <span dir="ltr" className="num">{p.phone}</span>}
              {age !== null && <span>{age} سنة</span>}
              {p.gender && <span>{p.gender === "male" ? "ذكر" : "أنثى"}</span>}
              {p.national_id && <span className="num">هوية: {p.national_id}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {p.phone && <Button asChild size="sm" variant="outline"><a href={`tel:${p.phone}`}><Phone /> اتصال</a></Button>}
            <Button asChild size="sm" variant="outline"><Link to="/orthodontics" search={{ patient: id }}>ملف التقويم</Link></Button>
            {wa && <Button asChild size="sm" variant="whatsapp"><a href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle /> واتساب</a></Button>}
            <Button size="sm" variant="ghost" onClick={() => setEdit(true)}><Pencil /> تعديل</Button>
          </div>
        </div>
        {(p.allergies || p.medical_notes) && (
          <div className="mt-4 flex gap-2 rounded-xl bg-destructive/8 p-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div>
              {p.allergies && <div><b>حساسية:</b> {p.allergies}</div>}
              {p.medical_notes && <div><b>التاريخ المرضي:</b> {p.medical_notes}</div>}
            </div>
          </div>
        )}
        {p.notes && <p className="mt-3 text-sm text-muted-foreground">📝 {p.notes}</p>}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <Stat k="الزيارات" v={String(data.appts.filter((a) => a.status === "done" || a.status === "arrived").length)} />
          <Stat k="خطة العلاج" v={money(planTotal, cur)} />
          <Stat k="المتبقي عليه" v={money(balance, cur)} warn={balance > 0} />
        </div>
      </div>

      <Tabs defaultValue="chart" dir="rtl">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="chart">مخطط الأسنان</TabsTrigger>
          <TabsTrigger value="plan">خطة العلاج</TabsTrigger>
          <TabsTrigger value="appts">المواعيد</TabsTrigger>
          <TabsTrigger value="invoices">الفواتير</TabsTrigger>
        </TabsList>

        <TabsContent value="chart">
          <Panel title="مخطط الأسنان" action={<span className="text-xs text-muted-foreground">اضغط على السن لتحديث حالته</span>}>
            <ToothChart patientId={id} records={data.teeth} />
          </Panel>
        </TabsContent>

        <TabsContent value="plan">
          <Panel
            title="خطة العلاج"
            action={
              data.plan.length > 0 && (
                <Button size="sm" variant="soft" onClick={() => setInv({
                  open: true,
                  lines: data.plan.filter((i) => i.status === "done").map((i) => ({ description: i.tooth ? `${i.title} — سن ${i.tooth}` : i.title, qty: 1, unit_price: Number(i.price) })),
                })}>
                  <Receipt /> فوترة المنفّذ
                </Button>
              )
            }
          >
            {data.plan.length === 0 ? <Empty>لا توجد بنود بعد</Empty> : (
              <ul className="divide-y divide-border">
                {data.plan.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{i.title}</div>
                      <div className="num text-xs text-muted-foreground">{i.tooth ? `سن ${i.tooth} · ` : ""}{money(Number(i.price), cur)}</div>
                    </div>
                    <NativeSelect value={i.status} onChange={(e) => updItem(i.id, e.target.value)} className="h-8 w-auto text-xs">
                      {Object.entries(TREATMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </NativeSelect>
                    <Button size="icon" variant="ghost" onClick={() => delItem(i.id)} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 grid grid-cols-[1fr_4.5rem_5.5rem_auto] gap-2 border-t border-border pt-4">
              <div className="relative">
                <Input list="svc-list" placeholder="الإجراء" value={newItem.title} onChange={(e) => {
                  const sv = services.find((x) => x.name === e.target.value);
                  setNewItem((n) => ({ ...n, title: e.target.value, price: sv ? String(sv.price) : n.price }));
                }} />
                <datalist id="svc-list">{services.map((sv) => <option key={sv.id} value={sv.name} />)}</datalist>
              </div>
              <Input placeholder="السن" inputMode="numeric" value={newItem.tooth} onChange={(e) => setNewItem((n) => ({ ...n, tooth: e.target.value }))} />
              <Input placeholder="السعر" inputMode="decimal" value={newItem.price} onChange={(e) => setNewItem((n) => ({ ...n, price: e.target.value }))} />
              <Button size="icon" onClick={addItem} aria-label="إضافة"><Plus /></Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="appts">
          <Panel title="المواعيد" action={<Button size="sm" onClick={() => setAppt({ open: true })}><CalendarPlus /> موعد جديد</Button>}>
            {data.appts.length === 0 ? <Empty>لا توجد مواعيد</Empty> : (
              <ul className="divide-y divide-border">
                {data.appts.map((a) => {
                  const st = APPT_STATUS[a.status as keyof typeof APPT_STATUS] ?? APPT_STATUS.booked;
                  return (
                    <li key={a.id}>
                      <button onClick={() => setAppt({ open: true, a })} className="flex w-full items-center gap-3 py-3 text-start">
                        <div className="min-w-0 flex-1">
                          <div className="num font-medium">{dateLabel(a.appt_date)} · {timeLabel(hhmm(a.appt_time))}</div>
                          <div className="text-xs text-muted-foreground">{a.service?.name ?? "—"}{a.doctor ? ` · ${a.doctor.name}` : ""}</div>
                        </div>
                        <Pill tone={st.tone}>{st.label}</Pill>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="invoices">
          <Panel title="الفواتير" action={<Button size="sm" onClick={() => setInv({ open: true })}><Plus /> فاتورة</Button>}>
            {data.invoices.length === 0 ? <Empty>لا توجد فواتير</Empty> : (
              <ul className="divide-y divide-border">
                {data.invoices.map((i) => {
                  const b = invoiceBalance(Number(i.total), i.payments);
                  return (
                    <li key={i.id}>
                      <Link to="/invoices/$id" params={{ id: i.id }} className="flex items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="num font-medium">#{i.number} · {money(Number(i.total), cur)}</div>
                          <div className="num text-xs text-muted-foreground">{i.issue_date}</div>
                        </div>
                        <InvoicePill status={b.status} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <PatientDialog open={edit} onOpenChange={setEdit} patient={p} />
      <AppointmentDialog open={appt.open} onOpenChange={(v) => setAppt((x) => ({ ...x, open: v }))} appointment={appt.a} defaults={{ patientId: id }} />
      <InvoiceDialog open={inv.open} onOpenChange={(v) => setInv((x) => ({ ...x, open: v }))} patientId={id} lines={inv.lines} />
    </>
  );
}

function Stat({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-2 py-2.5">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div className={`num mt-0.5 font-semibold ${warn ? "text-destructive" : ""}`}>{v}</div>
    </div>
  );
}
