import { useMemo, useState } from 'react';
import { BookMarked, Search, Trash2 } from 'lucide-react';
import type { Book, VocabularyWord } from '../types/reading';
import { formatPtBrDate } from '../utils/readingStats';

interface VocabularyViewProps {
  books: Book[];
  vocabulary: VocabularyWord[];
  onDeleteWord: (wordId: string) => void;
  onSelectBook: (bookId: string) => void;
}

export function VocabularyView({
  books,
  vocabulary,
  onDeleteWord,
  onSelectBook,
}: VocabularyViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBookId, setSelectedBookId] = useState<string>('all');

  const bookMap = useMemo(() => {
    const map = new Map<string, Book>();
    for (const book of books) {
      map.set(book.id, book);
    }
    return map;
  }, [books]);

  const booksWithWords = useMemo(() => {
    const ids = new Set(vocabulary.map((w) => w.bookId));
    return books.filter((b) => ids.has(b.id));
  }, [books, vocabulary]);

  const filteredWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vocabulary.filter((item) => {
      if (selectedBookId !== 'all' && item.bookId !== selectedBookId) {
        return false;
      }
      if (!q) return true;
      const bookTitle = bookMap.get(item.bookId)?.title.toLowerCase() ?? '';
      return (
        item.word.toLowerCase().includes(q) ||
        item.definicao.toLowerCase().includes(q) ||
        item.sinonimos.some((s) => s.toLowerCase().includes(q)) ||
        bookTitle.includes(q)
      );
    });
  }, [vocabulary, selectedBookId, searchQuery, bookMap]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#111111]">
          Vocabulário
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          {vocabulary.length === 0
            ? 'Todas as palavras difíceis salvas nos seus livros aparecerão reunidas aqui.'
            : `${vocabulary.length} ${
                vocabulary.length === 1 ? 'palavra salva' : 'palavras salvas'
              } em seu glossário pessoal`}
        </p>
      </div>

      {/* Search & Book Filter */}
      {vocabulary.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <label htmlFor="vocabulary-search" className="sr-only">
              Buscar palavra no vocabulário
            </label>
            <input
              id="vocabulary-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar palavra, definição ou sinônimo..."
              className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white pl-10 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none"
            />
          </div>

          <div className="sm:w-64">
            <label htmlFor="vocabulary-book-filter" className="sr-only">
              Filtrar por livro
            </label>
            <select
              id="vocabulary-book-filter"
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-[#111111] focus:border-[#111111] focus:outline-none cursor-pointer"
            >
              <option value="all">Todas as obras ({vocabulary.length})</option>
              {booksWithWords.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Empty State */}
      {vocabulary.length === 0 ? (
        <section
          aria-label="Vocabulário vazio"
          className="rounded-xl border border-neutral-200 bg-white px-6 py-12 sm:py-16 text-center"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-[#FAFAFA] text-[#111111]">
            <BookMarked className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
          </div>
          <h2 className="mt-5 font-editorial text-xl font-semibold text-[#111111]">
            Seu glossário ainda está vazio
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 leading-relaxed">
            Abra qualquer livro da sua estante e acesse a aba{' '}
            <strong className="font-semibold text-[#111111]">Palavras Difíceis</strong> para
            consultar significados no Dicio, Aulete, Michaelis e Priberam e salvar termos para
            revisão.
          </p>
        </section>
      ) : filteredWords.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <p className="text-sm text-neutral-600">
            Nenhuma palavra encontrada para os filtros atuais.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWords.map((item) => {
            const book = bookMap.get(item.bookId);
            return (
              <article
                key={item.id}
                className="rounded-xl border border-neutral-200 bg-white p-5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <h2 className="font-editorial text-xl font-semibold text-[#111111]">
                        {item.word}
                      </h2>
                      {item.classe && (
                        <span className="text-xs italic text-neutral-500">{item.classe}</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
                      {book ? (
                        <button
                          type="button"
                          onClick={() => onSelectBook(book.id)}
                          className="font-medium text-neutral-700 hover:text-[#111111] hover:underline underline-offset-2 text-left cursor-pointer"
                        >
                          {book.title}
                        </button>
                      ) : (
                        <span>Obra removida</span>
                      )}
                      {item.fonte && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{item.fonte}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{formatPtBrDate(item.createdAt)}</span>
                    </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
