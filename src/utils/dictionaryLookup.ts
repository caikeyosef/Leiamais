import type { DictionarySourceId } from '../types/reading';
import {
  type DictionaryEntry,
  type MergedDictionaryResponse,
  mergeDictionaryEntries,
  normalizeDicioSlug,
  parseAuleteHtml,
  parseDicioHtml,
  parseDicionarioAbertoJson,
  parseMichaelisHtml,
  parsePriberamHtml,
  parseWiktionaryPtJson,
  stripAccents,
} from './dictionaryParsers';

const REQUEST_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

async function fetchTextWithTimeout(
  url: string,
  timeoutMs = 5500,
  includeServerHeaders = true
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: includeServerHeaders ? REQUEST_HEADERS : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFromDicio(word: string): Promise<DictionaryEntry | null> {
  const slug = normalizeDicioSlug(word);
  if (!slug) return null;
  const { ok, text } = await fetchTextWithTimeout(`https://www.dicio.com.br/${slug}/`);
  if (!ok || !text) return null;
  return parseDicioHtml(text, word);
}

async function fetchFromMichaelis(
  word: string,
  includeServerHeaders = true
): Promise<DictionaryEntry | null> {
  const encoded = encodeURIComponent(word.trim().toLowerCase());
  if (!encoded) return null;
  const { ok, text } = await fetchTextWithTimeout(
    `https://michaelis.uol.com.br/moderno-portugues/busca/portugues-brasileiro/${encoded}/`,
    5500,
    includeServerHeaders
  );
  if (!ok || !text) return null;
  return parseMichaelisHtml(text, word);
}

async function fetchFromAulete(word: string): Promise<DictionaryEntry | null> {
  const encoded = encodeURIComponent(word.trim().toLowerCase());
  if (!encoded) return null;
  const { ok, text } = await fetchTextWithTimeout(`https://www.aulete.com.br/${encoded}`);
  if (!ok || !text) return null;
  return parseAuleteHtml(text, word);
}

async function fetchFromPriberam(word: string): Promise<DictionaryEntry | null> {
  const encoded = encodeURIComponent(word.trim().toLowerCase());
  if (!encoded) return null;
  const { ok, text } = await fetchTextWithTimeout(`https://dicionario.priberam.org/${encoded}`);
  if (!ok || !text) return null;
  return parsePriberamHtml(text, word);
}

async function fetchFromDicionarioAberto(
  word: string,
  includeServerHeaders = true
): Promise<DictionaryEntry | null> {
  const clean = word.trim().toLowerCase();
  if (!clean) return null;
  const { ok, text } = await fetchTextWithTimeout(
    `https://api.dicionario-aberto.net/word/${encodeURIComponent(clean)}`,
    5000,
    includeServerHeaders
  );
  if (!ok || !text) return null;
  try {
    return parseDicionarioAbertoJson(JSON.parse(text), word);
  } catch {
    return null;
  }
}

async function fetchFromWiktionaryPt(
  word: string,
  includeServerHeaders = true
): Promise<DictionaryEntry | null> {
  const clean = word.trim().toLowerCase();
  if (!clean) return null;
  const url = `https://pt.wiktionary.org/w/api.php?action=parse&page=${encodeURIComponent(
    clean
  )}&prop=wikitext&format=json&origin=*`;
  const { ok, text } = await fetchTextWithTimeout(url, 5000, includeServerHeaders);
  if (!ok || !text) return null;
  try {
    return parseWiktionaryPtJson(JSON.parse(text), word);
  } catch {
    return null;
  }
}

/**
 * Server-side multi-dictionary aggregator (Express server.ts & Vercel /api/dictionary.ts).
 * Queries Dicio, Michaelis, Aulete, and Priberam in parallel, handles accented retries,
 * and falls back to Dicionário Aberto and Wikcionário if needed.
 */
export async function lookupDictionaryServerSide(
  rawWord: string,
  source: DictionarySourceId = 'auto'
): Promise<MergedDictionaryResponse | null> {
  const word = rawWord.trim();
  if (!word) return null;

  const [dicioRes, michaelisRes, auleteRes, priberamRes] = await Promise.allSettled([
    fetchFromDicio(word),
    fetchFromMichaelis(word, true),
    fetchFromAulete(word),
    fetchFromPriberam(word),
  ]);

  const entries: DictionaryEntry[] = [];
  for (const res of [dicioRes, michaelisRes, auleteRes, priberamRes]) {
    if (res.status === 'fulfilled' && res.value) {
      entries.push(res.value);
    }
  }

  // If user typed without accents (e.g. "efemero") and Dicio/Michaelis/Aulete found the
  // canonical accented form ("efêmero"), retry Priberam when specifically requested or missing
  const canonicalAccented = entries.find(
    (e) => e.palavra.toLowerCase() !== word.toLowerCase() && stripAccents(e.palavra) === stripAccents(word)
  )?.palavra;

  if (canonicalAccented && !entries.some((e) => e.sourceId === 'priberam')) {
    const priberamRetry = await fetchFromPriberam(canonicalAccented);
    if (priberamRetry) {
      entries.push(priberamRetry);
    }
  }

  // If user requested a specific dictionary that did not find the word directly,
  // try the canonical accented word on that specific dictionary once before falling back.
  if (
    source !== 'auto' &&
    !entries.some((e) => e.sourceId === source) &&
    canonicalAccented
  ) {
    const retry =
      source === 'aulete'
        ? await fetchFromAulete(canonicalAccented)
        : source === 'michaelis'
          ? await fetchFromMichaelis(canonicalAccented, true)
          : source === 'dicio'
            ? await fetchFromDicio(canonicalAccented)
            : null;
    if (retry) {
      entries.push(retry);
    }
  }

  if (entries.length > 0) {
    return mergeDictionaryEntries(entries, source);
  }

  // Secondary fallback: Dicionário Aberto & Wikcionário PT
  const [daRes, wikiRes] = await Promise.allSettled([
    fetchFromDicionarioAberto(word, true),
    fetchFromWiktionaryPt(word, true),
  ]);
  for (const res of [daRes, wikiRes]) {
    if (res.status === 'fulfilled' && res.value) {
      entries.push(res.value);
    }
  }

  return mergeDictionaryEntries(entries, 'auto');
}

/**
 * Client-side CORS-enabled fallback (runs directly in the browser if /api/dictionary
 * is unavailable, e.g. on purely static deployments).
 * Uses Michaelis On-line (CORS *), Wikcionário PT (CORS *), and Dicionário Aberto (CORS *).
 */
export async function lookupDictionaryBrowserFallback(
  rawWord: string,
  source: DictionarySourceId = 'auto'
): Promise<MergedDictionaryResponse | null> {
  const word = rawWord.trim();
  if (!word) return null;

  const [michaelisRes, wikiRes, daRes] = await Promise.allSettled([
    fetchFromMichaelis(word, false),
    fetchFromWiktionaryPt(word, false),
    fetchFromDicionarioAberto(word, false),
  ]);

  const entries: DictionaryEntry[] = [];
  for (const res of [michaelisRes, wikiRes, daRes]) {
    if (res.status === 'fulfilled' && res.value) {
      entries.push(res.value);
    }
  }

  // Retry Dicionário Aberto / Wikcionário with canonical accented headword discovered by Michaelis
  const canonicalAccented = entries.find(
    (e) => e.palavra.toLowerCase() !== word.toLowerCase() && stripAccents(e.palavra) === stripAccents(word)
  )?.palavra;

  if (canonicalAccented && entries.length === 1 && entries[0].sourceId === 'michaelis') {
    const [wikiRetry, daRetry] = await Promise.allSettled([
      fetchFromWiktionaryPt(canonicalAccented, false),
      fetchFromDicionarioAberto(canonicalAccented, false),
    ]);
    for (const res of [wikiRetry, daRetry]) {
      if (res.status === 'fulfilled' && res.value) {
        entries.push(res.value);
      }
    }
  }

  return mergeDictionaryEntries(entries, source);
}
