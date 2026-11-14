import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarCheck, CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicShell } from "@/components/clinic/public-layout";
import { publicClinicQuery } from "@/lib/queries";
import { bookingSchema, getBookedSlots, submitBooking } from "@/lib/public.functions";
import { dateLabel, generateSlots, hhmm, isoDate, timeLabel, whatsappLink } from "@/lib/clinic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/book")({
  validateSearch: z.object({ service: z.string().optional() }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicClinicQuery),
  head: ({ loaderData }) => {
    const name = loaderData?.settings.name ?? "عيادة الأسنان";
    return {
      meta: [
        { title: `احجز موعد | ${name}` },
        { name: "description", content: `احجز موعدك في ${name} أونلاين خلال دقيقة واختر الوقت المناسب لك.` },
        { property: "og:title", content: `احجز موعد | ${name}` },
        { property: "og:description", content: `احجز موعدك في ${name} أونلاين خلال دقيقة.` },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: BookPage,
});

function BookPage() {
  const { data } = useSuspenseQuery(publicClinicQuery);
  const search = Route.useSearch();
  const s = data.settings;

  const [serviceId, setServiceId] = useState<string>(search.service ?? "any");
  const [doctorId, setDoctorId] = useState<string>("any");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<null | { date: string; time: string }>(null);

  const fetchSlots = useServerFn(getBookedSlots);
  const send = useServerFn(submitBooking);

  const days = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; out.length < 14 && i < 30; i++) {
      const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
      if (s.working_days.includes(x.getDay())) out.push(isoDate(x));
    }
    return out;
  }, [s.working_days]);

  const allSlots = useMemo(() => generateSlots(hhmm(s.open_time), hhmm(s.close_time), s.slot_minutes), [s]);

  const booked = useQuery({
    queryKey: ["booked", date, doctorId],
    queryFn: () => fetchSlots({ data: { date, doctorId: doctorId === "any" ? null : doctorId } }),
    enabled: !!date,
  });

  const now = new Date();
  const todayIso = isoDate(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const slotState = (t: string) => {
    const [h = 0, m = 0] = t.split(":").map(Number);
    if (date === todayIso && h * 60 + m <= nowMin + 30) return "past";
    if (booked.data?.includes(t)) return "taken";
    return "free";
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = bookingSchema.safeParse({
      full_name: name,
      phone,
      service_id: serviceId === "any" ? null : serviceId,
      doctor_id: doctorId === "any" ? null : doctorId,
      req_date: date,
      req_time: time,
      notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "تحقق من البيانات");
      return;
    }
    setSubmitting(true);
    try {
      await send({ data: parsed.data });
      setDone({ date, time });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذر إرسال الطلب");
      booked.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    const msg = `مرحباً ${s.name}، أرسلت طلب حجز باسم ${name} يوم ${dateLabel(done.date)} الساعة ${timeLabel(done.time)}.`;
    const wa = whatsappLink(s.whatsapp, msg);
    return (
      <PublicShell data={data}>
        <main className="mx-auto max-w-lg px-4 py-20 text-center">
          <CheckCircle2 className="mx-auto size-16 text-success" />
          <h1 className="mt-4 text-3xl font-bold">تم استلام طلبك</h1>
          <p className="mt-3 text-muted-foreground">
            طلب موعد يوم <b className="text-foreground">{dateLabel(done.date)}</b> الساعة{" "}
            <b className="num text-foreground">{timeLabel(done.time)}</b>. سنتواصل معك على جوالك لتأكيد الموعد.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {wa && (
              <Button asChild variant="whatsapp" size="lg">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> تأكيد عبر واتساب
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link to="/">العودة للرئيسية</Link>
            </Button>
          </div>
        </main>
      </PublicShell>
    );
  }

  return (
    <PublicShell data={data}>
      <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-sm font-semibold text-primary">حجز أونلاين</p>
          <h1 className="mt-1 text-3xl font-bold">احجز موعدك</h1>
          <p className="mt-2 text-muted-foreground">اختر الخدمة والوقت، وسيتواصل معك فريق العيادة للتأكيد.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-8">
          <Step n={1} title="الخدمة والطبيب">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>الخدمة</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">كشف عام / غير متأكد</SelectItem>
                    {data.services.map((sv) => (
                      <SelectItem key={sv.id} value={sv.id}>{sv.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الطبيب</Label>
                <Select value={doctorId} onValueChange={(v) => { setDoctorId(v); setTime(""); }}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">أي طبيب متاح</SelectItem>
                    {data.doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Step>

          <Step n={2} title="اليوم">
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {days.map((d) => {
                const [, , dd] = d.split("-");
                const active = d === date;
                return (
                  <button
                    type="button"
                    key={d}
                    onClick={() => { setDate(d); setTime(""); }}
                    className={cn(
                      "flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-2xl border px-3 py-2.5 transition",
                      active ? "border-primary bg-primary text-primary-foreground shadow-soft" : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <span className={cn("text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {dateLabel(d, { weekday: "short" })}
                    </span>
                    <span className="num font-display text-xl font-semibold">{Number(dd)}</span>
                    <span className={cn("text-[11px]", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {dateLabel(d, { month: "short" })}
                    </span>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={3} title="الوقت">
            {!date ? (
              <p className="text-sm text-muted-foreground">اختر اليوم أولاً لعرض الأوقات المتاحة.</p>
            ) : booked.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> جاري تحميل الأوقات…</div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {allSlots.map((t) => {
                  const st = slotState(t);
                  const active = t === time;
                  return (
                    <button
                      type="button"
                      key={t}
                      disabled={st !== "free"}
                      onClick={() => setTime(t)}
                      className={cn(
                        "num rounded-xl border py-2.5 text-sm font-medium transition",
                        active && "border-primary bg-primary text-primary-foreground",
                        !active && st === "free" && "border-border bg-card hover:border-primary/50",
                        st !== "free" && "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through",
                      )}
                    >
                      {timeLabel(t)}
                    </button>
                  );
                })}
              </div>
            )}
          </Step>

          <Step n={4} title="بياناتك">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">الاسم الكامل</Label>
                <Input id="name" className="h-11" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">رقم الجوال</Label>
                <Input id="phone" className="h-11 text-start" dir="ltr" inputMode="tel" placeholder="05xxxxxxxx" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="مثلاً: ألم في الضرس السفلي" />
              </div>
            </div>
          </Step>

          <Button type="submit" size="lg" className="w-full" disabled={submitting || !date || !time}>
            {submitting ? <Loader2 className="animate-spin" /> : <CalendarCheck />}
            {date && time ? `تأكيد طلب الحجز — ${timeLabel(time)}` : "اختر اليوم والوقت"}
          </Button>
        </form>
      </main>
    </PublicShell>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className="num grid size-7 place-items-center rounded-full bg-primary-soft text-sm text-primary">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
