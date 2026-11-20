import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ImagePlus, Trash2, X } from 'lucide-react';
import { BookCover } from './BookCover';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBook: (book: {
    title: string;
    author: string;
    totalPages: number;
    coverUrl?: string;
  }) => void;
}

async function compressCoverToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagem inválido.'));
      img.onload = () => {
        const maxW = 240;
        const maxH = 360;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Não foi possível processar a imagem.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AddBookModal({ isOpen, onClose, onAddBook }: AddBookModalProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [totalPages, setTotalPages] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setAuthor('');
    setTotalPages('');
    setCoverUrl(undefined);
    setFormError(null);

    const timer = window.setTimeout(() => {
      titleInputRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressCoverToDataUrl(file);
      setCoverUrl(dataUrl);
      setFormError(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();
    const parsedPages = Number.parseInt(totalPages, 10);

    if (!cleanTitle) {
      setFormError('Informe o título do livro.');
      return;
    }
    if (!cleanAuthor) {
      setFormError('Informe o nome do autor.');
      return;
    }
    if (!Number.isFinite(parsedPages) || parsedPages <= 0) {
      setFormError('Informe um número de páginas maior que zero.');
      return;
    }

    onAddBook({
      title: cleanTitle,
      author: cleanAuthor,
      totalPages: parsedPages,
      coverUrl: coverUrl?.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-book-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-neutral-200 bg-white overflow-hidden safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-neutral-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-5 py-4 sm:px-6">
          <h2
            id="add-book-modal-title"
            className="font-editorial text-xl font-semibold text-[#111111] truncate"
          >
            Adicionar novo livro
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de novo livro"
            className="-mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-[#111111] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-4">
          {/* Cover preview + optional local image upload */}
          <div className="flex items-center gap-4 pb-3 border-b border-neutral-100">
            <BookCover title={title || 'Novo livro'} author={author || 'Autor'} coverUrl={coverUrl} size="sm" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-medium text-[#111111]">
                {coverUrl ? 'Capa personalizada salva localmente' : 'Capa editorial automática'}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                  id="local-cover-upload"
                />
                <label
                  htmlFor="local-cover-upload"
                  className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-md border border-neutral-300 bg-white text-xs font-medium text-[#111111] hover:bg-neutral-50 cursor-pointer"
                >
                  <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  <span>{coverUrl ? 'Trocar foto' : 'Escolher capa (opcional)'}</span>
                </label>
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => setCoverUrl(undefined)}
                    aria-label="Remover imagem da capa"
                    className="inline-flex items-center gap-1 min-h-[36px] px-2 text-xs text-neutral-500 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>Usar padrão</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {formError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/70 px-3.5 py-2.5 text-xs text-red-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="manual-book-title" className="block text-xs font-medium text-neutral-700">
              Título do livro
            </label>
            <input
              ref={titleInputRef}
              id="manual-book-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Ex.: Grande Sertão: Veredas"
              className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="manual-book-author" className="block text-xs font-medium text-neutral-700">
              Autor
            </label>
            <input
              id="manual-book-author"
              type="text"
              value={author}
              onChange={(e) => {
                setAuthor(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Ex.: João Guimarães Rosa"
              className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="manual-book-pages" className="block text-xs font-medium text-neutral-700">
              Total de páginas
            </label>
            <input
              id="manual-book-pages"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              value={totalPages}
              onChange={(e) => {
                setTotalPages(e.target.value);
                if (formError) setFormError(null);
              }}
              placeholder="Ex.: 256"
              className="w-full min-h-[44px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm font-mono tabular-nums text-[#111111] placeholder:text-neutral-400 focus:border-[#111111] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-sm font-medium text-neutral-700 hover:text-[#111111] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] rounded-lg bg-[#111111] px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              Adicionar à estante
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
