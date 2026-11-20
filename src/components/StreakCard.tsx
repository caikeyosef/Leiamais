import { Flame, Check } from 'lucide-react';
import { calculateStreak, getLast7Days } from '../utils/readingStats';

interface StreakCardProps {
  readDates: string[];
}

export function StreakCard({ readDates }: StreakCardProps) {
  const { currentStreak, readToday } = calculateStreak(readDates);
  const last7Days = getLast7Days(readDates);

  const streakLabel =
    currentStreak === 1 ? '1 dia de ofensiva' : `${currentStreak} dias de ofensiva`;

  return (
    <section
      aria-label="Ofensiva diária de leitura"
      className="rounded-xl border border-neutral-200 bg-white px-4 py-4 sm:px-6 sm:py-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              readToday
                ? 'border-[#111111] bg-[#111111] text-white'
                : 'border-neutral-200 bg-[#FAFAFA] text-[#111111]'
            }`}
            aria-hidden="true"
          >
            <Flame className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="font-editorial text-xl sm:text-2xl font-semibold tracking-tight text-[#111111] tabular-nums leading-snug">
              {streakLabel}
            </p>
            <p className="mt-0.5 text-xs sm:text-sm text-neutral-600 flex items-center gap-1.5">
              {readToday ? (
                <>
                  <Check className="h-3.5 w-3.5 text-[#111111] shrink-0" strokeWidth={2.25} aria-hidden="true" />
                  <span className="text-[#111111] font-medium">Leitura de hoje registrada</span>
                </>
              ) : (
                <span>Leia hoje para manter a ofensiva</span>
              )}
            </p>
          </div>
        </div>

        {/* 7-day minimal indicator strip */}
        <div
          className="flex items-center justify-between sm:justify-end gap-2 sm:gap-2.5 border-t border-neutral-100 pt-3.5 sm:border-t-0 sm:pt-0"
          aria-label="Histórico de leitura dos últimos 7 dias"
        >
          {last7Days.map((day) => (
            <div
              key={day.dateKey}
              className="flex flex-col items-center gap-1.5"
              title={`${day.dateKey} — ${day.hasRead ? 'Leitura registrada' : 'Sem registro'}`}
            >
              <span
                className={`text-[11px] font-mono tabular-nums ${
                  day.isToday ? 'font-semibold text-[#111111]' : 'text-neutral-500'
                }`}
              >
                {day.weekdayLabel}
              </span>
              <span
                className={`flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center rounded-full transition-colors ${
                  day.hasRead
                    ? 'bg-[#111111] text-white'
                    : day.isToday
                      ? 'border-[1.5px] border-[#111111] bg-white'
                      : 'border border-neutral-300 bg-transparent'
                }`}
                aria-label={`${day.dateKey}: ${day.hasRead ? 'lido' : 'não lido'}`}
              >
                {day.hasRead && <Check className="h-3.5 w-3.5 sm:h-3 sm:w-3" strokeWidth={2.5} aria-hidden="true" />}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
