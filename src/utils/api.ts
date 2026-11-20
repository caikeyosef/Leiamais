import type { ReadingNote } from '../types/reading';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Sem conexão com o servidor. Verifique sua internet e tente novamente.');
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string' && payload.error.trim()
        ? payload.error
        : 'Não foi possível concluir a análise com IA agora. Tente novamente em instantes.';
    throw new Error(message);
  }

  return payload as T;
}

export interface WordDefinitionResponse {
  definicao: string;
  sinonimos: string[];
  exemplo: string;
}

export function defineWordWithAI(
  word: string,
  bookTitle: string,
  bookAuthor: string
): Promise<WordDefinitionResponse> {
  return postJson<WordDefinitionResponse>('/api/ai/define-word', {
    word,
    bookTitle,
    bookAuthor,
  });
}

export function synthesizeNotesWithAI(
  bookTitle: string,
  bookAuthor: string,
  notes: ReadingNote[]
): Promise<{ synthesis: string }> {
  return postJson<{ synthesis: string }>('/api/ai/synthesize-notes', {
    bookTitle,
    bookAuthor,
    notes: notes.map((n) => ({
      content: n.content,
      page: n.page,
      createdAt: n.createdAt,
    })),
  });
}

export interface ReaderProfilePayload {
  booksCompleted: Array<{ title: string; author: string; totalPages: number }>;
  booksReading: Array<{ title: string; author: string; currentPage: number; totalPages: number }>;
  totalPagesRead: number;
  currentStreak: number;
  bestStreak: number;
  vocabularyCount: number;
  recentWords: string[];
  annualGoal: number;
}

export function analyzeReaderProfileWithAI(
  payload: ReaderProfilePayload
): Promise<{ analysis: string }> {
  return postJson<{ analysis: string }>('/api/ai/reader-profile', payload);
}
