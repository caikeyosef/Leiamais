import type { Book, VocabularyWord } from '../types/reading';

export interface StreakStats {
  currentStreak: number;
  bestStreak: number;
  readToday: boolean;
}

export interface DayPill {
  dateKey: string;
  weekdayLabel: string;
  dayNumber: number;
  hasRead: boolean;
  isToday: boolean;
}

export interface BookProgressStats {
  clampedCurrent: number;
  percentage: number;
  remainingPages: number;
}

export interface BenchmarkComparison {
  id: 'brasil' | 'global' | 'top10';
  label: string;
  source?: string;
  targetBooks: number;
  summaryText: string;
  isAboveOrEqual: boolean;
  userBarPercent: number;
  benchmarkBarPercent: number;
}

export interface AnnualPerformanceStats {
  currentYear: number;
  booksCompletedThisYear: number;
  totalPagesRead: number;
  currentStreak: number;
  bestStreak: number;
  vocabularyCount: number;
  annualGoal: number;
  goalProgressPercent: number;
  projectedAnnualBooks: number;
  benchmarks: BenchmarkComparison[];
}

const WEEKDAY_SHORT_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function toLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function diffDays(later: Date, earlier: Date): number {
  const utcLater = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const utcEarlier = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((utcLater - utcEarlier) / (1000 * 60 * 60 * 24));
}

function shiftDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

export function normalizeReadDates(readDates: string[]): string[] {
  const validPattern = /^\d{4}-\d{2}-\d{2}$/;
  const unique = new Set<string>();
  for (const raw of readDates) {
    if (typeof raw === 'string' && validPattern.test(raw)) {
      unique.add(raw);
    }
  }
  return Array.from(unique).sort();
}

export function calculateStreak(readDates: string[], today: Date = new Date()): StreakStats {
  const sorted = normalizeReadDates(readDates);
  if (sorted.length === 0) {
    return { currentStreak: 0, bestStreak: 0, readToday: false };
  }

  const todayKey = toLocalDateKey(today);
  const yesterdayKey = toLocalDateKey(shiftDays(today, -1));
  const dateSet = new Set(sorted);
  const readToday = dateSet.has(todayKey);

  // Best streak across entire history
  let bestStreak = 1;
  let running = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = parseDateKey(sorted[i - 1]);
    const curr = parseDateKey(sorted[i]);
    if (diffDays(curr, prev) === 1) {
      running += 1;
      if (running > bestStreak) {
        bestStreak = running;
      }
    } else {
      running = 1;
    }
  }

  // Current active streak (either includes today or continues up to yesterday)
  let currentStreak = 0;
  let cursor: Date | null = null;
  if (readToday) {
    cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } else if (dateSet.has(yesterdayKey)) {
    cursor = shiftDays(today, -1);
  }

  while (cursor && dateSet.has(toLocalDateKey(cursor))) {
    currentStreak += 1;
    cursor = shiftDays(cursor, -1);
  }

  return {
    currentStreak,
    bestStreak,
    readToday,
  };
}

export function getLast7Days(readDates: string[], today: Date = new Date()): DayPill[] {
  const dateSet = new Set(normalizeReadDates(readDates));
  const todayKey = toLocalDateKey(today);
  const result: DayPill[] = [];

  for (let offset = -6; offset <= 0; offset++) {
    const d = shiftDays(today, offset);
    const dateKey = toLocalDateKey(d);
    result.push({
      dateKey,
      weekdayLabel: WEEKDAY_SHORT_PT[d.getDay()],
      dayNumber: d.getDate(),
      hasRead: dateSet.has(dateKey),
      isToday: dateKey === todayKey,
    });
  }

  return result;
}

export function calculateBookProgress(currentPage: number, totalPages: number): BookProgressStats {
  const safeTotal = Math.max(0, Math.floor(Number.isFinite(totalPages) ? totalPages : 0));
  const safeCurrent = Math.max(0, Math.floor(Number.isFinite(currentPage) ? currentPage : 0));

  if (safeTotal === 0) {
    return {
      clampedCurrent: safeCurrent,
      percentage: 0,
      remainingPages: 0,
    };
  }

  const clampedCurrent = Math.min(safeCurrent, safeTotal);
  const percentage = Math.min(100, Math.round((clampedCurrent / safeTotal) * 100));
  const remainingPages = Math.max(0, safeTotal - clampedCurrent);

  return {
    clampedCurrent,
    percentage,
    remainingPages,
  };
}

function formatBooksRemaining(diff: number): string {
  const rounded = Math.ceil(diff);
  if (rounded <= 1) {
    return 'Falta 1 livro';
  }
  return `Faltam ${rounded} livros`;
}

function buildBenchmarkComparison(
  id: 'brasil' | 'global' | 'top10',
  label: string,
  targetBooks: number,
  userBooks: number,
  source?: string
): BenchmarkComparison {
  const scaleMax = Math.max(targetBooks, userBooks, 12);
  const userBarPercent = Math.min(100, Math.round((userBooks / scaleMax) * 100));
  const benchmarkBarPercent = Math.min(100, Math.round((targetBooks / scaleMax) * 100));

  let summaryText: string;
  const isAboveOrEqual = userBooks >= targetBooks;

  if (userBooks > targetBooks) {
    const pctAbove = Math.round(((userBooks - targetBooks) / targetBooks) * 100);
    if (id === 'brasil') {
      summaryText = `Você leu ${pctAbove}% acima da média brasileira`;
    } else if (id === 'global') {
      summaryText = `Você leu ${pctAbove}% acima da média global`;
    } else {
      summaryText = `Você está ${pctAbove}% acima do ritmo dos leitores frequentes (Top 10%)`;
    }
  } else if (userBooks === targetBooks) {
    if (id === 'brasil') {
      summaryText = 'Você igualou a média brasileira';
    } else if (id === 'global') {
      summaryText = 'Você igualou a média global estimada';
    } else {
      summaryText = 'Você alcançou o patamar de Leitor Frequente (Top 10%)';
    }
  } else {
    const remaining = targetBooks - userBooks;
    if (id === 'brasil') {
      summaryText = `${formatBooksRemaining(remaining)} para superar a média brasileira`;
    } else if (id === 'global') {
      summaryText = `${formatBooksRemaining(remaining)} para superar a média global`;
    } else {
      summaryText = `${formatBooksRemaining(remaining)} para entrar no grupo de leitores frequentes`;
    }
  }

  return {
    id,
    label,
    source,
    targetBooks,
    summaryText,
    isAboveOrEqual,
    userBarPercent,
    benchmarkBarPercent,
  };
}

export function calculateAnnualProjection(booksCompletedThisYear: number, today: Date = new Date()): number {
  if (booksCompletedThisYear <= 0) {
    return 0;
  }
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const endOfYear = new Date(today.getFullYear(), 11, 31);
  const daysElapsed = Math.max(1, diffDays(today, startOfYear) + 1);
  const totalDaysInYear = diffDays(endOfYear, startOfYear) + 1;

  // Avoid extreme projections on the very first week of January by using a 14-day floor
  const effectiveDays = Math.max(daysElapsed, 14);
  const projected = (booksCompletedThisYear / effectiveDays) * totalDaysInYear;
  return Math.max(booksCompletedThisYear, Math.round(projected));
}

export function calculateAnnualStats(
  books: Book[],
  readDates: string[],
  vocabulary: VocabularyWord[],
  annualGoal: number,
  today: Date = new Date()
): AnnualPerformanceStats {
  const currentYear = today.getFullYear();
  const safeGoal = Math.max(1, Math.floor(annualGoal || 12));

  const booksCompletedThisYear = books.filter((book) => {
    if (book.status !== 'completed') return false;
    const refDate = book.completedAt || book.createdAt.slice(0, 10);
    return refDate.startsWith(`${currentYear}-`);
  }).length;

  const totalPagesRead = books.reduce((sum, book) => {
    const effective = book.status === 'completed' ? Math.max(book.currentPage, book.totalPages) : book.currentPage;
    return sum + Math.max(0, Math.floor(effective || 0));
  }, 0);

  const streak = calculateStreak(readDates, today);
  const projectedAnnualBooks = calculateAnnualProjection(booksCompletedThisYear, today);
  const goalProgressPercent = Math.min(100, Math.round((booksCompletedThisYear / safeGoal) * 100));

  const benchmarks: BenchmarkComparison[] = [
    buildBenchmarkComparison(
      'brasil',
      'Média Brasil · 2,5 livros/ano',
      2.5,
      booksCompletedThisYear,
      'Referência: Retratos da Leitura no Brasil'
    ),
    buildBenchmarkComparison(
      'global',
      'Média Global estimada · 4 livros/ano',
      4,
      booksCompletedThisYear
    ),
    buildBenchmarkComparison(
      'top10',
      'Leitor Frequente (Top 10%) · 12 livros/ano',
      12,
      booksCompletedThisYear
    ),
  ];

  return {
    currentYear,
    booksCompletedThisYear,
    totalPagesRead,
    currentStreak: streak.currentStreak,
    bestStreak: streak.bestStreak,
    vocabularyCount: vocabulary.length,
    annualGoal: safeGoal,
    goalProgressPercent,
    projectedAnnualBooks,
    benchmarks,
  };
}

export function formatPtBrDate(isoOrDateKey: string): string {
  if (!isoOrDateKey) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDateKey)
    ? parseDateKey(isoOrDateKey)
    : new Date(isoOrDateKey);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
