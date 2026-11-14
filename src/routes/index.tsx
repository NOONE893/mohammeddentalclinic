import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CalendarCheck, Clock, MapPin, MessageCircle, ShieldCheck, Sparkles, Stethoscope, HeartHandshake } from "lucide-react";
import heroImg from "@/assets/clinic-hero.jpg";
import { Button } from "@/components/ui/button";
import { PublicShell, workingDaysLabel } from "@/components/clinic/public-layout";
import { publicClinicQuery } from "@/lib/queries";
import { hhmm, money, timeLabel, whatsappLink } from "@/lib/clinic";
import { defaultServiceImage } from "@/lib/service-images";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(publicClinicQuery),
  head: ({ loaderData }) => {
    const name = loaderData?.settings.name ?? "عيادة الأسنان";
    const desc = loaderData?.settings.about ?? "عيادة طب وتجميل الأسنان — احجز موعدك أونلاين.";
    return {
      meta: [
        { title: `${name} | احجز موعدك أونلاين` },
        { name: "description", content: desc },
        { property: "og:title", content: name },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(publicClinicQuery);
  const s = data.settings;
  const wa = whatsappLink(s.whatsapp, `مرحباً ${s.name}، أود الاستفسار.`);

  return (
    <PublicShell data={data}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-hero text-primary-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-10 md:grid-cols-[1.05fr_1fr] md:pb-24 md:pt-16">
          <div className="animate-rise space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1 text-xs font-medium ring-1 ring-primary-foreground/20">
              <Sparkles className="size-3.5" /> {s.tagline}
            </span>
            <h1 className="text-4xl font-bold leading-[1.2] sm:text-5xl md:text-6xl">{s.name}</h1>
            <p className="max-w-lg text-base leading-relaxed text-primary-foreground/80 sm:text-lg">{s.about}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/book">
                  <CalendarCheck /> احجز موعدك الآن
                </Link>
              </Button>
              {wa && (
                <Button asChild variant="heroOutline" size="lg">
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> واتساب
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="relative animate-rise [animation-delay:150ms]">
            <img
              src={heroImg}
              alt="غرفة علاج حديثة في العيادة"
              width={1600}
              height={1104}
              className="aspect-[4/3] w-full rounded-3xl object-cover shadow-lift ring-1 ring-primary-foreground/15"
            />
            <div className="absolute -bottom-6 start-4 flex items-center gap-3 rounded-2xl bg-card p-3 pe-5 text-card-foreground shadow-lift">
              <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
                <Clock className="size-5" />
              </span>
              <div className="text-sm">
                <div className="font-semibold">{workingDaysLabel(s.working_days)}</div>
                <div className="num text-muted-foreground">
                  {timeLabel(hhmm(s.open_time))} – {timeLabel(hhmm(s.close_time))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why us */}
      <section className="mx-auto max-w-6xl px-4 pt-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "تعقيم وأمان", d: "بروتوكولات تعقيم صارمة وأدوات معقمة لكل مريض." },
            { icon: Stethoscope, t: "أجهزة حديثة", d: "تشخيص دقيق وعلاج مريح بأحدث التقنيات." },
            { icon: HeartHandshake, t: "رعاية للعائلة", d: "خطط علاج واضحة وأسعار شفافة قبل البدء." },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <f.icon className="size-6 text-primary" />
              <h3 className="mt-3 text-lg font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-primary">خدماتنا</p>
            <h2 className="mt-1 text-3xl font-bold">علاج متكامل لابتسامتك</h2>
          </div>
          <Button asChild variant="soft" className="hidden sm:inline-flex">
            <Link to="/book">احجز خدمة</Link>
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data.services.map((sv) => (
            <Link
              key={sv.id}
              to="/book"
              search={{ service: sv.id }}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={sv.photo ?? defaultServiceImage(sv.name)}
                  alt={sv.name}
                  width={960}
                  height={720}
                  loading="lazy"
                  className="size-full object-cover transition duration-500 group-hover:scale-105"
                />
                <span className="num absolute bottom-2 end-2 rounded-full bg-card/90 px-2.5 py-0.5 text-xs font-medium text-card-foreground backdrop-blur">
                  {sv.duration_min} د
                </span>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-base font-semibold">{sv.name}</h3>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{sv.description}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="num font-semibold text-primary">يبدأ من {money(Number(sv.price), s.currency)}</span>
                  <span className="text-xs font-medium text-primary opacity-0 transition group-hover:opacity-100">احجز ←</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Doctors */}
      {data.doctors.length > 0 && (
        <section id="doctors" className="scroll-mt-20 bg-sand-gradient py-20">
          <div className="mx-auto max-w-6xl px-4">
            <p className="text-sm font-semibold text-sand-foreground">فريقنا الطبي</p>
            <h2 className="mt-1 text-3xl font-bold">أطباء تثق بهم</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.doctors.map((d) => (
                <div key={d.id} className="rounded-2xl bg-card p-6 shadow-soft">
                  <div className="grid size-14 place-items-center rounded-2xl bg-primary-soft font-display text-xl font-bold text-primary">
                    {d.name.replace(/^د\.\s*/, "").charAt(0)}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{d.name}</h3>
                  <p className="text-sm font-medium text-primary">{d.specialty}</p>
                  {d.bio && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d.bio}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="flex flex-col items-start gap-6 rounded-3xl bg-hero p-8 text-primary-foreground shadow-lift md:flex-row md:items-center md:justify-between md:p-12">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">جاهز لابتسامة أجمل؟</h2>
            <p className="mt-2 text-primary-foreground/80">اختر الوقت المناسب لك وسنؤكد موعدك في أقرب وقت.</p>
            {s.address && (
              <p className="mt-3 flex items-center gap-2 text-sm text-primary-foreground/70">
                <MapPin className="size-4" /> {s.address}
              </p>
            )}
          </div>
          <Button asChild variant="hero" size="lg">
            <Link to="/book">
              <CalendarCheck /> احجز موعدك
            </Link>
          </Button>
        </div>
      </section>
    </PublicShell>
  );
}
