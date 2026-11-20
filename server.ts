import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      const isRetryable = !status || status >= 500 || status === 429;
      if (!isRetryable || attempt === maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const status = (err as { status?: number })?.status;
  const rawMessage = err instanceof Error ? err.message : String(err);

  if (status === 400 || status === 403 || /API_KEY_INVALID|PERMISSION_DENIED/i.test(rawMessage)) {
    return {
      status: status || 403,
      message: 'Não foi possível autenticar com a API do Gemini. Verifique a chave configurada em Settings > Secrets.',
    };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED/i.test(rawMessage)) {
    return {
      status: 429,
      message: 'Limite temporário da API do Gemini atingido. Aguarde alguns instantes e tente novamente.',
    };
  }
  if (status === 404 || /NOT_FOUND/i.test(rawMessage)) {
    return {
      status: 404,
      message: 'Modelo de IA temporariamente indisponível. Tente novamente em instantes.',
    };
  }
  return {
    status: 502,
    message: 'Não foi possível concluir a solicitação de IA agora. Verifique sua conexão e tente novamente.',
  };
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // 1. Define a difficult word in structured JSON
  app.post('/api/ai/define-word', async (req, res) => {
    const word = typeof req.body?.word === 'string' ? req.body.word.trim() : '';
    const bookTitle = typeof req.body?.bookTitle === 'string' ? req.body.bookTitle.trim() : '';
    const bookAuthor = typeof req.body?.bookAuthor === 'string' ? req.body.bookAuthor.trim() : '';

    if (!word) {
      res.status(400).json({ error: 'Digite uma palavra para consultar.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'A chave da API do Gemini não está configurada no servidor. Configure GEMINI_API_KEY em Settings > Secrets.',
      });
      return;
    }

    const contextLine = bookTitle
      ? `Livro em leitura: "${bookTitle}"${bookAuthor ? `, de ${bookAuthor}` : ''}. Considere o sentido mais provável no contexto desta obra quando aplicável.`
      : '';

    try {
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Explique a palavra ou expressão "${word}" em Português do Brasil.\n${contextLine}`,
          config: {
            systemInstruction:
              'Você é um lexicógrafo editorial brasileiro claro e conciso. Responda exclusivamente em Português do Brasil no formato JSON solicitado. A definição deve ter no máximo 2 frases curtas, diretas e fáceis de entender. Forneça de 2 a 3 sinônimos mais simples e 1 frase curta de exemplo natural.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                definicao: {
                  type: Type.STRING,
                  description: 'Explicação clara, direta e fácil de entender em no máximo 2 frases.',
                },
                sinonimos: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Lista de 2 a 3 sinônimos mais simples equivalentes.',
                },
                exemplo: {
                  type: Type.STRING,
                  description: 'Uma frase curta e clara de exemplo usando a palavra.',
                },
              },
              required: ['definicao', 'sinonimos', 'exemplo'],
            },
          },
        })
      );

      const rawText = (response.text ?? '').trim();
      const parsed = JSON.parse(rawText) as {
        definicao?: string;
        sinonimos?: string[];
        exemplo?: string;
      };

      if (!parsed.definicao || !Array.isArray(parsed.sinonimos) || !parsed.exemplo) {
        res.status(502).json({ error: 'A resposta da IA veio incompleta. Tente novamente.' });
        return;
      }

      res.json({
        definicao: parsed.definicao.trim(),
        sinonimos: parsed.sinonimos
          .map((item) => String(item).trim())
          .filter(Boolean)
          .slice(0, 3),
        exemplo: parsed.exemplo.trim(),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Synthesize user reflections for a book
  app.post('/api/ai/synthesize-notes', async (req, res) => {
    const bookTitle = typeof req.body?.bookTitle === 'string' ? req.body.bookTitle.trim() : '';
    const bookAuthor = typeof req.body?.bookAuthor === 'string' ? req.body.bookAuthor.trim() : '';
    const notes = Array.isArray(req.body?.notes) ? req.body.notes : [];

    if (!bookTitle || notes.length === 0) {
      res.status(400).json({ error: 'Adicione pelo menos uma anotação antes de sintetizar suas reflexões.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'A chave da API do Gemini não está configurada no servidor. Configure GEMINI_API_KEY em Settings > Secrets.',
      });
      return;
    }

    const formattedNotes = notes
      .slice(0, 40)
      .map(
        (n: { page?: number; createdAt?: string; content?: string }, idx: number) =>
          `${idx + 1}. [Página ${n.page ?? 0}] ${String(n.content ?? '').trim()}`
      )
      .join('\n');

    try {
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Livro: "${bookTitle}"${bookAuthor ? ` (${bookAuthor})` : ''}\n\nAnotações do leitor:\n${formattedNotes}\n\nSintetize os principais insights e fios condutores dessas reflexões.`,
          config: {
            systemInstruction:
              'Você é um editor literário minimalista. Escreva em Português do Brasil. Sintetize as anotações do leitor em 1 parágrafo curto de síntese geral (2 a 3 frases) seguido de 3 tópicos curtos iniciados por "• " destacando os insights mais relevantes do próprio leitor. Não use markdown com asteriscos, negrito ou títulos com #.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const synthesis = (response.text ?? '').trim();
      if (!synthesis) {
        res.status(502).json({ error: 'Não foi possível gerar a síntese das reflexões.' });
        return;
      }

      res.json({ synthesis });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Analyze reader profile based on books, streak, and vocabulary
  app.post('/api/ai/reader-profile', async (req, res) => {
    const body = req.body ?? {};
    const booksCompleted = Array.isArray(body.booksCompleted) ? body.booksCompleted : [];
    const booksReading = Array.isArray(body.booksReading) ? body.booksReading : [];
    const totalPagesRead = Number(body.totalPagesRead) || 0;
    const currentStreak = Number(body.currentStreak) || 0;
    const bestStreak = Number(body.bestStreak) || 0;
    const vocabularyCount = Number(body.vocabularyCount) || 0;
    const recentWords = Array.isArray(body.recentWords) ? body.recentWords.slice(0, 15) : [];
    const annualGoal = Number(body.annualGoal) || 12;

    if (booksCompleted.length === 0 && booksReading.length === 0 && totalPagesRead === 0) {
      res.status(400).json({
        error: 'Adicione pelo menos um livro e registre algum progresso para gerar a análise do seu perfil leitor.',
      });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'A chave da API do Gemini não está configurada no servidor. Configure GEMINI_API_KEY em Settings > Secrets.',
      });
      return;
    }

    const completedSummary =
      booksCompleted.length > 0
        ? booksCompleted.map((b: { title: string; author: string }) => `"${b.title}" (${b.author})`).join(', ')
        : 'Nenhum concluído ainda neste ano';

    const readingSummary =
      booksReading.length > 0
        ? booksReading
            .map(
              (b: { title: string; author: string; currentPage: number; totalPages: number }) =>
                `"${b.title}" (${b.author}, pág. ${b.currentPage}/${b.totalPages})`
            )
            .join(', ')
        : 'Nenhum em andamento';

    const prompt = [
      `Dados reais de leitura do usuário:`,
      `- Livros concluídos no ano: ${booksCompleted.length} (Meta anual: ${annualGoal})`,
      `- Obras concluídas: ${completedSummary}`,
      `- Lendo atualmente: ${readingSummary}`,
      `- Total de páginas lidas: ${totalPagesRead}`,
      `- Ofensiva atual: ${currentStreak} dia(s) | Recorde: ${bestStreak} dia(s)`,
      `- Vocabulário acumulado: ${vocabularyCount} palavra(s)${recentWords.length > 0 ? ` (exemplos: ${recentWords.join(', ')})` : ''}`,
      ``,
      `Faça uma análise curta, editorial e encorajadora do perfil leitor desta pessoa.`,
    ].join('\n');

    try {
      const response = await callWithRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            systemInstruction:
              'Você é um curador literário editorial brasileiro. Escreva uma análise concisa e elegante em Português do Brasil (entre 3 e 5 frases, divididas em 2 parágrafos curtos) comentando os padrões de leitura, a constância da ofensiva e o ganho de vocabulário com base exclusivamente nos dados fornecidos. Seja objetivo, humano e sem clichês motivacionais exagerados. Não use markdown (#, **, *).',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        })
      );

      const analysis = (response.text ?? '').trim();
      if (!analysis) {
        res.status(502).json({ error: 'Não foi possível gerar a análise do perfil leitor.' });
        return;
      }

      res.json({ analysis });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`LEIA + server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
