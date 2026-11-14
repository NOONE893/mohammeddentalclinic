import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Clock, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaffShell, useSignOut } from "@/components/clinic/staff-shell";
import { useMe } from "@/hooks/use-staff";

export const Route = createFileRoute("/_authenticated/_staff")({
  component: StaffLayout,
});

function StaffLayout() {
  const { data: me, isLoading } = useMe();
  const signOut = useSignOut();
  const path = useRouterState({ select: (st) => st.location.pathname });
  const adminOnly = ["/finance", "/accounting", "/inventory", "/settings"].some((p) => path === p || path.startsWith(p + "/"));

  if (isLoading) {
    return <div className="grid min-h-screen place-items-center"><Loader2 className="size-6 animate-spin text-primary" /></div>;
  }
  if (!me?.isStaff) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-sm rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
          <Clock className="mx-auto size-10 text-warning" />
          <h1 className="mt-4 text-xl font-bold">بانتظار موافقة المدير</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            تم إنشاء حسابك ({me?.email}). سيتمكن مدير العيادة من منحك الصلاحية من صفحة الإعدادات ← الفريق.
          </p>
          <Button variant="outline" className="mt-6" onClick={signOut}><LogOut /> تسجيل الخروج</Button>
        </div>
      </div>
    );
  }
  return (
    <StaffShell>
      {adminOnly && !me.isAdmin ? (
        <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-bold">هذه الصفحة للمدير فقط</h1>
          <Button asChild variant="outline" className="mt-5"><Link to="/dashboard">العودة للرئيسية</Link></Button>
        </div>
      ) : <Outlet />}
    </StaffShell>
  );
}
