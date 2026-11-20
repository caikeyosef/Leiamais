import type { DictionarySourceId } from '../types/reading';

export interface DictionaryEntry {
  palavra: string;
  classe?: string;
  definicao: string;
  sinonimos: string[];
  exemplo: string;
  fonte: string;
  sourceId: Exclude<DictionarySourceId, 'auto'> | 'dicionario-aberto' | 'wikcionario';
}

export interface MergedDictionaryResponse {
  palavra: string;
  classe?: string;
  definicao: string;
  sinonimos: string[];
  exemplo: string;
  fonte: string;
  fontesDisponiveis: string[];
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  aacute: 'á',
  Aacute: 'Á',
  agrave: 'à',
  Agrave: 'À',
  acirc: 'â',
  Acirc: 'Â',
  atilde: 'ã',
  Atilde: 'Ã',
  eacute: 'é',
  Eacute: 'É',
  ecirc: 'ê',
  Ecirc: 'Ê',
  iacute: 'í',
  Iacute: 'Í',
  oacute: 'ó',
  Oacute: 'Ó',
  ocirc: 'ô',
  Ocirc: 'Ô',
  otilde: 'õ',
  Otilde: 'Õ',
  uacute: 'ú',
  Uacute: 'Ú',
  uuml: 'ü',
  Uuml: 'Ü',
  ccedil: 'ç',
  Ccedil: 'Ç',
  ordm: 'º',
  ordf: 'ª',
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_m, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-zA-Z]+);/g, (full, name: string) => NAMED_ENTITIES[name] ?? full);
}

export function stripHtml(input: string): string {
  return decodeHtmlEntities(
    input
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

export function stripAccents(word: string): string {
  return word
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeDicioSlug(word: string): string {
  return stripAccents(word)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function cleanDefinitionText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/^[\d.\-\s]+/, '')
    .trim();
}

function dedupeSynonyms(list: string[], headword: string): string[] {
  const normalizedHead = stripAccents(headword);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of list) {
    const clean = raw
      .replace(/[.;:()[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!clean || clean.length < 2 || clean.length > 36) continue;
    const norm = stripAccents(clean);
    if (norm === normalizedHead || seen.has(norm)) continue;
    seen.add(norm);
    result.push(clean);
    if (result.length >= 4) break;
  }

  return result;
}

function formatGrammarClass(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  const abbrevMap: Record<string, string> = {
    'adj': 'adjetivo',
    'adj.': 'adjetivo',
    'a.': 'adjetivo',
    'sm': 'substantivo masculino',
    's.m.': 'substantivo masculino',
    'sf': 'substantivo feminino',
    's.f.': 'substantivo feminino',
    's.2g.': 'substantivo de dois gêneros',
    'adj+sm': 'adjetivo e substantivo masculino',
    'adj m+f': 'adjetivo',
    'v': 'verbo',
    'v.': 'verbo',
    'vtd': 'verbo transitivo direto',
    'vti': 'verbo transitivo indireto',
    'vi': 'verbo intransitivo',
    'adv': 'advérbio',
    'adv.': 'advérbio',
    'prep': 'preposição',
    'conj': 'conjunção',
    'interj': 'interjeição',
    'pron': 'pronome',
  };
  return abbrevMap[cleaned] ?? cleaned;
}

/**
 * Parser for Dicio (https://www.dicio.com.br/<slug>/)
 */
export function parseDicioHtml(html: string, queryWord: string): DictionaryEntry | null {
  const sigMatch = html.match(/<p[^>]*class="[^"]*significado[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  if (!sigMatch) return null;

  const sigBody = sigMatch[1];

  // Extract headword from <h1>
  let palavra = queryWord.trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const cleanH1 = stripHtml(
      h1Match[1].replace(/<sg-speech-button[\s\S]*?<\/sg-speech-button>/gi, '')
    );
    if (cleanH1 && cleanH1.length <= 60) {
      palavra = cleanH1;
    }
  }

  // Extract grammar class <span class="cl">
  const clMatch = sigBody.match(/<span[^>]*class="[^"]*\bcl\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
  const classe = clMatch ? formatGrammarClass(stripHtml(clMatch[1])) : undefined;

  // Remove class spans and etymology spans, then pull top 2 definition spans
  const cleanedBody = sigBody
    .replace(/<span[^>]*class="[^"]*\b(?:cl|etim)\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<span[^>]*class="[^"]*\btag\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi, '$1 ');

  const spanMatches = [...cleanedBody.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)];
  const senses: string[] = [];

  for (const m of spanMatches) {
    const txt = cleanDefinitionText(stripHtml(m[1]));
    if (txt.length >= 6 && !/^etimologia/i.test(txt)) {
      senses.push(txt);
    }
    if (senses.length >= 2) break;
  }

  if (senses.length === 0) {
    const fallback = cleanDefinitionText(stripHtml(cleanedBody));
    if (fallback.length >= 6) {
      senses.push(fallback);
    }
  }

  if (senses.length === 0) return null;

  // Extract synonyms from <p class="adicional sinonimos">
  const synBlock = html.match(/<p[^>]*class="[^"]*sinonimos[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
  const rawSynonyms: string[] = [];
  if (synBlock) {
    for (const aMatch of synBlock[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)) {
      rawSynonyms.push(stripHtml(aMatch[1]));
    }
  }

  // Extract first usage example from <div class="frases"><div class="frase">
  let exemplo = '';
  const fraseMatch = html.match(/<div[^>]*class="[^"]*\bfrase\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (fraseMatch) {
    const withoutSource = fraseMatch[1].replace(/<em[^>]*>[\s\S]*?<\/em>/gi, '');
    const cleanEx = stripHtml(withoutSource);
    if (cleanEx.length >= 10 && cleanEx.length <= 260) {
      exemplo = cleanEx;
    }
  }

  return {
    palavra,
    classe,
    definicao: senses.join(' '),
    sinonimos: dedupeSynonyms(rawSynonyms, palavra),
    exemplo,
    fonte: 'Dicio',
    sourceId: 'dicio',
  };
}

/**
 * Parser for Michaelis On-line (https://michaelis.uol.com.br/moderno-portugues/busca/portugues-brasileiro/<palavra>/)
 */
export function parseMichaelisHtml(html: string, queryWord: string): DictionaryEntry | null {
  const e1Match = html.match(/<E1>([\s\S]*?)<\/E1>/i);
  if (!e1Match) return null;

  const palavra = stripHtml(e1Match[1]) || queryWord.trim();
  const entryStart = html.indexOf(e1Match[0]);
  const entrySlice = html.slice(entryStart, entryStart + 6000);

  const cgMatch = entrySlice.match(/<Cg>([\s\S]*?)<\/Cg>/i);
  const classe = cgMatch ? formatGrammarClass(stripHtml(cgMatch[1])) : undefined;

  // Extract usage example from <Eu>...</Eu>
  let exemplo = '';
  const euMatch = entrySlice.match(/<Eu>([\s\S]*?)<\/Eu>/i);
  if (euMatch) {
    const cleanEu = stripHtml(euMatch[1]);
    if (cleanEu.length >= 8 && cleanEu.length <= 240) {
      exemplo = cleanEu;
    }
  }

  // Split senses by <AcN>N</AcN>
  const senseParts = entrySlice.split(/<AcN>\s*\d+\s*<\/AcN>/i).slice(1);
  const senses: string[] = [];

  for (const part of senseParts) {
    // Cut at next section break (<br><br>, </div, <E1>, <Etim>, <Sm>, etc.)
    const cut = part.split(/<br\s*\/?>|<\/div>|<E1>|<Et>|<Sm>/i)[0] ?? '';
    // Remove example tags and literary citations from definition text
    const defOnly = cut
      .replace(/<Eu>[\s\S]*?<\/Eu>/gi, '')
      .replace(/<AbT>[\s\S]*?<\/AbT>/gi, '')
      .replace(/<AbF>[\s\S]*?<\/AbF>/gi, '')
      .replace(/<Ra>([\s\S]*?)<\/Ra>/gi, '[$1] ');
    const clean = cleanDefinitionText(stripHtml(defOnly)).replace(/[:;.\s]+$/, '');
    if (clean.length >= 6) {
      senses.push(`${clean}.`);
    }
    if (senses.length >= 2) break;
  }

  // Fallback for single-sense entries without <AcN>
  if (senses.length === 0 && cgMatch) {
    const afterCg = entrySlice.slice(entrySlice.indexOf(cgMatch[0]) + cgMatch[0].length);
    const firstChunk = afterCg.split(/<br\s*\/?>\s*<br\s*\/?>|<\/div>|<Et>/i)[0] ?? '';
    const clean = cleanDefinitionText(
      stripHtml(
        firstChunk
          .replace(/<Eu>[\s\S]*?<\/Eu>/gi, '')
          .replace(/<AbT>[\s\S]*?<\/AbT>/gi, '')
          .replace(/<AbF>[\s\S]*?<\/AbF>/gi, '')
      )
    ).replace(/[:;.\s]+$/, '');
    if (clean.length >= 6) {
      senses.push(`${clean}.`);
    }
  }

  if (senses.length === 0) return null;

  // Michaelis often lists trailing synonyms separated by semicolons/commas at the end of a sense
  const rawSynonyms: string[] = [];
  const firstSenseParts = senses[0].split(';');
  if (firstSenseParts.length >= 2) {
    const tail = firstSenseParts[firstSenseParts.length - 1];
    if (tail.split(' ').length <= 6) {
      for (const candidate of tail.split(',')) {
        const trimmed = candidate.replace(/[.:\s]+$/g, '').trim();
        if (trimmed && !trimmed.includes(' ')) {
          rawSynonyms.push(trimmed);
        }
      }
    }
  }

  return {
    palavra,
    classe,
    definicao: senses.join(' '),
    sinonimos: dedupeSynonyms(rawSynonyms, palavra),
    exemplo,
    fonte: 'Michaelis',
    sourceId: 'michaelis',
  };
}

/**
 * Parser for iDicionário Aulete (https://www.aulete.com.br/<palavra>)
 */
export function parseAuleteHtml(html: string, queryWord: string): DictionaryEntry | null {
  const copyMatch = html.match(/<textarea[^>]*id="copy"[^>]*>([\s\S]*?)<\/textarea>/i);
  if (!copyMatch) return null;

  const rawText = decodeHtmlEntities(copyMatch[1]).trim();
  if (!rawText) return null;

  const nocabMatch = html.match(/<span[^>]*id="nocab"[^>]*>([\s\S]*?)<\/span>/i);
  const nocab = nocabMatch ? stripHtml(nocabMatch[1]) : '';

  const notFoundPrefix = /Não foi encontrado o verbete/i.test(rawText);
  if (notFoundPrefix) {
    // Only accept Aulete's nearest entry if it's the exact accent-folded match (e.g. efemero -> efêmero)
    if (!nocab || stripAccents(nocab) !== stripAccents(queryWord)) {
      return null;
    }
  }

  const palavra = nocab || queryWord.trim();

  // Strip "Não foi encontrado... ? <headword>" header if present
  let body = rawText.replace(/^Não foi encontrado[\s\S]*?\?\s*/i, '').trim();
  // Remove leading headword + syllabification "(o.blí.quo)"
  body = body.replace(/^[^(\n]{0,40}\([^)]+\)\s*/i, '').trim();

  // Extract optional leading grammar class abbreviation like "a.", "sm.", "sf.", "v."
  let classe: string | undefined;
  const classMatch = body.match(/^((?:s\.?[mf]\.|s\.?2g\.|a\.|adj\.|v\.|adv\.)(?:\s*e\s*(?:s\.?[mf]\.|a\.|adj\.))?)\s*/i);
  if (classMatch) {
    classe = formatGrammarClass(classMatch[1]);
    body = body.slice(classMatch[0].length).trim();
  }

  // Remove bracketed annotations like [ Antôn.: perene. ] or [Cf.: ...] BEFORE splitting senses
  body = body.replace(/\[[^\]]*\]/g, ' ').trim();

  // Extract numbered definitions "1. ...2. ...3. ..." (Aulete often omits spaces before sense numbers)
  const numberedChunks = body
    .split(/(?=(?:^|[\s.)\]a-zA-ZáéíóúâêôãõçÁÉÍÓÚÂÊÔÃÕÇ])\d+\.\s)/)
    .map((c) => c.trim())
    .filter(Boolean);
  const senses: string[] = [];
  const rawSynonyms: string[] = [];
  let exemplo = '';

  for (const chunk of numberedChunks) {
    // Strip any trailing grammar transition marker like "sm." before splitting next sense
    const matchStart = chunk.search(/\d+\.\s/);
    if (matchStart === -1 && numberedChunks.length > 1) continue;
    let line = (matchStart >= 0 ? chunk.slice(matchStart) : chunk)
      .replace(/^\d+\.\s*/, '')
      .replace(/\b(?:s\.?[mf]\.|s\.?2g\.|adj\.|v\.)\s*$/i, '')
      .trim();

    // Extract ALL-CAPS synonyms after semicolons (Aulete convention: "; INCLINADO", "; TRANSITÓRIO")
    const capsSynMatches = [...line.matchAll(/;\s*([A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,}(?:[\s,;-]+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})*)/g)];
    for (const m of capsSynMatches) {
      for (const s of m[1].split(/[;,]+/)) {
        const t = s.trim();
        if (t && !t.includes(' ')) rawSynonyms.push(t.toLowerCase());
      }
      line = line.replace(m[0], '').trim();
    }

    // Extract parenthetical usage example like "(linha oblíqua)" or "(glória efêmera)"
    if (!exemplo) {
      const parenEx = line.match(/\(([^()]{5,90})\)/);
      if (parenEx && !/^p\.?\s*ex/i.test(parenEx[1])) {
        exemplo = parenEx[1].trim();
      }
    }

    const clean = cleanDefinitionText(line).replace(/[:;.\s]+$/, '');
    if (clean.length >= 6) {
      senses.push(`${clean}.`);
    }
    if (senses.length >= 2) break;
  }

  if (senses.length === 0) return null;

  return {
    palavra,
    classe,
    definicao: senses.join(' '),
    sinonimos: dedupeSynonyms(rawSynonyms, palavra),
    exemplo,
    fonte: 'Aulete',
    sourceId: 'aulete',
  };
}

/**
 * Parser for Dicionário Priberam (https://dicionario.priberam.org/<palavra>)
 */
export function parsePriberamHtml(html: string, queryWord: string): DictionaryEntry | null {
  const lineMatches = [
    ...html.matchAll(/<div[^>]*class="[^"]*dp-definicao-linha[^"]*"[^>]*>([\s\S]*?)<\/div>/gi),
  ];
  if (lineMatches.length === 0) return null;

  // Headword from <h1><strong>Significado de X</strong></h1>
  let palavra = queryWord.trim();
  const h1Match = html.match(/<h1[^>]*>[\s\S]*?Significado de\s+([^<]+)/i);
  if (h1Match) {
    const clean = stripHtml(h1Match[1]);
    if (clean) palavra = clean;
  }

  // Grammar category
  const catMatch = html.match(/<div[^>]*class="[^"]*varpt[^"]*"[^>]*>[\s\S]*?<span[^>]*class="[^"]*categoria[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    ?? html.match(/<meta[^>]*name="description"[^>]*content="Significado de [^,]+,\s*([^:]+):/i);
  const classe = catMatch ? formatGrammarClass(stripHtml(catMatch[1])) : undefined;

  const senses: string[] = [];
  const rawSynonyms: string[] = [];
  let exemplo = '';

  for (const m of lineMatches) {
    const inner = m[1];

    // Extract synonyms inside dp-versaletes or after " = "
    const synSpan = inner.match(/<span[^>]*class="[^"]*dp-versaletes[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (synSpan) {
      const synText = stripHtml(synSpan[1]);
      for (const s of synText.split(/[,;]+/)) {
        if (s.trim()) rawSynonyms.push(s.trim());
      }
    }

    // Extract example inside <span class="ex"> or <i> if present
    if (!exemplo) {
      const exMatch = inner.match(/<span[^>]*class="[^"]*\bex\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      if (exMatch) {
        const exText = stripHtml(exMatch[1]);
        if (exText.length >= 8 && exText.length <= 220) {
          exemplo = exText;
        }
      }
    }

    const plain = stripHtml(
      inner
        .replace(/<span[^>]*class="[^"]*dp-versaletes[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
        .replace(/<span[^>]*class="[^"]*\bvarpt\b[^"]*"[^>]*>[\s\S]*?<\/span>/gi, '')
    )
      .replace(/^\d+\.\s*/, '')
      .replace(/(\[[^\]]+\])\s*\1+/g, '$1')
      .replace(/\s*=\s*$/, '')
      .replace(/\s*\.\s*=\s*.*$/, '.')
      .replace(/[:;.\s]+$/, '')
      .trim();

    if (plain.length >= 6) {
      senses.push(`${plain}.`);
    }
    if (senses.length >= 2) break;
  }

  if (senses.length === 0) return null;

  return {
    palavra,
    classe,
    definicao: senses.join(' '),
    sinonimos: dedupeSynonyms(rawSynonyms, palavra),
    exemplo,
    fonte: 'Priberam',
    sourceId: 'priberam',
  };
}

/**
 * Fallback parser for Dicionário Aberto API (CORS: *)
 */
export function parseDicionarioAbertoJson(
  payload: unknown,
  queryWord: string
): DictionaryEntry | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const first = payload[0] as { word?: string; xml?: string };
  if (!first || typeof first.xml !== 'string') return null;

  const palavra = (first.word || queryWord).trim();
  const gramMatch = first.xml.match(/<gramGrp>([\s\S]*?)<\/gramGrp>/i);
  const classe = gramMatch ? formatGrammarClass(stripHtml(gramMatch[1])) : undefined;

  const defMatches = [...first.xml.matchAll(/<def>([\s\S]*?)<\/def>/gi)];
  const senses: string[] = [];
  for (const m of defMatches) {
    const clean = cleanDefinitionText(stripHtml(m[1]));
    if (clean.length >= 6) {
      senses.push(clean.endsWith('.') ? clean : `${clean}.`);
    }
    if (senses.length >= 2) break;
  }

  if (senses.length === 0) return null;

  return {
    palavra,
    classe,
    definicao: senses.join(' '),
    sinonimos: [],
    exemplo: '',
    fonte: 'Dicionário Aberto',
    sourceId: 'dicionario-aberto',
  };
}

/**
 * Fallback parser for Wikcionário PT MediaWiki API (CORS: *)
 */
export function parseWiktionaryPtJson(
  payload: unknown,
  queryWord: string
): DictionaryEntry | null {
  const obj = payload as {
    parse?: { title?: string; wikitext?: { '*'?: string } };
  };
  const wikitext = obj?.parse?.wikitext?.['*'];
  if (!wikitext || typeof wikitext !== 'string') return null;

  // Isolate Portuguese section ={{-pt-}}=
  const ptStart = wikitext.search(/=\{\{-pt-\}\}=/i);
  if (ptStart === -1) return null;
  const afterPt = wikitext.slice(ptStart + 10);
  const nextLang = afterPt.search(/\n=\{\{-[a-z-]+-\}\}=/i);
  const ptSection = nextLang === -1 ? afterPt : afterPt.slice(0, nextLang);

  const palavra = (obj.parse?.title || queryWord).trim();
  const classMatch = ptSection.match(/==\s*(Substantivo|Adjetivo|Verbo|Advérbio|Preposição|Conjunção|Interjeição|Pronome)\s*==/i);
  const classe = classMatch ? classMatch[1].toLowerCase() : undefined;

  const lines = ptSection.split('\n');
  const senses: string[] = [];
  const rawSynonyms: string[] = [];
  let exemplo = '';
  let inSynonyms = false;

  for (const line of lines) {
    if (/^={2,4}\s*Sin[oô]nimos\s*={2,4}/i.test(line)) {
      inSynonyms = true;
      continue;
    }
    if (/^={2,4}/.test(line)) {
      inSynonyms = false;
      continue;
    }

    if (inSynonyms && /^\*/.test(line)) {
      for (const link of line.matchAll(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g)) {
        rawSynonyms.push(link[1]);
      }
      continue;
    }

    if (/^#\s+[^#*:]/i.test(line) && senses.length < 2) {
      const cleaned = line
        .replace(/^#\s+/, '')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length >= 6) {
        senses.push(cleaned.endsWith('.') ? cleaned : `${cleaned}.`);
      }
    } else if (/^#:\s*/.test(line) && !exemplo) {
      const ex = line
        .replace(/^#:\s*/, '')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (ex.length >= 8 && ex.length <= 220) {
        exemplo = ex;
      }
    }
  }

  if (senses.length === 0) return null;

  return {
    palavra,
    classe,
    definicao: senses.join(' '),
    sinonimos: dedupeSynonyms(rawSynonyms, palavra),
    exemplo,
    fonte: 'Wikcionário',
    sourceId: 'wikcionario',
  };
}

const DEFAULT_PRIORITY: Array<DictionaryEntry['sourceId']> = [
  'dicio',
  'michaelis',
  'aulete',
  'priberam',
  'dicionario-aberto',
  'wikcionario',
];

export function mergeDictionaryEntries(
  entries: DictionaryEntry[],
  preferredSource: DictionarySourceId = 'auto'
): MergedDictionaryResponse | null {
  if (entries.length === 0) return null;

  let primary: DictionaryEntry | undefined;
  if (preferredSource !== 'auto') {
    primary = entries.find((e) => e.sourceId === preferredSource);
  }
  if (!primary) {
    for (const id of DEFAULT_PRIORITY) {
      const found = entries.find((e) => e.sourceId === id);
      if (found) {
        primary = found;
        break;
      }
    }
  }
  if (!primary) primary = entries[0];

  // Enrich synonyms and example from complementary dictionaries if primary is missing them
  const combinedSynonyms = [...primary.sinonimos];
  let exemplo = primary.exemplo;
  let classe = primary.classe;

  for (const entry of entries) {
    if (entry === primary) continue;
    if (combinedSynonyms.length < 3 && entry.sinonimos.length > 0) {
      combinedSynonyms.push(...entry.sinonimos);
    }
    if (!exemplo && entry.exemplo) {
      exemplo = entry.exemplo;
    }
    if (!classe && entry.classe) {
      classe = entry.classe;
    }
  }

  return {
    palavra: primary.palavra,
    classe,
    definicao: primary.definicao,
    sinonimos: dedupeSynonyms(combinedSynonyms, primary.palavra).slice(0, 4),
    exemplo,
    fonte: primary.fonte,
    fontesDisponiveis: entries.map((e) => e.fonte),
  };
}
