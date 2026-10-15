# Estado da implantação

Atualização de 15/10/2026: pressão Fourlad, banho por itens e alimentação inteira implementados e testados (90 testes locais). Migration `20261015131355_rama_fourlad_banho_itens_alimentacao` aplicada com limpeza de testes autorizada: 0 receitas/históricos/fotos; usuários RAMA preservados; os 56 objetos antigos do apontamento continuam sem diferenças. Sequência `last_value=1, is_called=false`, pronta para `IBI-REC-001`. Veja [alterações da receita](ALTERACOES_RECEITA.md). O registro abaixo descreve a implantação inicial de 14/10/2026.

Atualizado em 14/10/2026. Implantação autorizada pelo usuário após revisão da entrega.

| Etapa                                | Estado verificado                                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Código e documentação                | Enviados a `main` de `appibicolors/receitas` via Git autenticado                                                                 |
| Testes locais                        | 72 aprovados; TypeScript e build aprovados                                                                                       |
| GitHub Actions                       | Primeiro workflow concluído com sucesso                                                                                          |
| Supabase                             | Projeto `apontamento-producao` identificado e ativo                                                                              |
| Inspeção/preservação                 | Nove tabelas antigas; 56 definições/permissões de relações, funções, triggers e políticas comparadas sem diferenças              |
| Migrations RAMA                      | `20261014162739 rama_receitas_core`, `20261014162756 rama_storage_privado`, `20261014163321 rama_pgtrgm_schema` aplicadas        |
| Storage                              | `rama-fotos` privado, WebP, limite 2 MB; não existiam buckets/políticas Storage antes                                            |
| Edge Function                        | `rama-admin` ativa, versão 1, verifica JWT e perfil dentro do código                                                             |
| RLS                                  | Três tabelas RAMA habilitadas, conferidas no banco real                                                                          |
| Primeiro supervisor                  | Conta Auth existente confirmada pelo usuário vinculada como SUPERVISOR ativo; metadados Auth e perfil do apontamento preservados |
| GitHub Pages                         | Publicado; workflow aprovado, URL HTTP 200, login habilitado, reload e proteção de rota sem sessão verificados no navegador real |
| Homologação autenticada/backup/Drive | Pendentes                                                                                                                        |

URL publicada: https://appibicolors.github.io/receitas/ . Workflow aprovado: [publicação](https://github.com/appibicolors/receitas/actions/runs/38599757325). Nenhuma credencial administrativa foi versionada. `.env.production` contém apenas URL e chave publishable pública; a service role permanece no ambiente da Edge Function.

Testes reais: REST anônimo de receitas HTTP 401; RPC anônima de gravação HTTP 401; Edge sem sessão HTTP 401. Download de caminho privado inexistente retornou NoSuchKey, não substituindo teste com foto real. `rama_administrar_usuario` não é executável por `anon`/`authenticated`, RPCs de receitas não são executáveis por `anon`; pg_trgm está em `extensions`.

Primeiro supervisor vinculado por SQL administrativo somente em `rama_usuarios`. Comparação por hash confirmou metadados Auth e perfil existente do apontamento inalterados. Usar a senha individual que essa conta já possui; nenhuma senha foi lida ou trocada.

Teste transacional no banco real: perfil supervisor, cadastro, código automático, decimais, pesquisa sem acentos, edição/status, exclusão lógica, histórico e bloqueio da RPC administrativa direta passaram. A transação foi revertida; nenhuma receita de teste persistiu. As sequências podem apresentar lacunas permitidas por causa dos testes revertidos.

Pendências: login interativo com senha do próprio usuário, testes com operador, upload/download/concorrência reais, SMTP/redirect de convite e backup/restauração. O trigger Auth preexistente cria perfil `operador` no apontamento para novas contas; não foi modificado. Reutilizar conta Auth existente evita cadastro global adicional.

Defaults não secretos da Edge: origem `https://appibicolors.github.io` e redirect `/receitas/convite.html`. Secrets RAMA podem sobrescrever esses valores; a lista Auth de redirects precisa ser validada, preservando configurações anteriores.

Os advisors sinalizaram funções privilegiadas antigas e proteção contra senhas vazadas desabilitada; não foram alteradas, conforme escopo. As RPCs RAMA privilegiadas indicadas são intencionais, têm `search_path` fixo, privilégios explícitos e checagem de vínculo/supervisor. Referências: [funções autenticadas privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [funções anônimas privilegiadas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
