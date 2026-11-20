import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeHtmlEntities,
  mergeDictionaryEntries,
  normalizeDicioSlug,
  parseAuleteHtml,
  parseDicioHtml,
  parseDicionarioAbertoJson,
  parseMichaelisHtml,
  parsePriberamHtml,
  parseWiktionaryPtJson,
} from './dictionaryParsers';

test('normalizeDicioSlug strips Portuguese accents and whitespace cleanly', () => {
  assert.equal(normalizeDicioSlug('Oblíquo'), 'obliquo');
  assert.equal(normalizeDicioSlug('  Efêmero  '), 'efemero');
  assert.equal(normalizeDicioSlug('Resiliência'), 'resiliencia');
  assert.equal(normalizeDicioSlug('guarda-chuva'), 'guarda-chuva');
});

test('decodeHtmlEntities decodes Portuguese named and numeric entities', () => {
  assert.equal(
    decodeHtmlEntities('A&ccedil;&atilde;o &eacute; &ldquo;obl&iacute;qua&rdquo; &#8212; fim.'),
    'Ação é “oblíqua” — fim.'
  );
});

test('parseDicioHtml extracts headword, class, definitions, synonyms, and example', () => {
  const html = `
    <html><body>
      <h1>oblíquo <sg-speech-button text="oblíquo">Ouvir</sg-speech-button></h1>
      <p class="significado textonovo">
        <span class="cl">adjetivo</span>
        <span>Que não se pode definir nem como perpendicular nem como paralelo; inclinado.</span>
        <span><span class="tag">[Por Extensão]</span> Que não se apresenta de maneira reta; torto.</span>
      </p>
      <p class="adicional sinonimos">
        Oblíquo é sinônimo de: <a href="/diagonal/">diagonal</a>, <a href="/inclinado/">inclinado</a>, <a href="/transversal/">transversal</a>
      </p>
      <div class="frases">
        <div class="frase">
          O raio incidiu em um ângulo <strong>oblíquo</strong> sobre o salão. <em>Folha de S.Paulo</em>
        </div>
      </div>
    </body></html>
  `;

  const entry = parseDicioHtml(html, 'obliquo');
  assert.ok(entry);
  assert.equal(entry.palavra, 'oblíquo');
  assert.equal(entry.classe, 'adjetivo');
  assert.equal(entry.fonte, 'Dicio');
  assert.match(entry.definicao, /inclinado/);
  assert.deepEqual(entry.sinonimos, ['diagonal', 'inclinado', 'transversal']);
  assert.equal(entry.exemplo, 'O raio incidiu em um ângulo oblíquo sobre o salão.');
});

test('parseMichaelisHtml extracts headword, class, definitions, and usage example without trailing colon-dot', () => {
  const html = `
    <div>
      <E1>oblíquo</E1><br><Es>o·blí·quo</Es><br><br><Cg>adj</Cg><br>
      <AcN>1</AcN> Inclinado sobre uma superfície; que não é perpendicular ou reto: <Eu>Os raios de sol oblíquos incidiam sobre as flores.</Eu><br>
      <AcN>2</AcN> Que não é reto ou direito; torto, vesgo:<br>
    </div>
  `;

  const entry = parseMichaelisHtml(html, 'obliquo');
  assert.ok(entry);
  assert.equal(entry.palavra, 'oblíquo');
  assert.equal(entry.classe, 'adjetivo');
  assert.equal(entry.fonte, 'Michaelis');
  assert.match(entry.definicao, /Inclinado sobre uma superfície/);
  assert.ok(!entry.definicao.includes(':.'));
  assert.equal(entry.exemplo, 'Os raios de sol oblíquos incidiam sobre as flores.');
});

test('parseAuleteHtml accepts exact accent-folded match, splits concatenated senses, and rejects not-found pages', () => {
  const validAccentFoldedHtml = `
    <h2><span id="nocab">efêmero</span></h2>
    <textarea id="copy">Não foi encontrado o verbete "efemero". Na ordem alfabética o verbete mais próximo do pesquisado ? efêmero(e.fê.me.ro)a.1. Que dura pouco (glória efêmera); TRANSITÓRIO [ Antôn.: perene. ]2. Que dura um dia.3. Bot. Diz-se da flor que murcha.</textarea>
  `;
  const entry = parseAuleteHtml(validAccentFoldedHtml, 'efemero');
  assert.ok(entry);
  assert.equal(entry.palavra, 'efêmero');
  assert.equal(entry.classe, 'adjetivo');
  assert.equal(entry.fonte, 'Aulete');
  assert.match(entry.definicao, /Que dura pouco/);
  assert.ok(!entry.definicao.includes('3. Bot.'));
  assert.deepEqual(entry.sinonimos, ['transitório']);
  assert.equal(entry.exemplo, 'glória efêmera');

  const notFoundHtml = `
    <h2><span id="nocab">  </span></h2>
    <textarea id="copy">Não foi encontrado o verbete "xyznaexiste123". Na ordem alfabética o verbete mais próximo do pesquisado ? 1 2 3</textarea>
  `;
  assert.equal(parseAuleteHtml(notFoundHtml, 'xyznaexiste123'), null);
});

test('parsePriberamHtml extracts definitions, deduplicates variant tags, and extracts inline synonyms', () => {
  const html = `
    <html>
      <head>
        <meta name="description" content="Significado de casmurro, adjetivo: Que ou quem costuma teimar — Dicionário Priberam" />
      </head>
      <body>
        <h1><strong>Significado de casmurro</strong></h1>
        <div class="py-4 dp-definicao-linha">
          <span class="h6">1. </span>
          <span class="def">Que ou quem costuma teimar ou insistir numa ideia.</span> =
          <span class="dp-versaletes"><span class="def"><small>CABEÇUDO, TEIMOSO</small></span></span>
        </div>
        <div class="py-4 dp-definicao-linha">
          <span class="h6">2. </span>
          <span class="varpt">[Figurado]</span> <span class="varpb">[Figurado]</span>
          <span class="def">Que ou quem tem tendência para se isolar.</span> =
          <span class="dp-versaletes"><span class="def"><small>SORUMBÁTICO</small></span></span>
        </div>
      </body>
    </html>
  `;

  const entry = parsePriberamHtml(html, 'casmurro');
  assert.ok(entry);
  assert.equal(entry.palavra, 'casmurro');
  assert.equal(entry.classe, 'adjetivo');
  assert.equal(entry.fonte, 'Priberam');
  assert.match(entry.definicao, /costuma teimar/);
  assert.ok(!entry.definicao.includes('[Figurado] [Figurado]'));
  assert.deepEqual(entry.sinonimos, ['cabeçudo', 'teimoso', 'sorumbático']);
});

test('parseDicionarioAbertoJson and parseWiktionaryPtJson extract fallback definitions', () => {
  const da = parseDicionarioAbertoJson(
    [
      {
        word: 'efêmero',
        xml: '<entry><gramGrp>adj.</gramGrp><def>Que dura um só dia ou pouco tempo.</def></entry>',
      },
    ],
    'efêmero'
  );
  assert.ok(da);
  assert.equal(da.fonte, 'Dicionário Aberto');
  assert.equal(da.definicao, 'Que dura um só dia ou pouco tempo.');

  const wiki = parseWiktionaryPtJson(
    {
      parse: {
        title: 'oblíquo',
        wikitext: {
          '*': '={{-pt-}}=\n==Adjetivo==\n# Que está [[inclinado]]; não perpendicular.\n#: O olhar oblíquo denunciou a dúvida.\n===Sinônimos===\n* [[diagonal]]\n* [[inclinado]]\n',
        },
      },
    },
    'oblíquo'
  );
  assert.ok(wiki);
  assert.equal(wiki.fonte, 'Wikcionário');
  assert.equal(wiki.classe, 'adjetivo');
  assert.equal(wiki.exemplo, 'O olhar oblíquo denunciou a dúvida.');
  assert.deepEqual(wiki.sinonimos, ['diagonal', 'inclinado']);
});

test('mergeDictionaryEntries respects preferred source and enriches missing fields from peers', () => {
  const priberamEntry = {
    palavra: 'oblíquo',
    classe: 'adjetivo',
    definicao: 'Não perpendicular, não vertical.',
    sinonimos: ['inclinado'],
    exemplo: '',
    fonte: 'Priberam',
    sourceId: 'priberam' as const,
  };
  const michaelisEntry = {
    palavra: 'oblíquo',
    classe: 'adjetivo',
    definicao: 'Inclinado sobre uma superfície.',
    sinonimos: [],
    exemplo: 'Os raios de sol oblíquos incidiam sobre as flores.',
    fonte: 'Michaelis',
    sourceId: 'michaelis' as const,
  };
  const dicioEntry = {
    palavra: 'oblíquo',
    classe: 'adjetivo',
    definicao: 'Que não é perpendicular nem paralelo.',
    sinonimos: ['diagonal', 'transversal'],
    exemplo: 'Ângulo oblíquo.',
    fonte: 'Dicio',
    sourceId: 'dicio' as const,
  };

  const mergedPriberam = mergeDictionaryEntries([dicioEntry, michaelisEntry, priberamEntry], 'priberam');
  assert.ok(mergedPriberam);
  assert.equal(mergedPriberam.fonte, 'Priberam');
  assert.equal(mergedPriberam.definicao, 'Não perpendicular, não vertical.');
  // Enriched with synonyms and example from peers
  assert.deepEqual(mergedPriberam.sinonimos, ['inclinado', 'diagonal', 'transversal']);
  assert.equal(mergedPriberam.exemplo, 'Ângulo oblíquo.');
  assert.deepEqual(mergedPriberam.fontesDisponiveis, ['Dicio', 'Michaelis', 'Priberam']);

  const mergedAuto = mergeDictionaryEntries([priberamEntry, michaelisEntry, dicioEntry], 'auto');
  assert.ok(mergedAuto);
  assert.equal(mergedAuto.fonte, 'Dicio');
});
