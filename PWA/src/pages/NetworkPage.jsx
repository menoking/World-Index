import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { CATEGORIES, formatMoney } from '../api/eastmoney';
import { buildNetworkNodes, buildNetworkLinks, buildParticles, stepForceLayout } from '../utils/layout';
import NetworkCanvas from '../components/NetworkCanvas';
import './NetworkPage.css';

const CANVAS_W = 343;
const CANVAS_H = 380;

export default function NetworkPage() {
  const navigate = useNavigate();
  const { themeClass, themeText, toggleTheme, theme } = useTheme();
  const { currentFundType, setCurrentFundType, setCurrentSector, fetchTime, fetchHotSectors } = useApp();

  const [category, setCategory] = useState('0');
  const [sectors, setSectors] = useState([]);
  const [topSector, setTopSector] = useState({});
  const [error, setError] = useState('');

  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const particlesRef = useRef(buildParticles(28, CANVAS_W, CANVAS_H));
  const canvasRef = useRef(null);

  const loadSectors = useCallback(async (fundType, forceRefresh) => {
    try {
      setError('');
      const data = await fetchHotSectors(fundType, forceRefresh);
      const enriched = data.map((item) => ({
        ...item,
        netInflowText: formatMoney(item.netInflow),
        changeText: `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`,
      }));

      setSectors(enriched);
      setTopSector(enriched[0] || {});
      nodesRef.current = buildNetworkNodes(enriched, CANVAS_W, CANVAS_H);
      linksRef.current = buildNetworkLinks(nodesRef.current);

      for (let i = 0; i < 220; i += 1) {
        const alpha = Math.max(0.18, 1 - i / 220);
        stepForceLayout(nodesRef.current, linksRef.current, CANVAS_W, CANVAS_H, alpha);
      }
    } catch (err) {
      console.error('[NetworkPage] loadSectors error:', err);
      setError(err.message || '数据加载失败');
    }
  }, [fetchHotSectors]);

  useEffect(() => {
    loadSectors('0');
  }, [loadSectors]);

  const switchCategory = useCallback((fundType) => {
    if (fundType === category) return;
    setCategory(fundType);
    setCurrentFundType(fundType);
    setSectors([]);
    setTopSector({});
    loadSectors(fundType);
  }, [category, setCurrentFundType, loadSectors]);

  const refreshData = useCallback(() => {
    setSectors([]);
    setTopSector({});
    loadSectors(category, true);
  }, [category, loadSectors]);

  const handleNodeTap = useCallback((node) => {
    if (category === '6' || category === '31') {
      navigate(`/fund/${node.rawCode}`);
      return;
    }
    setCurrentSector({ id: node.id, name: node.name, rawCode: node.rawCode || '' });
    navigate(`/sector/${node.id}?name=${encodeURIComponent(node.name)}&fundType=${category}&rawCode=${encodeURIComponent(node.rawCode || '')}`);
  }, [category, navigate, setCurrentSector]);

  const goRank = useCallback(() => {
    setCurrentFundType(category);
    navigate('/rank');
  }, [category, setCurrentFundType, navigate]);

  const openSectorFromList = useCallback((sector) => {
    handleNodeTap(sector);
  }, [handleNodeTap]);

  return (
    <div className={`page index-page ${themeClass}`}>
      <div className="hero">
        <div>
          <div className="section-title">
            <span>世界网络</span>
            {fetchTime && <span className="fetch-time">{fetchTime} 更新</span>}
          </div>
          <div className="hero-subtitle">资金流向驱动的板块关系图</div>
        </div>
        <div className="hero-actions">
          <button className="refresh-button" onClick={refreshData}>刷新</button>
          <button className="theme-toggle" onClick={toggleTheme}>{themeText}</button>
          <button className="rank-button" onClick={goRank}>热度指数</button>
        </div>
      </div>

      <div className="category-tabs">
        {CATEGORIES.map((cat) => (
          <div
            key={cat.fundType}
            className={`ctab ${category === cat.fundType ? 'active' : ''}`}
            onClick={() => switchCategory(cat.fundType)}
          >{cat.label}</div>
        ))}
      </div>

      <div className="summary">
        <div className="summary-item">
          <span className="summary-value">{topSector.name || '--'}</span>
          <span className="summary-label">当前热区</span>
        </div>
        <div className="summary-item">
          <span className="summary-value">{topSector.netInflowText || '--'}</span>
          <span className="summary-label">净流入</span>
        </div>
        <div className="summary-item">
          <span className="summary-value rise">{topSector.changeText || '--'}</span>
          <span className="summary-label">估算涨幅</span>
        </div>
      </div>

      <div className="canvas-panel">
        <NetworkCanvas
          ref={canvasRef}
          theme={theme}
          nodes={nodesRef.current}
          links={linksRef.current}
          particles={particlesRef.current}
          onNodeTap={handleNodeTap}
        />
      </div>

      {error && (
        <div style={{ padding: '16px', marginTop: '12px', background: 'rgba(233,75,95,0.1)', borderRadius: '4px', color: '#e94b5f', fontSize: '13px' }}>
          {error}。请打开浏览器控制台 (F12) 查看详细日志。
        </div>
      )}

      <div className="network-caption">双指缩放 / 滚轮缩放 · 拖动平移 · 拖动节点重排网络 · 点击节点进入详情</div>

      <div className="sector-list">
        {sectors.map((item) => (
          <div key={item.id} className="sector-chip" onClick={() => openSectorFromList(item)}>
            <div className="chip-main">
              <span className="chip-name">{item.name}</span>
              <span className="chip-money">{item.netInflowText}</span>
            </div>
            <span className={`chip-change ${item.change >= 0 ? 'rise' : 'fall'}`}>{item.changeText}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
