-- Aplicar somente após executar docs/preflight.sql e obter autorização.
begin;
do $$ begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname like 'rama\_%' escape '\')
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'rama\_%' escape '\')
 then raise exception 'Objetos RAMA existentes: revisar conflito antes de aplicar'; end if;
end $$;
create sequence public.rama_receitas_codigo_seq;
revoke all on sequence public.rama_receitas_codigo_seq from public,anon,authenticated;
create table public.rama_usuarios (
 id uuid primary key references auth.users(id), nome text not null check(length(trim(nome)) between 1 and 200),
 email text not null, perfil text not null check(perfil in ('SUPERVISOR','OPERADOR')), ativo boolean not null default true,
 data_criacao timestamptz not null default now(), data_atualizacao timestamptz not null default now()
);
create function public.rama_perfil() returns text language sql stable security definer set search_path='' as $$
 select perfil from public.rama_usuarios where id=auth.uid() and ativo
$$;
revoke all on function public.rama_perfil() from public,anon,authenticated;
grant execute on function public.rama_perfil() to authenticated;
create table public.rama_receitas (
 id uuid primary key default gen_random_uuid(), codigo text not null unique,
 descricao text not null check(length(trim(descricao))>0 and position(chr(10) in descricao)=0 and position(chr(13) in descricao)=0),
 foto text check(foto is null or foto ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$'),
 velocidade numeric not null check(velocidade>=0 and velocidade::text not in ('NaN','Infinity','-Infinity')),
 temperatura integer not null check(temperatura>=0), alimentacao text not null check(alimentacao ~ '^[A-Z0-9]{2}(-[A-Z0-9]{2}){3}$'),
 banho numeric not null check(banho>=0 and banho::text not in ('NaN','Infinity','-Infinity')),
 largura numeric not null check(largura>0 and largura::text not in ('NaN','Infinity','-Infinity')),
 observacao text not null default '', status text not null default 'RASCUNHO' check(status in ('RASCUNHO','ATIVA','INATIVA')),
 data_criacao timestamptz not null, criado_por uuid not null references auth.users(id),
 data_atualizacao timestamptz not null, atualizado_por uuid not null references auth.users(id),
 data_exclusao timestamptz, excluido_por uuid references auth.users(id), versao integer not null,
 busca text not null,
 check(foto is null or split_part(foto,'/',1)=id::text),
 check((data_exclusao is null)=(excluido_por is null))
);
create table public.rama_receitas_historico (
 id bigint generated always as identity primary key, receita_id uuid not null references public.rama_receitas(id),
 operacao text not null, usuario_id uuid not null references auth.users(id), data timestamptz not null default now(),
 dados_anteriores jsonb, dados_novos jsonb not null, versao integer not null
);
-- Normalização determinística sem alterar extensões/configurações preexistentes.
create function public.rama_normalizar(t text) returns text language sql immutable strict set search_path='' as $$
 select lower(translate(t,'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäåéèêëíìîïóòôõöúùûüçñ','AAAAAAEEEEIIIIOOOOOUUUUCNaaaaaaeeeeiiiiooooouuuucn'))
$$;
create function public.rama_auditar() returns trigger language plpgsql security definer set search_path='' as $$
declare n bigint; op text;
begin
 if public.rama_perfil() is distinct from 'SUPERVISOR' then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if TG_OP='INSERT' then
  n:=nextval('public.rama_receitas_codigo_seq');
  new.codigo:='IBI-REC-' || repeat('0',greatest(0,3-length(n::text))) || n::text;
  new.data_criacao:=clock_timestamp(); new.criado_por:=auth.uid(); new.versao:=1;
  new.data_exclusao:=null; new.excluido_por:=null;
 else
  if old.data_exclusao is not null then raise exception 'Receita excluída não pode ser alterada'; end if;
  new.id:=old.id; new.codigo:=old.codigo; new.data_criacao:=old.data_criacao; new.criado_por:=old.criado_por;
  new.versao:=old.versao+1;
  if new.data_exclusao is not null then new.data_exclusao:=clock_timestamp(); new.excluido_por:=auth.uid(); end if;
 end if;
 new.data_atualizacao:=clock_timestamp(); new.atualizado_por:=auth.uid();
 new.busca:=public.rama_normalizar(new.codigo || ' ' || new.descricao);
 return new;
end $$;
create function public.rama_historico() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.rama_receitas_historico(receita_id,operacao,usuario_id,dados_anteriores,dados_novos,versao)
 values(new.id,case when TG_OP='INSERT' then 'CRIACAO' when new.data_exclusao is not null then 'EXCLUSAO' when old.status<>new.status then 'STATUS' else 'EDICAO' end,
 auth.uid(),case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),new.versao);
 return new;
end $$;
revoke all on function public.rama_auditar(),public.rama_historico() from public,anon,authenticated;
create trigger rama_receitas_auditoria before insert or update on public.rama_receitas for each row execute function public.rama_auditar();
create trigger rama_receitas_historico after insert or update on public.rama_receitas for each row execute function public.rama_historico();
create index rama_receitas_status_idx on public.rama_receitas(status,data_atualizacao desc,id) where data_exclusao is null;
create index rama_historico_receita_idx on public.rama_receitas_historico(receita_id,id desc);
-- pg_trgm é aditivo; resolve seu schema atual, sem realocar extensão existente.
create extension if not exists pg_trgm;
do $$ declare s text; begin
 select n.nspname into s from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_trgm';
 execute format('create index rama_receitas_busca_idx on public.rama_receitas using gin (busca %I.gin_trgm_ops) where data_exclusao is null',s);
end $$;
alter table public.rama_usuarios enable row level security;
alter table public.rama_receitas enable row level security;
alter table public.rama_receitas_historico enable row level security;
revoke all on public.rama_usuarios,public.rama_receitas,public.rama_receitas_historico from public,anon,authenticated;
revoke all on sequence public.rama_receitas_historico_id_seq from public,anon,authenticated;
grant select on public.rama_usuarios,public.rama_receitas,public.rama_receitas_historico to authenticated;
grant insert(id,descricao,foto,velocidade,temperatura,alimentacao,banho,largura,observacao,status) on public.rama_receitas to authenticated;
grant update(descricao,foto,velocidade,temperatura,alimentacao,banho,largura,observacao,status,data_exclusao) on public.rama_receitas to authenticated;
grant all on public.rama_usuarios,public.rama_receitas,public.rama_receitas_historico to service_role;
grant usage,select on public.rama_receitas_codigo_seq,public.rama_receitas_historico_id_seq to service_role;
create policy rama_usuarios_leitura on public.rama_usuarios for select to authenticated using ((id=auth.uid() and ativo) or public.rama_perfil()='SUPERVISOR');
create policy rama_receitas_leitura on public.rama_receitas for select to authenticated using (data_exclusao is null and (public.rama_perfil()='SUPERVISOR' or (public.rama_perfil()='OPERADOR' and status='ATIVA')));
create policy rama_receitas_criar on public.rama_receitas for insert to authenticated with check(public.rama_perfil()='SUPERVISOR');
create policy rama_receitas_editar on public.rama_receitas for update to authenticated using (public.rama_perfil()='SUPERVISOR' and data_exclusao is null) with check(public.rama_perfil()='SUPERVISOR');
create policy rama_historico_leitura on public.rama_receitas_historico for select to authenticated using(public.rama_perfil()='SUPERVISOR');
create function public.rama_pesquisar(termo text default '',situacao text default null,pagina integer default 0,ordem text default 'atualizacao')
 returns table(id uuid,codigo text,descricao text,foto text,status text,data_atualizacao timestamptz,versao integer)
 language plpgsql stable security invoker set search_path='' as $$
declare q text; begin
 if pagina<0 or pagina>100000 or length(termo)>500 or (situacao is not null and situacao not in ('ATIVA','RASCUNHO','INATIVA')) or ordem not in ('atualizacao','codigo','descricao') then raise exception 'Filtro inválido'; end if;
 q:=public.rama_normalizar(trim(termo));
 if length(q) between 1 and 2 then return; end if;
 q:=replace(replace(replace(q,'\','\\'),'%','\%'),'_','\_');
 return query select r.id,r.codigo,r.descricao,r.foto,r.status,r.data_atualizacao,r.versao from public.rama_receitas r
 where r.data_exclusao is null and (q='' or r.busca like '%'||q||'%' escape '\') and (situacao is null or r.status=situacao)
 order by case when ordem='descricao' then r.descricao end asc,case when ordem='codigo' then r.codigo end asc,
 case when ordem='atualizacao' then r.data_atualizacao end desc,r.id limit 20 offset pagina*20;
end $$;
revoke all on function public.rama_pesquisar(text,text,integer,text) from public,anon,authenticated;
grant execute on function public.rama_pesquisar(text,text,integer,text) to authenticated;
-- Mutações passam pela RPC para validar temperatura antes do cast e versão.
revoke insert,update on public.rama_receitas from authenticated;
revoke insert(id,descricao,foto,velocidade,temperatura,alimentacao,banho,largura,observacao,status),update(descricao,foto,velocidade,temperatura,alimentacao,banho,largura,observacao,status,data_exclusao) on public.rama_receitas from authenticated;
create function public.rama_salvar(receita_id uuid,dados jsonb,versao_esperada integer default null) returns public.rama_receitas
 language plpgsql security definer set search_path='' as $$
declare r public.rama_receitas; t numeric; begin
 if public.rama_perfil() is distinct from 'SUPERVISOR' then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 t:=(dados->>'temperatura')::numeric;
 if t is null or t<>trunc(t) or t<0 or t>2147483647 then raise exception 'Temperatura deve ser inteira e não negativa'; end if;
 if versao_esperada is null then
  insert into public.rama_receitas(id,descricao,foto,velocidade,temperatura,alimentacao,banho,largura,observacao,status)
  values(receita_id,dados->>'descricao',dados->>'foto',(dados->>'velocidade')::numeric,t::integer,dados->>'alimentacao',(dados->>'banho')::numeric,(dados->>'largura')::numeric,coalesce(dados->>'observacao',''),dados->>'status') returning * into r;
 else
  update public.rama_receitas set descricao=dados->>'descricao',foto=dados->>'foto',velocidade=(dados->>'velocidade')::numeric,temperatura=t::integer,
  alimentacao=dados->>'alimentacao',banho=(dados->>'banho')::numeric,largura=(dados->>'largura')::numeric,observacao=coalesce(dados->>'observacao',''),status=dados->>'status'
  where id=receita_id and versao=versao_esperada and data_exclusao is null returning * into r;
  if r.id is null then raise exception 'Receita alterada por outro usuário. Reabra antes de salvar.'; end if;
 end if;
 return r;
end $$;
create function public.rama_excluir(receita_id uuid,versao_esperada integer) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.rama_perfil() is distinct from 'SUPERVISOR' then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 update public.rama_receitas set data_exclusao=clock_timestamp() where id=receita_id and versao=versao_esperada and data_exclusao is null;
 if not found then raise exception 'Receita alterada ou excluída. Atualize a consulta.'; end if;
end $$;
revoke all on function public.rama_salvar(uuid,jsonb,integer),public.rama_excluir(uuid,integer) from public,anon,authenticated;
grant execute on function public.rama_salvar(uuid,jsonb,integer),public.rama_excluir(uuid,integer) to authenticated;
-- Nunca exposta ao navegador. O backend passa o ID verificado da sessão.
create function public.rama_administrar_usuario(ator uuid,alvo uuid,nome text,email text,perfil text,ativo boolean) returns void
 language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(71914317);
 if not exists(select 1 from public.rama_usuarios u where u.id=ator and u.ativo and u.perfil='SUPERVISOR') then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if alvo=ator and perfil='SUPERVISOR' and not exists(select 1 from public.rama_usuarios u where u.id=alvo and u.perfil='SUPERVISOR') then raise exception 'Autopromoção bloqueada'; end if;
 if (not ativo or perfil<>'SUPERVISOR') and exists(select 1 from public.rama_usuarios u where u.id=alvo and u.ativo and u.perfil='SUPERVISOR')
 and not exists(select 1 from public.rama_usuarios u where u.id<>alvo and u.ativo and u.perfil='SUPERVISOR') then raise exception 'O último supervisor ativo deve ser preservado'; end if;
 insert into public.rama_usuarios as u(id,nome,email,perfil,ativo) values(alvo,nome,email,perfil,ativo)
 on conflict(id) do update set nome=excluded.nome,email=excluded.email,perfil=excluded.perfil,ativo=excluded.ativo,data_atualizacao=clock_timestamp();
end $$;
revoke all on function public.rama_administrar_usuario(uuid,uuid,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.rama_administrar_usuario(uuid,uuid,text,text,text,boolean) to service_role;
commit;
