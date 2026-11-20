import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Block pinch-to-zoom and double-tap zoom on iOS Safari / standalone iPhone PWA
if (typeof document !== 'undefined') {
  const preventGesture = (event: Event) => {
    event.preventDefault();
  };

  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

  document.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (event: TouchEvent) => {
      const now = Date.now();
      const target = event.target as HTMLElement | null;
      const isEditable = Boolean(target?.closest('input, textarea, select'));
      if (!isEditable && now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    },
    { passive: false }
  );
}

createRoot(document.getElementById('root')!).render(<App />);
