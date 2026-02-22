import { Bold, Italic, Underline, Link, List, Heading2 } from "lucide-react";

interface EmailFormatToolbarProps {
  onFormat: (tag: string, wrap?: boolean) => void;
}

export function EmailFormatToolbar({ onFormat }: EmailFormatToolbarProps) {
  const buttons = [
    { icon: Bold, label: "Negrito", action: () => onFormat("strong") },
    { icon: Italic, label: "Italico", action: () => onFormat("em") },
    { icon: Underline, label: "Sublinhado", action: () => onFormat("u") },
    { icon: Heading2, label: "Titulo", action: () => onFormat("h2") },
    { icon: List, label: "Lista", action: () => onFormat("li", true) },
    { icon: Link, label: "Link", action: () => onFormat("a") },
  ];

  return (
    <div className="flex items-center gap-0.5 py-1 px-1 bg-gray-50 border border-gray-200 rounded-t-md border-b-0">
      {buttons.map((btn) => {
        const Icon = btn.icon;
        return (
          <button
            key={btn.label}
            type="button"
            onClick={btn.action}
            title={btn.label}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

export function useEmailFormatter(
  getText: () => string,
  setText: (text: string) => void,
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
) {
  const handleFormat = (tag: string, wrap?: boolean) => {
    const textarea = textareaRef?.current;
    const text = getText();

    if (tag === "a") {
      const url = prompt("URL do link:");
      if (!url) return;
      const linkText = textarea
        ? text.substring(textarea.selectionStart, textarea.selectionEnd) || "clique aqui"
        : "clique aqui";
      const html = `<a href="${url}">${linkText}</a>`;
      insertAtCursor(textarea, text, html);
      return;
    }

    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = text.substring(start, end);
      const wrapped = wrap
        ? `<ul><${tag}>${selected}</${tag}></ul>`
        : `<${tag}>${selected}</${tag}>`;
      const newText = text.substring(0, start) + wrapped + text.substring(end);
      setText(newText);
    } else {
      const placeholder = getPlaceholder(tag);
      const html = wrap
        ? `<ul><${tag}>${placeholder}</${tag}></ul>`
        : `<${tag}>${placeholder}</${tag}>`;
      insertAtCursor(textarea, text, html);
    }
  };

  const insertAtCursor = (
    textarea: HTMLTextAreaElement | null | undefined,
    text: string,
    html: string
  ) => {
    if (textarea) {
      const pos = textarea.selectionStart;
      const newText = text.substring(0, pos) + html + text.substring(pos);
      setText(newText);
    } else {
      setText(text + html);
    }
  };

  const getPlaceholder = (tag: string) => {
    switch (tag) {
      case "strong": return "texto em negrito";
      case "em": return "texto em italico";
      case "u": return "texto sublinhado";
      case "h2": return "Titulo";
      case "li": return "item da lista";
      default: return "texto";
    }
  };

  return handleFormat;
}
