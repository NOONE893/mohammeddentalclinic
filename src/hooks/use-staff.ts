import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const [{ data: roles }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.user.id),
      supabase.from("profiles").select("full_name,email").eq("id", u.user.id).maybeSingle(),
    ]);
    const r = (roles ?? []).map((x) => x.role);
    return {
      id: u.user.id,
      email: u.user.email ?? "",
      name: profile?.full_name || u.user.email || "",
      isAdmin: r.includes("admin"),
      isStaff: r.length > 0,
    };
  },
});

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const { data, error } = await supabase.from("clinic_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
});

export function useMe() {
  return useQuery(meQuery);
}
export function useSettings() {
  return useQuery(settingsQuery);
}
