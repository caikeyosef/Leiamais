export type BookStatus = 'reading' | 'completed';

export type NavigationTab = 'estante' | 'desempenho' | 'vocabulario';

export type BookSubTab = 'progresso' | 'notas' | 'palavras';

export interface Book {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  createdAt: string; // ISO string
  completedAt?: string; // YYYY-MM-DD
  notesSynthesis?: string;
  notesSynthesisAt?: string; // ISO string
}

export interface ReadingNote {
  id: string;
  bookId: string;
  content: string;
  page: number;
  createdAt: string; // ISO string
}

export type DictionarySourceId = 'auto' | 'dicio' | 'aulete' | 'michaelis' | 'priberam';

export interface VocabularyWord {
  id: string;
  bookId: string;
  word: string;
  definicao: string;
  sinonimos: string[];
  exemplo: string;
  fonte?: string;
  classe?: string;
  createdAt: string; // ISO string
}

export interface AppData {
  books: Book[];
  notes: ReadingNote[];
  vocabulary: VocabularyWord[];
  readDates: string[]; // Unique YYYY-MM-DD strings
  annualGoal: number;
}
