# Spec: Gestão de Atestados Técnicos (Acervo Técnico + Inteligência de Concorrências)

## Objetivo

Módulo do VYD Engage para gerir o **acervo técnico** da empresa (atestados de
capacidade técnica, CATs, ARTs) e de **parceiros**, com três finalidades: (1)
**armazenar** de forma organizada e rastreável — incluindo o documento digital de
cada atestado; (2) **buscar de forma inteligente** (filtros estruturados + busca
semântica com IA/RAG sobre o conteúdo dos documentos) para casar as exigências de
um **edital/concorrência** com o acervo, sem nunca perder uma oportunidade por não
localizar a comprovação; e (3) **gerir atestados pendentes** — serviços já
executados que ainda precisam ser atestados pelo cliente/órgão — para que nenhum
fique esquecido. O módulo trata separadamente os dois acervos que a legislação de
licitações exige (**técnico-operacional**, da empresa, e **técnico-profissional**,
do responsável técnico), mantém **currículos estratégicos** dos profissionais para
composição de propostas, e produz o **dossiê de habilitação técnica** pronto para
anexar. IA é usada para OCR, extração/sugestão de campos, busca semântica e
casamento edital↔acervo — sempre com **indicador de confiança** e **nunca em
silêncio**: lacunas e baixa confiança são sempre explícitas.

## Usuários

- **Perfil restrito** (equipe de propostas/licitações e engenharia designada). O
  acesso à área de Atestados é **gated por permissão própria** — não é liberado a
  todos os usuários do tenant.
- Dentro da área, dois níveis de operação:
  - **Consulta:** buscar o acervo, rodar análises de concorrência, gerar dossiê e
    currículos.
  - **Gestão** (ADMIN/GESTOR ou perfil de permissão equivalente): cadastrar/editar
    atestados, profissionais, parceiros de terceiros, taxonomias e pendências.
- Nível técnico médio-alto (engenheiros, analistas de licitação). Uso em desktop,
  frequentemente sob pressão de prazo de edital.

## Contexto de dados existente (planilha de origem)

A carga inicial vem de `Atestados TENAX ENG.xlsx` (aba TENAX): **112 atestados**,
cada um em uma **caixa física** (CX###), com colunas Número, Caixa, CAT,
Contratante, Contrato, Período, Objeto, e uma lista de **Responsáveis** (36
distintos) com **Função** técnica (114 distintas) e **Categoria** (41 distintas).
Um atestado tem N responsáveis, cada um com N funções. Os documentos digitais
existem, mas **nem todos são pesquisáveis** (parte são digitalizações em imagem →
exigem OCR).

---

## Requisitos

### Obrigatórios

#### A. Modelo de dados — Acervo de Atestados

1. O sistema deve modelar um **Atestado** (multi-tenant, sempre filtrado por
   `tenantId`) com, no mínimo: número/código interno, **caixa física** (localização
   do original, ex. CX023), **contratante/emissor**, número/identificação do
   **contrato**, **objeto** (descrição do serviço), **período** em texto livre
   (preservar o original da planilha) **e** datas estruturadas de **início** e
   **conclusão** (opcionais), **valor do contrato** (opcional), e **origem**
   (`PROPRIO` | `TERCEIRO`).
2. O sistema deve permitir associar a um atestado **N responsáveis técnicos**, cada
   um com **N funções técnicas** e a **categoria** correspondente, reproduzindo a
   estrutura hierárquica da planilha (Atestado → Responsável → Função → Categoria).
3. O sistema deve registrar, por atestado, os dados de **registro no conselho**:
   número da **ART/RRT/TRT**, número da **CAT**, **conselho** (CREA/CAU/outros) e
   **UF** do registro. Estes campos são opcionais no cadastro mas sinalizados como
   recomendados para uso em licitação pública.
4. O sistema deve classificar cada atestado quanto ao **tipo de acervo que ele
   comprova**: **técnico-OPERACIONAL** (em nome da empresa/pessoa jurídica),
   **técnico-PROFISSIONAL** (acervo do profissional, via CAT), ou **AMBOS**. A busca
   e a análise de concorrência devem poder filtrar por esse atributo, porque um
   edital cobra os dois acervos separadamente.

#### B. Profissionais e vínculo (acervo técnico-profissional)

5. O sistema deve modelar o **Profissional/Responsável Técnico** como entidade de
   primeira classe (não apenas texto): nome, título/formação, registro no conselho
   (nº, conselho, UF), disciplinas de engenharia, e **status de vínculo** com a
   empresa (`SOCIO` | `CLT` | `CONTRATO` | `DESLIGADO`, com datas). A carga inicial
   deve consolidar os 36 responsáveis distintos da planilha em registros únicos
   (deduplicados por nome normalizado), preservando o vínculo com seus atestados.
6. O sistema deve **alertar explicitamente** quando um casamento de concorrência (ou
   um currículo/dossiê) depende do **acervo técnico-profissional de um profissional
   com status `DESLIGADO`** — porque esse acervo não habilita a empresa. O acervo
   **técnico-operacional** da empresa permanece válido independentemente do vínculo
   do profissional.

#### C. Documentos digitais, OCR e indexação (RAG)

7. O sistema deve permitir **anexar o documento digital** (PDF/imagem) a cada
   atestado, reutilizando a infraestrutura de `Attachment`/`AttachmentBlob` existente
   (provider `db` ou `s3` conforme `STORAGE_S3_*`).
8. Ao anexar um documento, o sistema deve executar um **pipeline de extração de
   texto**: usar o texto nativo quando o PDF for pesquisável e aplicar **OCR** quando
   for imagem. O texto extraído deve ser persistido e associado ao atestado.
9. O sistema deve **indexar o conteúdo** dos documentos e dos metadados do atestado
   para **busca semântica (RAG)**: gerar embeddings de trechos (chunks) do texto e
   armazená-los de forma pesquisável por similaridade. A infraestrutura de vetores
   (ex.: extensão `pgvector` no Postgres) deve ser provisionada por migração.
10. Quando o OCR **falhar** ou produzir texto de **baixa qualidade/ilegível**, o
    sistema **não** deve silenciar: deve **marcar o atestado como "documento
    ilegível/pendente de OCR"**, apontar o problema ao usuário e **solicitar que ele
    providencie as informações faltantes** (reenvio de documento melhor ou
    preenchimento manual). Esses atestados devem ser filtráveis para tratamento.

#### D. Busca inteligente do acervo

11. O sistema deve oferecer **busca por filtros estruturados**: por categoria/tipo de
    serviço, contratante, profissional, período/datas, valor, origem (próprio/
    terceiro), tipo de acervo (operacional/profissional), conselho/UF, e quantitativos
    (ver bloco E).
12. O sistema deve oferecer **busca em linguagem natural / semântica** sobre o
    **conteúdo** dos documentos (via RAG), retornando atestados relevantes mesmo
    quando os termos exatos não constam dos metadados — com o **trecho** do documento
    que motivou o resultado e um **score de relevância**.
13. A busca deve permitir **incluir ou excluir atestados de terceiros** no conjunto de
    resultados, e sempre **identificar visualmente a origem** (próprio vs. de qual
    parceiro) de cada resultado.

#### E. Quantitativos estruturados

14. O sistema deve permitir registrar, por atestado, **quantitativos técnicos**
    estruturados: uma lista de itens com **grandeza** (ex.: extensão de rede, volume
    de concreto, área construída, vazão), **valor numérico** e **unidade** (km, m³,
    m², L/s, …). Os quantitativos devem ser **buscáveis e comparáveis numericamente**.
15. Ao cadastrar um atestado assistido por IA (bloco I), o sistema deve **extrair e
    sugerir** os quantitativos encontrados no documento, para revisão do usuário.

#### F. Análise de Concorrência (edital → matriz de atendimento)

16. O sistema deve permitir criar uma **Análise de Concorrência** informando o edital
    por **texto colado** **ou** por **upload de PDF**.
17. A IA deve **extrair as exigências de habilitação técnica** do edital, distinguindo
    **exigências técnico-operacionais** (empresa) de **técnico-profissionais**
    (responsável técnico), e capturando os **quantitativos mínimos** de cada parcela
    de maior relevância (grandeza, valor mínimo, unidade).
18. Para cada exigência extraída, o sistema deve varrer o acervo (próprios ±
    terceiros, conforme escolha do usuário) e produzir uma **matriz de atendimento**:
    exigência × atestado(s) que a cobrem × quantitativo exigido vs. comprovado ×
    **status** (`ATENDE` | `ATENDE_PARCIAL` | `NAO_ATENDE` | `REVISAR`) × **indicador
    de confiança** × **trecho comprobatório**.
19. O sistema deve suportar **somatório de atestados**: quando uma exigência admite
    soma, permitir **compor uma combinação** de atestados cuja soma dos quantitativos
    atinja o mínimo, exibindo o total acumulado; e sinalizar quando o edital exige
    "em um único atestado".
20. Lacunas devem ser **sempre explícitas**: exigências sem atestado que as cubra
    aparecem como **`NAO_ATENDE`** (nunca omitidas). Casamentos com **baixa
    confiança** aparecem como **`REVISAR`** e solicitam confirmação manual.
21. A Análise de Concorrência deve ser **persistida** (salva) com o edital analisado,
    as exigências extraídas, a matriz e a composição escolhida, permitindo
    **consulta e edição futura**. O usuário pode ajustar manualmente qualquer
    casamento (incluir/remover atestado, alterar status).

#### G. Currículos estratégicos

22. O sistema deve manter, por profissional, um **currículo** (formação, registro no
    conselho, experiência, e os atestados/CATs vinculados a ele — puxados
    automaticamente do acervo), classificável por **segmento de negócio**, **área** e
    **disciplina de engenharia**.
23. O sistema deve permitir **filtrar/selecionar** currículos por segmento/área/
    disciplina para montar a equipe técnica de uma proposta.
24. O sistema deve **gerar um currículo formatado sob medida** para uma concorrência:
    selecionado o profissional, o sistema monta o CV destacando a experiência e os
    atestados **aderentes àquele edital** (puxados automaticamente do acervo do
    profissional), permitindo o usuário **selecionar/editar** o que entra, e
    **exportar em PDF** para anexar à proposta.

#### H. Atestados de terceiros / parceiros

25. Atestados de **terceiros** devem ficar em **área separada** (visualmente e
    logicamente distinta dos próprios), evitando confusão, porém **incluíveis** na
    busca de aderência a um escopo e na análise de concorrência quando o usuário optar.
26. Cada atestado de terceiro deve registrar: **empresa proprietária**, **contato**,
    **validade/condições da parceria**, se o **uso é livre** ou condicionado, e a
    **natureza jurídica** prevista da utilização (`CONSORCIO` | `SUBCONTRATACAO` |
    `CESSAO_DE_ACERVO`).
27. Na composição de uma concorrência com terceiros, o sistema deve deixar claro **de
    quem é cada atestado** (para montagem de consórcio) e permitir **incluir/excluir**
    terceiros do conjunto.

#### I. Cadastro assistido por IA e importação inicial

28. O sistema deve **importar a planilha** `Atestados TENAX ENG.xlsx` de uma vez,
    criando os 112 atestados com seus responsáveis, funções e categorias, e
    consolidando os profissionais (bloco B). A importação deve ser **idempotente**
    (reexecução não duplica) e apresentar um **relatório** do que foi criado/ignorado.
29. Ao subir o **PDF de um atestado** (na carga inicial ou em novos cadastros), a IA
    deve **ler o documento e sugerir o preenchimento** dos campos (contratante,
    objeto, datas, responsáveis, funções, quantitativos, dados de registro), para o
    usuário **revisar e confirmar** — nunca gravando automaticamente sem revisão.

#### J. Gestão de Pendências

30. O sistema deve modelar **Atestado Pendente** — um serviço já executado que ainda
    precisa ser atestado — com **responsável** (usuário da equipe), **prazo/data-alvo**
    e **status** ao longo de um **ciclo de vida configurável pela UI**. O fluxo-padrão
    inicial é: `Necessidade identificada → Serviço concluído → Documentação reunida →
    Enviado ao cliente → Assinado pelo cliente → CAT emitida → Arquivado`.
31. A pendência deve poder ser criada **automaticamente** a partir de eventos
    existentes no Engage (ex.: `Deal` ganho/fechado e/ou contrato registrado na
    `Company`) **e** **manualmente** (incluindo um campo livre de referência de OS/
    contrato guarda-chuva). A criação automática deve ser **configurável** (ligar/
    desligar o gatilho).
32. Quando uma pendência chega ao status final (`CAT emitida`/`Arquivado`), o sistema
    deve permitir **convertê-la em Atestado** do acervo, aproveitando os dados já
    preenchidos (transição pendência → atestado emitido).
33. O sistema deve **avisar** sobre pendências por **todos** os meios: (a) **painel/
    dashboard** com pendências agrupadas por status; (b) **badge de "atrasados"** para
    prazos vencidos; (c) **notificação in-app** (reutilizando `Notification`); (d)
    **e-mail de lembrete** ao responsável; (e) **resumo periódico** (digest). Os
    limiares de antecedência de alerta devem ser configuráveis.

#### K. Dossiê de habilitação técnica

34. O sistema deve **gerar um dossiê de habilitação técnica em PDF** a partir de uma
    Análise de Concorrência: capa/índice + **matriz de atendimento** (exigência ×
    atestado × status) + os **atestados selecionados** + os **currículos** dos
    profissionais indicados. O dossiê deve estar pronto para anexar à proposta,
    reutilizando a infraestrutura de geração de PDF existente (`Proposal`/templates).

#### L. Acesso e permissões

35. O acesso à área de Atestados deve ser controlado por uma **permissão própria**
    (via `PermissionProfile`/papel), separada das demais áreas do Engage. Usuários sem
    a permissão **não** veem o módulo.
36. Dentro do módulo, ações de **gestão** (cadastrar/editar atestados, profissionais,
    parceiros, taxonomias, gatilhos) devem ser restritas a **ADMIN/GESTOR** (ou perfil
    equivalente); ações de **consulta** (buscar, analisar concorrência, gerar dossiê/
    currículo) disponíveis a todos que têm acesso ao módulo. Próprios e terceiros são
    visíveis a quem tem acesso ao módulo.

#### M. Taxonomia

37. O sistema deve manter uma **taxonomia controlada** de tipos de serviço/categoria e
    de disciplinas de engenharia (vocabulário padronizado), **além** de preservar os
    textos livres originais da planilha. Na importação, os valores livres devem ser
    **mapeados** para a taxonomia (com revisão dos casos ambíguos), normalizando
    inconsistências (ex.: espaços duplicados, "Projeto Metrô    Projeto Edificação").

---

### Fora do Escopo

- **Emissão/protocolo eletrônico junto ao CREA/CAU** (integração com sistemas dos
  conselhos). O módulo registra ART/CAT, não os emite.
- **Model estruturado de Ordem de Serviço (OS)** como nova entidade do CRM. O gatilho
  de pendências usa os eventos/entidades já existentes (`Deal`, contrato na
  `Company`) e a criação manual com campo de referência de OS; OS estruturada é
  evolução futura.
- **Assinatura eletrônica** do dossiê/currículo (já coberta por outro módulo, fora
  daqui).
- **Reescrever a UI global/shell** — o módulo adere ao ribbon shell e ao
  vyd-design-system existentes; nada de sidebar/menu lateral.
- **Análise jurídica automatizada de mérito do edital** além da extração de
  exigências técnicas (não interpreta cláusulas jurídicas de habilitação não-técnica).

## Restrições

- **Stack:** React 18 + TypeScript + Vite (frontend) / Node.js + Express +
  TypeScript + Prisma + PostgreSQL (backend). Multi-tenant: toda query filtra por
  `tenantId`. Novas rotas autenticadas devem registrar CSRF conforme o padrão do
  `index.ts`.
- **UI:** obrigatoriamente **vyd-design-system@2** — apenas tokens semânticos (sem
  hex/rgb literais), navegação por ribbon, sem painéis laterais fixos no shell;
  detalhes via Sheet/overlay/painel dentro do canvas. Passar em `check:colors` e
  `lint:css`.
- **IA:** reutilizar a infraestrutura já existente (OpenAI/OpenRouter; ver
  `aiDraftService`/DeepResearch). Chaves via env; funcionalidades de IA **gated** por
  configuração — degradar com mensagem clara quando a IA não estiver configurada.
- **RAG:** vetores no Postgres (ex.: extensão `pgvector`) provisionados por migração
  **aditiva**. Sem OOM no `tsc` (atenção ao gotcha do AI SDK — severar tipos pesados).
- **Armazenamento:** documentos via `Attachment`/`AttachmentBlob` (db ou S3 gated por
  `STORAGE_S3_*`). Respeitar limites de tamanho de upload.
- **Migrações:** exclusivamente **aditivas** (o banco de produção não pode ser
  quebrado); nenhuma operação destrutiva. Aplicar em produção **antes** do merge,
  conforme o processo do projeto.
- **LGPD:** atestados e currículos contêm dados de terceiros (parceiros e
  profissionais). Uso de acervo de parceiro condicionado às condições registradas;
  acesso restrito ao perfil autorizado.
- **Verificação:** `cd server && npx vitest run && npm run build` + `npm run build`
  no frontend devem passar (tsc é o typecheck real).

## Casos Extremos

- **Nunca silêncio (regra transversal):** qualquer falha (OCR, extração de edital,
  casamento) é comunicada explicitamente ao usuário com o que fazer a seguir. Lacunas
  aparecem como `NAO_ATENDE`; incerteza como `REVISAR`.
- **PDF em imagem / OCR ruim:** atestado marcado como "ilegível/pendente de OCR";
  usuário é solicitado a reenviar documento melhor ou preencher manualmente; o
  atestado não entra na busca semântica até ter texto utilizável (mas continua
  visível e filtrável como pendente de tratamento).
- **IA de baixa confiança:** casamento marcado `REVISAR`; nunca conta como `ATENDE`
  sem confirmação manual. Sugestões de cadastro nunca são gravadas sem revisão.
- **RT desligado:** casamentos/currículos que dependem do acervo técnico-profissional
  de profissional `DESLIGADO` são sinalizados como inválidos para habilitação; o
  acervo técnico-operacional da empresa permanece válido.
- **Somatório vedado:** quando o edital exige "único atestado", o sistema não oferece
  composição por soma para aquela exigência e sinaliza a restrição.
- **Edital sem quantitativo claro / texto ambíguo:** exigência marcada `REVISAR` com
  o trecho do edital, pedindo o usuário definir o quantitativo mínimo manualmente.
- **Importação reexecutada:** idempotente — não duplica atestados/profissionais;
  relatório indica ignorados.
- **IA não configurada / offline:** OCR, sugestão de campos, busca semântica e
  extração de edital degradam com mensagem clara; a busca por filtros estruturados e
  o cadastro manual continuam funcionando.
- **Atestado sem documento digital:** permitido cadastrar só com metadados; sinalizado
  como "sem documento anexado" e não participa da busca semântica.
- **Terceiro com uso condicionado/expirado:** ao incluir na composição, o sistema
  alerta sobre a condição/validade da parceria.

## Definição de Concluído

- [ ] Modelo Prisma criado (migração aditiva) para Atestado, Responsável/Função/
      Categoria, Profissional (+vínculo), Quantitativos, Atestado de Terceiro
      (+parceria), Análise de Concorrência (+exigências/matriz), Pendência (+ciclo de
      vida configurável), Currículo e Taxonomia — tudo multi-tenant.
- [ ] Migração provisiona a infraestrutura de vetores (pgvector) para RAG.
- [ ] Importação da planilha cria os 112 atestados, dedup dos 36 profissionais, e
      mapeia categorias/funções para a taxonomia; idempotente e com relatório.
- [ ] É possível anexar PDF; o pipeline extrai texto (nativo ou OCR) e indexa para RAG;
      documentos ilegíveis são marcados e solicitam ação.
- [ ] Busca por filtros estruturados (incl. quantitativos e tipo de acervo) e busca
      semântica em linguagem natural retornam resultados com origem visível e score;
      terceiros podem ser incluídos/excluídos.
- [ ] Cadastro assistido por IA sugere campos e quantitativos a partir do PDF, com
      revisão obrigatória.
- [ ] Análise de Concorrência aceita texto ou PDF, extrai exigências (operacional vs.
      profissional) e quantitativos, e produz a matriz de atendimento com status,
      confiança e trecho comprobatório; lacunas explícitas; permite somatório quando
      cabível; é salva e editável.
- [ ] RT desligado é sinalizado nos casamentos/currículos dependentes do acervo
      profissional.
- [ ] Pendências têm responsável, prazo e ciclo de vida configurável; são criadas
      automática (gatilho configurável) e manualmente; podem ser convertidas em
      atestado; e disparam avisos por painel, badge de atraso, notificação in-app,
      e-mail e resumo periódico.
- [ ] Currículos estratégicos existem, classificados por segmento/área/disciplina,
      puxam automaticamente os atestados do profissional, e geram CV em PDF sob medida
      para uma concorrência.
- [ ] Dossiê de habilitação técnica em PDF é gerado a partir de uma análise (matriz +
      atestados + currículos selecionados).
- [ ] Acesso ao módulo é gated por permissão própria; gestão restrita a ADMIN/GESTOR;
      consulta liberada a quem tem acesso.
- [ ] UI adere ao vyd-design-system (ribbon, tokens, sem sidebar) e passa
      `check:colors`/`lint:css`.
- [ ] `cd server && npx vitest run && npm run build` e `npm run build` (frontend)
      passam sem erros.
