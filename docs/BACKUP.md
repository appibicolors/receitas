# Backup RAMA e Google Drive

**Não há integração Drive autorizada nem backup de produção testado nesta entrega.** O procedimento e exportador estão preparados; a aprovação final exige restauração real validada. PostgreSQL permanece fonte oficial; Google Sheets não é utilizado.

## Exportação administrativa

1. Reservar janela sem gravações no módulo RAMA. Consultas podem continuar. Não alterar usuários/configurações do apontamento para suspender RAMA. Avisar supervisores para não editar e suspender temporariamente a publicação RAMA, se necessário, por decisão administrativa.
2. Em estação administrativa segura, definir `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente, sem salvar em repositório ou logs. Executar `node scripts/backup.mjs` dentro deste repositório. O diretório `backups/` está ignorado pelo Git; contém dados pessoais e deve ter acesso restrito.
3. Exportação usa paginação por chave e inclui `rama_usuarios`, todas as receitas (inclusive excluídas), histórico e fotos atuais/antigas referenciadas. JSON preserva UUIDs, decimais, versões e timestamps. Manifesto tem contagens e SHA256. Falhas não produzem manifesto completo; descartar a exportação incompleta somente após avaliação local.
4. Exportar também a sequência, com acesso SQL administrativo somente leitura:

```sql
select last_value,is_called from public.rama_receitas_codigo_seq;
select last_value,is_called from public.rama_receitas_historico_id_seq;
```

Guardar resultado em `sequencias.json` junto ao backup; não inferir sequência apenas do maior código, porque operações canceladas deixam lacunas. Incluir os dois arquivos SQL da migration, versão do código e configuração não secreta. Nunca copiar secrets para o pacote.

5. Para backup transacional adicional, usar `pg_dump` com conexão segura/arquivo de serviço fora do repositório, selecionando **somente** `public.rama_usuarios`, `public.rama_receitas`, `public.rama_receitas_historico`, `public.rama_receitas_codigo_seq`, `public.rama_receitas_historico_id_seq`. Executar em snapshot consistente. Não executar dump indiscriminado do Auth/apontamento para esta finalidade. Storage é exportado separadamente. `pg_dump` pode emitir aviso sobre FK para Auth fora da seleção; preservar o mapeamento autorizado descrito abaixo.
6. Conferir hashes, contagens, abertura de amostras WebP e arquivos de sequências. Comprimir e criptografar o pacote com ferramenta corporativa, mantendo senha/chave fora do Drive. Fazer upload manual ao Google Drive administrativo da Ibicolor em pasta restrita. Confirmar upload baixando uma cópia e verificando SHA256. Não publicar links de compartilhamento aberto.
7. Definir retenção conforme política administrativa e espaço disponível (ex.: diários 7 dias, semanais 4 semanas, mensais 6 meses após aprovação). Nenhuma rotina é executada a cada consulta.

## Restauração obrigatória em ambiente isolado

1. Criar projeto Supabase de homologação separado. Nunca executar restauração experimental no `apontamento-producao`.
2. Verificar hashes e manifestos. Aplicar migrations RAMA em ambiente limpo.
3. Preservar IDs Auth se o ambiente já possuir contas autorizadas correspondentes. Em projeto novo, o administrador cria/vincula contas reais de homologação e mantém mapeamento `UUID antigo → UUID novo`. Reescrever somente referências RAMA: `rama_usuarios.id`, `criado_por`, `atualizado_por`, `excluido_por`, `usuario_id` e campos correspondentes nos snapshots históricos. Não restaurar senhas, tokens ou metadados de outros aplicativos. Guardar mapeamento e relatório de rastreabilidade.
4. Em transação administrativa do ambiente isolado, desabilitar **somente** `rama_receitas_auditoria` e `rama_receitas_historico` na tabela RAMA durante a importação. As RPCs não servem para restaurar porque substituem códigos e auditoria. Importar usuários, receitas e histórico nessa ordem, usando `OVERRIDING SYSTEM VALUE` para identidade do histórico. Reabilitar os dois triggers na mesma transação; rollback em qualquer falha.
5. Restabelecer sequências com `setval` conforme `last_value` e `is_called` guardados. Restaurar imagens no bucket privado `rama-fotos` com os caminhos originais, via administração Storage. Não alterar tabelas internas `storage.objects` diretamente.
6. Comparar contagem total, ativas/inativas/rascunhos/excluídas, versões, snapshots e hashes das fotos. Conferir todos os vínculos e ausência de objetos antigos alterados.
7. Testar login de supervisor/operador, busca com acentos, receita com foto, histórico e exclusão. Criar nova receita: seu código deve ser maior que a sequência salva, sem reutilização. Confirmar downloads bloqueados para anônimo/inativo.
8. Registrar duração, erros, evidências e responsável. Somente após esses passos declarar o backup e a restauração validados. Os testes locais de SQL não equivalem a uma restauração Supabase + Storage.

## Limpeza de fotos não vinculadas

Falhas de gravação tentam recolher uploads novos não referenciados. Substituições/removals preservam as imagens anteriores que aparecem no histórico, incluindo receitas excluídas. Para cancelamentos abruptos/rede interrompida, revisar periodicamente arquivos do bucket com mais de 24 horas; comparar com **todas** as receitas e `dados_anteriores.foto`/`dados_novos.foto` no histórico. Somente arquivos sem qualquer referência podem ser removidos após backup. Usar API Storage administrativa, nunca exclusão SQL global, `emptyBucket` ou remoção em massa sem lista revisada.

## Integração Drive futura

Se autorizada, usar serviço administrativo com OAuth da conta Ibicolor ou service account autorizada para uma pasta específica. Tokens em cofre/secret de backend, nunca frontend/Actions público. Programar exportação na janela acordada, compactar, criptografar, enviar, verificar hashes, registrar falhas e testar restauração periodicamente. Confirmar cotas/SMTP e custos antes de automatizar. Nenhuma credencial foi criada ou presumida aqui.
