begin;
-- Falha em conflito, nunca atualiza bucket existente.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('rama-fotos','rama-fotos',false,2097152,array['image/webp']);
create policy rama_fotos_leitura on storage.objects for select to authenticated using (
 bucket_id='rama-fotos' and exists(select 1 from public.rama_receitas r where r.foto=name)
);
-- Escrita exclusivamente pela Edge Function após validação real do conteúdo.
commit;
