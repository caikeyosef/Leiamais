import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DictionarySourceId } from '../src/types/reading';
import { lookupDictionaryServerSide } from '../src/utils/dictionaryLookup';

const VALID_SOURCES = new Set<DictionarySourceId>([
  'auto',
  'dicio',
  'aulete',
  'michaelis',
  'priberam',
]);

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', statusCode === 200 ? 's-maxage=86400, stale-while-revalidate=604800' : 'no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Método não permitido.' });
    return;
  }

  const parsedUrl = new URL(req.url ?? '/', 'http://localhost');
  const word = (parsedUrl.searchParams.get('word') ?? '').trim();
  const rawSource = (parsedUrl.searchParams.get('source') ?? 'auto').trim().toLowerCase() as DictionarySourceId;
  const source: DictionarySourceId = VALID_SOURCES.has(rawSource) ? rawSource : 'auto';

  if (!word) {
    sendJson(res, 400, { error: 'Digite uma palavra para consultar.' });
    return;
  }

  if (word.length > 80) {
    sendJson(res, 400, { error: 'Informe apenas uma palavra ou expressão curta.' });
    return;
  }

  try {
    const result = await lookupDictionaryServerSide(word, source);
    if (!result) {
      sendJson(res, 404, {
        error: `Não encontramos "${word}" nas bases do Dicio, Aulete, Michaelis ou Priberam. Verifique a grafia ou salve manualmente.`,
      });
      return;
    }

    sendJson(res, 200, result);
  } catch {
    sendJson(res, 502, {
      error: 'Não foi possível consultar os dicionários no momento. Tente novamente ou salve manualmente.',
    });
  }
}
