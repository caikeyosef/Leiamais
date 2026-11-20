import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  title: string;
  author: string;
  coverUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<BookCoverProps['size']>, string> = {
  sm: 'w-12 h-[72px] rounded-md',
  md: 'w-[72px] h-[108px] rounded-md',
  lg: 'w-24 h-36 sm:w-28 sm:h-40 rounded-lg',
};

export function BookCover({ title, author, coverUrl, size = 'md' }: BookCoverProps) {
  const [failed, setFailed] = useState(false);

  const showImage = Boolean(coverUrl) && !failed;
  const dims = SIZE_CLASSES[size];

  if (showImage) {
    return (
      <div
        className={`${dims} relative shrink-0 overflow-hidden border border-neutral-200 bg-neutral-100`}
      >
        <img
          src={coverUrl}
          alt={`Capa do livro ${title}`}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dims} relative shrink-0 overflow-hidden border border-neutral-200 bg-[#141414] text-white flex flex-col justify-between p-2 select-none`}
      aria-label={`Capa minimalista de ${title}`}
    >
      <div className="absolute inset-y-0 left-1.5 w-px bg-white/15" aria-hidden="true" />
      <div className="pl-1.5 min-w-0">
        {size === 'sm' ? (
          <BookOpen className="w-3.5 h-3.5 text-neutral-400" strokeWidth={1.6} aria-hidden="true" />
        ) : (
          <p
            lang="pt-BR"
            className={`font-editorial font-medium text-white break-words hyphens-auto ${
              size === 'lg'
                ? 'text-xs leading-[1.25] line-clamp-4'
                : 'text-[10px] leading-[1.2] line-clamp-4'
            }`}
          >
            {title}
          </p>
        )}
      </div>
      {size !== 'sm' && (
        <p className="pl-1.5 text-[9px] leading-tight text-neutral-400 truncate">{author}</p>
      )}
    </div>
  );
}
