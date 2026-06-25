import { defaultSchema } from 'rehype-sanitize';

/**
 * Schema de sanitizacao do relatorio (allowlist). Parte do defaultSchema do
 * rehype-sanitize (que ja bloqueia script/style/iframe/on* e restringe href a
 * http/https/mailto) e apenas libera o atributo `id` em qualquer elemento, para
 * que os ids de ancora adicionados pelo rehype-slug aos titulos sobrevivam.
 *
 * IMPORTANTE: rodar rehype-sanitize SEMPRE depois do rehype-slug, e este schema
 * NAO deve liberar script/style/event handlers.
 *
 * clobberPrefix: '' desativa o prefixo "user-content-" que o defaultSchema
 * aplica em `id`/`name` — sem isso, os ids gerados pelo rehype-slug virariam
 * "user-content-<slug>" no DOM e as ancoras do sumario (#<slug>) nao bateriam.
 * Seguro aqui: o conteudo ja e sanitizado e os ids vem de slugs de titulos.
 */
export const reportSchema = {
  ...defaultSchema,
  clobberPrefix: '',
  attributes: {
    ...defaultSchema.attributes,
    '*': [...((defaultSchema.attributes && defaultSchema.attributes['*']) || []), 'id'],
  },
};
