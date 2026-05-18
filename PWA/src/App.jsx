import { Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import NetworkPage from './pages/NetworkPage';
import RankPage from './pages/RankPage';
import SectorDetailPage from './pages/SectorDetailPage';
import FundDetailPage from './pages/FundDetailPage';

export default function App() {
  const { themeClass } = useTheme();

  return (
    <div className={themeClass}>
      <div style={{ minHeight: '100vh', background: 'var(--page-bg)' }}>
        <Routes>
          <Route path="/" element={<NetworkPage />} />
          <Route path="/rank" element={<RankPage />} />
          <Route path="/sector/:id" element={<SectorDetailPage />} />
          <Route path="/fund/:code" element={<FundDetailPage />} />
        </Routes>
      </div>
    </div>
  );
}
