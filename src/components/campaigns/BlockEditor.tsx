import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Trash2,
  Type,
  Image as ImageIcon,
  MousePointerClick,
  Minus,
  MoveVertical,
} from 'lucide-react';
import type { Block } from '../../services/api/client';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

/** Generates a stable client-side id for a new block. */
function newId(): string {
  return `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeBlock(type: Block['type']): Block {
  switch (type) {
    case 'text':
      return { id: newId(), type: 'text', content: '' };
    case 'image':
      return { id: newId(), type: 'image', url: '', alt: '' };
    case 'button':
      return { id: newId(), type: 'button', label: 'Clique aqui', href: '' };
    case 'divider':
      return { id: newId(), type: 'divider' };
    case 'spacer':
      return { id: newId(), type: 'spacer', height: 24 };
  }
}

const BLOCK_TYPES: { type: Block['type']; label: string; icon: typeof Type }[] = [
  { type: 'text', label: 'Texto', icon: Type },
  { type: 'image', label: 'Imagem', icon: ImageIcon },
  { type: 'button', label: 'Botão', icon: MousePointerClick },
  { type: 'divider', label: 'Divisor', icon: Minus },
  { type: 'spacer', label: 'Espaçador', icon: MoveVertical },
];

interface BlockEditorProps {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
}

/**
 * Drag-and-drop block editor (req 3). Supports adding, reordering (via
 * @dnd-kit/sortable), removing and inline-editing blocks of the five supported
 * types. The block list is the campaign body and is rendered by CampaignPreview.
 */
export function BlockEditor({ blocks, onChange }: BlockEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addBlock = (type: Block['type']) => {
    onChange([...blocks, makeBlock(type)]);
  };

  const updateBlock = (id: string, patch: Partial<Block>) => {
    onChange(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex((b) => b.id === active.id);
    const newIndex = blocks.findIndex((b) => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(blocks, oldIndex, newIndex));
  };

  return (
    <div className="space-y-4">
      {/* Add-block toolbar */}
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map(({ type, label, icon: Icon }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addBlock(type)}
            className="gap-1.5"
          >
            <Icon size={14} /> {label}
          </Button>
        ))}
      </div>

      {/* Block list */}
      {blocks.length === 0 ? (
        <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
          Adicione blocos ao corpo do email usando os botões acima.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {blocks.map((block) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  onUpdate={updateBlock}
                  onRemove={removeBlock}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableBlock({
  block,
  onUpdate,
  onRemove,
}: {
  block: Block;
  onUpdate: (id: string, patch: Partial<Block>) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 rounded-lg border border-gray-200 bg-card p-3"
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab touch-none text-gray-400 hover:text-gray-600"
        aria-label="Reordenar bloco"
        title="Arraste para reordenar"
      >
        <GripVertical size={16} />
      </button>

      {/* Editable body per type */}
      <div className="flex-1 min-w-0">
        <BlockFields block={block} onUpdate={onUpdate} />
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(block.id)}
        className="mt-1 text-gray-400 hover:text-red-500"
        aria-label="Remover bloco"
        title="Remover bloco"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

function BlockFields({
  block,
  onUpdate,
}: {
  block: Block;
  onUpdate: (id: string, patch: Partial<Block>) => void;
}) {
  switch (block.type) {
    case 'text':
      return (
        <>
          <span className="mb-1 block text-xs font-medium text-gray-500">Texto</span>
          <textarea
            value={block.content}
            onChange={(e) => onUpdate(block.id, { content: e.target.value })}
            placeholder="Escreva o texto... Use {{lead.name}}, {{lead.company}}, {{lead.email}}"
            className="w-full min-h-[72px] resize-y rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </>
      );
    case 'image':
      return (
        <>
          <span className="mb-1 block text-xs font-medium text-gray-500">Imagem (URL)</span>
          <Input
            value={block.url}
            onChange={(e) => onUpdate(block.id, { url: e.target.value })}
            placeholder="https://exemplo.com/imagem.png"
            className="mb-2"
          />
          <Input
            value={block.alt ?? ''}
            onChange={(e) => onUpdate(block.id, { alt: e.target.value })}
            placeholder="Texto alternativo (opcional)"
          />
        </>
      );
    case 'button':
      return (
        <>
          <span className="mb-1 block text-xs font-medium text-gray-500">Botão</span>
          <Input
            value={block.label}
            onChange={(e) => onUpdate(block.id, { label: e.target.value })}
            placeholder="Texto do botão"
            className="mb-2"
          />
          <Input
            value={block.href}
            onChange={(e) => onUpdate(block.id, { href: e.target.value })}
            placeholder="https://destino-do-link.com"
          />
        </>
      );
    case 'divider':
      return <span className="block py-2 text-xs text-gray-400">Divisor (linha horizontal)</span>;
    case 'spacer':
      return (
        <>
          <span className="mb-1 block text-xs font-medium text-gray-500">
            Espaçador (altura em px)
          </span>
          <Input
            type="number"
            min={0}
            value={block.height ?? 24}
            onChange={(e) => onUpdate(block.id, { height: Number(e.target.value) || 0 })}
            className="w-32"
          />
        </>
      );
    default:
      return null;
  }
}
