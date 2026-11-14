import { queryOptions } from "@tanstack/react-query";
import { getPublicClinic } from "./public.functions";

export const publicClinicQuery = queryOptions({
  queryKey: ["public-clinic"],
  queryFn: () => getPublicClinic(),
  staleTime: 60_000,
});

export type PublicClinic = Awaited<ReturnType<typeof getPublicClinic>>;
