import { Comment } from "../types";
import { generateId } from "./id";

const STORAGE_KEY_PREFIX = "lead_comments_";

export function getLeadComments(leadId: number): Comment[] {
  try {
    const key = `${STORAGE_KEY_PREFIX}${leadId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Erro ao buscar comentários:", error);
    return [];
  }
}

export function addComment(
  leadId: number,
  comment: Omit<Comment, "id" | "leadId" | "createdAt">
): Comment {
  const newComment: Comment = {
    ...comment,
    id: generateId(),
    leadId,
    createdAt: new Date().toISOString(),
  };

  const comments = getLeadComments(leadId);
  comments.unshift(newComment);
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${leadId}`, JSON.stringify(comments));

  return newComment;
}

export function updateComment(
  leadId: number,
  commentId: string,
  updates: Partial<Comment>
): Comment | null {
  const comments = getLeadComments(leadId);
  const index = comments.findIndex((c) => c.id === commentId);
  
  if (index === -1) return null;

  const updatedComment: Comment = {
    ...comments[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  comments[index] = updatedComment;
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${leadId}`, JSON.stringify(comments));

  return updatedComment;
}

export function deleteComment(leadId: number, commentId: string): void {
  const comments = getLeadComments(leadId);
  const filtered = comments.filter((c) => c.id !== commentId);
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${leadId}`, JSON.stringify(filtered));
}

export function extractMentions(text: string): string[] {
  const mentionRegex = /@(\w+)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map((m) => m.substring(1)) : [];
}








