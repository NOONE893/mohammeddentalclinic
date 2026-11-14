import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublicClinic = createServerFn({ method: "GET" }).handler(async () => {
  const { publicSupabase } = await import("./public-client.server");
  const sb = publicSupabase();
  const [settings, doctors, services] = await Promise.all([
    sb.from("clinic_settings").select("*").eq("id", 1).single(),
    sb.from("doctors").select("id,name,specialty,bio").eq("active", true).order("sort"),
    sb.from("services").select("id,name,description,price,duration_min,image_url").eq("active", true).order("sort"),
  ]);
  if (settings.error) throw new Error(settings.error.message);
  const list = services.data ?? [];
  const paths = list.map((s) => s.image_url).filter(Boolean);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await sb.storage.from("service-images").createSignedUrls(paths, 60 * 60 * 24 * 7);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl);
  }
  return {
    settings: settings.data,
    doctors: doctors.data ?? [],
    services: list.map((s) => ({ ...s, photo: s.image_url ? signed.get(s.image_url) ?? null : null })),
  };
});

export const getBookedSlots = createServerFn({ method: "GET" })
  .inputValidator((input: { date: string; doctorId?: string | null }) =>
    z
      .object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        doctorId: z.string().uuid().nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { publicSupabase } = await import("./public-client.server");
    const { data: rows, error } = await publicSupabase().rpc("get_booked_slots", {
      _date: data.date,
      ...(data.doctorId ? { _doctor: data.doctorId } : {}),
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => String(r.slot).slice(0, 5));
  });

export const bookingSchema = z.object({
  full_name: z.string().trim().min(2, "اكتب الاسم الكامل").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d\s-]{8,20}$/, "رقم الجوال غير صحيح"),
  service_id: z.string().uuid().nullish(),
  doctor_id: z.string().uuid().nullish(),
  req_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "اختر التاريخ"),
  req_time: z.string().regex(/^\d{2}:\d{2}$/, "اختر الوقت"),
  notes: z.string().trim().max(500).default(""),
});

export const submitBooking = createServerFn({ method: "POST" })
  .inputValidator((input: z.input<typeof bookingSchema>) => bookingSchema.parse(input))
  .handler(async ({ data }) => {
    const { publicSupabase } = await import("./public-client.server");
    const sb = publicSupabase();
    const today = new Date().toISOString().slice(0, 10);
    if (data.req_date < today) throw new Error("لا يمكن الحجز في تاريخ سابق");
    const { data: taken } = await sb.rpc("get_booked_slots", {
      _date: data.req_date,
      ...(data.doctor_id ? { _doctor: data.doctor_id } : {}),
    });
    if ((taken ?? []).some((r) => String(r.slot).slice(0, 5) === data.req_time)) {
      throw new Error("هذا الوقت محجوز، اختر وقتاً آخر");
    }
    const { error } = await sb.from("booking_requests").insert({
      full_name: data.full_name,
      phone: data.phone,
      service_id: data.service_id ?? null,
      doctor_id: data.doctor_id ?? null,
      req_date: data.req_date,
      req_time: data.req_time,
      notes: data.notes ?? "",
    });
    if (error) throw new Error("تعذر إرسال الطلب، حاول مرة أخرى");
    return { ok: true };
  });
