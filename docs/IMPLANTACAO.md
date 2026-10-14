# Implantação autorizada

## 1. Inspeção e revisão de impacto

1. Confirmar que está no projeto Supabase `apontamento-producao` e registrar project ref. Nenhuma credencial foi descoberta nesta implementação.
2. Executar `preflight.sql` no SQL Editor com acesso administrativo. É somente leitura. Guardar resultado seguro; não publicar funções/dados internos no GitHub.
3. Examinar objetos `rama_*`, bucket `rama-fotos`, extensões e permissões padrão. As migrations abortam em conflitos, não os substituem.
4. Examinar TODAS as políticas `storage.objects`, incluindo `anon`, `authenticated` e `public`. Se alguma permitir leitura/escrita genérica de buckets, ela também poderia alcançar RAMA. Não modificar políticas do apontamento: resolver o isolamento com o administrador antes da implantação.
5. Confirmar que papéis `anon`, `authenticated`, `service_role` e `auth.uid()` existem; `pg_trgm` pode ser criado ou já está instalado. Não realocar extensões existentes.
6. Salvar definição de tabelas, funções, triggers, views e políticas do apontamento. Executar fluxo básico existente de login, apontamento e consulta. Registrar resultados.
7. Revisar SQL e obter **autorização explícita** antes de executar migrations ou operações administrativas no projeto em produção. A implantação foi autorizada pelo usuário em 14/10/2026 ("vamos implantar"); o preflight e o acesso administrativo continuam necessários antes de aplicar as migrations. Nenhuma migration de produção foi aplicada até o registro desse estado.

## 2. Migrations

Aplicar os arquivos em ordem, cada um dentro de sua transação, pelo SQL Editor (mais simples no projeto compartilhado). Registrar arquivo, hash SHA256, responsável, horário e resultado no controle administrativo de migrations. Alternativa CLI: vincular o projeto explicitamente e revisar `supabase db push --dry-run` com todo o histórico remoto reconciliado antes de qualquer push. Não usar `db reset`, `--include-all` ou manipular migrations do aplicativo anterior.

1. `20261014162739_rama_receitas_core.sql`: sequência, três tabelas, índices, funções, triggers e RLS.
2. `20261014162756_rama_storage_privado.sql`: bucket privado e política exclusiva de leitura.
3. `20261014163321_rama_pgtrgm_schema.sql`: relocação da extensão pg_trgm criada pela RAMA para o schema `extensions`, confirmado ausente antes da implantação. Não aplicar essa terceira migration para realocar extensões preexistentes de outro projeto sem revisão.

Não há seed com usuários, e-mails ou senhas de produção. Não conceder `service_role` a navegadores. Após aplicar, repetir inspeção e comparar objetos anteriores: somente novos objetos RAMA, pg_trgm se faltava e bucket/política exclusivos são esperados.

## 3. Primeiro supervisor

O administrador identifica uma conta **já autorizada** no Supabase Auth (UUID, nome e e-mail reais). Pode ser conta existente, sem trocar senha ou metadados. Se conta nova for necessária, criá-la/convocá-la por fluxo administrativo seguro do Supabase. Depois executar no SQL Editor, substituindo os valores:

```sql
begin;
-- Substituir UUID e nome antes de executar. E-mail vem da conta Auth real.
insert into public.rama_usuarios(id,nome,email,perfil,ativo)
select id, 'NOME REAL AUTORIZADO', email, 'SUPERVISOR', true
from auth.users where id = 'UUID REAL AUTORIZADO'::uuid;
-- Verificar exatamente 1 registro inserido. Caso contrário: ROLLBACK.
commit;
```

Não disponibilizar isso em rota, Edge Function pública ou tela de primeiro acesso. Para recuperar último supervisor em emergência, repetir processo com administrador do banco e registro formal da decisão. Nunca remover proteções por falta de acesso.

## 4. Edge Function e convites

Usar Supabase CLI autenticada em ambiente administrativo:

```sh
supabase functions deploy rama-admin --project-ref PROJECT_REF --no-verify-jwt
```

O gateway JWT fica desabilitado porque a função valida token com `auth.getUser(token)` e exige supervisor ativo por requisição. Não remover essa validação. Configurar pelo painel de secrets, evitando registrar valores secretos no terminal:

- `RAMA_APP_ORIGIN`: `https://appibicolors.github.io` (confirmar endereço real).
- `RAMA_INVITE_REDIRECT`: `https://appibicolors.github.io/receitas/convite.html`.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são disponibilizadas pelo Supabase nas funções.

Verificar configuração atual de redirect URLs, templates e SMTP ANTES de alterá-la. Adicionar apenas a URL de convite, preservando configurações do apontamento; obter aprovação administrativa para a alteração compartilhada. Não substituir Site URL ou templates globais cegamente. A página de convite trata fragmentos Auth antes do HashRouter e abre `#/senha`.

Se SMTP não funcionar/limites não atenderem, não gerar credenciais fictícias nem compartilhar senha coletiva: administrador prepara conta Auth e credenciais de forma segura, usuário define sua própria senha, supervisor vincula seu UUID existente. Não há troca de senha administrativa no frontend. Se um convite for enviado mas o vínculo falhar, a conta continua sem permissão RAMA; corrigir pelo vínculo UUID, sem apagar a conta compartilhada.

## 5. GitHub Pages

1. Confirmar visibilidade de `appibicolors/receitas` e plano do proprietário. A documentação atual permite Pages em repositórios públicos no plano gratuito; repositórios privados exigem plano elegível. Visibilidade/plano não foram confirmados nesta execução.
2. Em Settings → Pages, selecionar GitHub Actions, apenas após confirmar elegibilidade.
3. Em Settings → Secrets and variables → Actions → Variables, cadastrar somente `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` pública. `service_role` não é necessária em GitHub.
4. Definir `RAMA_PAGES_ENABLED=true` quando implantação do backend e homologação estiverem concluídas. Sem essa variável, workflow apenas verifica/builda e não publica.
5. Subir código para branch `main` e executar workflow. Conferir artefato, URL e acesso. Repositório privado não torna a aplicação Pages privada automaticamente; dados continuam protegidos por Auth/RLS.
6. Testar abertura e reload de `https://appibicolors.github.io/receitas/#/consulta` e rota administrativa como operador.

Para desenvolvimento, `.env.local` com URL/chave pública e `pnpm dev`. Ausência dessas variáveis mostra configuração pendente na tela; não há modo demo em produção. Conferir que artefato não contém secrets. Não habilitar qualquer configuração Auth que conceda automaticamente vínculo RAMA.

## 6. Homologação e recuperação

Executar matriz de `VALIDACAO.md` em staging primeiro, com Auth e Storage reais. Testes locais não substituem estes passos. Confirmar funcionamento do apontamento após a implantação sem alterações em seus objetos ou usuários. Testar backup/restauração em projeto isolado.

Se RAMA falhar, retirar sua publicação ou desativar acessos RAMA e investigar. Não reverter usando exclusão global de schema/usuários; não remover pg_trgm que possa estar sendo usado por terceiros. Preservar receitas/histórico e backup. Reversão de objetos RAMA requer revisão administrativa específica.
