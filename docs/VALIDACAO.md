# Verificação e homologação

Atualização de 15/10/2026: 43 testes de domínio/WebP, 26 de PostgreSQL, 12 de Edge e 9 de navegador (90 no total), com pressão Fourlad, banho por produtos e alimentação inteira. A seção abaixo registra a homologação inicial; os requisitos de máscara antigos foram substituídos conforme [alterações de receita](ALTERACOES_RECEITA.md).

Data: 14/10/2026, horário de Brasília. Migrations RAMA, bucket e Edge Function implantados após inspeção/autorização. Foram comparados 56 objetos antigos sem diferenças e executados testes reais de rejeição anônima e CRUD transacional com rollback. O supervisor foi vinculado a conta Auth existente confirmada pelo usuário, sem alterar metadados Auth ou perfil do apontamento. Ver [estado da implantação](STATUS_IMPLANTACAO.md) para resultados recentes e limites da homologação.

## Escopo dos testes locais

- Vitest: validação numérica, temperatura inteira, máscara, descrição longa, foto opcional, fuso horário, bloqueio de chave administrativa e estrutura WebP.
- PGlite: executa as duas migrations reais em PostgreSQL embarcado isolado, com schemas/papéis Auth e Storage mínimos; verifica privilégios, RLS, RPCs, auditoria, código e conflitos de versão. Não emula login, envio de e-mail nem API Storage. As 12 requisições de criação concorrentes são enfileiradas em uma única conexão local; teste multic conexão PostgreSQL/Supabase ainda é obrigatório em staging.
- Playwright/Edge: navegação com API interceptada, conta sem vínculo, proteção por URL, reload de rota hash, busca e retorno, detalhes sem foto, formulário e envio de decimais; screenshots em 390×844, 820×1180 e 1440×1000. Não comprova login real/RLS de produção.
- TypeScript e build Vite: verificam código frontend e artefato estático `/receitas/`, inclusive página de convite independente.

Resultados finais executados:

| Verificação                       | Resultado                                                                                     |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| TypeScript `tsc -b`               | Aprovado                                                                                      |
| Vitest                            | 31 testes aprovados em 2 arquivos                                                             |
| PostgreSQL/PGlite                 | 21 testes aprovados, ambas migrations aplicadas somente no banco isolado                      |
| Edge Function                     | 12 testes aprovados com adaptadores Supabase/Deno simulados, executando código real da função |
| Playwright/Edge                   | 8 testes aprovados; screenshots inspecionadas de consulta móvel e cadastro desktop            |
| Vite produção                     | Aprovado; `index.html` e `convite.html`, chunks separados, sem aviso de chunk acima de 500 kB |
| Instalação `--frozen-lockfile`    | Aprovada                                                                                      |
| Supabase/GitHub Pages/Drive reais | Não executados                                                                                |

Total: **72 testes automatizados locais aprovados**, além de TypeScript/build. A suíte Edge substitui os adaptadores de serviço por mocks, verificando bloqueios sem sessão, token inválido, operador/inativo/sem vínculo, origem incorreta, perfil inválido, ator validado, vínculo sem alteração de credenciais, upload falso/válido e preservação de fotos referenciadas. Não valida emissão de JWT real, SMTP, ambiente Deno remoto ou Storage real.

## Matriz dos 32 requisitos

| #   | Requisito                             | Evidência local                                            | Homologação real                      |
| --- | ------------------------------------- | ---------------------------------------------------------- | ------------------------------------- |
| 1   | Login supervisor                      | Perfil/navegação com API interceptada                      | Pendente login Auth                   |
| 2   | Login operador                        | Perfil/navegação com API interceptada                      | Pendente login Auth                   |
| 3   | Sem vínculo bloqueado                 | PGlite e navegador                                         | Pendente API real                     |
| 4   | URL de cadastro bloqueada ao operador | Playwright                                                 | Pendente publicado                    |
| 5   | Operador não altera API               | Privilégios/RPC PGlite                                     | Pendente REST real                    |
| 6   | Operador não cria usuários            | RPC sem EXECUTE no PGlite; Edge exige supervisor           | Pendente Edge real                    |
| 7   | Não lê rascunhos                      | RLS PGlite                                                 | Pendente REST real                    |
| 8   | Não lê inativas                       | RLS/pesquisa PGlite                                        | Pendente REST real                    |
| 9   | Não lê excluídas                      | Exclusão/pesquisa PGlite                                   | Pendente REST real                    |
| 10  | Supervisor cria receita               | RPC PGlite e formulário interceptado                       | Pendente integração                   |
| 11  | Código automático                     | PGlite                                                     | Pendente integração                   |
| 12  | Concorrência sem duplicação           | 12 solicitações locais; sequence/unique                    | Pendente múltiplas conexões           |
| 13  | Descrição técnica/popular longa       | Vitest e PGlite                                            | Pendente amostra real                 |
| 14  | Foto opcional                         | Vitest/PGlite                                              | Pendente integração                   |
| 15  | Upload                                | Compressão e validador implementados; WebP testado         | Pendente Storage/Edge reais           |
| 16  | Sem foto não falha                    | Playwright                                                 | Pendente integração                   |
| 17  | Temperatura rejeita decimal           | Vitest e RPC PostgreSQL                                    | Pendente REST real                    |
| 18  | Alimentação alfanumérica/máscara      | Vitest, Playwright e SQL                                   | Pendente operador real                |
| 19  | Alimentação incompleta rejeitada      | Vitest/SQL                                                 | Pendente REST real                    |
| 20  | Largura com vírgula                   | Vitest e payload Playwright                                | Pendente integração                   |
| 21  | Banho/velocidade numéricos            | Vitest/SQL                                                 | Pendente integração                   |
| 22  | Pesquisa por trecho                   | PGlite                                                     | Pendente base real                    |
| 23  | Caixa/acentos ignorados               | PGlite                                                     | Pendente base real                    |
| 24  | Histórico backend                     | PGlite; histórico imutável                                 | Pendente integração                   |
| 25  | Exclusão lógica                       | PGlite                                                     | Pendente integração                   |
| 26  | Status                                | PGlite/formulário                                          | Pendente integração                   |
| 27  | Novo usuário/perfil                   | Código de convite/vínculo e RPC                            | Pendente SMTP/Edge/Auth               |
| 28  | Desativação só RAMA                   | PGlite mantém linha Auth                                   | Pendente conta compartilhada real     |
| 29  | Fotos privadas                        | RLS Storage PGlite para ativo/sem vínculo/inativa          | Pendente downloads reais/anônimo      |
| 30  | Reload produção                       | Reload rota hash local                                     | Pendente GitHub Pages                 |
| 31  | Celular/tablet/desktop                | Playwright, screenshots inspecionadas                      | Pendente dispositivos industriais     |
| 32  | Apontamento preservado                | Nenhum arquivo anterior editado; sentinel local preservado | Pendente comparação e smoke test real |

## Roteiro de homologação obrigatório

Usar staging com supervisor, operador, usuário Auth sem vínculo e anônimo. Guardar evidências sem senhas/tokens. Executar as 32 linhas acima com interface e REST direta. Verificar também versão concorrente, rebaixamento/desativação simultânea do último supervisor, data/autor gerados pelo servidor, acesso a fotos após alteração de status/desativação, mime adulterado/tamanho excedido e busca com `%`, `_`, acentos e termos curtos. Testar convites, definição de senha, sessão expirada e logout local mantendo apontamento ativo.

Em PostgreSQL staging, iniciar duas conexões independentes e inserir pelo menos 50 receitas em cada uma via RPC com token supervisor; comparar códigos únicos e monotônicos, observando lacunas permitidas. Conferir planos de consulta/indexação e latência numa base representativa; nenhum benchmark de produção foi feito aqui.

Antes/depois de migrations autorizadas, comparar saída de `preflight.sql` e fluxo do apontamento. Verificar políticas Storage globais não abrangendo o novo bucket. Testar exportação/restauração real seguindo `BACKUP.md`; sem isso, backup não está validado.

## Pendências e riscos concretos

- Acesso administrativo ao Supabase, revisão de schema/políticas atuais e autorização explícita para implantação.
- URL/chave pública do projeto; SMTP/redirect de convite e domínio real.
- Primeiro supervisor autorizado e usuários reais de homologação.
- Elegibilidade/ativação GitHub Pages e configuração de variáveis.
- Políticas Storage globais preexistentes podem invalidar isolamento: inspeção deve bloquear aplicação se houver alcance indevido.
- Convite Auth e vínculo RAMA são operações distintas: se vínculo falhar, não apagar conta global; corrigir UUID autorizado.
- Fotos antigas do histórico são preservadas; uploads abandonados precisam da limpeza administrativa documentada.
- Backup/Drive e restauração reais não executados.

Não afirmar que o apontamento em produção continua funcionando sem executar sua homologação. O que foi comprovado é que esta execução não modificou seus arquivos ou acessou seu backend.
