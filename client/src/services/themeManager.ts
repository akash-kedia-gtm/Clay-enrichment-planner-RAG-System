export type Theme = 'light' | 'dark';

export const themeManager = {
  getTheme(): Theme {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = localStorage.getItem('clay_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark'; // Default to dark mode
    } catch (_) {
      return 'dark';
    }
  },

  setTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('clay_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (_) {}
  },

  toggleTheme(): Theme {
    const current = this.getTheme();
    const next: Theme = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  },

  init(): Theme {
    const theme = this.getTheme();
    this.setTheme(theme);
    return theme;
  },
};
