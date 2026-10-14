-- SOMENTE LEITURA. Guardar saída antes/depois fora do repositório público.
select current_database(),version();
select n.nspname,c.relname,c.relkind,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','auth','storage') order by 1,2;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by 1,2,3;
select n.nspname,p.proname,pg_get_functiondef(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1,2;
select event_object_schema,event_object_table,trigger_name,action_statement from information_schema.triggers order by 1,2,3;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets;
select extname,extnamespace::regnamespace from pg_extension;
-- Se houver políticas storage globais/permissivas que alcancem rama-fotos,
-- NÃO aplicar: isolar bucket em outro projeto ou obter decisão administrativa.
