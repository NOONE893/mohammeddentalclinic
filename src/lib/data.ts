import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Patient = Tables<"patients">;
export type Doctor = Tables<"doctors">;
export type Service = Tables<"services">;
export type Appointment = Tables<"appointments">;

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("لا توجد بيانات");
  return data as NonNullable<T>;
}

export const doctorsQuery = queryOptions({
  queryKey: ["doctors"],
  queryFn: () => must(supabase.from("doctors").select("*").order("sort").order("created_at")),
});

export const servicesQuery = queryOptions({
  queryKey: ["services"],
  queryFn: () => must(supabase.from("services").select("*").order("sort").order("created_at")),
});

export const patientsQuery = queryOptions({
  queryKey: ["patients"],
  queryFn: () => must(supabase.from("patients").select("*").order("created_at", { ascending: false })),
});

export const apptSelect = "*, patient:patients(id,full_name,phone), doctor:doctors(id,name), service:services(id,name)";
export type ApptRow = Appointment & {
  patient: { id: string; full_name: string; phone: string } | null;
  doctor: { id: string; name: string } | null;
  service: { id: string; name: string } | null;
};

export const appointmentsByDate = (date: string) =>
  queryOptions({
    queryKey: ["appointments", date],
    queryFn: () =>
      must(supabase.from("appointments").select(apptSelect).eq("appt_date", date).order("appt_time")) as Promise<ApptRow[]>,
  });

export const bookingRequestsQuery = queryOptions({
  queryKey: ["booking_requests"],
  queryFn: () =>
    must(
      supabase
        .from("booking_requests")
        .select("*, service:services(id,name), doctor:doctors(id,name)")
        .eq("status", "new")
        .order("req_date")
        .order("req_time"),
    ),
});

export const invoiceSelect = "*, patient:patients(id,full_name,phone), payments(id,amount,method,paid_on)";
export type InvoiceRow = Tables<"invoices"> & {
  patient: { id: string; full_name: string; phone: string } | null;
  payments: { id: string; amount: number; method: string; paid_on: string }[];
};

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: () => must(supabase.from("invoices").select(invoiceSelect).order("number", { ascending: false })) as Promise<InvoiceRow[]>,
});

export const inventoryQuery = queryOptions({
  queryKey: ["inventory"],
  queryFn: () => must(supabase.from("inventory_items").select("*").order("name")),
});

export { must };
