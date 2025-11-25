import { Tag } from "../types";

const STORAGE_KEY = "tags";

// Cores pré-definidas para tags
export const TAG_COLORS = [
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
];

export function getAllTags(): Tag[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao buscar tags:", error);
    return [];
  }
}

export function getTagById(id: string): Tag | undefined {
  const tags = getAllTags();
  return tags.find((tag) => tag.id === id);
}

export function createTag(tag: Omit<Tag, "id" | "createdAt">): Tag {
  const tags = getAllTags();
  
  // Verificar se já existe tag com mesmo nome
  const existingTag = tags.find(
    (t) => t.name.toLowerCase() === tag.name.toLowerCase()
  );
  
  if (existingTag) {
    throw new Error("Já existe uma tag com este nome");
  }

  const newTag: Tag = {
    ...tag,
    id: `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };

  tags.push(newTag);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
  
  return newTag;
}

export function updateTag(id: string, updates: Partial<Tag>): Tag {
  const tags = getAllTags();
  const index = tags.findIndex((tag) => tag.id === id);

  if (index === -1) {
    throw new Error("Tag não encontrada");
  }

  // Verificar nome único se estiver atualizando o nome
  if (updates.name) {
    const existingTag = tags.find(
      (t) => t.id !== id && t.name.toLowerCase() === updates.name!.toLowerCase()
    );
    if (existingTag) {
      throw new Error("Já existe uma tag com este nome");
    }
  }

  tags[index] = { ...tags[index], ...updates };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
  
  return tags[index];
}

export function deleteTag(id: string): void {
  const tags = getAllTags();
  const filteredTags = tags.filter((tag) => tag.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredTags));
}

export function getLeadsByTag(tagId: string): number[] {
  try {
    const stored = localStorage.getItem("leads");
    if (!stored) return [];

    const leads = JSON.parse(stored);
    return leads
      .filter((lead: any) => lead.tags && lead.tags.includes(tagId))
      .map((lead: any) => lead.id);
  } catch (error) {
    console.error("Erro ao buscar leads por tag:", error);
    return [];
  }
}

export function getTagUsageCount(tagId: string): number {
  return getLeadsByTag(tagId).length;
}


