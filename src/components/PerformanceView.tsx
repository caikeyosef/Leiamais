import { useState } from 'react';
import { AlertCircle, Check, Loader2, Pencil, Sparkles } from 'lucide-react';
import type { Book, VocabularyWord } from '../types/reading';
import { calculateAnnualStats, formatPtBrDate } from '../utils/readingStats';
import { analyzeReaderProfileWithAI } from '../utils/api';

interface PerformanceViewProps {
  books: Book[];
  readDates: string[];
  vocabulary: VocabularyWord[];
  annualGoal: number;
  readerProfileAnalysis?: string;
  readerProfileAnalysisAt?: string;
  onUpdateAnnualGoal: (goal: number) => void;
  onSaveReaderProfileAnalysis: (analysis: string) => void;
}

export function PerformanceView({
  books,
  readDates,
  vocabulary,
  annualGoal,
  readerProfileAnalysis,
  readerProfileAnalysisAt,
  onUpdateAnnualGoal,
  onSaveReaderProfileAnalysis,
}: PerformanceViewProps) {
  const stats = calculateAnnualStats(books, readDates, vocabulary, annualGoal);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(annualGoal));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleGoalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(goalInput, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 365) {
      onUpdateAnnualGoal(parsed);
      setEditingGoal(false);
    }
  };

  const handleAnalyzeProfile = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    const booksCompleted = books
      .filter((b) => b.status === 'completed')
      .map((b) => ({ title: b.title, author: b.author, totalPages: b.totalPages }));
    const booksReading = books
      .filter((b) => b.status === 'reading')
      .map((b) => ({
        title: b.title,
        author: b.author,
        currentPage: b.currentPage,
        totalPages: b.totalPages,
      }));

    try {
      const { analysis } = await analyzeReaderProfileWithAI({
        booksCompleted,
        booksReading,
        totalPagesRead: stats.totalPagesRead,
        currentStreak: stats.currentStreak,
        bestStreak: stats.bestStreak,
        vocabularyCount: stats.vocabularyCount,
        recentWords: vocabulary.slice(0, 15).map((v) => v.word),
        annualGoal: stats.annualGoal,
      });
      onSaveReaderProfileAnalysis(analysis);
    } catch (err) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Não foi possível gerar a análise do perfil leitor agora.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#111111]">
          Desempenho
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Métricas reais do seu ritmo de leitura em {stats.currentYear}.
        </p>
      </div>

      {/* 4 Clean Numeric KPI Cards */}
      <section aria-label="Resumo de métricas de leitura" className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
          <p className="text-xs text-neutral-600">Concluídos em {stats.currentYear}</p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-[#111111] tabular-nums">
            {stats.booksCompletedThisYear}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {stats.booksCompletedThisYear === 1 ? 'livro inteiro' : 'livros inteiros'}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
          <p className="text-xs text-neutral-600">Total de páginas lidas</p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-[#111111] tabular-nums">
            {stats.totalPagesRead.toLocaleString('pt-BR')}
          </p>
          <p className="mt-1 text-xs text-neutral-500">acumuladas na estante</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
          <p className="text-xs text-neutral-600">Ofensiva atual / Recorde</p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-[#111111] tabular-nums">
            {stats.currentStreak}
            <span className="text-xl sm:text-2xl font-normal text-neutral-400">
              {' '}
              / {stats.bestStreak}
            </span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">dias consecutivos</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
          <p className="text-xs text-neutral-600">Palavras aprendidas</p>
          <p className="mt-2 font-editorial text-3xl sm:text-4xl font-semibold text-[#111111] tabular-nums">
            {stats.vocabularyCount}
          </p>
          <p className="mt-1 text-xs text-neutral-500">no glossário pessoal</p>
        </div>
      </section>

      {/* Main Highlight: Comparativo com Dados Reais */}
      <section
        aria-labelledby="benchmarks-heading"
        className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-7 space-y-6"
      >
        <div className="border-b border-neutral-200 pb-4">
          <h2
            id="benchmarks-heading"
            className="font-editorial text-2xl font-semibold text-[#111111]"
          >
            Comparativo com dados reais
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            {stats.booksCompletedThisYear === 1 ? (
              <>
                Seu{' '}
                <strong className="font-semibold text-[#111111] tabular-nums">
                  1 livro concluído
                </strong>{' '}
                em {stats.currentYear} comparado a referências reais de leitura anual.
              </>
            ) : (
              <>
                Seus{' '}
                <strong className="font-semibold text-[#111111] tabular-nums">
                  {stats.booksCompletedThisYear} livros concluídos
                </strong>{' '}
                em {stats.currentYear} comparados a referências reais de leitura anual.
              </>
            )}
          </p>
        </div>

        <div className="space-y-6">
          {stats.benchmarks.map((item) => (
            <div key={item.id} className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                <div>
                  <p className="text-sm font-semibold text-[#111111]">{item.summaryText}</p>
                  <p className="text-xs text-neutral-500">
                    {item.label}
                    {item.source ? ` · ${item.source}` : ''}
                  </p>
                </div>
                <span className="font-mono text-xs text-neutral-600 tabular-nums shrink-0">
                  Você: {stats.booksCompletedThisYear} vs.{' '}
                  {String(item.targetBooks).replace('.', ',')}
                </span>
              </div>

              {/* Dual minimalist comparative bars */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="w-16 text-[11px] font-medium text-[#111111] shrink-0">Você</span>
                  <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full w-full origin-left bg-[#111111] transition-transform duration-200 ease-out"
                      style={{
                        transform: `scaleX(${Math.max(stats.booksCompletedThisYear > 0 ? 0.04 : 0, item.userBarPercent / 100)})`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 text-[11px] text-neutral-500 shrink-0">Referência</span>
                  <div className="h-2 flex-1 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full w-full origin-left bg-neutral-400 transition-transform duration-200 ease-out"
                      style={{ transform: `scaleX(${item.benchmarkBarPercent / 100})` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Annual Goal & Projection */}
      <section
        aria-labelledby="annual-goal-heading"
        className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="annual-goal-heading"
              className="font-editorial text-xl font-semibold text-[#111111]"
            >
              Meta anual e projeção
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              {stats.booksCompletedThisYear > 0 ? (
                <>
                  No seu ritmo atual, a projeção é encerrar {stats.currentYear} com{' '}
                  <strong className="font-semibold text-[#111111] tabular-nums">
                    {stats.projectedAnnualBooks}{' '}
                    {stats.projectedAnnualBooks === 1 ? 'livro concluído' : 'livros concluídos'}
                  </strong>
                  .
                </>
              ) : (
                'Conclua seu primeiro livro do ano para calcular sua projeção anual de leitura.'
              )}
            </p>
          </div>

          {!editingGoal ? (
            <button
              type="button"
              onClick={() => {
                setGoalInput(String(stats.annualGoal));
                setEditingGoal(true);
              }}
              className="inline-flex items-center gap-1.5 min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-[#111111] hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span>Editar meta ({stats.annualGoal})</span>
            </button>
          ) : (
            <form onSubmit={handleGoalSubmit} className="flex items-center gap-2">
              <label htmlFor="annual-goal-input" className="sr-only">
                Meta de livros no ano
              </label>
              <input
                id="annual-goal-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="w-20 min-h-[44px] rounded-lg border border-neutral-300 px-3 py-2 text-sm font-mono tabular-nums text-[#111111] focus:border-[#111111] focus:outline-none"
              />
              <button
                type="submit"
                aria-label="Salvar meta anual"
                className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg bg-[#111111] text-white hover:bg-neutral-800 cursor-pointer"
              >
                <Check className="h-4 w-4" strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setEditingGoal(false)}
                className="min-h-[44px] px-2.5 text-xs font-medium text-neutral-600 hover:text-[#111111] cursor-pointer"
              >
                Cancelar
              </button>
            </form>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between text-xs font-mono tabular-nums">
            <span className="text-neutral-600">
              {stats.booksCompletedThisYear} de {stats.annualGoal} livros
            </span>
            <span className="font-semibold text-[#111111]">{stats.goalProgressPercent}%</span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-valuenow={stats.goalProgressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso da meta anual de leitura"
          >
            <div
              className="h-full w-full origin-left bg-[#111111] transition-transform duration-200 ease-out"
              style={{ transform: `scaleX(${stats.goalProgressPercent / 100})` }}
            />
          </div>
        </div>
      </section>

      {/* Gemini Reader Profile Analysis */}
      <section
        aria-labelledby="ai-profile-heading"
        className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2
              id="ai-profile-heading"
              className="font-editorial text-xl font-semibold text-[#111111]"
            >
              Análise do meu perfil leitor
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-neutral-600">
              Leitura editorial gerada por IA com base nas suas obras, constância da ofensiva e vocabulário.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAnalyzeProfile}
            disabled={isAnalyzing}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isAnalyzing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
            <span>{isAnalyzing ? 'Analisando...' : 'Análise do meu perfil leitor'}</span>
          </button>
        </div>

        {analysisError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-xs text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{analysisError}</span>
          </div>
        )}

        {readerProfileAnalysis && (
          <div className="border-t border-neutral-200 pt-4 space-y-2">
            <div className="text-sm text-[#111111] leading-relaxed whitespace-pre-line">
              {readerProfileAnalysis}
            </div>
            {readerProfileAnalysisAt && (
              <p className="text-xs text-neutral-500">
                Atualizado em {formatPtBrDate(readerProfileAnalysisAt)}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
