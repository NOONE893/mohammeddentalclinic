import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, Check, CreditCard, Inbox, MessageCircle, Plus, Receipt, UserPlus, Users, Wallet, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Empty, PageHeader, Panel, Pill } from "@/components/clinic/staff-shell";
import { AppointmentDialog } from "@/components/clinic/appointment-dialog";
import { ReminderButton } from "@/components/clinic/reminder";
import { appointmentsByDate, bookingRequestsQuery, inventoryQuery, invoicesQuery, must, patientsQuery } from "@/lib/data";
import { APPT_STATUS, dateLabel, hhmm, invoiceBalance, isoDate, money, timeLabel, whatsappLink } from "@/lib/clinic";
import { useMe, useSettings } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/_staff/dashboard")({
  head: () => ({ meta: [{ title: "لوحة التحكم | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

function Dashboard() {
  const today = isoDate(new Date());
  const t = new Date();
  const tomorrow = isoDate(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1));
  const monthStart = today.slice(0, 8) + "01";
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: s } = useSettings();
  const cur = s?.currency ?? "ر.س";

  const todayQ = useQuery(appointmentsByDate(today));
  const tomorrowQ = useQuery(appointmentsByDate(tomorrow));
  const reqQ = useQuery(bookingRequestsQuery);
  const invQ = useQuery(invoicesQuery);
  const stockQ = useQuery(inventoryQuery);
  const patQ = useQuery(patientsQuery);
  const payQ = useQuery({
    queryKey: ["payments", "month", monthStart],
    queryFn: () => must(supabase.from("payments").select("amount").gte("paid_on", monthStart)),
  });

  const [newAppt, setNewAppt] = useState(false);

  const todays = (todayQ.data ?? []).filter((a) => a.status !== "cancelled");
  const collected = (payQ.data ?? []).reduce((x, p) => x + Number(p.amount), 0);
  const unpaid = (invQ.data ?? []).reduce((x, i) => x + invoiceBalance(Number(i.total), i.payments).due, 0);
  const unpaidCount = (invQ.data ?? []).filter((i) => invoiceBalance(Number(i.total), i.payments).due > 0).length;
  const newPatients = (patQ.data ?? []).filter((p) => p.created_at.slice(0, 10) >= monthStart).length;
  const lowStock = (stockQ.data ?? []).filter((i) => Number(i.quantity) <= Number(i.min_quantity));
  const pendingReminders = (tomorrowQ.data ?? []).filter((a) => a.status === "booked" && !a.reminder_sent_at);

  async function accept(r: NonNullable<typeof reqQ.data>[number]) {
    try {
      const phoneDigits = r.phone.replace(/\D/g, "");
      const existing = (patQ.data ?? []).find((p) => p.phone.replace(/\D/g, "") === phoneDigits && phoneDigits.length >= 8);
      let pid = existing?.id;
      if (!pid) {
        const { data, error } = await supabase.from("patients").insert({ full_name: r.full_name, phone: r.phone }).select("id").single();
        if (error) throw error;
        pid = data.id;
      }
      const { error: e1 } = await supabase.from("appointments").insert({
        patient_id: pid,
        doctor_id: r.doctor_id,
        service_id: r.service_id,
        appt_date: r.req_date,
        appt_time: r.req_time,
        notes: r.notes ? `حجز أونلاين: ${r.notes}` : "حجز أونلاين",
      });
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("booking_requests").update({ status: "accepted" }).eq("id", r.id);
      if (e2) throw e2;
      qc.invalidateQueries();
      const msg = `مرحباً ${r.full_name}، تم تأكيد موعدك في ${s?.name ?? "العيادة"} يوم ${dateLabel(r.req_date)} الساعة ${timeLabel(hhmm(r.req_time))}. نتشرف بزيارتك.`;
      const link = whatsappLink(r.phone, msg);
      toast.success("تم تأكيد الموعد", link ? { action: { label: "إرسال تأكيد واتساب", onClick: () => window.open(link, "_blank") } , duration: 10000 } : undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "تعذر التأكيد");
    }
  }

  async function reject(id: string) {
    if (!confirm("رفض هذا الطلب؟")) return;
    const { error } = await supabase.from("booking_requests").update({ status: "rejected" }).eq("id", id);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["booking_requests"] });
  }

  return (
    <>
      <PageHeader
        title={`أهلاً ${me?.name?.split(" ")[0] ?? ""} 👋`}
        subtitle={dateLabel(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="mb-5 grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
        <QuickAction icon={CalendarPlus} label="حجز موعد" onClick={() => setNewAppt(true)} />
        <QuickAction icon={UserPlus} label="مريض جديد" to="/patients" />
        <QuickAction icon={Receipt} label="فاتورة" to="/invoices" />
        <QuickAction icon={Wallet} label="مصروف" to="/finance" />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="مواعيد اليوم" value={String(todays.length)} icon={CalendarPlus} />
        <Kpi label="المحصّل هذا الشهر" value={money(collected, cur)} icon={CreditCard} />
        <Kpi label={`مستحقات (${unpaidCount} فاتورة)`} value={money(unpaid, cur)} icon={Receipt} tone="warning" />
        <Kpi label="مرضى جدد هذا الشهر" value={String(newPatients)} icon={Users} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Panel
            title={<span className="flex items-center gap-2"><Inbox className="size-4 text-primary" /> طلبات الحجز أونلاين {reqQ.data?.length ? <Pill tone="warning">{reqQ.data.length}</Pill> : null}</span>}
          >
            {!reqQ.data?.length ? (
              <Empty>لا توجد طلبات جديدة</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {reqQ.data.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{r.full_name}</div>
                      <div className="text-xs text-muted-foreground">
                        <span dir="ltr" className="num">{r.phone}</span> · {r.service?.name ?? "كشف عام"}{r.doctor ? ` · ${r.doctor.name}` : ""}
                      </div>
                      <div className="num mt-0.5 text-sm text-primary">{dateLabel(r.req_date)} · {timeLabel(hhmm(r.req_time))}</div>
                      {r.notes && <div className="mt-1 text-xs text-muted-foreground">📝 {r.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => accept(r)}><Check /> تأكيد</Button>
                      <Button size="sm" variant="outline" onClick={() => reject(r.id)} aria-label="رفض"><X /></Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="مواعيد اليوم" action={<Button asChild size="sm" variant="ghost"><Link to="/appointments">عرض الكل</Link></Button>}>
            {!todays.length ? (
              <Empty>
                لا توجد مواعيد اليوم
                <div className="mt-3"><Button size="sm" variant="soft" onClick={() => setNewAppt(true)}><Plus /> حجز موعد</Button></div>
              </Empty>
            ) : (
              <ul className="divide-y divide-border">
                {todays.map((a) => {
                  const st = APPT_STATUS[a.status as keyof typeof APPT_STATUS] ?? APPT_STATUS.booked;
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-3">
                      <div className="num w-16 shrink-0 text-sm font-semibold text-primary">{timeLabel(hhmm(a.appt_time))}</div>
                      <div className="min-w-0 flex-1">
                        <Link to="/patients/$id" params={{ id: a.patient_id }} className="font-semibold hover:text-primary">{a.patient?.full_name}</Link>
                        <div className="truncate text-xs text-muted-foreground">{a.service?.name ?? "—"}{a.doctor ? ` · ${a.doctor.name}` : ""}</div>
                      </div>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title={<span className="flex items-center gap-2"><MessageCircle className="size-4 text-whatsapp" /> تذكيرات الغد</span>}>
            {!tomorrowQ.data?.filter((a) => a.status === "booked").length ? (
              <Empty>لا توجد مواعيد غداً</Empty>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {pendingReminders.length ? `${pendingReminders.length} مريض لم يُرسل لهم تذكير بعد` : "تم إرسال كل التذكيرات ✓"}
                </p>
                <ul className="divide-y divide-border">
                  {tomorrowQ.data.filter((a) => a.status === "booked").map((a) => (
                    <li key={a.id} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{a.patient?.full_name}</div>
                        <div className="num text-xs text-muted-foreground">{timeLabel(hhmm(a.appt_time))}</div>
                      </div>
                      <ReminderButton a={a} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-warning" /> تنبيهات</span>}>
            <ul className="space-y-2 text-sm">
              {lowStock.map((i) => (
                <li key={i.id}>
                  <Link to="/inventory" className="flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2 hover:bg-warning/20">
                    <span>مخزون منخفض: {i.name}</span>
                    <span className="num text-xs text-muted-foreground">{Number(i.quantity)} / {Number(i.min_quantity)}</span>
                  </Link>
                </li>
              ))}
              {unpaidCount > 0 && (
                <li>
                  <Link to="/invoices" className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 hover:bg-muted/70">
                    <span>فواتير غير مسددة</span>
                    <span className="num text-xs text-muted-foreground">{unpaidCount}</span>
                  </Link>
                </li>
              )}
              {!lowStock.length && unpaidCount === 0 && <li className="text-muted-foreground">لا توجد تنبيهات 🎉</li>}
            </ul>
          </Panel>
        </div>
      </div>

      <AppointmentDialog open={newAppt} onOpenChange={setNewAppt} />
    </>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Users; tone?: "warning" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={tone === "warning" ? "size-4 text-warning" : "size-4 text-primary"} />
      </div>
      <div className="num mt-2 font-display text-xl font-bold md:text-2xl">{value}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, onClick, to }: { icon: typeof Users; label: string; onClick?: () => void; to?: "/patients" | "/invoices" | "/finance" }) {
  const cls = "flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-2 py-3 text-xs font-medium shadow-soft transition hover:border-primary/40 sm:flex-row sm:px-4 sm:text-sm";
  const inner = (<><span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary"><Icon className="size-[18px]" /></span>{label}</>);
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>;
}
