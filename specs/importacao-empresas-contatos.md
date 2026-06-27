# Spec: Importação de Empresas e Contatos (BD legado)

## Objetivo

Estender a ferramenta **Import Pro** para viabilizar a migração, sem perda de dados, de uma base legada exportada de outro CRM em dois arquivos `.xls` (Excel 97-2003): **BD - Empresas.xls** (220 empresas, 18 colunas) e **BD - Contatos.xls** (366 contatos, 10 colunas). Para isso, a ferramenta passa a (a) ler o formato `.xls` antigo, (b) importar a entidade **Empresa (Company)** — hoje inexistente no importador, (c) acomodar todos os campos do arquivo via campos nativos novos + campos customizados, e (d) vincular cada contato à sua empresa. Este recurso amplia deliberadamente o que a spec `import-pro.md` declarou "Fora do Escopo" (Companies, ID externo, formatos além de CSV/XLSX).

## Usuários

**Administrador Migrando** — gestor/operador responsável pela carga inicial da base no VYD Engage. Nível técnico intermediário (sabe exportar planilhas, não conhece banco de dados). Contexto: operação pontual de migração, executada uma ou poucas vezes, com necessidade de conferir o resultado antes de confiar nos dados.

## Diagnóstico dos dados (base para os requisitos)

- **Empresas (220):** 220/220 com ID legado do CRM antigo; 148 com URL; 22 com Resumo; 15 com Nome Fantasia; apenas 5 com CNPJ. Coluna `Segmentos` é multivalor (ex.: `"Mineração e Siderurgia;Indústria"`).
- **Contatos (366):** 345 com email, **21 sem email**; 12 emails repetidos entre linhas; 203 com telefone; 42 com celular (coluna separada); 323 com cargo; 38 com consentimento preenchido. **357/357 contatos com empresa preenchida casam exatamente, por nome, com uma empresa do arquivo de empresas** (9 contatos sem empresa).
- Datas no formato brasileiro `DD/MM/YYYY` + hora `HH:MM` em colunas separadas. Valores monetários no formato brasileiro (ex.: `25350,29`).

## Mapeamento de campos (contrato de "nada se perde")

### BD - Empresas.xls → `Company`
| Coluna do arquivo | Destino | Tipo de destino |
|---|---|---|
| ID | `externalId` | campo nativo novo |
| Nome | `name` | nativo |
| Resumo | `notes` | nativo |
| URL | `website` | nativo |
| CNPJ | `cnpj` | campo nativo novo |
| Nome Fantasia | `fantasyName` | campo nativo novo |
| Segmentos | `industry` | nativo (texto livre, preserva `;`) |
| Data de criação + Hora de criação | `createdAt` | nativo (combinar + parsear data BR) |
| Valor único vendido | custom field `Valor único vendido` | NUMBER |
| Valor recorrente vendido | custom field `Valor recorrente vendido` | NUMBER |
| Data do último contato + Hora do último contato | custom field `Data do último contato` | DATE |
| Vendas | custom field `Vendas` | NUMBER |
| Perdidos | custom field `Perdidos` | NUMBER |
| Pausados | custom field `Pausados` | NUMBER |
| Em andamento | custom field `Em andamento` | NUMBER |
| Total | custom field `Total` | NUMBER |

### BD - Contatos.xls → `Lead`
| Coluna do arquivo | Destino | Tipo de destino |
|---|---|---|
| Nome | `name` | nativo |
| Empresa | `company` (texto) + `companyId` (vínculo) | nativo |
| Cargo | `position` | nativo |
| Email | `email` (opcional) | nativo |
| Telefone | `phone` | nativo |
| Data de criação + Hora de criação | `createdAt` | nativo (data BR) |
| Contato e envio de comunicação | custom field `Consentimento` | TEXT |
| Status de contato e envio de comunicação | custom field `Status de consentimento` | TEXT |
| Celular | custom field `Celular` | TEXT |

Cada `Lead` importado por este fluxo recebe `isContact = true`.

## Requisitos

### Obrigatórios

**IEC-1 — Leitura de arquivos `.xls` (Excel 97-2003 / BIFF8)**

1. O sistema deve aceitar upload de arquivos no formato `.xls` (binário OLE2/BIFF8), além dos formatos `.csv` e `.xlsx` já suportados, em todas as abas de importação.
2. O sistema deve extrair de um `.xls` os cabeçalhos (primeira linha) e as linhas de dados da primeira aba, produzindo a mesma estrutura `{ headers, rows }` usada pelos formatos existentes, de modo que mapeamento, preview e importação funcionem sem distinção de formato.
3. O uploader (dropzone) deve declarar `accept=".csv,.xlsx,.xls"` e o texto de formatos aceitos deve mencionar `.xls`.
4. O parser `.xls` no frontend deve ser carregado sob demanda (lazy import), acionado apenas quando o arquivo enviado tiver extensão `.xls`, para não aumentar o bundle inicial.

**IEC-2 — Importação da entidade Empresa (Company)**

5. O sistema deve disponibilizar na página de importação uma aba **"Empresas"** com mapeamento visual de colunas, no mesmo padrão da aba "Leads".
6. Os campos de destino disponíveis para mapeamento de empresa devem incluir: `name`, `externalId`, `cnpj`, `fantasyName`, `website`, `industry`, `notes` e os campos customizados aplicáveis a empresas.
7. O sistema deve expor o endpoint `POST /api/v1/import/companies` aceitando `multipart/form-data` com o arquivo e o JSON de mapeamento, com suporte a `dry_run=true`.
8. O dry-run de empresas deve retornar o resumo (novos, atualizações/duplicatas, erros) e o preview das 5 primeiras linhas com o mapeamento aplicado, sem gravar nada.
9. O sistema deve gravar os valores de colunas mapeadas para campos customizados em `Company.customFields` (JSON), análogo ao comportamento de leads.
10. O sistema deve registrar `importBatchId` em cada `Company` criada ou atualizada por uma importação.
11. O valor `COMPANIES` deve ser adicionado ao enum `ImportType`, e o histórico/rollback deve tratar empresas como qualquer outra entidade importável.

**IEC-3 — Schema: campos nativos e customizados**

12. O sistema deve adicionar ao model `Company` os campos `externalId String?`, `cnpj String?`, `fantasyName String?` e `customFields Json @default("{}")`, com índice `@@index([tenantId, externalId])`.
13. A alteração de schema deve ser uma migration Prisma **apenas aditiva** (novas colunas opcionais e novo valor de enum), sem alterar ou remover colunas existentes.
14. O sistema deve permitir a criação das definições de campos customizados usadas por esta importação: para empresa — `Valor único vendido` (NUMBER), `Valor recorrente vendido` (NUMBER), `Vendas` (NUMBER), `Perdidos` (NUMBER), `Pausados` (NUMBER), `Em andamento` (NUMBER), `Total` (NUMBER), `Data do último contato` (DATE); para contato — `Celular` (TEXT), `Consentimento` (TEXT), `Status de consentimento` (TEXT).

**IEC-4 — Importação de Contatos (ajustes em Leads)**

15. O sistema deve permitir importar contatos **sem email**: a ausência de email não pode gerar erro de validação nem impedir a gravação do registro.
16. O sistema deve preservar a data de criação original do contato e da empresa, gravando-a em `createdAt` a partir da combinação das colunas de data e hora do arquivo.
17. O sistema deve marcar `isContact = true` nos leads criados por esta importação de contatos.
18. O sistema deve interpretar valores monetários e numéricos no formato brasileiro (separador decimal vírgula, milhar ponto) ao gravar campos numéricos.
19. O sistema deve interpretar datas no formato brasileiro `DD/MM/YYYY` (com hora opcional `HH:MM`) ao gravar campos de data; uma data inválida não deve sobrescrever o campo com valor incorreto.
20. O sistema deve registrar os campos de consentimento apenas como valores (custom fields), **sem** alterar o campo `unsubscribed` do lead — todos os contatos importados permanecem aptos a receber comunicação (`unsubscribed = false`).

**IEC-5 — Vínculo Contato → Empresa**

21. Ao importar contatos, o sistema deve preencher `companyId` quando o valor da coluna Empresa casar (por nome normalizado: caixa e espaços ignorados) com uma empresa existente do tenant.
22. O sistema deve sempre preservar o nome da empresa em `Lead.company` (texto), mesmo quando não houver empresa correspondente para vincular `companyId` — nenhum dado da coluna Empresa pode ser descartado.
23. A documentação/UI deve orientar que a importação de **Empresas seja feita antes** da de Contatos, para que o vínculo `companyId` seja resolvido.

**IEC-6 — Idempotência (reimportação) e deduplicação**

24. Para **empresas**, o sistema deve deduplicar pela chave `externalId` (primária); na ausência de `externalId`, por `cnpj`; na ausência de ambos, por `name` normalizado. Um registro cuja chave já exista deve ser **atualizado** (upsert), nunca duplicado.
25. Para **contatos**, o sistema deve deduplicar pela chave composta `nome normalizado + email normalizado`; quando o contato não tiver email, pela chave `nome normalizado + empresa normalizada`. Um registro cuja chave já exista deve ser **atualizado** (upsert).
26. A deduplicação de contatos **não** deve usar o email isoladamente como chave: dois contatos com nomes diferentes que compartilham o mesmo email (ex.: email corporativo) devem resultar em **dois** registros distintos, não em sobrescrita.
27. Reexecutar a importação do mesmo arquivo não deve criar registros duplicados nem perder dados: empresas e contatos já presentes devem ser atualizados in-place.

**IEC-7 — Execução em produção e rollback**

28. A operação de rollback (`DELETE /api/v1/import/batches/:batchId`) deve aplicar soft delete também às **empresas** (`Company`) criadas pelo lote, além de leads/deals/interactions, dentro da janela de 24h já existente.
29. A migration aditiva deve ser aplicável ao banco de produção (Railway Postgres) via `prisma migrate deploy`, sem etapa destrutiva.
30. O fluxo de carga em produção deve ser: aplicar migration → criar os campos customizados no tenant de destino → executar **dry-run** dos dois arquivos e conferir as contagens → importar Empresas → importar Contatos.

**Requisitos Não-Funcionais**

31. O recurso deve reutilizar a infraestrutura existente do Import Pro: rate limit (5 importações/hora/tenant), processamento síncrono para ≤500 linhas (ambos os arquivos se enquadram), whitelist de CSRF, histórico e isolamento por `tenantId`.
32. Todas as novas queries (empresas, vínculo de contato, custom fields) devem ser filtradas por `tenantId`.

### Fora do Escopo

- Importação de outros formatos legados (ODS, Numbers, Google Sheets).
- Criação automática de empresas "stub" a partir de contatos cuja empresa não exista no arquivo de empresas (apenas o texto em `Lead.company` é preservado).
- Correspondência aproximada (fuzzy) entre nomes de empresa — apenas correspondência exata por nome normalizado (suficiente: 357/357 casam).
- Criação de `Deal`/negócios a partir dos contadores de empresa (Vendas/Perdidos/etc.) — esses números são apenas registrados como campos customizados, não viram negócios.
- Segmentação de campos customizados por entidade (`entityType`) — os campos criados ficam visíveis globalmente; segmentar é melhoria futura.
- Normalização/parsing do CNPJ (validação de dígitos, formatação) — o valor é gravado como veio.

## Restrições

- **Formato `.xls`:** parsing via **SheetJS**; instalar a partir do tarball oficial do CDN da SheetJS (o pacote npm `xlsx` está desatualizado e com CVEs). ExcelJS (já no projeto) cobre `.xlsx`, mas não lê `.xls` BIFF8.
- **Parsers BR:** datas `DD/MM/YYYY [HH:MM]` e decimais com vírgula exigem parser dedicado; o `parseDate` atual (`new Date()`) interpreta `MM/DD` e não serve para datas brasileiras.
- **Banco único:** `server/.env` aponta `DATABASE_URL` para o Postgres de **produção** (Railway); não há banco de desenvolvimento separado. Toda migration/escrita afeta produção — daí a obrigatoriedade de migration aditiva, dry-run prévio e rollback de 24h.
- **CSS pré-compilado:** o frontend usa Tailwind v4 compilado estaticamente (`src/index.css`, sem JIT); a aba "Empresas" deve reutilizar exatamente as classes já presentes no padrão de Leads/Deals — classes novas não gerariam CSS.
- **Estrutura backend:** estender `server/src/services/importService.ts` (parser `.xls`, análise/escrita de empresas, ajustes em leads, rollback) e `server/src/routes/import.ts` (rota `/companies`).
- **Estrutura frontend:** estender `src/utils/importParser.ts` (`.xls` lazy), `src/pages/Import.tsx` (aba Empresas, `accept`), `src/services/api/client.ts` (`importCompaniesFile`, tipo `COMPANIES`).
- **Limites herdados:** máximo 10 MB e 10.000 linhas por arquivo; ambos os arquivos atuais estão muito abaixo.

## Casos Extremos

- **Contato sem email (21 casos):** importado normalmente; deduplicado por `nome + empresa`; nunca listado como erro por falta de email.
- **Email repetido entre contatos distintos (12 casos):** com nomes diferentes, resultam em registros distintos; com o mesmo nome, são tratados como o mesmo contato (atualização).
- **Empresa do contato sem correspondência:** `companyId` fica nulo, mas `Lead.company` preserva o texto original; nenhum erro é gerado.
- **`Segmentos` multivalor (`A;B`):** gravado integralmente em `industry` como texto; nenhum valor é descartado nem dividido.
- **CNPJ ausente (215 de 220):** campo `cnpj` fica nulo; a dedup recai sobre `externalId`; nenhuma linha é rejeitada por falta de CNPJ.
- **Data/valor em formato inválido:** a linha não é rejeitada inteira; o campo problemático fica vazio e os demais dados são preservados (o erro pode ser listado no preview, mas o registro entra).
- **`.xls` corrompido ou protegido por senha:** o sistema deve rejeitar o arquivo com mensagem específica, sem derrubar a importação.
- **Reimportação do mesmo arquivo:** empresas (por `externalId`) e contatos (por `nome+email`/`nome+empresa`) existentes são atualizados; o resultado final tem a mesma contagem da primeira carga (idempotente).
- **Rollback após importar empresas e contatos:** o "Desfazer" do lote remove (soft delete) também as empresas criadas; contatos vinculados ficam com `companyId` órfão tratado pela regra `onDelete: SetNull` já existente.
- **Importar Contatos antes de Empresas:** permitido, mas `companyId` ficará nulo (apenas `company` texto); reimportar contatos depois das empresas resolve o vínculo via upsert.

## Definição de Concluído

- [ ] O upload de um arquivo `.xls` (BIFF8) é aceito em todas as abas e exibe corretamente cabeçalhos e preview, igual a `.xlsx`/`.csv`.
- [ ] O dropzone aceita `.csv,.xlsx,.xls` e o texto de formatos cita `.xls`.
- [ ] A aba "Empresas" existe, com mapeamento visual de colunas e os campos de destino `name`, `externalId`, `cnpj`, `fantasyName`, `website`, `industry`, `notes` + custom fields.
- [ ] `POST /api/v1/import/companies` com `dry_run=true` retorna resumo e preview sem gravar nada.
- [ ] O model `Company` possui `externalId`, `cnpj`, `fantasyName`, `customFields` e índice `(tenantId, externalId)`; a migration é aditiva e aplica via `prisma migrate deploy`.
- [ ] O enum `ImportType` inclui `COMPANIES`.
- [ ] Importar **BD - Empresas.xls** cria 220 empresas, 0 erro; CNPJ/Nome Fantasia/ID externo gravados nos campos nativos; valores e contadores gravados em `customFields`; `createdAt` reflete a data original.
- [ ] Importar **BD - Contatos.xls** cria 366 contatos (incluindo os 21 sem email), 0 contato perdido; celular e consentimento gravados em custom fields; `isContact = true`.
- [ ] Todos os 357 contatos com empresa correspondente têm `companyId` preenchido; os demais preservam `Lead.company` como texto.
- [ ] Contatos com email repetido mas nomes diferentes geram registros distintos (nenhuma sobrescrita).
- [ ] Reimportar qualquer um dos dois arquivos não altera a contagem total nem cria duplicatas (upsert idempotente por `externalId` / `nome+email`).
- [ ] O campo `unsubscribed` de todos os contatos importados permanece `false`.
- [ ] O "Desfazer" (rollback ≤24h) do lote de empresas aplica soft delete nas empresas criadas.
- [ ] `cd server && npx vitest run && npm run build` passa (inclui teste de dedup/upsert de empresas); `npm run build` na raiz passa (typecheck + bundle).
- [ ] Datas brasileiras (`DD/MM/YYYY`) e valores com vírgula decimal são interpretados corretamente (verificável no preview do dry-run).
