import { Link } from "@tanstack/react-router";
import { CalendarCheck, MapPin, MessageCircle, Phone } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { whatsappLink, hhmm, timeLabel, WEEK_DAYS } from "@/lib/clinic";
import type { PublicClinic } from "@/lib/queries";

export function ToothMark({ className = "size-9" }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-xl bg-primary text-primary-foreground ${className}`}>
      <svg viewBox="0 0 24 24" className="size-[60%]" fill="currentColor" aria-hidden="true">
        <path d="M7.5 2C4.4 2 2.5 4.4 2.5 7.4c0 2.2.8 3.7 1.4 5.4.6 1.8.8 3.8 1.2 5.8.4 2.1 1.1 3.4 2.4 3.4 1.6 0 1.9-2 2.3-4.2.3-1.6.8-2.9 2.2-2.9s1.9 1.3 2.2 2.9c.4 2.2.7 4.2 2.3 4.2 1.3 0 2-1.3 2.4-3.4.4-2 .6-4 1.2-5.8.6-1.7 1.4-3.2 1.4-5.4C21.5 4.4 19.6 2 16.5 2c-1.9 0-3 .9-4.5.9S9.4 2 7.5 2Z" />
      </svg>
    </span>
  );
}

export function PublicHeader({ name }: { name: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md no-print">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <ToothMark />
          <span className="truncate font-display text-base font-semibold sm:text-lg">{name}</span>
        </Link>
        <nav className="ms-auto hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <a href="/#services" className="hover:text-foreground">الخدمات</a>
          <a href="/#doctors" className="hover:text-foreground">الأطباء</a>
          <a href="/#contact" className="hover:text-foreground">التواصل</a>
        </nav>
        <Button asChild size="sm" className="ms-auto md:ms-0">
          <Link to="/book">
            <CalendarCheck /> احجز موعد
          </Link>
        </Button>
      </div>
    </header>
  );
}

export function WhatsAppFab({ phone, name }: { phone: string; name: string }) {
  const href = whatsappLink(phone, `مرحباً ${name}، أود الاستفسار عن موعد.`);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل عبر واتساب"
      className="fixed bottom-5 start-5 z-40 grid size-14 place-items-center rounded-full bg-whatsapp text-whatsapp-foreground shadow-lift transition-transform hover:scale-105 no-print"
    >
      <MessageCircle className="size-7" />
    </a>
  );
}

export function workingDaysLabel(days: number[]) {
  const order = [6, 0, 1, 2, 3, 4, 5];
  const sorted = order.filter((d) => days.includes(d));
  if (sorted.length === 0) return "";
  // Collapse a continuous run (in Saturday-first order) into "from – to"
  const idx = sorted.map((d) => order.indexOf(d));
  const continuous = idx.every((v, i) => i === 0 || v === (idx[i - 1] ?? -9) + 1);
  const first = sorted[0] ?? 0;
  const last = sorted[sorted.length - 1] ?? 0;
  if (continuous && sorted.length > 2) return `${WEEK_DAYS[first]} – ${WEEK_DAYS[last]}`;
  return sorted.map((d) => WEEK_DAYS[d]).join("، ");
}

export function PublicFooter({ data }: { data: PublicClinic }) {
  const s = data.settings;
  return (
    <footer id="contact" className="border-t border-border bg-primary-deep text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <ToothMark />
            <span className="font-display text-lg font-semibold">{s.name}</span>
          </div>
          <p className="text-sm leading-relaxed text-primary-foreground/75">{s.tagline}</p>
        </div>
        <div className="space-y-3 text-sm">
          <h3 className="font-display text-base font-semibold">ساعات العمل</h3>
          <p className="text-primary-foreground/80">{workingDaysLabel(s.working_days)}</p>
          <p className="num text-primary-foreground/80">
            {timeLabel(hhmm(s.open_time))} – {timeLabel(hhmm(s.close_time))}
          </p>
        </div>
        <div className="space-y-3 text-sm">
          <h3 className="font-display text-base font-semibold">تواصل معنا</h3>
          <a href={`tel:${s.phone}`} className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground">
            <Phone className="size-4" /> <span dir="ltr" className="num">{s.phone}</span>
          </a>
          {s.address && (
            <a
              href={s.map_url || `https://www.google.com/maps/search/${encodeURIComponent(s.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground"
            >
              <MapPin className="size-4" /> {s.address}
            </a>
          )}
        </div>
      </div>
      <div className="border-t border-primary-foreground/10 py-5 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} {s.name}
      </div>
    </footer>
  );
}

export function PublicShell({ data, children }: { data: PublicClinic; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader name={data.settings.name} />
      {children}
      <PublicFooter data={data} />
      <WhatsAppFab phone={data.settings.whatsapp} name={data.settings.name} />
    </div>
  );
}
