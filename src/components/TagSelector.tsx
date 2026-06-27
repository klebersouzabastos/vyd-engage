import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { X, Plus } from 'lucide-react';
import { Tag } from '../types';
import { useTags } from '../contexts/TagsContext';
import { TAG_COLORS } from '../utils/tags';
import { TagBadge } from './TagBadge';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface TagSelectorProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  placeholder?: string;
}

export function TagSelector({
  selectedTagIds,
  onChange,
  placeholder = 'Selecione ou crie tags...',
}: TagSelectorProps) {
  const { tags, createTag } = useTags();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedTags = tags.filter((tag) => selectedTagIds.includes(tag.id));
  const filteredTags = tags.filter(
    (tag) =>
      !selectedTagIds.includes(tag.id) && tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTagToggle = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
    setSearchQuery('');
  };

  const handleCreateTag = () => {
    if (!newTagName.trim()) return;

    try {
      const newTag = createTag({
        name: newTagName.trim(),
        color: newTagColor,
      });
      onChange([...selectedTagIds, newTag.id]);
      setNewTagName('');
      setSearchQuery('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar tag');
    }
  };

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="space-y-2">
      {/* Tags selecionadas */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg bg-gray-100 min-h-[42px]">
          {selectedTags.map((tag) => (
            <TagBadge
              key={tag.id}
              tag={tag}
              showRemove
              onRemove={() => handleTagToggle(tag.id)}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Seletor de tags */}
      <div className="relative w-full" ref={dropdownRef}>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Plus size={16} className="mr-2" />
          {placeholder}
        </Button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg z-50">
            <div className="p-3 border-b border-gray-300">
              <Input
                ref={inputRef}
                placeholder="Buscar tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Lista de tags disponíveis */}
            {filteredTags.length > 0 && (
              <div className="max-h-48 overflow-y-auto p-2">
                {filteredTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      handleTagToggle(tag.id);
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors flex items-center gap-2"
                  >
                    <TagBadge tag={tag} size="sm" />
                  </button>
                ))}
              </div>
            )}

            {/* Criar nova tag */}
            <div className="p-3 border-t border-gray-300 space-y-2">
              <p className="text-sm font-medium text-gray-900">Criar nova tag</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateTag();
                      setIsOpen(false);
                    }
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={() => {
                    handleCreateTag();
                    setIsOpen(false);
                  }}
                  size="sm"
                  className="bg-primary hover:bg-primary-dark"
                >
                  Criar
                </Button>
              </div>
              <div className="flex gap-1 flex-wrap">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewTagColor(color)}
                    className={`
                      w-6 h-6 rounded-full border-2 transition-all
                      ${newTagColor === color ? 'border-gray-900 scale-110' : 'border-gray-300'}
                    `}
                    style={{ backgroundColor: color }}
                    aria-label={`Selecionar cor ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
