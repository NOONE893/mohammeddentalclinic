import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToothMark } from "@/components/clinic/public-layout";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول الطاقم | نظام العيادة" },
      { name: "description", content: "تسجيل دخول طاقم العيادة لإدارة المواعيد والمرضى والفواتير." },
      { property: "og:title", content: "دخول الطاقم | نظام العيادة" },
      { property: "og:description", content: "تسجيل دخول طاقم العيادة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const GoogleG = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
);

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard", replace: true });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/dashboard", data: { full_name: fullName } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard", replace: true });
        else toast.success("تم إنشاء الحساب. افتح بريدك الإلكتروني لتأكيده ثم سجّل الدخول.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("أرسلنا رابط إعادة تعيين كلمة المرور إلى بريدك.");
        setMode("signin");
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      toast.error(m.includes("Invalid login") ? "البريد أو كلمة المرور غير صحيحة" : m.includes("not confirmed") ? "يرجى تأكيد بريدك الإلكتروني أولاً" : m || "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (result.error) {
      toast.error("تعذر تسجيل الدخول عبر Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen bg-hero px-4 py-10">
      <div className="m-auto w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2.5 text-primary-foreground">
          <ToothMark className="size-10 bg-primary-foreground/15" />
          <span className="font-display text-lg font-semibold">نظام إدارة العيادة</span>
        </Link>
        <div className="rounded-3xl bg-card p-6 shadow-lift">
          <h1 className="text-2xl font-bold">
            {mode === "signin" ? "تسجيل الدخول" : mode === "signup" ? "حساب جديد للطاقم" : "استعادة كلمة المرور"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signup" ? "أول حساب يُنشأ يصبح مدير العيادة، والبقية بانتظار موافقته." : "للأطباء وموظفي الاستقبال فقط."}
          </p>

          {mode !== "forgot" && (
            <>
              <button
                type="button"
                onClick={google}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-[#747775] bg-[#FFFFFF] px-3 text-sm font-medium text-[#1F1F1F]"
              >
                <GoogleG /> المتابعة باستخدام Google
              </button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> أو بالبريد <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fn">الاسم</Label>
                <Input id="fn" className="h-11" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="em">البريد الإلكتروني</Label>
              <Input id="em" type="email" dir="ltr" className="h-11 text-start" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pw">كلمة المرور</Label>
                  {mode === "signin" && (
                    <button type="button" className="text-xs text-primary" onClick={() => setMode("forgot")}>نسيت كلمة المرور؟</button>
                  )}
                </div>
                <Input id="pw" type="password" dir="ltr" className="h-11 text-start" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {mode === "signin" ? "دخول" : mode === "signup" ? "إنشاء الحساب" : "إرسال الرابط"}
            </Button>
          </form>

          <div className="mt-5 text-center text-sm text-muted-foreground">
            {mode === "signin" ? (
              <>ليس لديك حساب؟ <button className="font-semibold text-primary" onClick={() => setMode("signup")}>أنشئ حساباً</button></>
            ) : (
              <button className="font-semibold text-primary" onClick={() => setMode("signin")}>العودة لتسجيل الدخول</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
