import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStreak,
  getLast7Days,
  calculateBookProgress,
  calculateAnnualStats,
  calculateAnnualProjection,
} from './readingStats';
import type { Book, VocabularyWord } from '../types/reading';

test('calculateStreak handles empty history', () => {
  const result = calculateStreak([], new Date(2026, 10, 20));
  assert.deepEqual(result, { currentStreak: 0, bestStreak: 0, readToday: false });
});

test('calculateStreak counts consecutive days ending today and tracks best record', () => {
  const today = new Date(2026, 10, 20); // 2026-11-20
  const dates = [
    '2026-11-01',
    '2026-11-02',
    '2026-11-03',
    '2026-11-04',
    '2026-11-05', // 5-day record
    '2026-11-18',
    '2026-11-19',
    '2026-11-20', // 3-day current streak
    '2026-11-20', // duplicate should be ignored
  ];
  const result = calculateStreak(dates, today);
  assert.deepEqual(result, { currentStreak: 3, bestStreak: 5, readToday: true });
});

test('calculateStreak preserves streak when last read was yesterday', () => {
  const today = new Date(2026, 10, 20);
  const dates = ['2026-11-17', '2026-11-18', '2026-11-19'];
  const result = calculateStreak(dates, today);
  assert.deepEqual(result, { currentStreak: 3, bestStreak: 3, readToday: false });
});

test('calculateStreak resets current streak when missed 2+ days but retains record', () => {
  const today = new Date(2026, 10, 20);
  const dates = ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18'];
  const result = calculateStreak(dates, today);
  assert.deepEqual(result, { currentStreak: 0, bestStreak: 4, readToday: false });
});

test('getLast7Days returns 7 chronological entries ending today', () => {
  const today = new Date(2026, 10, 20); // 2026-11-20
  const days = getLast7Days(['2026-11-14', '2026-11-20'], today);
  assert.equal(days.length, 7);
  assert.equal(days[0].dateKey, '2026-11-14');
  assert.equal(days[0].hasRead, true);
  assert.equal(days[0].isToday, false);
  assert.equal(days[6].dateKey, '2026-11-20');
  assert.equal(days[6].hasRead, true);
  assert.equal(days[6].isToday, true);
  assert.equal(days[3].hasRead, false);
});

test('calculateBookProgress clamps pages and computes percentage accurately', () => {
  assert.deepEqual(calculateBookProgress(50, 200), {
    clampedCurrent: 50,
    percentage: 25,
    remainingPages: 150,
  });
  assert.deepEqual(calculateBookProgress(300, 200), {
    clampedCurrent: 200,
    percentage: 100,
    remainingPages: 0,
  });
  assert.deepEqual(calculateBookProgress(-5, 200), {
    clampedCurrent: 0,
    percentage: 0,
    remainingPages: 200,
  });
  assert.deepEqual(calculateBookProgress(10, 0), {
    clampedCurrent: 10,
    percentage: 0,
    remainingPages: 0,
  });
});

test('calculateAnnualStats computes real-world benchmarks and exact percentages', () => {
  const today = new Date(2026, 5, 30); // mid-year 2026-06-30
  const books: Book[] = [
    {
      id: '1',
      title: 'Dom Casmurro',
      author: 'Machado de Assis',
      totalPages: 256,
      currentPage: 256,
      status: 'completed',
      createdAt: '2026-01-10T10:00:00Z',
      completedAt: '2026-02-01',
    },
    {
      id: '2',
      title: 'Grande Sertão: Veredas',
      author: 'João Guimarães Rosa',
      totalPages: 600,
      currentPage: 600,
      status: 'completed',
      createdAt: '2026-02-10T10:00:00Z',
      completedAt: '2026-03-15',
    },
    {
      id: '3',
      title: 'A Hora da Estrela',
      author: 'Clarice Lispector',
      totalPages: 88,
      currentPage: 88,
      status: 'completed',
      createdAt: '2026-03-20T10:00:00Z',
      completedAt: '2026-04-01',
    },
    {
      id: '4',
      title: 'Vidas Secas',
      author: 'Graciliano Ramos',
      totalPages: 176,
      currentPage: 176,
      status: 'completed',
      createdAt: '2026-04-05T10:00:00Z',
      completedAt: '2026-04-20',
    },
    {
      id: '5',
      title: 'O Cortiço',
      author: 'Aluísio Azevedo',
      totalPages: 280,
      currentPage: 280,
      status: 'completed',
      createdAt: '2026-05-01T10:00:00Z',
      completedAt: '2026-05-15',
    },
    {
      id: '6',
      title: 'Memórias Póstumas',
      author: 'Machado de Assis',
      totalPages: 320,
      currentPage: 120,
      status: 'reading',
      createdAt: '2026-06-01T10:00:00Z',
    },
  ];
  const vocabulary: VocabularyWord[] = [
    {
      id: 'w1',
      bookId: '1',
      word: 'Oblíqua',
      definicao: 'Inclinada ou indireta.',
      sinonimos: ['inclinada', 'indireta'],
      exemplo: 'Olhos de cigana oblíqua e dissimulada.',
      createdAt: '2026-01-12T10:00:00Z',
    },
  ];

  const stats = calculateAnnualStats(books, ['2026-06-29', '2026-06-30'], vocabulary, 10, today);
  assert.equal(stats.booksCompletedThisYear, 5);
  assert.equal(stats.totalPagesRead, 256 + 600 + 88 + 176 + 280 + 120);
  assert.equal(stats.currentStreak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.vocabularyCount, 1);
  assert.equal(stats.goalProgressPercent, 50);

  // 5 books vs 2.5 Brazil avg = +100%
  assert.equal(stats.benchmarks[0].summaryText, 'Você leu 100% acima da média brasileira');
  // 5 books vs 4 Global avg = +25%
  assert.equal(stats.benchmarks[1].summaryText, 'Você leu 25% acima da média global');
  // 5 books vs 12 Top 10% = 7 remaining
  assert.equal(
    stats.benchmarks[2].summaryText,
    'Faltam 7 livros para entrar no grupo de leitores frequentes'
  );
});

test('calculateAnnualProjection scales pace over the year', () => {
  // On June 30 (day 181 of 365), 6 books completed -> ~12 projected
  const projected = calculateAnnualProjection(6, new Date(2026, 5, 30));
  assert.equal(projected, 12);
  assert.equal(calculateAnnualProjection(0, new Date(2026, 5, 30)), 0);
});
