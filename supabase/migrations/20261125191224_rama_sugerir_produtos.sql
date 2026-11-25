-- Sugestões de produtos já utilizados nas composições do banho.
-- Somente leitura, sob os privilégios e RLS do usuário chamador.
create function public.rama_sugerir_produtos(termo text default '', limite integer default 10)
returns table(produto text, frequencia bigint)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  q text;
begin
  if public.rama_perfil() is distinct from 'SUPERVISOR' then
    raise exception 'Acesso não autorizado' using errcode = '42501';
  end if;

  if termo is null or length(termo) > 200 or limite < 1 or limite > 10 then
    raise exception 'Filtro inválido';
  end if;

  q := public.rama_normalizar(trim(termo));
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');

  return query
  with produtos as (
    select
      upper(regexp_replace(trim(item ->> 'produto'), '\s+', ' ', 'g')) as nome,
      r.status
    from public.rama_receitas r
    cross join lateral jsonb_array_elements(r.banho_itens) as itens(item)
    where r.data_exclusao is null
      and item ? 'produto'
      and length(trim(item ->> 'produto')) > 0
  ), normalizados as (
    select nome, public.rama_normalizar(nome) as chave, status
    from produtos
  )
  select min(n.nome) as produto, count(*) as frequencia
  from normalizados n
  where q = '' or n.chave like '%' || q || '%' escape '\'
  group by n.chave
  order by count(*) filter (where n.status = 'ATIVA') desc,
           count(*) desc,
           min(n.nome)
  limit limite;
end
$$;

revoke all on function public.rama_sugerir_produtos(text, integer)
  from public, anon, authenticated;
grant execute on function public.rama_sugerir_produtos(text, integer) to authenticated;

comment on function public.rama_sugerir_produtos(text, integer) is
  'Sugere nomes de produtos de banho para supervisores, sem modificar receitas.';
