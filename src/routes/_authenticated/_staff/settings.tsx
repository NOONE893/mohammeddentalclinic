import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Plus, Save, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, PageHeader, Panel, Pill } from "@/components/clinic/staff-shell";
import { Field } from "@/components/clinic/fields";
import { doctorsQuery, must, servicesQuery, type Doctor, type Service } from "@/lib/data";
import { hhmm, WEEK_DAYS } from "@/lib/clinic";
import { defaultServiceImage } from "@/lib/service-images";
import { useMe, useSettings } from "@/hooks/use-staff";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/_staff/settings")({
  head: () => ({ meta: [{ title: "الإعدادات | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me } = useMe();
  const isAdmin = !!me?.isAdmin;
  return (
    <>
      <PageHeader title="الإعدادات" subtitle={isAdmin ? "كل ما يظهر للمرضى وفي الفواتير يُعدَّل من هنا" : "التعديل متاح لمدير العيادة فقط"} />
      <Tabs defaultValue="clinic" dir="rtl">
        <TabsList className="mb-4 w-full justify-start overflow-x-auto">
          <TabsTrigger value="clinic">بيانات العيادة</TabsTrigger>
          <TabsTrigger value="hours">الدوام والحجز</TabsTrigger>
          <TabsTrigger value="services">الخدمات</TabsTrigger>
          <TabsTrigger value="doctors">الأطباء</TabsTrigger>
          <TabsTrigger value="billing">الفواتير</TabsTrigger>
          {isAdmin && <TabsTrigger value="team">الفريق</TabsTrigger>}
        </TabsList>
        <SettingsForm isAdmin={isAdmin} />
        <TabsContent value="services"><ServicesTab isAdmin={isAdmin} /></TabsContent>
        <TabsContent value="doctors"><DoctorsTab isAdmin={isAdmin} /></TabsContent>
        {isAdmin && <TabsContent value="team"><TeamTab myId={me!.id} /></TabsContent>}
      </Tabs>
    </>
  );
}

type Settings = Tables<"clinic_settings">;

function SettingsForm({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const [f, setF] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (s) setF({ ...s, open_time: hhmm(s.open_time), close_time: hhmm(s.close_time) }); }, [s]);
  if (!f) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const txt = (k: keyof Settings) => ({
    value: String(f[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, e.target.value as never),
    disabled: !isAdmin,
  });

  async function save() {
    if (!f) return;
    if (f.name.trim().length < 2) return void toast.error("اكتب اسم العيادة");
    setBusy(true);
    const { id: _id, updated_at: _u, ...rest } = f;
    const { error } = await supabase.from("clinic_settings").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", 1);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success("تم حفظ الإعدادات");
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["public-clinic"] });
  }

  const saveBtn = isAdmin && (
    <Button onClick={save} disabled={busy} className="mt-4">{busy ? <Loader2 className="animate-spin" /> : <Save />} حفظ</Button>
  );

  return (
    <>
      <TabsContent value="clinic">
        <Panel>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="اسم العيادة"><Input {...txt("name")} /></Field>
            <Field label="الاسم بالإنجليزية"><Input dir="ltr" {...txt("name_en")} /></Field>
            <Field label="الشعار النصي" className="sm:col-span-2"><Input {...txt("tagline")} /></Field>
            <Field label="نبذة عن العيادة" className="sm:col-span-2"><Textarea rows={3} {...txt("about")} /></Field>
            <Field label="رقم الهاتف"><Input dir="ltr" {...txt("phone")} /></Field>
            <Field label="رقم واتساب"><Input dir="ltr" {...txt("whatsapp")} /></Field>
            <Field label="البريد الإلكتروني"><Input dir="ltr" {...txt("email")} /></Field>
            <Field label="العنوان"><Input {...txt("address")} /></Field>
            <Field label="رابط الموقع على خرائط Google" className="sm:col-span-2"><Input dir="ltr" placeholder="https://maps.app.goo.gl/…" {...txt("map_url")} /></Field>
          </div>
          {saveBtn}
        </Panel>
      </TabsContent>

      <TabsContent value="hours">
        <Panel>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="بداية الدوام"><Input type="time" {...txt("open_time")} /></Field>
            <Field label="نهاية الدوام"><Input type="time" {...txt("close_time")} /></Field>
            <Field label="مدة الموعد (دقيقة)"><Input type="number" min={10} step={5} value={f.slot_minutes} disabled={!isAdmin} onChange={(e) => set("slot_minutes", Number(e.target.value))} /></Field>
          </div>
          <div className="mt-4">
            <div className="mb-2 text-xs text-muted-foreground">أيام العمل</div>
            <div className="flex flex-wrap gap-2">
              {[6, 0, 1, 2, 3, 4, 5].map((d) => {
                const on = f.working_days.includes(d);
                return (
                  <button
                    key={d}
                    disabled={!isAdmin}
                    onClick={() => set("working_days", on ? f.working_days.filter((x) => x !== d) : [...f.working_days, d])}
                    className={cn("rounded-xl border px-3 py-2 text-sm", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}
                  >
                    {WEEK_DAYS[d]}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="نص رسالة تذكير واتساب" className="mt-4">
            <Textarea rows={3} {...txt("reminder_template")} />
          </Field>
          <p className="mt-1 text-xs text-muted-foreground">
            المتغيرات المتاحة: {"{name}"} اسم المريض، {"{clinic}"} اسم العيادة، {"{date}"} التاريخ، {"{time}"} الوقت، {"{doctor}"} الطبيب، {"{service}"} الخدمة
          </p>
          {saveBtn}
        </Panel>
      </TabsContent>

      <TabsContent value="billing">
        <Panel>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="الرقم الضريبي"><Input dir="ltr" {...txt("vat_number")} /></Field>
            <Field label="نسبة الضريبة %"><Input type="number" min={0} value={Number(f.vat_rate)} disabled={!isAdmin} onChange={(e) => set("vat_rate", Number(e.target.value))} /></Field>
            <Field label="العملة"><Input {...txt("currency")} /></Field>
            <Field label="تذييل الفاتورة" className="sm:col-span-3"><Input {...txt("invoice_footer")} /></Field>
          </div>
          {saveBtn}
        </Panel>
      </TabsContent>
    </>
  );
}

function ServicesTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: services = [] } = useQuery(servicesQuery);
  const add = async () => {
    const { error } = await supabase.from("services").insert({ name: "خدمة جديدة", price: 0, sort: services.length + 1 });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["services"] });
  };
  return (
    <div className="space-y-3">
      {services.map((sv) => <ServiceRow key={sv.id} sv={sv} isAdmin={isAdmin} />)}
      {isAdmin && <Button variant="soft" onClick={add}><Plus /> إضافة خدمة</Button>}
    </div>
  );
}

function ServiceRow({ sv, isAdmin }: { sv: Service; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [f, setF] = useState(sv);
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setF(sv), [sv]);
  useEffect(() => {
    if (!sv.image_url) { setPhoto(null); return; }
    supabase.storage.from("service-images").createSignedUrl(sv.image_url, 3600).then(({ data }) => setPhoto(data?.signedUrl ?? null));
  }, [sv.image_url]);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["services"] }); qc.invalidateQueries({ queryKey: ["public-clinic"] }); };

  async function save() {
    const { error } = await supabase.from("services").update({ name: f.name, description: f.description, price: Number(f.price), duration_min: Number(f.duration_min), active: f.active }).eq("id", sv.id);
    if (error) return void toast.error(error.message);
    toast.success("تم الحفظ");
    refresh();
  }
  async function del() {
    if (!confirm(`حذف ${sv.name}؟`)) return;
    const { error } = await supabase.from("services").delete().eq("id", sv.id);
    if (error) return void toast.error(error.message);
    refresh();
  }
  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return void toast.error("اختر صورة");
    if (file.size > 5 * 1024 * 1024) return void toast.error("الحد الأقصى 5 ميجابايت");
    setUploading(true);
    const path = `${sv.id}/${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("service-images").upload(path, file, { contentType: file.type });
    if (error) { setUploading(false); return void toast.error(error.message); }
    const { error: e2 } = await supabase.from("services").update({ image_url: path }).eq("id", sv.id);
    setUploading(false);
    if (e2) return void toast.error(e2.message);
    toast.success("تم تحديث الصورة");
    refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-soft sm:flex-row">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-40">
        <img src={photo ?? defaultServiceImage(f.name)} alt={f.name} loading="lazy" className="size-full object-cover" />
        {isAdmin && (
          <>
            <button onClick={() => fileRef.current?.click()} className="absolute bottom-2 end-2 flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-xs font-medium shadow-soft">
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />} تغيير
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </>
        )}
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="الاسم" className="col-span-2"><Input value={f.name} disabled={!isAdmin} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="السعر"><Input type="number" value={Number(f.price)} disabled={!isAdmin} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></Field>
        <Field label="المدة (د)"><Input type="number" value={f.duration_min} disabled={!isAdmin} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} /></Field>
        <Field label="الوصف" className="col-span-2 sm:col-span-4"><Input value={f.description} disabled={!isAdmin} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {isAdmin && (
          <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
            <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> ظاهرة للمرضى</label>
            <Button size="sm" className="ms-auto" onClick={save}><Save /> حفظ</Button>
            <Button size="icon" variant="ghost" onClick={del} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DoctorsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: doctors = [] } = useQuery(doctorsQuery);
  const add = async () => {
    const { error } = await supabase.from("doctors").insert({ name: "د. ", sort: doctors.length + 1 });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["doctors"] });
  };
  return (
    <div className="space-y-3">
      {doctors.map((d) => <DoctorRow key={d.id} d={d} isAdmin={isAdmin} />)}
      {isAdmin && <Button variant="soft" onClick={add}><Plus /> إضافة طبيب</Button>}
    </div>
  );
}

function DoctorRow({ d, isAdmin }: { d: Doctor; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [f, setF] = useState(d);
  useEffect(() => setF(d), [d]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["doctors"] }); qc.invalidateQueries({ queryKey: ["public-clinic"] }); };
  async function save() {
    const { error } = await supabase.from("doctors").update({ name: f.name, specialty: f.specialty, bio: f.bio, active: f.active }).eq("id", d.id);
    if (error) return void toast.error(error.message);
    toast.success("تم الحفظ");
    refresh();
  }
  async function del() {
    if (!confirm(`حذف ${d.name}؟`)) return;
    const { error } = await supabase.from("doctors").delete().eq("id", d.id);
    if (error) return void toast.error(error.message);
    refresh();
  }
  return (
    <Panel>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="الاسم"><Input value={f.name} disabled={!isAdmin} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="التخصص"><Input value={f.specialty} disabled={!isAdmin} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></Field>
        <Field label="نبذة" className="sm:col-span-2"><Input value={f.bio} disabled={!isAdmin} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
      </div>
      {isAdmin && (
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /> ظاهر للمرضى</label>
          <Button size="sm" className="ms-auto" onClick={save}><Save /> حفظ</Button>
          <Button size="icon" variant="ghost" onClick={del} aria-label="حذف"><Trash2 className="text-muted-foreground" /></Button>
        </div>
      )}
    </Panel>
  );
}

function TeamTab({ myId }: { myId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        must(supabase.from("profiles").select("*").order("created_at")),
        must(supabase.from("user_roles").select("user_id,role")),
      ]);
      return profiles.map((p) => ({ ...p, roles: roles.filter((r) => r.user_id === p.id).map((r) => r.role) }));
    },
  });
  async function grant(uid: string, role: "staff" | "admin") {
    const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team"] });
  }
  async function revoke(uid: string) {
    if (!confirm("إلغاء صلاحيات هذا المستخدم؟")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", uid);
    if (error) return void toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team"] });
  }
  return (
    <Panel title="أعضاء الفريق">
      <p className="mb-3 text-sm text-muted-foreground">
        يسجّل الموظف حساباً من رابط <span dir="ltr" className="font-mono">/admin</span> ثم يظهر هنا لتمنحه الصلاحية.
      </p>
      {!data?.length ? <Empty>لا يوجد أعضاء</Empty> : (
        <ul className="divide-y divide-border">
          {data.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{u.full_name || u.email}</div>
                <div className="text-xs text-muted-foreground" dir="ltr">{u.email}</div>
              </div>
              {u.roles.includes("admin") ? <Pill tone="primary">مدير</Pill> : u.roles.includes("staff") ? <Pill tone="success">موظف</Pill> : <Pill tone="warning">بانتظار الموافقة</Pill>}
              {u.id !== myId && (
                <div className="flex gap-1">
                  {!u.roles.length && <Button size="sm" onClick={() => grant(u.id, "staff")}><UserCheck /> قبول</Button>}
                  {!u.roles.includes("admin") && u.roles.length > 0 && <Button size="sm" variant="outline" onClick={() => grant(u.id, "admin")}><ShieldCheck /> ترقية لمدير</Button>}
                  {u.roles.length > 0 && <Button size="sm" variant="ghost" onClick={() => revoke(u.id)}><UserX className="text-destructive" /></Button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
