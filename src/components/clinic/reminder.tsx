import { useQueryClient } from "@tanstack/react-query";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { dateLabel, fillTemplate, timeLabel, whatsappLink, hhmm } from "@/lib/clinic";
import { useSettings } from "@/hooks/use-staff";
import type { ApptRow } from "@/lib/data";

export function ReminderButton({ a, size = "sm" }: { a: ApptRow; size?: "sm" | "default" }) {
  const { data: s } = useSettings();
  const qc = useQueryClient();
  const phone = a.patient?.phone ?? "";
  if (!s) return null;
  const msg = fillTemplate(s.reminder_template, {
    name: a.patient?.full_name ?? "",
    clinic: s.name,
    date: dateLabel(a.appt_date),
    time: timeLabel(hhmm(a.appt_time)),
    doctor: a.doctor?.name ?? "",
    service: a.service?.name ?? "",
  });
  const href = whatsappLink(phone, msg);
  const sent = !!a.reminder_sent_at;

  if (!href) {
    return (
      <Button size={size} variant="outline" disabled title="لا يوجد رقم جوال">
        <MessageCircle /> بلا رقم
      </Button>
    );
  }
  return (
    <Button
      size={size}
      variant={sent ? "outline" : "whatsapp"}
      asChild
      onClick={async () => {
        const { error } = await supabase.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
        if (error) toast.error(error.message);
        qc.invalidateQueries({ queryKey: ["appointments"] });
      }}
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle /> {sent ? "أُرسل التذكير" : "تذكير واتساب"}
      </a>
    </Button>
  );
}
