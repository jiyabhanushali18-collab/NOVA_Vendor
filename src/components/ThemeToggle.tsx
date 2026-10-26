import { Moon, Sun } from 'lucide-react';

interface ThemeToggleProps {
  darkMode: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ darkMode, onToggle }: ThemeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
      aria-pressed={darkMode}
      title={`Switch to ${darkMode ? 'light' : 'dark'} mode`}
      className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/60 bg-white/60 text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary dark-mode-toggle"
    >
      {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
