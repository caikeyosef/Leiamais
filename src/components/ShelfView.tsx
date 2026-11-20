import { BookOpen, Plus } from 'lucide-react';
import type { Book } from '../types/reading';
import { calculateBookProgress, formatPtBrDate } from '../utils/readingStats';
import { BookCover } from './BookCover';
import { StreakCard } from './StreakCard';

interface ShelfViewProps {
  books: Book[];
  readDates: string[];
  onSelectBook: (bookId: string) => void;
  onOpenAddBook: () => void;
}

function BookRowCard({ book, onSelect }: { book: Book; onSelect: () => void }) {
  const { clampedCurrent, percentage } = calculateBookProgress(book.currentPage, book.totalPages);
  const isCompleted = book.status === 'completed';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group w-full text-left rounded-xl border border-neutral-200 bg-white p-4 sm:p-5 hover:border-neutral-400 transition-colors flex items-start gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
    >
      <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} size="md" />

      <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch py-0.5">
        <div>
          <h3 className="font-editorial text-base sm:text-lg font-semibold text-[#111111] leading-snug line-clamp-2 group-hover:underline decoration-1 underline-offset-4">
            {book.title}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-neutral-600 truncate">{book.author}</p>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between gap-2 text-xs text-neutral-600">
            <span className="font-mono tabular-nums">
              {isCompleted
                ? `${book.totalPages} / ${book.totalPages} págs.`
                : `${clampedCurrent} / ${book.totalPages} págs.`}
            </span>
            <span className="font-mono tabular-nums font-medium text-[#111111]">
              {isCompleted ? '100%' : `${percentage}%`}
            </span>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
            role="progressbar"
            aria-valuenow={isCompleted ? 100 : percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progresso de leitura de ${book.title}`}
          >
            <div
              className="h-full w-full origin-left bg-[#111111] transition-transform duration-150 ease-out"
              style={{ transform: `scaleX(${(isCompleted ? 100 : percentage) / 100})` }}
            />
          </div>

          {isCompleted && book.completedAt && (
            <p className="text-[11px] text-neutral-500 pt-0.5">
              Concluído em {formatPtBrDate(book.completedAt)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function ShelfView({ books, readDates, onSelectBook, onOpenAddBook }: ShelfViewProps) {
  const readingBooks = books.filter((b) => b.status === 'reading');
  const completedBooks = books.filter((b) => b.status === 'completed');

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#111111]">
            Estante
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {books.length === 0
              ? 'Seu espaço editorial para acompanhar leituras, reflexões e vocabulário.'
              : `${readingBooks.length} em leitura · ${completedBooks.length} ${
                  completedBooks.length === 1 ? 'concluído' : 'concluídos'
                }`}
          </p>
        </div>

        {books.length > 0 && (
          <button
            type="button"
            onClick={onOpenAddBook}
            className="hidden sm:inline-flex items-center gap-2 min-h-[44px] rounded-lg bg-[#111111] px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span>Novo Livro</span>
          </button>
        )}
      </div>

      {/* Daily Streak Block */}
      <StreakCard readDates={readDates} />

      {/* Empty State */}
      {books.length === 0 ? (
        <section
          aria-label="Estante vazia"
          className="rounded-xl border border-neutral-200 bg-white px-6 py-12 sm:px-10 sm:py-16 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-[#FAFAFA] text-[#111111]">
            <BookOpen className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-editorial text-2xl font-semibold text-[#111111] text-balance">
            Sua estante está pronta para o primeiro livro
          </h2>
          <p className="mx-auto mt-2.5 max-w-md text-sm text-neutral-600 leading-relaxed">
            Cadastre sua primeira obra, registre suas páginas diárias, guarde reflexões e construa
            seu glossário pessoal com consulta direta a dicionários de português.
          </p>
          <div className="mt-7">
            <button
              type="button"
              onClick={onOpenAddBook}
              className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-lg bg-[#111111] px-6 py-3 text-sm font-medium text-white hover:bg-neutral-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              <span>Adicionar primeiro livro</span>
            </button>
          </div>
        </section>
      ) : (
        <div className="space-y-10">
          {/* Lendo agora */}
          <section aria-labelledby="section-reading-now" className="space-y-4">
            <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2.5">
              <h2
                id="section-reading-now"
                className="font-editorial text-xl font-semibold text-[#111111]"
              >
                Lendo agora
              </h2>
              <span className="font-mono text-xs text-neutral-500 tabular-nums">
                {readingBooks.length}
              </span>
            </div>

            {readingBooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-5 py-7 text-center">
                <p className="text-sm text-neutral-600">Nenhum livro em andamento no momento.</p>
                <button
                  type="button"
                  onClick={onOpenAddBook}
                  className="mt-3 inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-xs font-medium text-[#111111] border border-neutral-300 rounded-lg hover:bg-neutral-50 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                  <span>Começar uma nova leitura</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {readingBooks.map((book) => (
                  <BookRowCard
                    key={book.id}
                    book={book}
                    onSelect={() => onSelectBook(book.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Concluídos */}
          {completedBooks.length > 0 && (
            <section aria-labelledby="section-completed" className="space-y-4">
              <div className="flex items-baseline justify-between border-b border-neutral-200 pb-2.5">
                <h2
                  id="section-completed"
                  className="font-editorial text-xl font-semibold text-[#111111]"
                >
                  Concluídos
                </h2>
                <span className="font-mono text-xs text-neutral-500 tabular-nums">
                  {completedBooks.length}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {completedBooks.map((book) => (
                  <BookRowCard
                    key={book.id}
                    book={book}
                    onSelect={() => onSelectBook(book.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
