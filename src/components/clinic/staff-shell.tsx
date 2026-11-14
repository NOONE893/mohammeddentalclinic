import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  BookOpen, CalendarDays, Globe, HandCoins, LayoutDashboard, LogOut, Menu, Package, Receipt, Settings, SmilePlus, Users, Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToothMark } from "@/components/clinic/public-layout";
import { useMe, useSettings } from "@/hooks/use-staff";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/appointments", label: "المواعيد", icon: CalendarDays },
  { to: "/patients", label: "المرضى", icon: Users },
  { to: "/orthodontics", label: "التقويم", icon: SmilePlus },
  { to: "/invoices", label: "الفواتير", icon: Receipt },
  { to: "/vouchers", label: "السندات والصندوق", icon: HandCoins },
  { to: "/finance", label: "الدخل والمصروفات", icon: Wallet, admin: true },
  { to: "/accounting", label: "المحاسبة", icon: BookOpen, admin: true },
  { to: "/inventory", label: "المخزون", icon: Package, admin: true },
  { to: "/settings", label: "الإعدادات", icon: Settings, admin: true },
] as const;

export function useSignOut() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };
}

export function StaffShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: settings } = useSettings();
  const { data: me } = useMe();
  const signOut = useSignOut();
  const [more, setMore] = useState(false);
  const isActive = (to: string) => path === to || path.startsWith(to + "/");
  // Secretary (staff without admin role) sees patients, appointments, orthodontics, invoices and vouchers only.
  const nav = NAV.filter((n) => !("admin" in n) || me?.isAdmin);

  return (
    <div className="min-h-screen bg-background md:ps-64 print:ps-0">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex no-print">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <ToothMark className="size-9 bg-sidebar-primary text-sidebar-primary-foreground" />
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-semibold">{settings?.name ?? "العيادة"}</div>
            <div className="text-xs text-sidebar-foreground/60">نظام الإدارة</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                isActive(n.to) ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60",
              )}
            >
              <n.icon className={cn("size-[18px]", isActive(n.to) && "text-sidebar-primary")} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-3">
          <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60">
            <Globe className="size-[18px]" /> صفحة العيادة
          </Link>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-sidebar-foreground/75 hover:bg-sidebar-accent/60">
            <LogOut className="size-[18px]" /> تسجيل الخروج
          </button>
          {me && <div className="truncate px-3 pt-2 text-xs text-sidebar-foreground/50">{me.name}</div>}
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2.5 border-b border-border bg-background/90 px-4 backdrop-blur md:hidden no-print">
        <ToothMark className="size-8" />
        <span className="truncate font-display text-sm font-semibold">{settings?.name ?? "العيادة"}</span>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-10 md:pt-8 print:max-w-none print:p-0">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden no-print">
        {nav.slice(0, 4).map((n) => (
          <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", isActive(n.to) ? "font-semibold text-primary" : "text-muted-foreground")}>
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground">
          <Menu className="size-5" /> المزيد
        </button>
      </nav>

      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader><SheetTitle className="text-start">المزيد</SheetTitle></SheetHeader>
          <div className="grid gap-1 p-4 pt-0">
            {nav.slice(4).map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMore(false)} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted">
                <n.icon className="size-5 text-primary" /> {n.label}
              </Link>
            ))}
            <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-muted">
              <Globe className="size-5 text-primary" /> صفحة العيادة
            </Link>
            <button onClick={signOut} className="flex items-center gap-3 rounded-xl px-3 py-3 text-destructive hover:bg-muted">
              <LogOut className="size-5" /> تسجيل الخروج
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft md:p-5", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">{children}</div>;
}

const TONES = {
  info: "bg-info/12 text-info",
  success: "bg-success/12 text-success",
  primary: "bg-primary-soft text-accent-foreground",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-warning/20 text-warning-foreground",
  muted: "bg-muted text-muted-foreground",
} as const;

export function Pill({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", TONES[tone])}>{children}</span>;
}

export function InvoicePill({ status }: { status: "paid" | "partial" | "unpaid" }) {
  return status === "paid" ? <Pill tone="success">مدفوعة</Pill> : status === "partial" ? <Pill tone="warning">مدفوعة جزئياً</Pill> : <Pill tone="destructive">غير مدفوعة</Pill>;
}
