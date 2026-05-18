import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { fetchHotSectors as apiFetchHotSectors } from '../api/eastmoney';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  });
  const [currentSector, setCurrentSector] = useState(null);
  const [currentFundType, setCurrentFundType] = useState('0');
  const [fetchTime, setFetchTime] = useState('');
  const sectorsCache = useRef({});

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const fetchHotSectors = useCallback(async (fundType, forceRefresh) => {
    const result = await apiFetchHotSectors(fundType, forceRefresh, sectorsCache.current);
    sectorsCache.current[fundType || '0'] = result.data;
    sectorsCache.current._fetchTime = result.time;
    setFetchTime(result.time);
    return result.data;
  }, []);

  const clearSectorsCache = useCallback((fundType) => {
    delete sectorsCache.current[fundType || '0'];
  }, []);

  const value = {
    theme,
    toggleTheme,
    currentSector,
    setCurrentSector,
    currentFundType,
    setCurrentFundType,
    fetchTime,
    fetchHotSectors,
    clearSectorsCache,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
