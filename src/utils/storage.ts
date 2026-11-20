import type { AppData } from '../types/reading';
import { normalizeReadDates, toLocalDateKey } from './readingStats';

export const STORAGE_KEY = 'leia_mais_app_data_v1';

export const DEFAULT_APP_DATA: AppData = {
  books: [],
  notes: [],
  vocabulary: [],
  readDates: [],
  annualGoal: 12,
};

export function loadAppData(): AppData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_DATA };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      books: Array.isArray(parsed.books) ? parsed.books : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      vocabulary: Array.isArray(parsed.vocabulary) ? parsed.vocabulary : [],
      readDates: Array.isArray(parsed.readDates) ? normalizeReadDates(parsed.readDates) : [],
      annualGoal:
        typeof parsed.annualGoal === 'number' && parsed.annualGoal >= 1
          ? Math.floor(parsed.annualGoal)
          : 12,
    };
  } catch {
    return { ...DEFAULT_APP_DATA };
  }
}

export function saveAppData(data: AppData): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function recordTodayInReadDates(readDates: string[], today: Date = new Date()): string[] {
  const todayKey = toLocalDateKey(today);
  if (readDates.includes(todayKey)) {
    return readDates;
  }
  return normalizeReadDates([...readDates, todayKey]);
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
