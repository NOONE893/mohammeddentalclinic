import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "تعيين كلمة مرور جديدة | نظام العيادة" },
      { name: "description", content: "تعيين كلمة مرور جديدة لحساب طاقم العيادة." },
      { property: "og:title", content: "تعيين كلمة مرور جديدة" },
      { property: "og:description", content: "تعيين كلمة مرور جديدة لحساب طاقم العيادة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void toast.error("انتهت صلاحية الرابط، اطلب رابطاً جديداً");
    toast.success("تم تغيير كلمة المرور");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen bg-hero px-4">
      <form onSubmit={submit} className="m-auto w-full max-w-sm space-y-4 rounded-3xl bg-card p-6 shadow-lift">
        <h1 className="text-2xl font-bold">كلمة مرور جديدة</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">كلمة المرور</Label>
          <Input id="pw" type="password" dir="ltr" className="h-11" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={busy}>حفظ</Button>
      </form>
    </div>
  );
}
