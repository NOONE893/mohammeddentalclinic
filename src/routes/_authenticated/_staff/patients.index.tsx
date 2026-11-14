import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertCircle, Phone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Empty, PageHeader } from "@/components/clinic/staff-shell";
import { PatientDialog } from "@/components/clinic/patient-dialog";
import { patientsQuery } from "@/lib/data";
import { ageFrom } from "@/lib/clinic";

export const Route = createFileRoute("/_authenticated/_staff/patients/")({
  head: () => ({ meta: [{ title: "المرضى | نظام العيادة" }, { name: "robots", content: "noindex" }] }),
  component: PatientsPage,
});

function PatientsPage() {
  const navigate = useNavigate();
  const { data: patients = [], isLoading } = useQuery(patientsQuery);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = patients.filter((p) => !q.trim() || p.full_name.includes(q.trim()) || p.phone.includes(q.trim()) || p.national_id.includes(q.trim()));

  return (
    <>
      <PageHeader title="المرضى" subtitle={`${patients.length} مريض`} actions={<Button onClick={() => setOpen(true)}><Plus /> مريض جديد</Button>} />
      <div className="relative mb-4">
        <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم أو الجوال أو الهوية…" className="h-11 ps-9" />
      </div>
      {isLoading ? <Empty>جاري التحميل…</Empty> : list.length === 0 ? (
        <Empty>{q ? "لا توجد نتائج" : "لم تتم إضافة مرضى بعد"}</Empty>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
          {list.map((p) => {
            const age = ageFrom(p.birth_date);
            return (
              <Link key={p.id} to="/patients/$id" params={{ id: p.id }} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/50">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft font-display font-bold text-primary">{p.full_name.charAt(0)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {p.full_name}
                    {(p.allergies || p.medical_notes) && <AlertCircle className="size-3.5 text-destructive" aria-label="تنبيه طبي" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {p.phone ? <span className="num flex items-center gap-1" dir="ltr"><Phone className="size-3" />{p.phone}</span> : <span>بلا رقم</span>}
                    {age !== null && <span>· {age} سنة</span>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <PatientDialog open={open} onOpenChange={setOpen} onCreated={(id) => navigate({ to: "/patients/$id", params: { id } })} />
    </>
  );
}
