# Spec: Import Pro (Migração de Dados)

## Objetivo

Fornecer um fluxo completo de importação em lote de leads, deals e interações a partir de arquivos CSV ou Excel, com mapeamento visual de colunas, deduplicação prévia via dry-run, processamento assíncrono para arquivos grandes e histórico de importações com rollback nas últimas 24h. O recurso elimina o principal bloqueio de adoção do VYD Engage por novos clientes que já possuem base de contatos em outros sistemas.

## Usuários

**Administrador Migrando** — gestor ou desenvolvedor responsável pela configuração inicial do VYD para o time; possui base de leads exportada de outro CRM (ex.: HubSpot) e precisa importar antes de iniciar o treinamento.

**Vendedor Iniciando** — usuário que mantém sua lista de prospectos em planilha (Excel/Google Sheets) e precisa carregar centenas de contatos sem digitação manual.

Nível técnico: intermediário (sabe exportar CSV, não necessariamente conhece estruturas de banco de dados). Contexto de uso: configuração pontual, realizada uma ou poucas vezes por tenant.

## Requisitos

### Obrigatórios

**IMP-1.1 — Upload CSV/Excel com Mapeamento de Campos**

1. O sistema deve disponibilizar a página `/app/settings/import` com um uploader que aceite arrastar e soltar arquivos ou clicar para selecionar.
2. O sistema deve aceitar arquivos nos formatos `.csv` (codificação UTF-8, separador vírgula ou ponto-e-vírgula) e `.xlsx`.
3. O sistema deve rejeitar arquivos com mais de 10 MB, exibindo mensagem de erro ao usuário.
4. O sistema deve rejeitar importações com mais de 10.000 linhas, exibindo mensagem de erro ao usuário.
5. O sistema deve exibir, após o upload, uma tabela de mapeamento de colunas onde cada coluna do arquivo pode ser associada a um campo de destino do VYD.
6. Os campos de destino disponíveis para mapeamento devem incluir: `name`, `email`, `phone`, `company`, `position`, `source`, `notes`, `status` e campos customizados (custom fields) do tenant.
7. O sistema deve exibir um preview das primeiras 5 linhas do arquivo com os valores já aplicando o mapeamento definido pelo usuário.
8. O sistema deve expor o endpoint `POST /api/v1/import/leads` aceitando `multipart/form-data` com o arquivo e um JSON de mapeamento de colunas.
9. O sistema deve processar a importação em lotes de 100 registros para não bloquear o event loop.
10. O sistema deve registrar a rota `/api/v1/import/leads` na whitelist de CSRF em `server/src/index.ts`.

**IMP-1.2 — Deduplicação e Preview antes de Importar**

11. O sistema deve suportar o parâmetro `dry_run=true` no endpoint de importação de leads, que processa o arquivo sem gravar registros e retorna a análise completa.
12. O sistema deve detectar duplicatas por email (critério principal) e por telefone (critério secundário) comparando com registros já existentes no tenant.
13. O sistema deve exibir no preview o resumo: quantidade de registros novos, quantidade de duplicatas detectadas e quantidade de registros com erros de validação.
14. O sistema deve apresentar, para cada duplicata detectada, as opções "Pular" (ignorar o registro) ou "Atualizar existente" (sobrescrever o registro existente).
15. O sistema deve listar, para cada erro de validação, a linha do arquivo e o campo com problema.
16. O sistema deve exigir que o usuário visualize o preview e confirme explicitamente antes de executar a importação definitiva.

**IMP-2.1 — Importação de Deals e Histórico de Interações**

17. O sistema deve disponibilizar na página de importação uma aba "Deals" para upload de CSV com as colunas: `lead_email`, `deal_name`, `value`, `stage`, `expected_close_date`.
18. O sistema deve associar automaticamente cada deal importado ao lead correspondente pelo campo `lead_email`.
19. O sistema deve disponibilizar na página de importação uma aba "Interações" para upload de CSV com as colunas: `lead_email`, `type` (valores aceitos: `CALL`, `EMAIL`, `MEETING`, `NOTE`), `date`, `notes`.
20. O sistema deve validar, antes de importar deals ou interações, que o lead referenciado pelo `lead_email` já existe no tenant; registros com lead não encontrado devem ser listados como erros no preview.
21. O sistema deve expor os endpoints `POST /api/v1/import/deals` e `POST /api/v1/import/interactions`.

**IMP-2.2 — Histórico e Rollback de Importações**

22. O sistema deve exibir na página de importação uma seção "Histórico de Importações" listando todas as importações do tenant com: data, tipo, usuário, total de registros e status.
23. O sistema deve atribuir um `importBatchId` (UUID) a cada registro criado (Lead, Deal, Interaction) durante uma importação.
24. O sistema deve criar o model `ImportBatch` no Prisma com os campos: `id`, `tenantId`, `userId`, `type` (enum: `LEADS | DEALS | INTERACTIONS`), `status` (enum: `PENDING | PROCESSING | COMPLETED | FAILED | ROLLED_BACK`), `totalRows`, `importedRows`, `errorRows`, `skippedRows`, `errorLog` (JSON), `rolledBackAt`, `createdAt`, `updatedAt`, e índice em `(tenantId, createdAt)`.
25. O sistema deve adicionar o campo `importBatchId String?` nos models `Lead`, `Deal` e `Interaction` no Prisma.
26. O sistema deve exibir o botão "Desfazer" apenas para lotes criados nas últimas 24h.
27. O sistema deve, ao acionar "Desfazer", aplicar soft delete em todos os registros do lote identificados pelo `importBatchId` e atualizar o status do `ImportBatch` para `ROLLED_BACK`.
28. O sistema deve expor o endpoint `DELETE /api/v1/import/batches/:batchId` para execução do rollback.

**Requisitos Não-Funcionais**

29. O sistema deve aplicar rate limit dedicado de 5 importações por hora por tenant.
30. O sistema deve processar arquivos com até 500 linhas de forma síncrona e retornar a resposta diretamente.
31. O sistema deve processar arquivos com mais de 500 linhas de forma assíncrona, retornando imediatamente um `batchId` e permitindo polling de status pelo cliente.
32. O sistema deve garantir que todos os registros de `ImportBatch` e os campos `importBatchId` nos modelos associados estejam filtrados por `tenantId` em todas as queries.

### Fora do Escopo

- Importação de arquivos nos formatos ODS, Numbers ou Google Sheets (somente CSV e XLSX).
- Importação de outros modelos além de Leads, Deals e Interactions (ex.: Companies, Tasks).
- Rollback de importações com mais de 24h de antecedência.
- Mapeamento de campos relacionais complexos além de associação por email (ex.: leads por ID externo).
- Interface de agendamento de importações recorrentes.
- Integração direta com APIs de terceiros (HubSpot, Salesforce, Pipedrive) — somente upload de arquivo exportado.

## Restrições

- **Tamanho máximo de arquivo:** 10 MB.
- **Linhas por importação:** máximo de 10.000 linhas.
- **Rate limit:** 5 importações por hora por tenant.
- **Parser CSV:** utilizar a biblioteca `csv-parse` (MIT) já disponível no ecossistema.
- **Parser Excel:** utilizar `xlsx` ou `exceljs` (já presente no bundle frontend).
- **Processamento em lote:** lotes de 100 registros por ciclo para não bloquear o event loop.
- **Processamento assíncrono:** obrigatório para arquivos > 500 linhas; abaixo desse limite pode ser síncrono.
- **Multi-tenancy:** todas as queries devem filtrar por `tenantId`; `ImportBatch` deve ter campo `tenantId` com cascade delete.
- **CSRF:** a rota de importação é autenticada e deve estar registrada na whitelist de CSRF em `server/src/index.ts`.
- **Estrutura backend:** nova rota em `server/src/routes/import.ts`.
- **Estrutura frontend:** nova página em `src/pages/Import.tsx`, componente `src/components/import/ColumnMapper.tsx`, rota registrada em `src/utils/routes.tsx` como `/app/settings/import`.

## Casos Extremos

- **Arquivo CSV com codificação não-UTF-8:** o sistema deve rejeitar o upload com mensagem explicando que o arquivo deve estar em UTF-8.
- **CSV com separador ambíguo (ex.: tabulação):** o sistema deve tentar detecção automática; se falhar, exibir mensagem de erro orientando o usuário a salvar com separador vírgula ou ponto-e-vírgula.
- **Arquivo XLSX protegido por senha:** o sistema deve rejeitar com mensagem de erro específica.
- **Todas as linhas são duplicatas:** o sistema deve exibir o preview com 0 novos registros e permitir ao usuário cancelar ou selecionar "Atualizar existente" para todas.
- **Campo email ausente ou inválido na linha:** a linha deve ser incluída nos erros de validação no preview; não deve ser importada.
- **`lead_email` em deals/interações não encontrado no tenant:** a linha deve ser listada como erro "lead não encontrado" no preview; não deve ser importada.
- **Importação excede 10.000 linhas:** o sistema deve rejeitar o arquivo antes de processar qualquer linha.
- **Falha de banco de dados no meio do processamento em lote:** o status do `ImportBatch` deve ser atualizado para `FAILED` e o `errorLog` deve registrar a linha e o erro; registros já gravados não devem ser revertidos automaticamente (o rollback manual fica disponível via "Desfazer").
- **Timeout no processamento assíncrono:** o status do `ImportBatch` deve ser atualizado para `FAILED`; o `batchId` retornado permite que o usuário verifique o estado via polling.
- **Tentativa de rollback após 24h:** o sistema deve retornar erro 400 com mensagem indicando que o prazo expirou.
- **Tentativa de rollback de lote já revertido (`ROLLED_BACK`):** o sistema deve retornar erro 400 indicando que o lote já foi desfeito.
- **Tentativa de rollback de lote em status `PROCESSING`:** o sistema deve retornar erro 400 indicando que a importação ainda está em andamento.

## Definição de Concluído

- [ ] A página `/app/settings/import` é acessível a usuários autenticados e exibe o uploader com suporte a drag-and-drop e clique.
- [ ] O upload de um arquivo `.csv` UTF-8 (vírgula e ponto-e-vírgula) é aceito e exibe a tabela de mapeamento de colunas.
- [ ] O upload de um arquivo `.xlsx` é aceito e exibe a tabela de mapeamento de colunas.
- [ ] A tabela de mapeamento lista todos os campos de destino: `name`, `email`, `phone`, `company`, `position`, `source`, `notes`, `status` e custom fields do tenant.
- [ ] O preview das primeiras 5 linhas é exibido com os valores refletindo o mapeamento definido.
- [ ] Um arquivo com mais de 10 MB é rejeitado com mensagem de erro antes de qualquer processamento.
- [ ] Um arquivo com mais de 10.000 linhas é rejeitado com mensagem de erro antes de qualquer processamento.
- [ ] `POST /api/v1/import/leads` com `dry_run=true` retorna o resumo: N novos, N duplicatas, N erros — sem gravar nenhum registro.
- [ ] O resumo do dry_run identifica duplicatas por email e por telefone separadamente.
- [ ] O preview lista linhas com erros de validação indicando linha e campo com problema.
- [ ] A opção "Pular" para duplicatas resulta em 0 duplicatas gravadas após a importação definitiva.
- [ ] A opção "Atualizar existente" para duplicatas sobrescreve o registro existente após a importação definitiva.
- [ ] Re-importar o mesmo CSV com "Pular" resulta em 0 registros gravados e 0 duplicatas no banco.
- [ ] A aba "Deals" aceita CSV com `lead_email`, `deal_name`, `value`, `stage`, `expected_close_date` e associa deals ao lead correto.
- [ ] Deals com `lead_email` inexistente aparecem como erro "lead não encontrado" no preview e não são gravados.
- [ ] A aba "Interações" aceita CSV com `lead_email`, `type`, `date`, `notes` e grava interações associadas ao lead correto.
- [ ] O endpoint `DELETE /api/v1/import/batches/:batchId` aplica soft delete em todos os registros do lote e atualiza o status para `ROLLED_BACK`.
- [ ] O botão "Desfazer" é exibido apenas para lotes com menos de 24h; após esse prazo, retorna erro 400.
- [ ] A seção "Histórico de Importações" lista data, tipo, usuário, total de registros e status de cada lote do tenant.
- [ ] Arquivos com até 500 linhas são processados de forma síncrona com resposta direta.
- [ ] Arquivos com mais de 500 linhas retornam imediatamente um `batchId` e o status evolui via polling.
- [ ] O rate limit de 5 importações por hora por tenant é aplicado; a 6ª tentativa retorna erro 429.
- [ ] O model `ImportBatch` existe no schema Prisma com todos os campos especificados e índice `(tenantId, createdAt)`.
- [ ] Os models `Lead`, `Deal` e `Interaction` possuem o campo `importBatchId String?`.
- [ ] A rota de importação está registrada na whitelist de CSRF em `server/src/index.ts`.
