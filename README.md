# IBICOLORS · Receitas da RAMA

Aplicação React/TypeScript/Vite/Tailwind para consulta industrial e administração de receitas. Identidade visual azul com o logo fornecido pela empresa, preservado em `src/assets/ibicolor-logo.png`. PostgreSQL/Supabase é a fonte dos dados. HashRouter e base `/receitas/` são compatíveis com GitHub Pages.

## Estado da entrega

Publicado em [Receitas da RAMA](https://appibicolors.github.io/receitas/). Migrations RAMA e Edge Function implantadas após inspeção/autorização; primeiro supervisor vinculado a conta Auth existente confirmada pelo usuário. Os 56 objetos preexistentes inspecionados mantiveram as mesmas definições/permissões, assim como os metadados Auth e o perfil do apontamento dessa conta. Workflow aprovado e acesso público/rota hash verificados. Consulte [estado da implantação](docs/STATUS_IMPLANTACAO.md) para os limites da homologação e pendências de convites, fotos e backup.

## Executar

Node 22 ou posterior e pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
# Preencher somente URL e chave pública do projeto autorizado.
pnpm dev
pnpm test
pnpm test:db
pnpm test:edge
pnpm build
pnpm test:e2e
```

Os testes de navegador usam respostas interceptadas de um domínio de teste; não fazem login no projeto industrial. No Windows usam Edge instalado; no Linux instalar Chromium com `pnpm exec playwright install --with-deps chromium`. Não usar testes com fixtures no banco de produção.

## Arquitetura e arquivos

```text
src/
  App.tsx                    rotas, login, senha e navegação
  auth.tsx                   sessão separada e validação do vínculo RAMA
  components.tsx             fotos privadas, status e feedback
  invite.ts                  processamento do convite fora do HashRouter
  lib/{client,domain,photos}  cliente, validação e compressão
  pages/{Recipes,Editor,Users} consulta, painel, histórico e administração
supabase/
  migrations/                SQL versionado, tabelas, RPC, RLS, Storage
  functions/rama-admin/      convites, vínculo, acesso e upload protegido
docs/
  preflight.sql              inspeção somente leitura
  IMPLANTACAO.md             Supabase, primeiro supervisor, GitHub Pages
  BACKUP.md                  exportação, Drive e restauração
  VALIDACAO.md               resultados e matriz de homologação
scripts/
  test-db.mjs                PostgreSQL isolado com PGlite
  test-edge.mjs              função real com adaptadores de serviços simulados
  backup.mjs                 exportação RAMA e fotos, sem Auth global
tests/ e2e/                  validação de domínio e navegação
.github/workflows/pages.yml  checks/build; publicação opt-in
```

## Banco e segurança

`rama_usuarios` vincula contas de `auth.users` sem modificar seus metadados. `rama_receitas` mantém parâmetros numéricos, códigos únicos, foto por caminho, status e auditoria. `rama_receitas_historico` preserva snapshots e autoria. A sequência `rama_receitas_codigo_seq` não reutiliza números; transações canceladas podem consumir códigos.

Funções: `rama_perfil`, `rama_normalizar`, `rama_auditar`, `rama_historico`, `rama_pesquisar`, `rama_salvar`, `rama_excluir`, `rama_administrar_usuario`. Triggers exclusivos nas receitas geram timestamps e histórico. RLS habilitado em todas as três tabelas. Conta autenticada sem vínculo ativo não lê receitas; operador lê somente ATIVAS não excluídas. Não há privilégios diretos de inserção/alteração/exclusão nas tabelas para o navegador. RPCs de escrita validam supervisor e versão; a RPC administrativa é exclusiva de `service_role`.

`rama-admin` verifica token via `getUser` e vínculo ativo de supervisor antes de executar qualquer operação. A desativação não bloqueia, apaga ou altera contas Auth. O último supervisor é protegido por lock transacional. Criação do primeiro supervisor ocorre somente no SQL administrativo.

Bucket `rama-fotos` privado. Downloads autenticados passam por RLS e pelo vínculo exato com receita visível. Upload somente pela Edge Function, com assinatura WebP, MIME e tamanho conferidos no servidor; o navegador decodifica JPEG/PNG/WebP e comprime até 1200px. Blob URLs locais são revogadas ao desmontar; não há links públicos permanentes. Fotos antigas vinculadas ao histórico são preservadas; arquivos nunca vinculados são recolhidos conforme o procedimento de backup/limpeza. Políticas Storage globais preexistentes precisam ser examinadas: políticas permissivas são combinadas por OR.

Busca no banco normaliza caixa/acentos, usa `pg_trgm`, pagina 20 resumos e faz debounce de 300 ms. Buscas de 1–2 caracteres não executam pesquisa parcial; campo vazio lista página recente. `%` e `_` são literais. Sessão usa chave local própria e logout `scope: local`, preservando as sessões de outros aplicativos. Sem polling ou Realtime.

## Variáveis

Públicas: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (publishable ou anon; nunca service role).

Backend: `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` fornecidas pelo ambiente Supabase; `RAMA_APP_ORIGIN` com origem exata da aplicação; `RAMA_INVITE_REDIRECT` com URL HTTPS de `/receitas/convite.html`. Nenhuma credencial administrativa no frontend, workflow ou código versionado.

Veja [implantação](docs/IMPLANTACAO.md), [backup](docs/BACKUP.md) e [validação](docs/VALIDACAO.md). Referências técnicas: [Storage/RLS](https://supabase.com/docs/guides/storage/security/access-control), [Edge Auth](https://supabase.com/docs/guides/functions/auth), [convites](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail), [elegibilidade Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).
