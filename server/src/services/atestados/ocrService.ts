// Extração de texto do documento de um atestado (req 8, 10, 29).
//
// Estratégia em camadas, sempre graciosa e NUNCA silenciosa:
//   1. PDF com camada de texto (pesquisável) → extração nativa via pdf-parse.
//   2. Imagem (image/*) → OCR por visão da IA (gated; só quando há provider OpenAI).
//   3. Sem texto útil (ex.: PDF que é só digitalização de imagem) → status ILEGIVEL/
//      PENDENTE_EXTRACAO: o chamador aponta a falha ao usuário e pede que ele forneça
//      as informações (o silêncio é proibido pela spec).

import { logger } from '../../utils/logger.js';
import { resolveProviderConfig, isAIEnabled } from '../aiProvider.js';

export type ExtractionStatus = 'OK' | 'PENDENTE_EXTRACAO' | 'ILEGIVEL';

export interface ExtractionResult {
  text: string;
  status: ExtractionStatus;
  engine: 'pdf-text' | 'ai-vision' | 'none';
  /** Mensagem em pt-BR quando a extração falhou (para exibir ao usuário). */
  message?: string;
}

// Abaixo deste nº de caracteres consideramos o documento "não pesquisável".
const MIN_TEXT_CHARS = 40;

/** Extrai o texto nativo de um PDF pesquisável (não faz OCR de imagem). */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    // Importa o módulo interno para evitar o runner de teste do index.js do pdf-parse.
    const mod = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text?: string }>;
    const result = await pdfParse(buffer);
    return (result.text ?? '').trim();
  } catch (err) {
    logger.warn('pdf-parse falhou ao extrair texto do PDF', err as Error);
    return '';
  }
}

/**
 * OCR de um PDF digitalizado (sem camada de texto) via IA (OpenAI aceita documento
 * como input de arquivo). Gated ao provider OpenAI. Evita depender de rasterização
 * local (canvas/pdfjs). Retorna '' em falha (o chamador degrada p/ PENDENTE).
 */
async function ocrPdfWithAI(buffer: Buffer): Promise<string> {
  const config = resolveProviderConfig();
  if (!config || config.provider !== 'openai') return '';
  const dataUrl = `data:application/pdf;base64,${buffer.toString('base64')}`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcreva integralmente, em português, TODO o texto legível deste documento (atestado técnico / CAT). Responda apenas com o texto transcrito, sem comentários.',
              },
              { type: 'file', file: { filename: 'documento.pdf', file_data: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`OCR de PDF via IA falhou: ${res.status} ${body.slice(0, 200)}`);
      return '';
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return (data.choices?.[0]?.message?.content ?? '').trim();
  } catch (err) {
    logger.warn('OCR de PDF via IA lançou exceção', err as Error);
    return '';
  }
}

/**
 * OCR de imagem via visão da IA (OpenAI). Gated: só roda quando há provider OpenAI
 * configurado. Usa fetch cru (padrão dos providers de pesquisa) para evitar OOM do
 * AI SDK e não depender de renderização local.
 */
async function ocrImageWithAI(buffer: Buffer, mimeType: string): Promise<string> {
  const config = resolveProviderConfig();
  if (!config || config.provider !== 'openai') return '';
  const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Transcreva integralmente, em português, TODO o texto legível deste documento (atestado técnico / CAT). Responda apenas com o texto transcrito, sem comentários.',
              },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`OCR via IA falhou: ${res.status} ${body.slice(0, 200)}`);
      return '';
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return (data.choices?.[0]?.message?.content ?? '').trim();
  } catch (err) {
    logger.warn('OCR via IA lançou exceção', err as Error);
    return '';
  }
}

/**
 * Extrai o texto de um documento (PDF pesquisável ou imagem). Nunca lança: em falha,
 * devolve status ILEGIVEL/PENDENTE com uma mensagem para o usuário providenciar os dados.
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  const isPdf = mimeType === 'application/pdf' || /pdf/i.test(mimeType);
  const isImage = mimeType.startsWith('image/');

  if (isPdf) {
    const text = await extractPdfText(buffer);
    if (text.length >= MIN_TEXT_CHARS) {
      return { text, status: 'OK', engine: 'pdf-text' };
    }
    // PDF sem camada de texto (digitalização de imagem): tenta OCR via IA.
    if (isAIEnabled()) {
      const ocr = await ocrPdfWithAI(buffer);
      if (ocr.length >= MIN_TEXT_CHARS) {
        return { text: ocr, status: 'OK', engine: 'ai-vision' };
      }
    }
    return {
      text,
      status: 'PENDENTE_EXTRACAO',
      engine: 'none',
      message:
        'Documento parece ser uma digitalização de imagem sem texto pesquisável e o ' +
        'OCR não extraiu texto legível. Envie um PDF pesquisável ou preencha os campos manualmente.',
    };
  }

  if (isImage) {
    if (isAIEnabled()) {
      const text = await ocrImageWithAI(buffer, mimeType);
      if (text.length >= MIN_TEXT_CHARS) {
        return { text, status: 'OK', engine: 'ai-vision' };
      }
    }
    return {
      text: '',
      status: 'PENDENTE_EXTRACAO',
      engine: 'none',
      message:
        'Não foi possível extrair texto legível da imagem. Preencha os campos ' +
        'manualmente ou envie um documento com melhor qualidade.',
    };
  }

  return {
    text: '',
    status: 'ILEGIVEL',
    engine: 'none',
    message: `Tipo de arquivo não suportado para extração de texto (${mimeType}).`,
  };
}

export const ocrService = { extractText };
