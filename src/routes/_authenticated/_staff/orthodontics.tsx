import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Check, Loader2, Plus, Printer, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, PageHeader, Panel } from "@/components/clinic/staff-shell";
import { Field, NativeSelect } from "@/components/clinic/fields";
import { PatientDialog } from "@/components/clinic/patient-dialog";
import { patientsQuery, type Patient } from "@/lib/data";
import { ageFrom, isoDate } from "@/lib/clinic";
import { compressImage, emptyCase, EXTRAORAL, INTRAORAL, type OrthoCase, type OrthoField } from "@/lib/ortho";

export const Route = createFileRoute("/_authenticated/_staff/orthodontics")({
  validateSearch: (s: Record<string, unknown>) => ({ patient: typeof s.patient === "string" ? s.patient : undefined }),
  head: () => ({ meta: [{ title: "تقويم الأسنان | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: OrthoPage,
});

const BUCKET = "ortho-photos";
// ortho_cases is created by sql/ortho-and-vouchers.sql and is not in the generated Supabase types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const casesTable = () => (supabase as any).from("ortho_cases");

function OrthoPage() {
  const search = Route.useSearch();
  const qc = useQueryClient();
  const { data: patients = [] } = useQuery(patientsQuery);
  const [pid, setPid] = useState<string | null>(search.patient ?? null);
  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);

  const list = useMemo(
    () => patients.filter((p) => !q.trim() || p.full_name.includes(q.trim()) || p.phone.includes(q.trim())),
    [patients, q],
  );
  const patient = patients.find((p) => p.id === pid) ?? null;

  const caseQ = useQuery({
    queryKey: ["ortho", pid],
    enabled: !!pid,
    queryFn: async () => {
      const { data, error } = await casesTable().select("*").eq("patient_id", pid).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as OrthoCase | null) ?? null;
    },
  });

  return (
    <>
      <PageHeader
        title="تقويم الأسنان"
        subtitle="ملف حالة تقويم لكل مريض: فحص، صور، تشخيص وخطة علاج"
        actions={
          <>
            <Button variant="outline" onClick={() => setNewOpen(true)}><Plus /> مريض جديد</Button>
            {pid && <Button variant="outline" onClick={() => window.print()}><Printer /> طباعة / PDF</Button>}
          </>
        }
      />

      <Panel className="no-print mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="بحث عن مريض"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="الاسم أو رقم الجوال…" /></Field>
          <Field label="المريض">
            <NativeSelect value={pid ?? ""} onChange={(e) => setPid(e.target.value || null)}>
              <option value="">— اختر مريضاً —</option>
              {list.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.phone ? ` · ${p.phone}` : ""}</option>)}
            </NativeSelect>
          </Field>
        </div>
      </Panel>

      {!patient ? <Empty>اختر مريضاً أو أضف مريضاً جديداً لفتح ملف التقويم</Empty>
        : caseQ.isLoading ? <Empty>جاري التحميل…</Empty>
        : caseQ.isError ? <Empty>تعذر تحميل الملف. تأكد من تنفيذ ملف sql/ortho-and-vouchers.sql في قاعدة البيانات.</Empty>
        : <CaseForm key={patient.id} patient={patient} initial={caseQ.data ?? emptyCase(patient.id, isoDate(new Date()))} onSaved={() => qc.invalidateQueries({ queryKey: ["ortho", patient.id] })} />}

      <PatientDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => { setPid(id); setQ(""); }} />
    </>
  );
}

type SaveState = "idle" | "dirty" | "saving" | "saved";

function CaseForm({ patient, initial, onSaved }: { patient: Patient; initial: OrthoCase; onSaved: () => void }) {
  const [c, setC] = useState<OrthoCase>(initial);
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(c);
  latest.current = c;

  const persist = useCallback(async (silent = true) => {
    setState("saving");
    const { id: _id, ...row } = latest.current;
    void _id;
    const { error } = await casesTable().upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "patient_id" });
    if (error) { setState("dirty"); return void toast.error(error.message); }
    setState("saved");
    if (!silent) toast.success("تم حفظ الحالة");
    onSaved();
  }, [onSaved]);

  const change = (fn: (x: OrthoCase) => OrthoCase) => {
    setC((x) => fn(x));
    setState("dirty");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 1200);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const setExam = (k: string, part: "v" | "n", val: string) =>
    change((x) => ({ ...x, exam: { ...x.exam, [k]: { ...x.exam[k], [part]: val } } }));
  const setPhotos = (k: string, paths: string[]) => {
    setC((x) => ({ ...x, photos: { ...x.photos, [k]: paths } }));
    latest.current = { ...latest.current, photos: { ...latest.current.photos, [k]: paths } };
    void persist();
  };

  const age = ageFrom(patient.birth_date);

  return (
    <div className="print-area space-y-4">
      <div className="no-print sticky top-14 z-10 flex items-center justify-between rounded-xl border border-border bg-card/95 px-4 py-2 backdrop-blur md:top-0">
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {state === "saving" ? <><Loader2 className="size-4 animate-spin" /> جاري الحفظ…</>
            : state === "saved" ? <><Check className="size-4 text-success" /> تم الحفظ تلقائياً</>
            : state === "dirty" ? "تعديلات غير محفوظة" : "الحفظ التلقائي مفعّل"}
        </span>
        <Button size="sm" onClick={() => { clearTimeout(timer.current); void persist(false); }}><Save /> حفظ</Button>
      </div>

      <Panel title="١. بيانات المريض">
        <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info k="الاسم" v={patient.full_name} />
          <Info k="العمر" v={age != null ? `${age} سنة` : "—"} />
          <Info k="الجنس" v={patient.gender === "male" ? "ذكر" : patient.gender === "female" ? "أنثى" : patient.gender || "—"} />
          <Info k="رقم الجوال" v={patient.phone || "—"} ltr />
          <Field label="تاريخ بدء الحالة">
            <Input type="date" value={c.case_date} onChange={(e) => change((x) => ({ ...x, case_date: e.target.value }))} />
          </Field>
        </div>
      </Panel>

      <Panel title="٢. الشكوى الرئيسية (Chief Complaint)">
        <Textarea rows={3} value={c.complaint} onChange={(e) => change((x) => ({ ...x, complaint: e.target.value }))} placeholder="اكتب شكوى المريض بكلماته…" />
      </Panel>

      <Panel title="٣. الفحص — External / Extraoral Examination">
        {EXTRAORAL.map((f) => <ExamRow key={f.key} f={f} c={c} patientId={patient.id} setExam={setExam} setPhotos={setPhotos} />)}
      </Panel>

      <Panel title="Intraoral Examination">
        {INTRAORAL.map((f) => <ExamRow key={f.key} f={f} c={c} patientId={patient.id} setExam={setExam} setPhotos={setPhotos} />)}
      </Panel>

      <Panel title="Cephalometric Analysis">
        <Textarea rows={5} value={c.ceph} onChange={(e) => change((x) => ({ ...x, ceph: e.target.value }))} placeholder="SNA, SNB, ANB, FMA, U1-SN, IMPA …" dir="ltr" className="text-start" />
        <div className="mt-3">
          <Photos patientId={patient.id} k="ceph" paths={c.photos.ceph ?? []} onChange={(p) => setPhotos("ceph", p)} label="صورة الأشعة" />
        </div>
      </Panel>

      <Panel title="٤. Diagnosis and Problem List">
        <Textarea rows={5} value={c.diagnosis} onChange={(e) => change((x) => ({ ...x, diagnosis: e.target.value }))} placeholder="- المشكلة الأولى&#10;- المشكلة الثانية" />
      </Panel>

      <Panel title="٥. Treatment Plan">
        <Textarea rows={5} value={c.plan} onChange={(e) => change((x) => ({ ...x, plan: e.target.value }))} />
      </Panel>
    </div>
  );
}

function Info({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) {
  return <div><div className="text-xs text-muted-foreground">{k}</div><div className="mt-0.5 font-medium" dir={ltr ? "ltr" : undefined}>{v}</div></div>;
}

function ExamRow({ f, c, patientId, setExam, setPhotos }: {
  f: OrthoField; c: OrthoCase; patientId: string;
  setExam: (k: string, part: "v" | "n", val: string) => void; setPhotos: (k: string, p: string[]) => void;
}) {
  const e = c.exam[f.key] ?? {};
  return (
    <div className="grid gap-2 border-t border-border py-3 first:border-0 first:pt-0 md:grid-cols-[190px_1fr_1fr]">
      <div className="pt-2 text-sm font-semibold" dir="ltr" style={{ textAlign: "start" }}>{f.label}</div>
      {f.options ? (
        <NativeSelect value={e.v ?? ""} onChange={(ev) => setExam(f.key, "v", ev.target.value)}>
          <option value="">—</option>
          {f.options.map((o) => <option key={o}>{o}</option>)}
        </NativeSelect>
      ) : <Input value={e.v ?? ""} onChange={(ev) => setExam(f.key, "v", ev.target.value)} />}
      <Input value={e.n ?? ""} onChange={(ev) => setExam(f.key, "n", ev.target.value)} placeholder="ملاحظات" />
      <div className="md:col-span-3">
        <Photos patientId={patientId} k={f.key} paths={c.photos[f.key] ?? []} onChange={(p) => setPhotos(f.key, p)} />
      </div>
    </div>
  );
}

function Photos({ patientId, k, paths, onChange, label = "إضافة صورة" }: {
  patientId: string; k: string; paths: string[]; onChange: (p: string[]) => void; label?: string;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const missing = paths.filter((p) => !urls[p]);
    if (!missing.length) return;
    supabase.storage.from(BUCKET).createSignedUrls(missing, 3600).then(({ data }) => {
      if (!data) return;
      setUrls((u) => { const n = { ...u }; for (const d of data) if (d.path && d.signedUrl) n[d.path] = d.signedUrl; return n; });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const blob = await compressImage(file);
        const path = `${patientId}/${k}/${crypto.randomUUID()}.jpg`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error(error.message);
        added.push(path);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "فشل رفع الصورة");
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (added.length) onChange([...paths, ...added]);
  }

  async function remove(p: string) {
    if (!confirm("حذف الصورة؟")) return;
    await supabase.storage.from(BUCKET).remove([p]);
    onChange(paths.filter((x) => x !== p));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {paths.map((p) => (
        <div key={p} className="group relative">
          {urls[p]
            ? <button type="button" onClick={() => setZoom(urls[p]!)}><img src={urls[p]} alt="" className="size-20 rounded-lg border border-border object-cover print:size-40" /></button>
            : <div className="size-20 animate-pulse rounded-lg bg-muted" />}
          <button type="button" onClick={() => remove(p)} aria-label="حذف الصورة" className="no-print absolute -start-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-destructive text-white"><X className="size-3" /></button>
        </div>
      ))}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
      <Button type="button" size="sm" variant="outline" className="no-print" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? <Loader2 className="animate-spin" /> : <Camera />} {label}
      </Button>
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-4xl p-2">
          <DialogHeader className="sr-only"><DialogTitle>عرض الصورة</DialogTitle></DialogHeader>
          {zoom && <img src={zoom} alt="" className="max-h-[80vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
