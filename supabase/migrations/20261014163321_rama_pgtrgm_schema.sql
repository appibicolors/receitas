-- Inspeção de produção confirmou que pg_trgm não existia antes da RAMA.
-- Move exclusivamente a extensão recém-instalada, sem tocar objetos antigos.
begin;
alter extension pg_trgm set schema extensions;
commit;
