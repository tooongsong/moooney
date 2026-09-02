'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

function applyTheme(t: Theme) {
  if (t === 'light') document.documentElement.dataset.theme = 'light';
  else if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  else delete document.documentElement.dataset.theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch {}
  }, []);

  function pick(t: Theme) {
    setTheme(t);
    try { localStorage.setItem('theme', t); } catch {}
    applyTheme(t);
  }

  const opts: Theme[] = ['system', 'light', 'dark'];

  return (
    <div className="inline-flex rounded-full bg-sand overflow-hidden">
      {opts.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => pick(t)}
          className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${
            theme === t ? 'bg-ink text-paper' : 'text-ink-soft'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
