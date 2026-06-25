import type { Block } from "../../services/api/client";

/**
 * Sample lead used to fill merge tags in the preview (req 5). The actual send
 * substitutes real lead data server-side via `blocksToHtml`; here we mirror the
 * same merge-tag set with a placeholder lead so the user sees a realistic email.
 */
export const SAMPLE_LEAD = {
  name: "João Silva",
  company: "Empresa Exemplo",
  email: "joao.silva@exemplo.com",
};

/**
 * Replaces the supported merge tags with the provided lead values. Tags with no
 * corresponding value resolve to an empty string (mirrors the send-time edge
 * case: a missing `{{lead.company}}` must not render the literal tag).
 */
export function substituteMergeTags(
  text: string,
  lead: { name?: string; company?: string; email?: string },
): string {
  return text
    .replace(/\{\{lead\.name\}\}/g, lead.name ?? "")
    .replace(/\{\{lead\.company\}\}/g, lead.company ?? "")
    .replace(/\{\{lead\.email\}\}/g, lead.email ?? "");
}

interface CampaignPreviewProps {
  blocks: Block[];
  /** Lead used for merge-tag substitution; defaults to the sample lead. */
  lead?: { name?: string; company?: string; email?: string };
}

/**
 * Renders the campaign body blocks to React/HTML for the in-app preview,
 * mirroring the backend `blocksToHtml` block structure (req 5). Merge tags are
 * substituted with a sample lead so the preview matches the eventual send.
 */
export function CampaignPreview({ blocks, lead = SAMPLE_LEAD }: CampaignPreviewProps) {
  return (
    <div className="mx-auto max-w-[600px] bg-white text-gray-900">
      {blocks.map((block) => {
        switch (block.type) {
          case "text":
            return (
              <p
                key={block.id}
                className="px-6 py-2 text-sm leading-relaxed whitespace-pre-wrap"
              >
                {substituteMergeTags(block.content, lead)}
              </p>
            );
          case "image":
            return (
              <div key={block.id} className="px-6 py-2">
                {block.url ? (
                  <img
                    src={block.url}
                    alt={block.alt || ""}
                    className="max-w-full h-auto mx-auto"
                  />
                ) : (
                  <div className="flex items-center justify-center h-24 bg-gray-100 text-xs text-gray-400 rounded">
                    Imagem (sem URL)
                  </div>
                )}
              </div>
            );
          case "button":
            return (
              <div key={block.id} className="px-6 py-3 text-center">
                <a
                  href={block.href || "#"}
                  className="inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-white no-underline"
                >
                  {substituteMergeTags(block.label || "Botão", lead)}
                </a>
              </div>
            );
          case "divider":
            return <hr key={block.id} className="my-3 border-gray-200" />;
          case "spacer":
            return <div key={block.id} style={{ height: block.height ?? 24 }} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
