import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { fetchSectorFunds, fetchHotSectors } from '../api/eastmoney';
import { computeSpiralLayout } from '../utils/layout';
import './SectorDetailPage.css';

function getNodeColor(change) {
  const alpha = Math.min(0.95, 0.55 + Math.abs(change) / 8);
  if (change >= 0) return `rgba(233, 75, 95, ${alpha})`;
  return `rgba(22, 161, 119, ${alpha})`;
}

export default function SectorDetailPage() {
  const navigate = useNavigate();
  const { id: sectorId } = useParams();
  const [searchParams] = useSearchParams();
  const { themeClass, themeText, toggleTheme } = useTheme();
  const { setCurrentSector, setCurrentFundType, fetchHotSectors: loadSectors } = useApp();

  const sectorName = searchParams.get('name') || '板块';
  const fundType = searchParams.get('fundType') || '0';
  const rawCode = searchParams.get('rawCode') || '';
  const sectorChange = searchParams.get('change') || '';
  const isPositive = sectorChange.startsWith('+');

  const [funds, setFunds] = useState([]);
  const [mapSize, setMapSize] = useState({ w: 0, h: 0 });
  const mapRef = useRef(null);

  useEffect(() => {
    setCurrentSector({ id: sectorId, name: sectorName, rawCode });
    setCurrentFundType(fundType);
  }, [sectorId, sectorName, rawCode, fundType, setCurrentSector, setCurrentFundType]);

  const loadFunds = useCallback(async () => {
    const ensureSector = () => loadSectors(fundType);
    const data = await fetchSectorFunds(sectorId, fundType, rawCode || null, ensureSector);
    const maxScale = Math.max(...data.map((item) => item.scale), 1);
    const enriched = data.map((item) => {
      const size = Math.round((92 + (item.scale / maxScale) * 58) / 2);
      return {
        ...item,
        size,
        halfSize: Math.round(size / 2),
        borderWidth: Math.max(1, Math.min(3, Math.round(Math.abs(item.change) / 2))),
        color: getNodeColor(item.change),
        companyShort: (item.name || '').slice(0, 4),
        changeText: `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`,
      };
    });
    setFunds(enriched);
  }, [sectorId, fundType, rawCode, loadSectors]);

  useEffect(() => { loadFunds(); }, [loadFunds]);

  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setMapSize((prev) => {
          if (Math.abs(prev.w - rect.width) < 2 && Math.abs(prev.h - rect.height) < 2) return prev;
          return { w: rect.width, h: rect.height };
        });
      }
    };

    measure();
    const onResize = () => requestAnimationFrame(measure);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [funds.length]);

  const spiralFunds = useMemo(
    () => computeSpiralLayout(funds, mapSize.w, mapSize.h),
    [funds, mapSize.w, mapSize.h]
  );

  const goRank = useCallback(() => {
    navigate('/rank');
  }, [navigate]);

  return (
    <div className={`page detail-page ${themeClass}`}>
      <div className="detail-header">
        <div>
          <div className="section-title">{sectorName}</div>
          <div className="detail-subtitle">
            板块内基金热力分布
            {sectorChange && (
              <span className={isPositive ? 'rise' : 'fall'} style={{ marginLeft: 12, fontWeight: 700 }}>
                {sectorChange}
              </span>
            )}
          </div>
        </div>
        <div className="detail-actions">
          <button className="theme-toggle" onClick={toggleTheme}>{themeText}</button>
          <button className="rank-button" onClick={goRank}>看排名</button>
        </div>
      </div>

      <div className="heatmap-area" ref={mapRef}>
        <div className="map-grid">
          {spiralFunds.map((item) => (
            <div
              key={item.id}
              className="fund-node"
              style={{
                left: `${item.x}px`,
                top: `${item.y}px`,
                width: `${item.size}px`,
                height: `${item.size}px`,
                marginLeft: `-${item.halfSize}px`,
                marginTop: `-${item.halfSize}px`,
                background: item.color,
                borderWidth: `${item.borderWidth}px`,
              }}
              onClick={() => navigate(`/fund/${item.code}`)}
            >
              <span className="node-company">{item.companyShort}</span>
              <span className="node-change">{item.changeText}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fund-strip">
        {funds.map((item) => (
          <div key={item.code} className="fund-card" onClick={() => navigate(`/fund/${item.code}`)}>
            <div className="fund-name">{item.name}</div>
            <div className="fund-meta">{item.code}</div>
            <div className="fund-bottom">
              <span>规模 {item.scale} 亿</span>
              <span className={item.change >= 0 ? 'rise' : 'fall'}>{item.changeText}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
