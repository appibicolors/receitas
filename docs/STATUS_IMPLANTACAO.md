# Estado da implantação

Atualizado em 14/10/2026. Implantação autorizada pelo usuário após revisão da entrega.

| Etapa                                | Estado verificado                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Código e documentação                | Enviados a `main` de `appibicolors/receitas` via Git autenticado                                                          |
| Testes locais                        | 72 aprovados; TypeScript e build aprovados                                                                                |
| GitHub Actions                       | Primeiro workflow concluído com sucesso                                                                                   |
| Supabase                             | Projeto `apontamento-producao` identificado e ativo                                                                       |
| Inspeção/preservação                 | Nove tabelas antigas; 56 definições/permissões de relações, funções, triggers e políticas comparadas sem diferenças       |
| Migrations RAMA                      | `20261014162739 rama_receitas_core`, `20261014162756 rama_storage_privado`, `20261014163321 rama_pgtrgm_schema` aplicadas |
| Storage                              | `rama-fotos` privado, WebP, limite 2 MB; não existiam buckets/políticas Storage antes                                     |
| Edge Function                        | `rama-admin` ativa, versão 1, verifica JWT e perfil dentro do código                                                      |
| RLS                                  | Três tabelas RAMA habilitadas, conferidas no banco real                                                                   |
| Primeiro supervisor                  | `app.ibcolors@gmail.com` indicado não foi localizado no Auth; aguardando conta válida                                     |
| GitHub Pages                         | Site criado como `workflow`, `RAMA_PAGES_ENABLED=true` configurado; publicação deve ser conferida no workflow             |
| Homologação autenticada/backup/Drive | Pendentes                                                                                                                 |

URL configurada: https://appibicolors.github.io/receitas/ . Nenhuma credencial administrativa foi versionada. `.env.production` contém apenas URL e chave publishable pública; a service role permanece no ambiente da Edge Function.

Testes reais: REST anônimo de receitas HTTP 401; RPC anônima de gravação HTTP 401; Edge sem sessão HTTP 401. Download de caminho privado inexistente retornou NoSuchKey, não substituindo teste com foto real. `rama_administrar_usuario` não é executável por `anon`/`authenticated`, RPCs de receitas não são executáveis por `anon`; pg_trgm está em `extensions`.

Pendências: conta Auth válida para primeiro supervisor, teste com operador, CRUD/fotos/concorrência reais, SMTP/redirect de convite e backup/restauração. A conta do painel Supabase não é automaticamente conta Auth do aplicativo. O trigger Auth preexistente cria perfil `operador` no apontamento para novas contas; não foi modificado. Reutilizar conta Auth existente evita cadastro global adicional.

Defaults não secretos da Edge: origem `https://appibicolors.github.io` e redirect `/receitas/convite.html`. Secrets RAMA podem sobrescrever esses valores; a lista Auth de redirects precisa ser validada, preservando configurações anteriores.

Os advisors sinalizaram funções privilegiadas antigas e proteção contra senhas vazadas desabilitada; não foram alteradas, conforme escopo. As RPCs RAMA privilegiadas indicadas são intencionais, têm `search_path` fixo, privilégios explícitos e checagem de vínculo/supervisor. Referências: [funções autenticadas privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [funções anônimas privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
