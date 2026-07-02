import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TextStyle, Color } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Mic,
  MicOff,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Code2,
  Minus,
  Baseline,
  Highlighter,
  RemoveFormatting,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { sanitizeRichHtml } from '@/lib/richText';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
  ariaLabel?: string;
}

// Cores do texto e do realce — SEMPRE tokens do DS (var(--vyd-*)), nunca hex.
const TEXT_COLORS = [
  { label: 'Vermelho', value: 'var(--vyd-danger)' },
  { label: 'Verde', value: 'var(--vyd-success)' },
  { label: 'Amarelo', value: 'var(--vyd-warning)' },
  { label: 'Azul', value: 'var(--vyd-info)' },
  { label: 'Acento', value: 'var(--vyd-action-primary)' },
];
const HIGHLIGHT_COLORS = [
  { label: 'Amarelo', value: 'var(--vyd-warning)' },
  { label: 'Verde', value: 'var(--vyd-success)' },
  { label: 'Azul', value: 'var(--vyd-info)' },
  { label: 'Vermelho', value: 'var(--vyd-danger)' },
];

// Estilo compartilhado do conteúdo rico (editor + timeline). Só tokens do DS.
export const RICH_CONTENT_CLASS =
  'text-sm text-foreground [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ml-5 [&_ol]:ml-5 [&_a]:text-primary [&_a]:underline [&_p]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_pre]:bg-muted [&_pre]:rounded [&_pre]:p-2 [&_pre]:text-xs [&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_hr]:my-2 [&_hr]:border-border [&_mark]:rounded [&_mark]:px-0.5';

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function Btn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px self-center bg-border" aria-hidden="true" />;
}

/**
 * Editor de texto rico "Word-like" (req 10-13 + evolução): títulos, negrito/
 * itálico/sublinhado/tachado, cor e realce (tokens do DS), alinhamento, listas,
 * citação, código, régua, link, limpar formatação + ditado por voz (pt-BR).
 * Persiste HTML SANITIZADO. Só tokens do DS.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 140,
  id,
  ariaLabel,
}: RichTextEditorProps) {
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceSupported = getSpeechRecognitionCtor() !== null;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false, heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: sanitizeRichHtml(value || ''),
    editorProps: {
      attributes: {
        id: id ?? '',
        role: 'textbox',
        'aria-label': ariaLabel ?? placeholder ?? 'Editor de texto',
        'aria-multiline': 'true',
        style: `min-height:${minHeight}px`,
        class: `${RICH_CONTENT_CLASS} w-full px-3 py-2 focus:outline-none`,
      },
    },
    onUpdate: ({ editor }) => onChange(sanitizeRichHtml(editor.getHTML())),
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && !editor.isFocused) {
      editor.commands.setContent(sanitizeRichHtml(value || ''), { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const toggleVoice = () => {
    if (!editor) return;
    if (listening) {
      setVoiceError(null);
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    setVoiceError(null);
    const rec = new Ctor();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      if (text) editor.chain().focus().insertContent(text.trim() + ' ').run();
    };
    rec.onerror = (e) => {
      setVoiceError(
        e?.error === 'not-allowed'
          ? 'Permita o microfone para ditar.'
          : 'Não foi possível ouvir. Continue digitando.'
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  if (!editor) return null;

  const blockValue = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p';

  const setBlock = (v: string) => {
    const chain = editor.chain().focus();
    if (v === 'p') chain.setParagraph().run();
    else chain.toggleHeading({ level: Number(v[1]) as 1 | 2 | 3 }).run();
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const input = window.prompt('URL do link', prev ?? 'https://');
    if (input === null) return;
    const raw = input.trim();
    if (raw === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    // Bloqueia esquemas perigosos; adiciona https:// a domínios sem esquema.
    if (/^(?:javascript|data|vbscript|file):/i.test(raw)) return;
    const href =
      /^(?:https?:|mailto:)/i.test(raw) || raw.startsWith('/') || raw.startsWith('#')
        ? raw
        : `https://${raw}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
        <Btn title="Desfazer" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={14} />
        </Btn>
        <Btn title="Refazer" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={14} />
        </Btn>
        <Divider />

        <select
          value={blockValue}
          onChange={(e) => setBlock(e.target.value)}
          aria-label="Estilo do bloco"
          className="h-7 rounded-md border border-border bg-card px-1.5 text-xs text-foreground focus:outline-none"
        >
          <option value="p">Parágrafo</option>
          <option value="h1">Título 1</option>
          <option value="h2">Título 2</option>
          <option value="h3">Título 3</option>
        </select>
        <Divider />

        <Btn title="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={14} />
        </Btn>
        <Btn title="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={14} />
        </Btn>
        <Btn title="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={14} />
        </Btn>
        <Btn title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough size={14} />
        </Btn>

        {/* Cor do texto */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Cor do texto"
              aria-label="Cor do texto"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Baseline size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Padrão"
                onClick={() => editor.chain().focus().unsetColor().run()}
                className="flex h-5 w-5 items-center justify-center rounded border border-border text-[10px] text-foreground"
              >
                A
              </button>
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => editor.chain().focus().setColor(c.value).run()}
                  className="h-5 w-5 rounded border border-border"
                  style={{ background: c.value }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Realce */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              title="Realce"
              aria-label="Realce"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border ${
                editor.isActive('highlight')
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Highlighter size={14} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Nenhum"
                onClick={() => editor.chain().focus().unsetHighlight().run()}
                className="flex h-5 w-5 items-center justify-center rounded border border-border text-[10px] text-foreground"
              >
                ✕
              </button>
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => editor.chain().focus().toggleHighlight({ color: c.value }).run()}
                  className="h-5 w-5 rounded border border-border"
                  style={{ background: c.value }}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <Divider />

        <Btn title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft size={14} />
        </Btn>
        <Btn title="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter size={14} />
        </Btn>
        <Btn title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight size={14} />
        </Btn>
        <Btn title="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
          <AlignJustify size={14} />
        </Btn>
        <Divider />

        <Btn title="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={14} />
        </Btn>
        <Btn title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={14} />
        </Btn>
        <Btn title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={14} />
        </Btn>
        <Btn title="Bloco de código" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code2 size={14} />
        </Btn>
        <Btn title="Linha divisória" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus size={14} />
        </Btn>
        <Divider />

        <Btn title="Link" active={editor.isActive('link')} onClick={setLink}>
          <Link2 size={14} />
        </Btn>
        <Btn title="Limpar formatação" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>
          <RemoveFormatting size={14} />
        </Btn>

        {voiceSupported && (
          <>
            <Divider />
            <Btn title={listening ? 'Parar ditado' : 'Ditar por voz (pt-BR)'} active={listening} onClick={toggleVoice}>
              {listening ? <MicOff size={14} /> : <Mic size={14} />}
            </Btn>
          </>
        )}
      </div>

      <EditorContent editor={editor} />

      {listening && (
        <div className="px-3 pb-2 text-xs text-primary" role="status">
          Ouvindo… fale agora.
        </div>
      )}
      {voiceError && (
        <div className="px-3 pb-2 text-xs text-destructive" role="alert">
          {voiceError}
        </div>
      )}
    </div>
  );
}
