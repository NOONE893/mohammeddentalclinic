create policy "Service images readable" on storage.objects for select to anon, authenticated
  using (bucket_id = 'service-images');
create policy "Admins upload service images" on storage.objects for insert to authenticated
  with check (bucket_id = 'service-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update service images" on storage.objects for update to authenticated
  using (bucket_id = 'service-images' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete service images" on storage.objects for delete to authenticated
  using (bucket_id = 'service-images' and public.has_role(auth.uid(), 'admin'));