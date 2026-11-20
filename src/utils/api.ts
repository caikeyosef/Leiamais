import type { DictionarySourceId, ReadingNote } from '../types/reading';
import { lookupDictionaryBrowserFallback } from './dictionaryLookup';
import type { MergedDictionaryResponse } from './dictionaryParsers';

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
        : 'Não foi possível concluir a análise agora. Tente novamente em instantes.';
    throw new Error(message);
  }

  return payload as T;
}

export type WordDefinitionResponse = MergedDictionaryResponse;

/**
 * Looks up a Portuguese word in Dicio, Aulete, Michaelis, and Priberam.
 * 1. Calls GET /api/dictionary (works on AI Studio Express & Vercel Serverless Functions).
 * 2. If /api/dictionary is not mounted (e.g., purely static hosting without serverless routes),
 *    transparently falls back directly in the browser to CORS-enabled Portuguese dictionaries
 *    (Michaelis On-line, Wikcionário PT, Dicionário Aberto).
 */
export async function lookupWordInDictionaries(
  word: string,
  source: DictionarySourceId = 'auto'
): Promise<WordDefinitionResponse> {
  const cleanWord = word.trim();
  if (!cleanWord) {
    throw new Error('Digite uma palavra para consultar.');
  }

  const params = new URLSearchParams({ word: cleanWord, source });
  let shouldUseBrowserFallback = false;

  try {
    const response = await fetch(`/api/dictionary?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const contentType = response.headers.get('content-type') ?? '';
    const isJson = contentType.includes('application/json');

    if (response.ok && isJson) {
      const data = (await response.json()) as WordDefinitionResponse;
      if (data && typeof data.definicao === 'string' && data.definicao.trim()) {
        return data;
      }
    }

    if (response.status === 404 && isJson) {
      const errPayload = (await response.json()) as { error?: string };
      throw new Error(
        errPayload.error ||
          `Não encontramos "${cleanWord}" nas bases do Dicio, Aulete, Michaelis ou Priberam.`
      );
    }

    if (response.status === 400 && isJson) {
      const errPayload = (await response.json()) as { error?: string };
      throw new Error(errPayload.error || 'Digite uma palavra válida para consultar.');
    }

    // 404 HTML (static hosting / missing serverless route) or 5xx -> try browser fallback
    shouldUseBrowserFallback = true;
  } catch (err) {
    // Re-throw explicit dictionary "not found" / validation errors from the server JSON
    if (
      err instanceof Error &&
      (err.message.includes('Não encontramos') || err.message.includes('Digite uma palavra'))
    ) {
      throw err;
    }
    shouldUseBrowserFallback = true;
  }

  if (shouldUseBrowserFallback) {
    const browserResult = await lookupDictionaryBrowserFallback(cleanWord, source);
    if (browserResult) {
      return browserResult;
    }
  }

  throw new Error(
    `Não encontramos "${cleanWord}" nas bases consultadas (Dicio, Aulete, Michaelis e Priberam). Verifique a grafia ou salve manualmente.`
  );
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
