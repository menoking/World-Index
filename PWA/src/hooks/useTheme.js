import { useApp } from '../context/AppContext';

export function useTheme() {
  const { theme, toggleTheme } = useApp();
  const themeClass = `theme-${theme}`;
  const themeText = theme === 'dark' ? '亮色' : '暗色';
  return { theme, themeClass, themeText, toggleTheme };
}
