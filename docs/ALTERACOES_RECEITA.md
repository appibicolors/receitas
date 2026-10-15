# Parâmetros atualizados — 15/10/2026

Alteração solicitada pela IBICOLORS, incluindo autorização explícita para remover os dados de teste da RAMA e reiniciar os códigos.

- **Pressão Fourlad:** campo obrigatório, numérico não negativo, com vírgula decimal aceita na interface; unidade kgf/cm².
- **Alimentação:** inteiro de 0 a 99, com até dois dígitos no formulário. A máscara alfanumérica antiga foi removida.
- **Banho:** lista ordenada de itens, cada um com quantidade numérica não negativa em g/L e nome do produto. O formulário começa com uma linha, permite adicionar, editar e apagar itens e mantém uma linha vazia se o último item for apagado. Para salvar, pelo menos um item completo é necessário.
- Consulta exibe todos os produtos e suas dosagens, sem somá-los em um único valor. Cadastro, edição e histórico preservam a composição completa.

## Banco

Migration `rama_fourlad_banho_itens_alimentacao`: altera somente objetos RAMA. `rama_receitas.pressao_fourlad` é `numeric`; `alimentacao` é `smallint` com constraint 0–99; `banho_itens` é `jsonb` validado pelo banco. A coluna escalar `banho` é removida. A RPC `rama_salvar` valida os novos campos antes da inserção e preserva controle de versão, autorização e auditoria existentes.

Formato dos itens:

```json
[
  {"quantidade": 40, "produto": "Silicone"},
  {"quantidade": 5, "produto": "Graxo"},
  {"quantidade": 50, "produto": "Talco baby"}
]
```

## Limpeza autorizada

A inspeção encontrou 1 receita de teste, 2 registros de histórico e nenhuma foto no bucket privado RAMA. Uma cópia de precaução foi guardada em diretório local ignorado pelo Git. A migration limpa exclusivamente `rama_receitas` e `rama_receitas_historico`, reinicia suas identidades e a sequência `rama_receitas_codigo_seq`. Não usa CASCADE e aborta se encontrar fotos que precisem de remoção pela API Storage.

Usuários RAMA, Auth, acessos e todos os objetos/dados do apontamento são preservados. A limpeza é uma exceção única de implantação autorizada; a exclusão normal de receitas continua lógica, sem reutilizar códigos.

Para verificar a próxima numeração sem consumir o código 001:

```sql
select last_value, is_called from public.rama_receitas_codigo_seq;
-- Esperado após a limpeza: last_value = 1, is_called = false.
```

Não executar `nextval` ou criar receitas de teste em produção após esse reset. O teste da primeira receita `IBI-REC-001` foi executado no PostgreSQL isolado com a migration real.

## Verificações locais

43 testes Vitest, 26 testes PostgreSQL/PGlite, 12 testes Edge com adaptadores simulados e 9 testes Playwright: 90 testes, além de TypeScript e build. Incluem primeira numeração após limpeza, preservação de usuários, limites da alimentação, pressão inválida, composição inválida, edição/remoção de itens, snapshots de auditoria e layout em celular/tablet/desktop. Serviços simulados e banco local não substituem login e operação reais.

O estado da implantação real e da publicação consta em `STATUS_IMPLANTACAO.md`.

## Aplicação em produção

Migration aplicada como `20261015131355_rama_fourlad_banho_itens_alimentacao.sql`. Verificação posterior: 0 receitas, 0 históricos, 0 fotos; usuários RAMA com o mesmo fingerprint e 1 supervisor ativo. Os 56 objetos antigos do apontamento mantiveram as mesmas definições/permissões. Sequência confirmada com `last_value=1` e `is_called=false`, sem consumir a primeira numeração em testes de produção.
