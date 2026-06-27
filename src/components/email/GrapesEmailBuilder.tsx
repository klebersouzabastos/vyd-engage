import { useEffect, useRef } from 'react';
import grapesjs, { type Editor } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';

interface GrapesEmailBuilderProps {
  initialHtml?: string;
  onChange: (html: string) => void;
}

const BLOCKS = [
  {
    id: 'section-header',
    label: 'Cabeçalho',
    category: 'Layout',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="background:#2563eb;padding:24px 32px;">
      <tr><td style="color:#fff;font-size:22px;font-family:Arial,sans-serif;font-weight:bold;">
        Seu título aqui
      </td></tr>
    </table>`,
  },
  {
    id: 'section-text',
    label: 'Texto',
    category: 'Conteúdo',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 32px;">
      <tr><td style="font-size:15px;font-family:Arial,sans-serif;color:#374151;line-height:1.6;">
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
        <a href="#" style="display:inline-block;background:#2563eb;color:#fff;font-family:Arial,sans-serif;
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
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
      <tr><td style="font-size:12px;font-family:Arial,sans-serif;color:#9ca3af;text-align:center;">
        © 2025 Sua empresa. Para cancelar inscrição, <a href="#" style="color:#6b7280;">clique aqui</a>.
      </td></tr>
    </table>`,
  },
  {
    id: 'section-divider',
    label: 'Separador',
    category: 'Layout',
    content: `<table width="100%" cellpadding="0" cellspacing="0" style="padding:8px 32px;">
      <tr><td><hr style="border:none;border-top:1px solid #e5e7eb;" /></td></tr>
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
