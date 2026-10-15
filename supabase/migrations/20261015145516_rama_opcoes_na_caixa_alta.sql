-- Preserva todas as receitas, histórico, usuários e sequência existentes.
begin;
alter table public.rama_receitas alter column largura drop not null, alter column pressao_fourlad drop not null;
create or replace function public.rama_banho_valido(itens jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare item jsonb; begin
 if jsonb_typeof(itens) is distinct from 'array' then return false; end if;

 for item in select value from jsonb_array_elements(itens) loop
  if jsonb_typeof(item) is distinct from 'object' then return false; end if;
  if jsonb_typeof(item->'quantidade') is distinct from 'number' or jsonb_typeof(item->'produto') is distinct from 'string' then return false; end if;
  if (item->>'quantidade')::numeric<0 or length(trim(item->>'produto'))=0 or position(chr(10) in item->>'produto')>0 or position(chr(13) in item->>'produto')>0 then return false; end if;
 end loop;
 return true;
end $$;
revoke all on function public.rama_banho_valido(jsonb) from public,anon,authenticated;
grant execute on function public.rama_banho_valido(jsonb) to service_role;

create or replace function public.rama_salvar(receita_id uuid,dados jsonb,versao_esperada integer default null) returns public.rama_receitas
 language plpgsql security definer set search_path='' as $$
declare r public.rama_receitas; t numeric; a integer; p numeric; v numeric; l numeric; itens jsonb; begin
 if public.rama_perfil() is distinct from 'SUPERVISOR' then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
 if receita_id is null or jsonb_typeof(dados) is distinct from 'object' then raise exception 'Receita inválida'; end if;
 if dados->>'descricao' is null or length(upper(trim(dados->>'descricao')))=0 or position(chr(10) in dados->>'descricao')>0 or position(chr(13) in dados->>'descricao')>0 then raise exception 'Informe a descrição em uma única linha'; end if;
 t:=(dados->>'temperatura')::numeric;
 if t is null or t<>trunc(t) or t<0 or t>2147483647 then raise exception 'Temperatura deve ser inteira e não negativa'; end if;
 if dados->>'alimentacao' is null or (dados->>'alimentacao') !~ '^[0-9]{1,2}$' then raise exception 'Alimentação deve ser um número inteiro de 0 a 99'; end if;
 a:=(dados->>'alimentacao')::integer;
 p:=(dados->>'pressao_fourlad')::numeric;
 if not (dados ? 'pressao_fourlad') or p<0 or p::text in ('NaN','Infinity','-Infinity') then raise exception 'Informe a pressão Fourlad não negativa em kgf/cm²'; end if;
 v:=(dados->>'velocidade')::numeric; l:=(dados->>'largura')::numeric;
 if v is null or v<0 or v::text in ('NaN','Infinity','-Infinity') or not (dados ? 'largura') or l<=0 or l::text in ('NaN','Infinity','-Infinity') then raise exception 'Velocidade ou largura inválida'; end if;
 if dados->>'status' is null or dados->>'status' not in ('RASCUNHO','ATIVA','INATIVA') then raise exception 'Status inválido'; end if;
 if dados->>'foto' is not null and ((dados->>'foto') !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' or split_part(dados->>'foto','/',1)<>receita_id::text) then raise exception 'Caminho de foto inválido'; end if;
 if not public.rama_banho_valido(dados->'banho_itens') then raise exception 'Informe SEM BANHO ou itens com quantidade não negativa e produto'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('quantidade',(item->>'quantidade')::numeric,'produto',upper(trim(item->>'produto')))), '[]'::jsonb) into itens from jsonb_array_elements(dados->'banho_itens') as entries(item);
 if versao_esperada is null then
  insert into public.rama_receitas(id,descricao,foto,velocidade,temperatura,alimentacao,pressao_fourlad,banho_itens,largura,observacao,status)
  values(receita_id,upper(trim(dados->>'descricao')),dados->>'foto',v,t::integer,a,p,itens,l,upper(coalesce(dados->>'observacao','')),dados->>'status') returning * into r;
 else
  update public.rama_receitas set descricao=upper(trim(dados->>'descricao')),foto=dados->>'foto',velocidade=v,temperatura=t::integer,alimentacao=a,pressao_fourlad=p,banho_itens=itens,largura=l,observacao=upper(coalesce(dados->>'observacao','')),status=dados->>'status'
  where id=receita_id and versao=versao_esperada and data_exclusao is null returning * into r;
  if r.id is null then raise exception 'Receita alterada por outro usuário. Reabra antes de salvar.'; end if;
 end if;
 return r;
end $$;
revoke all on function public.rama_salvar(uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.rama_salvar(uuid,jsonb,integer) to authenticated;
notify pgrst,'reload schema';
commit;
