import { useEffect, useMemo, useState } from 'react';
import { BarChart3, BookMarked, BookOpen, Plus } from 'lucide-react';
import type { AppData, Book, NavigationTab, ReadingNote, VocabularyWord } from './types/reading';
import { toLocalDateKey } from './utils/readingStats';
import { createId, loadAppData, recordTodayInReadDates, saveAppData } from './utils/storage';
import { ShelfView } from './components/ShelfView';
import { BookDetailView } from './components/BookDetailView';
import { PerformanceView } from './components/PerformanceView';
import { VocabularyView } from './components/VocabularyView';
import { AddBookModal } from './components/AddBookModal';
import { OfflineIndicator } from './components/PWAInstallButton';

const NAV_ITEMS: Array<{
  id: NavigationTab;
  label: string;
  icon: typeof BookOpen;
}> = [
  { id: 'estante', label: 'Estante', icon: BookOpen },
  { id: 'desempenho', label: 'Desempenho', icon: BarChart3 },
  { id: 'vocabulario', label: 'Vocabulário', icon: BookMarked },
];

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [activeTab, setActiveTab] = useState<NavigationTab>('estante');
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    saveAppData(data);
  }, [data]);

  const selectedBook = useMemo(
    () => (selectedBookId ? data.books.find((b) => b.id === selectedBookId) ?? null : null),
    [data.books, selectedBookId]
  );

  const selectedBookNotes = useMemo(
    () =>
      selectedBook
        ? data.notes
            .filter((n) => n.bookId === selectedBook.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [data.notes, selectedBook]
  );

  const selectedBookWords = useMemo(
    () =>
      selectedBook
        ? data.vocabulary
            .filter((w) => w.bookId === selectedBook.id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [data.vocabulary, selectedBook]
  );

  const sortedVocabulary = useMemo(
    () => [...data.vocabulary].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.vocabulary]
  );

  const handleNavigateTab = (tab: NavigationTab) => {
    setActiveTab(tab);
    setSelectedBookId(null);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  const handleAddBook = (payload: {
    title: string;
    author: string;
    totalPages: number;
    coverUrl?: string;
  }) => {
    const newBook: Book = {
      id: createId('book'),
      title: payload.title,
      author: payload.author,
      coverUrl: payload.coverUrl,
      totalPages: payload.totalPages,
      currentPage: 0,
      status: 'reading',
      createdAt: new Date().toISOString(),
    };

    setData((prev) => ({
      ...prev,
      books: [newBook, ...prev.books],
    }));
    setActiveTab('estante');
    setSelectedBookId(null);
  };

  const handleUpdatePage = (bookId: string, nextPage: number) => {
    const todayKey = toLocalDateKey();
    setData((prev) => ({
      ...prev,
      readDates: recordTodayInReadDates(prev.readDates),
      books: prev.books.map((book) => {
        if (book.id !== bookId) return book;
        const clamped = Math.max(0, Math.min(book.totalPages, nextPage));
        const reachedEnd = clamped >= book.totalPages && book.totalPages > 0;
        return {
          ...book,
          currentPage: clamped,
          status: reachedEnd ? 'completed' : book.status,
          completedAt: reachedEnd ? book.completedAt || todayKey : book.completedAt,
        };
      }),
    }));
  };

  const handleUpdateTotalPages = (bookId: string, totalPages: number) => {
    setData((prev) => ({
      ...prev,
      books: prev.books.map((book) => {
        if (book.id !== bookId) return book;
        const safeTotal = Math.max(1, totalPages);
        const adjustedCurrent = Math.min(book.currentPage, safeTotal);
        return {
          ...book,
          totalPages: safeTotal,
          currentPage: adjustedCurrent,
        };
      }),
    }));
  };

  const handleCompleteBook = (bookId: string) => {
    const todayKey = toLocalDateKey();
    setData((prev) => ({
      ...prev,
      readDates: recordTodayInReadDates(prev.readDates),
      books: prev.books.map((book) =>
        book.id === bookId
          ? {
              ...book,
              currentPage: book.totalPages,
              status: 'completed',
              completedAt: todayKey,
            }
          : book
      ),
    }));
  };

  const handleReopenBook = (bookId: string) => {
    setData((prev) => ({
      ...prev,
      books: prev.books.map((book) =>
        book.id === bookId
          ? {
              ...book,
              status: 'reading',
              completedAt: undefined,
              currentPage:
                book.currentPage >= book.totalPages
                  ? Math.max(0, book.totalPages - 1)
                  : book.currentPage,
            }
          : book
      ),
    }));
  };

  const handleDeleteBook = (bookId: string) => {
    setData((prev) => ({
      ...prev,
      books: prev.books.filter((b) => b.id !== bookId),
      notes: prev.notes.filter((n) => n.bookId !== bookId),
      vocabulary: prev.vocabulary.filter((w) => w.bookId !== bookId),
    }));
    setSelectedBookId(null);
  };

  const handleAddNote = (bookId: string, content: string) => {
    const targetBook = data.books.find((b) => b.id === bookId);
    const newNote: ReadingNote = {
      id: createId('note'),
      bookId,
      content,
      page: targetBook?.currentPage ?? 0,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      readDates: recordTodayInReadDates(prev.readDates),
      notes: [newNote, ...prev.notes],
    }));
  };

  const handleDeleteNote = (noteId: string) => {
    setData((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== noteId),
    }));
  };

  const handleSaveNotesSynthesis = (bookId: string, synthesis: string) => {
    const now = new Date().toISOString();
    setData((prev) => ({
      ...prev,
      books: prev.books.map((book) =>
        book.id === bookId
          ? { ...book, notesSynthesis: synthesis, notesSynthesisAt: now }
          : book
      ),
    }));
  };

  const handleAddWord = (
    bookId: string,
    payload: {
      word: string;
      definicao: string;
      sinonimos: string[];
      exemplo: string;
      fonte?: string;
      classe?: string;
    }
  ) => {
    const newWord: VocabularyWord = {
      id: createId('word'),
      bookId,
      word: payload.word,
      definicao: payload.definicao,
      sinonimos: payload.sinonimos,
      exemplo: payload.exemplo,
      fonte: payload.fonte,
      classe: payload.classe,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({
      ...prev,
      readDates: recordTodayInReadDates(prev.readDates),
      vocabulary: [newWord, ...prev.vocabulary],
    }));
  };

  const handleDeleteWord = (wordId: string) => {
    setData((prev) => ({
      ...prev,
      vocabulary: prev.vocabulary.filter((w) => w.id !== wordId),
    }));
  };

  const handleUpdateAnnualGoal = (annualGoal: number) => {
    setData((prev) => ({
      ...prev,
      annualGoal,
    }));
  };

  return (
    <div className="min-h-dvh bg-[#FAFAFA] text-[#111111] flex flex-col md:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 md:left-0 border-r border-neutral-200 bg-white px-5 py-7 justify-between z-30">
        <div className="space-y-8">
          <div className="px-2">
            <button
              type="button"
              onClick={() => handleNavigateTab('estante')}
              className="font-editorial text-2xl font-bold tracking-tight text-[#111111] whitespace-nowrap cursor-pointer"
            >
              LEIA +
            </button>
          </div>

          <nav aria-label="Navegação principal" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavigateTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center gap-3 min-h-[44px] rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-[#111111] text-white'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-[#111111]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-neutral-200 pt-5">
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-[#111111] hover:border-[#111111] hover:bg-neutral-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span>Novo Livro</span>
          </button>
        </div>
      </aside>

      {/* Mobile Compact Sticky Header */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 safe-top select-none">
        <div className="h-[54px] safe-x flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => handleNavigateTab('estante')}
            className="font-editorial text-xl font-bold tracking-tight text-[#111111] whitespace-nowrap shrink-0 cursor-pointer active:opacity-70"
          >
            LEIA +
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 min-h-[40px] rounded-lg bg-[#111111] px-3.5 py-2 text-xs font-medium text-white hover:bg-neutral-800 active:scale-[0.98] transition-[background-color,transform] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              <span>Novo Livro</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 main-safe-bottom">
        <div className="mx-auto w-full max-w-5xl safe-x py-5 sm:px-8 sm:py-10">
          {selectedBook ? (
            <BookDetailView
              book={selectedBook}
              notes={selectedBookNotes}
              words={selectedBookWords}
              onBack={() => setSelectedBookId(null)}
              onUpdatePage={handleUpdatePage}
              onUpdateTotalPages={handleUpdateTotalPages}
              onCompleteBook={handleCompleteBook}
              onReopenBook={handleReopenBook}
              onDeleteBook={handleDeleteBook}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              onSaveNotesSynthesis={handleSaveNotesSynthesis}
              onAddWord={handleAddWord}
              onDeleteWord={handleDeleteWord}
            />
          ) : activeTab === 'estante' ? (
            <ShelfView
              books={data.books}
              readDates={data.readDates}
              onSelectBook={handleSelectBook}
              onOpenAddBook={() => setIsAddModalOpen(true)}
            />
          ) : activeTab === 'desempenho' ? (
            <PerformanceView
              books={data.books}
              readDates={data.readDates}
              vocabulary={data.vocabulary}
              annualGoal={data.annualGoal}
              onUpdateAnnualGoal={handleUpdateAnnualGoal}
            />
          ) : (
            <VocabularyView
              books={data.books}
              vocabulary={sortedVocabulary}
              onDeleteWord={handleDeleteWord}
              onSelectBook={(id) => {
                setActiveTab('estante');
                handleSelectBook(id);
              }}
            />
          )}
        </div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Navegação inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-neutral-200 bg-white/95 backdrop-blur-md safe-bottom select-none"
      >
        <div className="grid grid-cols-3 h-[60px]">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigateTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 min-h-[48px] transition-colors active:opacity-70 cursor-pointer ${
                  isActive ? 'text-[#111111]' : 'text-neutral-400 hover:text-neutral-700'
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={isActive ? 2.25 : 1.6}
                  aria-hidden="true"
                />
                <span
                  className={`text-[11px] leading-none whitespace-nowrap ${
                    isActive ? 'font-semibold text-[#111111]' : 'font-medium'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Add Book Modal */}
      <AddBookModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddBook={handleAddBook}
      />

      {/* Offline Connectivity Banner */}
      <OfflineIndicator />
    </div>
  );
}
