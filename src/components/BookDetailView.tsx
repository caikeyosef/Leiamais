import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Book, BookSubTab, ReadingNote, VocabularyWord } from '../types/reading';
import { calculateBookProgress, formatPtBrDate } from '../utils/readingStats';
import { defineWordWithAI, synthesizeNotesWithAI } from '../utils/api';
import { BookCover } from './BookCover';

interface BookDetailViewProps {
  book: Book;
  notes: ReadingNote[];
  words: VocabularyWord[];
  onBack: () => void;
  onUpdatePage: (bookId: string, nextPage: number) => void;
  onUpdateTotalPages: (bookId: string, totalPages: number) => void;
  onCompleteBook: (bookId: string) => void;
  onReopenBook: (bookId: string) => void;
  onDeleteBook: (bookId: string) => void;
  onAddNote: (bookId: string, content: string) => void;
  onDeleteNote: (noteId: string) => void;
  onSaveNotesSynthesis: (bookId: string, synthesis: string) => void;
  onAddWord: (
    bookId: string,
    payload: { word: string; definicao: string; sinonimos: string[]; exemplo: string }
  ) => void;
  onDeleteWord: (wordId: string) => void;
}

export function BookDetailView({
  book,
  notes,
  words,
  onBack,
  onUpdatePage,
  onUpdateTotalPages,
  onCompleteBook,
  onReopenBook,
  onDeleteBook,
  onAddNote,
  onDeleteNote,
  onSaveNotesSynthesis,
  onAddWord,
  onDeleteWord,
}: BookDetailViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<BookSubTab>('progresso');

  // Progress controls
  const [pageInput, setPageInput] = useState(String(book.currentPage));
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalPagesInput, setTotalPagesInput] = useState(String(book.totalPages));
  const [confirmDeleteBook, setConfirmDeleteBook] = useState(false);

  // Notes controls
  const [noteDraft, setNoteDraft] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // Vocabulary controls
  const [wordDraft, setWordDraft] = useState('');
  const [isDefiningWord, setIsDefiningWord] = useState(false);
  const [wordError, setWordError] = useState<string | null>(null);
  const [manualWordMode, setManualWordMode] = useState(false);
  const [manualDef, setManualDef] = useState('');
  const [manualSynonyms, setManualSynonyms] = useState('');
  const [manualExample, setManualExample] = useState('');

  useEffect(() => {
    setPageInput(String(book.currentPage));
    setTotalPagesInput(String(book.totalPages));
  }, [book.currentPage, book.totalPages]);

  const { clampedCurrent, percentage, remainingPages } = calculateBookProgress(
    book.currentPage,
    book.totalPages
  );
  const isCompleted = book.status === 'completed';

  const commitPageValue = (rawValue: string) => {
    const parsed = Number.parseInt(rawValue, 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(book.currentPage));
      return;
    }
    const clamped = Math.max(0, Math.min(book.totalPages, parsed));
    setPageInput(String(clamped));
    if (clamped !== book.currentPage) {
      onUpdatePage(book.id, clamped);
    }
  };

  const handleQuickIncrement = (delta: number) => {
    const next = Math.min(book.totalPages, book.currentPage + delta);
    setPageInput(String(next));
    onUpdatePage(book.id, next);
  };

  const handleTotalPagesSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(totalPagesInput, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      onUpdateTotalPages(book.id, parsed);
      setEditingTotal(false);
    }
  };

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = noteDraft.trim();
    if (!clean) {
      setNoteError('Escreva uma anotação ou trecho antes de salvar.');
      return;
    }
    onAddNote(book.id, clean);
    setNoteDraft('');
    setNoteError(null);
  };

  const handleSynthesizeNotes = async () => {
    if (notes.length === 0) return;
    setIsSynthesizing(true);
    setSynthesisError(null);
    try {
      const { synthesis } = await synthesizeNotesWithAI(book.title, book.author, notes);
      onSaveNotesSynthesis(book.id, synthesis);
    } catch (err) {
      setSynthesisError(
        err instanceof Error ? err.message : 'Não foi possível sintetizar suas reflexões agora.'
      );
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleWordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWord = wordDraft.trim();
    if (!cleanWord) {
      setWordError('Digite uma palavra para salvar.');
      return;
    }

    if (manualWordMode) {
      const cleanDef = manualDef.trim();
      if (!cleanDef) {
        setWordError('Informe uma definição curta para salvar manualmente.');
        return;
      }
      onAddWord(book.id, {
        word: cleanWord,
        definicao: cleanDef,
        sinonimos: manualSynonyms
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3),
        exemplo: manualExample.trim(),
      });
      setWordDraft('');
      setManualDef('');
      setManualSynonyms('');
      setManualExample('');
      setWordError(null);
      return;
    }

    setIsDefiningWord(true);
    setWordError(null);
    try {
      const result = await defineWordWithAI(cleanWord, book.title, book.author);
      onAddWord(book.id, {
        word: cleanWord,
        definicao: result.definicao,
        sinonimos: result.sinonimos,
        exemplo: result.exemplo,
      });
      setWordDraft('');
    } catch (err) {
      setWordError(
        err instanceof Error
          ? err.message
          : 'Não foi possível buscar a definição com IA agora. Você pode alternar para o modo manual offline.'
      );
    } finally {
      setIsDefiningWord(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] -ml-2 px-2 text-sm font-medium text-neutral-600 hover:text-[#111111] transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          <span>Voltar para a estante</span>
        </button>

        {!confirmDeleteBook ? (
          <button
            type="button"
            onClick={() => setConfirmDeleteBook(true)}
            aria-label={`Remover livro ${book.title}`}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-red-700 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-600">Remover obra?</span>
            <button
              type="button"
              onClick={() => onDeleteBook(book.id)}
              className="min-h-[36px] px-3 py-1 rounded-md bg-red-700 text-xs font-medium text-white hover:bg-red-800 cursor-pointer"
            >
              Excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteBook(false)}
              className="min-h-[36px] px-2.5 py-1 text-xs font-medium text-neutral-600 hover:text-[#111111] cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Book Header Summary */}
      <header className="flex items-start gap-5 border-b border-neutral-200 pb-6">
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} size="lg" />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="font-editorial text-2xl sm:text-3xl font-semibold text-[#111111] leading-tight text-balance">
            {book.title}
          </h1>
          <p className="text-sm sm:text-base text-neutral-600">{book.author}</p>
          <div className="pt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500 font-mono tabular-nums">
            <span>{book.totalPages} páginas</span>
            <span aria-hidden="true">·</span>
            <span>{isCompleted ? 'Concluído' : 'Lendo agora'}</span>
            {isCompleted && book.completedAt && (
              <>
                <span aria-hidden="true">·</span>
                <span>{formatPtBrDate(book.completedAt)}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 3 Sub-tabs */}
      <div
        role="tablist"
        aria-label="Seções do livro"
        className="flex items-center border-b border-neutral-200 gap-6 overflow-x-auto"
      >
        {(
          [
            { id: 'progresso', label: 'Progresso' },
            { id: 'notas', label: `Diário / Notas (${notes.length})` },
            { id: 'palavras', label: `Palavras Difíceis (${words.length})` },
          ] as const
        ).map((tab) => {
          const selected = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActiveSubTab(tab.id)}
              className={`relative min-h-[44px] pb-3 pt-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selected ? 'text-[#111111]' : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              {tab.label}
              {selected && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#111111]"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Sub-tab 1: Progresso */}
      {activeSubTab === 'progresso' && (
        <section aria-label="Progresso de leitura" className="space-y-6">
          <div className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 space-y-6">
            {/* Large Progress Readout */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <p className="font-editorial text-4xl sm:text-5xl font-semibold text-[#111111] tabular-nums">
                    {isCompleted ? '100%' : `${percentage}%`}
                  </p>
                  <p className="mt-1 text-xs sm:text-sm text-neutral-600">
                    {isCompleted
                      ? `Leitura concluída${book.completedAt ? ` em ${formatPtBrDate(book.completedAt)}` : ''}`
                      : remainingPages === 1
                        ? 'Falta 1 página para concluir'
                        : `Faltam ${remainingPages} páginas para concluir`}
                  </p>
                </div>

                <div className="text-right font-mono tabular-nums">
                  <p className="text-base sm:text-lg font-medium text-[#111111]">
                    {isCompleted ? book.totalPages : clampedCurrent} / {book.totalPages}
                  </p>
                  <p className="text-xs text-neutral-500">páginas lidas</p>
                </div>
              </div>

              <div
                className="h-3 w-full overflow-hidden rounded-full bg-neutral-200"
                role="progressbar"
                aria-valuenow={isCompleted ? 100 : percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Barra de progresso do livro"
              >
                <div
                  className="h-full w-full origin-left bg-[#111111] transition-transform duration-150 ease-out"
                  style={{ transform: `scaleX(${(isCompleted ? 100 : percentage) / 100})` }}
                />
              </div>
            </div>

            {/* Page Update Controls */}
            <div className="border-t border-neutral-200 pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    commitPageValue(pageInput);
                  }}
                  className="flex-1 space-y-1.5"
                >
                  <label htmlFor="current-page-input" className="block text-xs font-medium text-neutral-700">
                    Página atual
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="current-page-input"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={book.totalPages}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onBlur={() => commitPageValue(pageInput)}
                      className="w-32 min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-base font-mono tabular-nums text-[#111111] focus:border-[#111111] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Atualizar
                    </button>
                  </div>
                </form>

                {/* Quick Increment Buttons */}
                <div className="space-y-1.5">
                  <span className="block text-xs font-medium text-neutral-700">Avanço rápido</span>
                  <div className="flex items-center gap-2">
                    {[5, 10, 20].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => handleQuickIncrement(step)}
                        disabled={book.currentPage >= book.totalPages}
                        className="min-h-[44px] min-w-[56px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm font-mono font-medium text-[#111111] hover:border-[#111111] hover:bg-[#111111] hover:text-white disabled:opacity-40 disabled:pointer-events-none transition-colors tabular-nums cursor-pointer"
                      >
                        +{step}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Edit total pages inline */}
              <div className="pt-2">
                {!editingTotal ? (
                  <button
                    type="button"
                    onClick={() => setEditingTotal(true)}
                    className="text-xs text-neutral-500 underline underline-offset-4 hover:text-[#111111] cursor-pointer"
                  >
                    Ajustar total de páginas ({book.totalPages})
                  </button>
                ) : (
                  <form onSubmit={handleTotalPagesSave} className="flex flex-wrap items-center gap-2">
                    <label htmlFor="edit-total-pages" className="text-xs text-neutral-600">
                      Total de páginas:
                    </label>
                    <input
                      id="edit-total-pages"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={totalPagesInput}
                      onChange={(e) => setTotalPagesInput(e.target.value)}
                      className="w-24 min-h-[38px] rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-mono tabular-nums text-[#111111] focus:border-[#111111] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="min-h-[38px] rounded-md bg-[#111111] px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800 cursor-pointer"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTotalPagesInput(String(book.totalPages));
                        setEditingTotal(false);
                      }}
                      className="min-h-[38px] px-2 text-xs text-neutral-600 hover:text-[#111111] cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Complete / Reopen Action */}
            <div className="border-t border-neutral-200 pt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              {!isCompleted ? (
                <>
                  <p className="text-xs text-neutral-600">
                    Ao concluir, a obra entra nos seus livros concluídos do ano com a data de hoje.
                  </p>
                  <button
                    type="button"
                    onClick={() => onCompleteBook(book.id)}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-[#111111] px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Concluir livro</span>
                  </button>
                </>
              ) : (
                <>
                  <p className="text-xs text-neutral-600">
                    Concluído em {book.completedAt ? formatPtBrDate(book.completedAt) : 'hoje'}.
                  </p>
                  <button
                    type="button"
                    onClick={() => onReopenBook(book.id)}
                    className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-[#111111] hover:bg-neutral-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    <span>Retomar leitura</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Sub-tab 2: Diário / Notas */}
      {activeSubTab === 'notas' && (
        <section aria-label="Diário e notas de leitura" className="space-y-6">
          <form
            onSubmit={handleNoteSubmit}
            className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 space-y-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="reading-note-textarea" className="text-sm font-medium text-[#111111]">
                Nova reflexão ou trecho marcante
              </label>
              <span className="text-xs font-mono text-neutral-500 tabular-nums">
                Página {book.currentPage}
              </span>
            </div>

            <textarea
              id="reading-note-textarea"
              rows={3}
              value={noteDraft}
              onChange={(e) => {
                setNoteDraft(e.target.value);
                if (noteError) setNoteError(null);
              }}
              placeholder="Registre o que leu, ideias que chamou atenção ou uma citação da obra..."
              className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-3 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none resize-y leading-relaxed"
            />

            {noteError && (
              <p role="alert" className="text-xs text-red-700 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{noteError}</span>
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleSynthesizeNotes}
                disabled={notes.length === 0 || isSynthesizing}
                className="inline-flex items-center gap-2 min-h-[44px] rounded-lg border border-neutral-300 bg-white px-4 py-2 text-xs sm:text-sm font-medium text-[#111111] hover:border-[#111111] disabled:opacity-45 disabled:pointer-events-none transition-colors whitespace-nowrap cursor-pointer"
              >
                {isSynthesizing ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                )}
                <span>{isSynthesizing ? 'Sintetizando...' : 'Sintetizar minhas reflexões'}</span>
              </button>

              <button
                type="submit"
                className="min-h-[44px] rounded-lg bg-[#111111] px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer"
              >
                Salvar anotação
              </button>
            </div>
          </form>

          {/* AI Synthesis Error */}
          {synthesisError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3 text-xs text-red-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{synthesisError}</span>
            </div>
          )}

          {/* Saved AI Synthesis */}
          {book.notesSynthesis && (
            <div className="rounded-xl border border-neutral-300 bg-white p-5 sm:p-6 space-y-2.5">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-200 pb-2.5">
                <h2 className="font-editorial text-base font-semibold text-[#111111]">
                  Síntese das suas reflexões
                </h2>
                {book.notesSynthesisAt && (
                  <span className="text-xs text-neutral-500">
                    {formatPtBrDate(book.notesSynthesisAt)}
                  </span>
                )}
              </div>
              <div className="text-sm text-neutral-800 leading-relaxed whitespace-pre-line">
                {book.notesSynthesis}
              </div>
            </div>
          )}

          {/* Notes List */}
          {notes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
              <p className="text-sm text-neutral-600">
                Nenhuma anotação registrada para este livro ainda.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Cada nota salva automaticamente a data e a página em que você está.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <article
                  key={note.id}
                  className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-neutral-500 font-mono tabular-nums flex items-center gap-2">
                      <span>Pág. {note.page}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-sans">{formatPtBrDate(note.createdAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      aria-label={`Excluir anotação da página ${note.page}`}
                      className="min-h-[40px] min-w-[40px] -mr-2 flex items-center justify-center text-neutral-400 hover:text-red-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                  <p className="text-sm text-[#111111] leading-relaxed whitespace-pre-line">
                    {note.content}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Sub-tab 3: Palavras Difíceis (Glossário do Livro) */}
      {activeSubTab === 'palavras' && (
        <section aria-label="Glossário de palavras difíceis do livro" className="space-y-6">
          <form
            onSubmit={handleWordSubmit}
            className="rounded-xl border border-neutral-200 bg-white p-5 sm:p-6 space-y-3.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="difficult-word-input" className="text-sm font-medium text-[#111111]">
                {manualWordMode ? 'Salvar palavra manualmente (offline)' : 'Consultar e salvar no glossário da obra'}
              </label>
              <button
                type="button"
                onClick={() => {
                  setManualWordMode((prev) => !prev);
                  setWordError(null);
                }}
                className="text-xs font-medium text-neutral-600 underline underline-offset-4 hover:text-[#111111] cursor-pointer"
              >
                {manualWordMode ? 'Usar IA (online)' : 'Definir manualmente (offline)'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <input
                id="difficult-word-input"
                type="text"
                value={wordDraft}
                onChange={(e) => {
                  setWordDraft(e.target.value);
                  if (wordError) setWordError(null);
                }}
                placeholder="Digite uma palavra que você não entendeu..."
                disabled={isDefiningWord}
                className="flex-1 min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none disabled:bg-neutral-50"
              />
              {!manualWordMode && (
                <button
                  type="submit"
                  disabled={isDefiningWord}
                  className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg bg-[#111111] px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isDefiningWord ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span>{isDefiningWord ? 'Consultando...' : 'Salvar com IA'}</span>
                </button>
              )}
            </div>

            {manualWordMode && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label htmlFor="manual-word-def" className="block text-xs font-medium text-neutral-700">
                    Definição curta
                  </label>
                  <input
                    id="manual-word-def"
                    type="text"
                    value={manualDef}
                    onChange={(e) => {
                      setManualDef(e.target.value);
                      if (wordError) setWordError(null);
                    }}
                    placeholder="Explique o significado com suas palavras..."
                    className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="manual-word-syn" className="block text-xs font-medium text-neutral-700">
                      Sinônimos (separados por vírgula)
                    </label>
                    <input
                      id="manual-word-syn"
                      type="text"
                      value={manualSynonyms}
                      onChange={(e) => setManualSynonyms(e.target.value)}
                      placeholder="Ex.: indireta, inclinada"
                      className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="manual-word-ex" className="block text-xs font-medium text-neutral-700">
                      Frase de exemplo (opcional)
                    </label>
                    <input
                      id="manual-word-ex"
                      type="text"
                      value={manualExample}
                      onChange={(e) => setManualExample(e.target.value)}
                      placeholder="Ex.: Olhos de cigana oblíqua..."
                      className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="min-h-[44px] rounded-lg bg-[#111111] px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    Salvar palavra
                  </button>
                </div>
              </div>
            )}

            {wordError && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50/70 px-3.5 py-2.5 text-xs text-red-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{wordError}</span>
              </div>
            )}
          </form>

          {words.length === 0 ? (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
              <p className="text-sm text-neutral-600">
                Nenhuma palavra salva para este livro ainda.
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                A IA gera definição clara, sinônimos simples e uma frase de exemplo considerando o contexto da obra.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {words.map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-editorial text-lg font-semibold text-[#111111]">
                        {item.word}
                      </h3>
                      <p className="text-xs text-neutral-500">{formatPtBrDate(item.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteWord(item.id)}
                      aria-label={`Excluir palavra ${item.word}`}
                      className="min-h-[40px] min-w-[40px] -mr-2 -mt-1 flex items-center justify-center text-neutral-400 hover:text-red-700 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  <p className="text-sm text-[#111111] leading-relaxed">{item.definicao}</p>

                  {item.sinonimos.length > 0 && (
                    <p className="text-xs text-neutral-600">
                      <span className="font-medium text-[#111111]">Sinônimos: </span>
                      {item.sinonimos.join(' · ')}
                    </p>
                  )}

                  {item.exemplo && (
                    <p className="border-t border-neutral-100 pt-2.5 font-editorial italic text-sm text-neutral-700 leading-relaxed">
                      &ldquo;{item.exemplo}&rdquo;
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
