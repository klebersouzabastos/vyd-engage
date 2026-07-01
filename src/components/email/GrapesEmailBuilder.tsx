import { useEffect, useRef } from 'react';
import grapesjs, { type Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';

interface GrapesEmailBuilderProps {
  initialHtml?: string;
  onChange: (html: string) => void;
}

/**
 * EMAIL_PALETTE — valores hex RESOLVIDOS do vyd-design-system para os blocos de
 * e-mail. E-mails HTML exigem cor INLINE literal (clientes de e-mail não suportam
 * var() de forma confiável), logo estes blocos default usam hex do DS (tema light,
 * pois e-mails têm fundo claro). Arquivo na allowlist do gate.
 * Referência: vyd-design-system/dist/variables.css.
 */
const EMAIL_PALETTE = {
  accent: '#1E5FC4', // --vyd-blueprint-500 (marca)
  onAccent: '#FFFFFF', // --vyd-neutral-1000 (texto sobre a marca)
  text: '#1F2630', // --vyd-neutral-100 (corpo em fundo claro)
  muted: '#7B8794', // --vyd-neutral-500
  border: '#C2CAD3', // --vyd-neutral-700
  subtleBg: '#F2F5F8', // --vyd-neutral-900
} as const; // gate-allow: email (inline colors required)

const BLOCKS = [
  {
    id: 'section-header',
    label: 'Cabeçalho',
    category: 'Layout',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_PALETTE.accent};padding:24px 32px;">
      <tr><td style="color:${EMAIL_PALETTE.onAccent};font-size:22px;font-family:Arial,sans-serif;font-weight:bold;">
        Seu título aqui
      </td></tr>
    </table>`,
  },
  {
    id: 'section-text',
    label: 'Texto',
    category: 'Conteúdo',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 32px;">
      <tr><td style="font-size:15px;font-family:Arial,sans-serif;color:${EMAIL_PALETTE.text};line-height:1.6;">
        Escreva seu conteúdo aqui.
      </td></tr>
    </table>`,
  },
  {
    id: 'section-button',
    label: 'Botão CTA',
    category: 'Conteúdo',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding:16px 32px;">
      <tr><td align="center">
        <a href="#" style="display:inline-block;background:${EMAIL_PALETTE.accent};color:${EMAIL_PALETTE.onAccent};font-family:Arial,sans-serif;
          font-size:15px;font-weight:bold;padding:12px 28px;border-radius:6px;text-decoration:none;">
          Clique aqui
        </a>
      </td></tr>
    </table>`,
  },
  {
    id: 'section-image',
    label: 'Imagem',
    category: 'Conteúdo',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding:16px 32px;">
      <tr><td align="center">
        <img src="https://via.placeholder.com/560x200" alt="imagem" style="max-width:100%;border-radius:4px;" />
      </td></tr>
    </table>`,
  },
  {
    id: 'section-footer',
    label: 'Rodapé',
    category: 'Layout',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="background:${EMAIL_PALETTE.subtleBg};padding:16px 32px;border-top:1px solid ${EMAIL_PALETTE.border};">
      <tr><td style="font-size:12px;font-family:Arial,sans-serif;color:${EMAIL_PALETTE.muted};text-align:center;">
        © 2025 Sua empresa. Para cancelar inscrição, <a href="#" style="color:${EMAIL_PALETTE.muted};">clique aqui</a>.
      </td></tr>
    </table>`,
  },
  {
    id: 'section-divider',
    label: 'Separador',
    category: 'Layout',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding:8px 32px;">
      <tr><td><hr style="border:none;border-top:1px solid ${EMAIL_PALETTE.border};" /></td></tr>
    </table>`,
  },
];

export function GrapesEmailBuilder({ initialHtml, onChange }: GrapesEmailBuilderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;

    const editor = grapesjs.init({
      container: containerRef.current,
      fromElement: false,
      height: '100%',
      width: 'auto',
      storageManager: false,
      panels: { defaults: [] },
      blockManager: { blocks: BLOCKS },
      styleManager: {
        sectors: [
          {
            name: 'Tipografia',
            open: true,
            properties: [
              'font-family',
              'font-size',
              'font-weight',
              'color',
              'text-align',
              'line-height',
            ],
          },
          {
            name: 'Espaçamento',
            open: false,
            properties: ['padding', 'margin'],
          },
          {
            name: 'Aparência',
            open: false,
            properties: ['background-color', 'border-radius', 'width'],
          },
        ],
      },
      canvas: {
        styles: ['https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'],
      },
      components:
        initialHtml ||
        `
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td>
            <table width="600" align="center" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td>Arraste blocos para construir seu email.</td></tr>
            </table>
          </td></tr>
        </table>
      `,
    });

    editor.on('change:changesCount', () => {
      const html = editor.getHtml();
      const css = editor.getCss();
      const full = css ? `<style>${css}</style>\n${html}` : html;
      onChange(full);
    });

    editorRef.current = editor;

    return () => {
      editor.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', minHeight: 480 }}
      className="rounded border border-gray-200 overflow-hidden"
    />
  );
}
