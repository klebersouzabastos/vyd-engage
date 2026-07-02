import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, List, ListOrdered, Link2, Mic, MicOff } from 'lucide-react';
import { sanitizeRichHtml } from '@/lib/richText';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
  ariaLabel?: string;
}

// A Web Speech API não é tipada no lib.dom padrão; tipagem mínima local.
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

function ToolbarButton({
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
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-card text-muted-foreground hover:text-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Editor de texto rico reutilizável (req 10-13): negrito/itálico/listas/link +
 * ditado por voz (Web Speech API, pt-BR). Persiste HTML SANITIZADO. Só tokens do DS.
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 120,
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
      // StarterKit@3 já traz um Link; desligamos o embutido para usar só o
      // configurado abaixo (evita "Duplicate extension names: ['link']").
      StarterKit.configure({ link: false }),
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        id: id ?? '',
        role: 'textbox',
        'aria-label': ariaLabel ?? placeholder ?? 'Editor de texto',
        'aria-multiline': 'true',
        // Altura mínima via style inline: classe arbitrária interpolada
        // (min-h-[${'${minHeight}'}px]) não é gerada pelo scanner estático do Tailwind v4.
        style: `min-height:${minHeight}px`,
        class:
          'w-full px-3 py-2 text-sm text-foreground focus:outline-none [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:ml-5 [&_ol]:ml-5 [&_a]:text-primary [&_a]:underline [&_p]:my-1',
      },
    },
    onUpdate: ({ editor }) => onChange(sanitizeRichHtml(editor.getHTML())),
  });

  // Sincroniza conteúdo externo (ex.: carregar um passo/nota) sem quebrar o cursor.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && !editor.isFocused) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [value, editor]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const insertVoice = (editor: Editor | null, text: string) => {
    if (!editor || !text) return;
    editor.chain().focus().insertContent(text.trim() + ' ').run();
  };

  const toggleVoice = () => {
    if (!editor) return;
    if (listening) {
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
      insertVoice(editor, text);
    };
    rec.onerror = (e) => {
      // Erro/permissão negada: aviso não-bloqueante; o texto já digitado permanece.
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

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
        <ToolbarButton
          title="Negrito"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Itálico"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Lista com marcadores"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Lista numerada"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </ToolbarButton>
        <ToolbarButton
          title="Link"
          active={editor.isActive('link')}
          onClick={() => {
            const prev = editor.getAttributes('link').href as string | undefined;
            const url = window.prompt('URL do link', prev ?? 'https://');
            if (url === null) return;
            if (url === '') {
              editor.chain().focus().extendMarkRange('link').unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
        >
          <Link2 size={14} />
        </ToolbarButton>

        {voiceSupported && (
          <>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
            <ToolbarButton
              title={listening ? 'Parar ditado' : 'Ditar por voz (pt-BR)'}
              active={listening}
              onClick={toggleVoice}
            >
              {listening ? <MicOff size={14} /> : <Mic size={14} />}
            </ToolbarButton>
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
