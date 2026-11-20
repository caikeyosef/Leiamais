import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/usePWAInstall';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 left-4 right-4 md:left-auto md:right-5 z-40 flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-[#111111] px-4 py-2.5 text-xs text-white"
    >
      <WifiOff className="w-4 h-4 shrink-0 text-neutral-300" strokeWidth={1.75} aria-hidden="true" />
      <span>Modo offline — seus livros e notas continuam salvos localmente.</span>
    </div>
  );
}
