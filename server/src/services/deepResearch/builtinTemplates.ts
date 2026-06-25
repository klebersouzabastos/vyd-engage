// Templates semente da Pesquisa Profunda (Deep Research).
//
// Fonte única de verdade dos prompts-modelo. Usado pelo seed e pelo
// auto-provision lazy (templateService.ensureBuiltins). A seção de saída pede
// Markdown estruturado (renderizado como site pelo Engage) em vez de HTML.
//
// Placeholders são escritos no formato [TEXTO] — o frontend os detecta e gera
// um campo preenchível por placeholder. Os modelos cobrem dois recortes:
//   - "Empresa": pesquisa sobre uma empresa específica;
//   - "Segmento": pesquisa sobre um segmento de mercado inteiro.

export interface BuiltinTemplate {
  name: string;
  description: string;
  promptBody: string;
}

export const EMPRESA_TEMPLATE_PROMPT = `Objetivo: gerar uma pesquisa aprofundada sobre a empresa [EMPRESA] (setor: [SETOR]), com foco em identificar oportunidades de negócio em engenharia, projetos e suprimentos.

## Estrutura da pesquisa solicitada

### Capítulo 1 — Panorama Geral da Empresa
- Histórico e posicionamento no seu setor de atuação;
- Estrutura societária e grupos controladores;
- Localização das unidades operacionais e escritórios;
- Produtos principais, volumes produzidos e mercados atendidos.

### Capítulo 2 — Investimentos em Curso e Planejados (próximos 5 anos, sendo que estamos em 2026)
- Tabela com os investimentos planejados por ano e por projeto, separando:
  - Expansão de capacidade (greenfield, brownfield);
  - Sustentação (CAPEX de manutenção);
  - Exploração / prospecção de recursos (quando aplicável);
- Destaque para:
  - Fases mais intensivas em engenharia e obras;
  - Marcos principais do cronograma (início de obras, comissionamento, etc.).

O estudo de investimentos deve sempre levar em consideração investimentos que passam pelo ano de 2026 ou que se iniciam em 2026 ou posterior. Deve-se ignorar os investimentos que já se findaram. Todos os investimentos devem ser informados com as suas datas de realização: em toda situação em que um investimento for anunciado, é necessário dizer quando ele ocorrerá.

### Capítulo 3 — Distribuição de Investimentos por Fase de Projeto
- Apresentar a distribuição percentual estimada dos custos por fase, incluindo:
  - Engenharia conceitual / estudos iniciais;
  - Engenharia básica e estudos de viabilidade;
  - Engenharia detalhada;
  - Aquisição de equipamentos;
  - Construção e montagem;
  - Gerenciamento de obras e comissionamento.

Considerar apenas investimentos que passam por 2026 ou se iniciam em 2026 ou posterior, sempre com as respectivas datas.

### Capítulo 4 — Maturidade dos Projetos
- Listar os projetos da empresa com indicação do estágio atual, como:
  - Estudo / concepção;
  - Estudo de viabilidade;
  - Engenharia básica;
  - Construção;
  - Operação;
- Indicar possíveis janelas de entrada para prestadores de serviços.

Considerar apenas investimentos que passam por 2026 ou se iniciam em 2026 ou posterior, sempre com as respectivas datas.

### Capítulo 5 — Modelo de Contratação e Preferências da Empresa
- Informar como a empresa costuma estruturar suas contratações:
  - Modelo EPC ou EPCM;
  - Uso de equipe interna vs. contratação de pacotes externos;
  - Nível de terceirização em engenharia, compras e obras;
  - Se a empresa atua com contratos de LTA do tipo guarda-chuva para fornecimento de projetos de engenharia.
- Avaliar se há padronização ou flexibilidade nos escopos.

### Capítulo 6 — Concorrência e Parcerias Estratégicas
- Mapear fornecedores e concorrentes que já atuam com a empresa:
  - Empresas de engenharia;
  - Identificar se há alguma empresa atendendo com contrato LTA (estamos em 2026);
  - Consultorias técnicas (ambiental, viabilidade, especializadas);
  - Empreiteiras e montadoras industriais;
- Apontar os diferenciais competitivos dessas empresas.

### Capítulo 7 — Organograma e Tomadores de Decisão (estamos em 2026)
- Gerar um organograma com os principais líderes nas áreas:
  - Engenharia;
  - Projetos;
  - Suprimentos;
  - Diretoria Executiva;
- Incluir, para cada um:
  - Nome;
  - Cargo;
  - Responsabilidades;
  - E-mail ou contato institucional, se público.

### Capítulo 8 — Conteúdo Local e Política de Contratação Regional
- Informar se a empresa prioriza fornecedores nacionais ou regionais;
- Avaliar o nível de conteúdo local (ex.: % do CAPEX executado no Brasil);
- Indicar vantagens competitivas para empresas locais.

### Capítulo 9 — Pipeline de Projetos e Oportunidades Futuras (estamos em 2026)
- Identificar projetos em estudo ou com alto potencial de se tornarem empreendimentos futuros;
- Indicar estimativas de prazo para início de estudos, licenciamento ou obras;
- Destacar oportunidades para:
  - Estudos de viabilidade;
  - Engenharia conceitual e básica;
  - Suporte técnico antecipado.

### Capítulo 10 — Estratégias Comerciais Recomendadas
- Indicar abordagens comerciais eficazes para:
  - Iniciar contato com os decisores;
  - Posicionar a empresa como parceira técnica;
  - Oferecer soluções complementares à equipe interna;
- Incluir exemplos de diferenciação com foco em:
  - Redução de custos e riscos;
  - Agilidade e flexibilidade;
  - Domínio do ambiente regulatório/local.

## Instruções de formatação da saída
- Responda em português do Brasil, em **Markdown estruturado** (não HTML).
- Use um título de nível 1 (#) para o relatório e um título de nível 2 (##) para cada capítulo, na ordem acima, para que um sumário navegável possa ser gerado.
- Use **tabelas Markdown (GFM)** para todos os dados comparativos (investimentos por ano/projeto, distribuição por fase, diretório de decisores, etc.).
- Sempre que citar um investimento, informe a data ou janela; considere apenas investimentos que atravessam 2026 ou começam em 2026 ou depois.
- Marque claramente como **estimativa** qualquer valor ou cronograma inferido.
- Inclua uma seção final \`## Fontes e Referências\` listando as fontes utilizadas.
- Mantenha linguagem profissional e objetiva, adequada para apresentação à área comercial.`;

export const SEGMENTO_TEMPLATE_PROMPT = `Objetivo: gerar uma pesquisa aprofundada sobre o segmento de [SEGMENTO] em [REGIÃO], com foco em mapear oportunidades de negócio em engenharia, projetos e suprimentos — identificando empresas-alvo, investimentos, decisores e estratégia comercial.

## Estrutura da pesquisa solicitada

### Capítulo 1 — Escopo, premissas e leitura executiva
- Definição do escopo do segmento e do recorte geográfico ([REGIÃO]);
- Leitura executiva: atratividade do segmento, maturidade do pipeline e principais oportunidades;
- Ranking-resumo das melhores oportunidades comerciais (empresa/projeto, foco, tese resumida, janela principal).

### Capítulo 2 — Panorama do segmento
- Relevância estratégica e principais drivers de demanda;
- Posição de [REGIÃO] na cadeia de valor / oferta;
- Principais polos, regiões e concentração geográfica;
- Ambiente de demanda, preços e arcabouço regulatório.

### Capítulo 3 — Players, ativos e ranking preliminar
- Tabela-mestra de empresas do segmento (controlador, origem do capital, estágio, ativos/projetos, localização, capacidade atual/planejada, relevância comercial);
- Ranking preliminar por relevância como potencial cliente de engenharia, cruzando: tamanho do CAPEX, maturidade/janela de entrada, abertura a terceiros e concorrência já instalada.

### Capítulo 4 — Investimentos do segmento e valor endereçável (a partir de 2026)
- Tabela consolidada de investimentos (empresa/projeto, tipo, CAPEX total, datas-chave, fase intensiva em engenharia, distribuição anual 2026+);
- Visão agregada do CAPEX do segmento e pico de desembolso esperado;
- Distribuição estimada por fase de projeto e SAM (mercado endereçável) para estudos, engenharia, detalhamento, EPCM/comissionamento e compras/equipamentos.

Considerar apenas investimentos que passam por 2026 ou se iniciam em 2026 ou posterior; sempre informar datas/janelas; marcar inferências como **estimativa**.

### Capítulo 5 — Maturidade, modelos de contratação e concorrência
- Mapa de maturidade dos projetos e janela de entrada para serviços;
- Timeline do segmento (marcos e oportunidades comerciais associadas);
- Modelos de contratação predominantes (EPC vs EPCM, terceirização, LTAs guarda-chuva);
- Concorrência instalada e incumbentes com evidência pública.

### Capítulo 6 — Conteúdo local e diretório de decisores
- Tendência de conteúdo local e política regional do segmento;
- Diretório de decisores por empresa-alvo, nas áreas de Engenharia, Projetos, Suprimentos e Diretoria Executiva, com nome, cargo, responsabilidades e contato institucional público, quando disponível.

### Capítulo 7 — Pipeline futuro, estratégia comercial e limitações
- Pipeline futuro que pode virar empreendimento relevante após 2026;
- Estratégia comercial recomendada por tipo de alvo (developers em pré-FID, brownfields/expansões, players verticalizados);
- Proposta de abordagem inicial por empresa-alvo (primeira oferta recomendada e motivo);
- Open questions e limitações (informações sem transparência pública).

## Instruções de formatação da saída
- Responda em português do Brasil, em **Markdown estruturado** (não HTML).
- Use um título de nível 1 (#) para o relatório e um título de nível 2 (##) para cada capítulo, para que um sumário navegável possa ser gerado.
- Use **tabelas Markdown (GFM)** para a tabela-mestra de players, investimentos, rankings e diretório de decisores.
- Sempre que citar um investimento, informe a data ou janela; considere apenas investimentos que atravessam 2026 ou começam em 2026 ou depois.
- Marque claramente como **estimativa** qualquer valor ou cronograma inferido.
- Inclua uma seção final \`## Fontes e Referências\` listando as fontes utilizadas.
- Mantenha linguagem profissional e objetiva, adequada para apresentação à área comercial.`;

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    name: 'Empresa',
    description:
      'Pesquisa profunda focada em uma empresa específica — oportunidades de engenharia, projetos e suprimentos (10 capítulos).',
    promptBody: EMPRESA_TEMPLATE_PROMPT,
  },
  {
    name: 'Segmento',
    description:
      'Pesquisa profunda sobre um segmento de mercado inteiro — players, investimentos, decisores e estratégia comercial (7 capítulos).',
    promptBody: SEGMENTO_TEMPLATE_PROMPT,
  },
];
