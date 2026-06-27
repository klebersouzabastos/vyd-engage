// ========================
// Static Email Templates (fallback when no AI provider is configured)
// ========================

export type TemplateType = 'initial_outreach' | 'follow_up' | 'proposal' | 'thank_you';

export interface TemplateContext {
  leadName: string;
  leadEmail?: string;
  companyName?: string;
  userName?: string;
  stage?: string;
  daysSinceLastContact?: number;
  lastInteractionSummary?: string;
  dealName?: string;
  dealValue?: string;
}

export interface EmailTemplate {
  id: TemplateType;
  name: string;
  description: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

const templates: Record<TemplateType, EmailTemplate> = {
  initial_outreach: {
    id: 'initial_outreach',
    name: 'Primeiro Contato',
    description: 'Email de apresentação para novos leads',
    subjectTemplate: 'Primeiro contato — {{userName}} | {{companyName}}',
    bodyTemplate: `Olá {{leadName}},

Meu nome é {{userName}} e estou entrando em contato pois acredito que podemos agregar valor ao seu negócio.

{{#if companyName}}Trabalho com empresas do segmento de {{companyName}} e temos ajudado nossos clientes a alcançar resultados significativos.{{/if}}

Gostaria de agendar uma conversa rápida de 15 minutos para entender melhor suas necessidades e apresentar como podemos colaborar.

Qual seria o melhor horário para conversarmos?

Atenciosamente,
{{userName}}`,
  },

  follow_up: {
    id: 'follow_up',
    name: 'Follow-up',
    description: 'Acompanhamento após período sem contato',
    subjectTemplate: 'Follow-up — Podemos conversar? | {{userName}}',
    bodyTemplate: `Olá {{leadName}},

Espero que esteja bem! Faz {{daysSinceLastContact}} dias desde nosso último contato e gostaria de retomar nossa conversa.

{{#if lastInteractionSummary}}Na nossa última interação, conversamos sobre: {{lastInteractionSummary}}{{/if}}

Continuo à disposição para ajudar. Tem alguma novidade ou posso auxiliar em algo?

Aguardo seu retorno.

Atenciosamente,
{{userName}}`,
  },

  proposal: {
    id: 'proposal',
    name: 'Proposta Comercial',
    description: 'Envio de proposta ou apresentação comercial',
    subjectTemplate: 'Proposta comercial para {{companyName}} | {{userName}}',
    bodyTemplate: `Olá {{leadName}},

Conforme alinhado, segue nossa proposta comercial{{#if companyName}} para {{companyName}}{{/if}}.

{{#if dealName}}Referente ao negócio: {{dealName}}{{/if}}
{{#if dealValue}}Valor proposto: {{dealValue}}{{/if}}

Os principais pontos da proposta incluem:
- [Descreva o escopo do serviço/produto]
- [Prazos de entrega]
- [Condições de pagamento]

Fico à disposição para esclarecer qualquer dúvida ou ajustar a proposta conforme necessário.

Atenciosamente,
{{userName}}`,
  },

  thank_you: {
    id: 'thank_you',
    name: 'Agradecimento',
    description: 'Agradecimento após reunião ou fechamento',
    subjectTemplate: 'Agradecimento — {{dealName || companyName}} | {{userName}}',
    bodyTemplate: `Olá {{leadName}},

Gostaria de agradecer pelo tempo dedicado{{#if dealName}} ao negócio {{dealName}}{{/if}}.

Foi um prazer conversar com você e estou confiante de que podemos construir uma parceria de sucesso.

Os próximos passos que alinhamos são:
- [Próximo passo 1]
- [Próximo passo 2]

Caso tenha qualquer dúvida, não hesite em entrar em contato.

Obrigado mais uma vez!

Atenciosamente,
{{userName}}`,
  },
};

/**
 * Replace template placeholders with actual values.
 * Supports {{variable}} and simple {{#if variable}}...{{/if}} blocks.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  let rendered = template;

  // Process {{#if variable}}...{{/if}} blocks
  rendered = rendered.replace(
    /\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, varName: string, content: string) => {
      const value = (context as any)[varName];
      if (value !== undefined && value !== null && value !== '' && value !== 0) {
        // Also replace variables inside the block
        return content;
      }
      return '';
    }
  );

  // Process {{variable || fallback}} syntax
  rendered = rendered.replace(
    /\{\{(\w+)\s*\|\|\s*(\w+)\}\}/g,
    (_match, primary: string, fallback: string) => {
      const primaryValue = (context as any)[primary];
      const fallbackValue = (context as any)[fallback];
      return String(primaryValue || fallbackValue || '');
    }
  );

  // Process simple {{variable}} placeholders
  rendered = rendered.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = (context as any)[varName];
    return value !== undefined && value !== null ? String(value) : '';
  });

  // Clean up empty lines from removed blocks
  rendered = rendered.replace(/\n{3,}/g, '\n\n');

  return rendered.trim();
}

export function getTemplate(type: TemplateType): EmailTemplate {
  return templates[type];
}

export function getAllTemplates(): EmailTemplate[] {
  return Object.values(templates);
}

export function generateStaticDraft(
  type: TemplateType,
  context: TemplateContext
): { subject: string; body: string } {
  const template = getTemplate(type);
  return {
    subject: renderTemplate(template.subjectTemplate, context),
    body: renderTemplate(template.bodyTemplate, context),
  };
}
