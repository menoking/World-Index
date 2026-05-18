import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../hooks/useTheme';
import { fetchFundRank, getCategoryLabel } from '../api/eastmoney';
import './RankPage.css';

export default function RankPage() {
  const navigate = useNavigate();
  const { themeClass, themeText, toggleTheme } = useTheme();
  const { currentSector, setCurrentSector, currentFundType } = useApp();

  const [period, setPeriod] = useState('daily');
  const [purchasable, setPurchasable] = useState(false);
  const [funds, setFunds] = useState([]);

  const scopeText = currentSector
    ? `${currentSector.name} · ${getCategoryLabel(currentFundType)}涨幅榜`
    : `${getCategoryLabel(currentFundType)}涨幅榜`;

  const loadRank = useCallback(() => {
    fetchFundRank({
      scope: currentSector ? 'sector' : 'all',
      sectorId: currentSector?.id,
      rawCode: currentSector?.rawCode,
      period,
      fundType: currentFundType,
      purchasable,
    }).then((data) => {
      setFunds(data.map((item) => ({
        ...item,
        changeText: `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`,
      })));
    });
  }, [period, purchasable, currentSector, currentFundType]);

  useEffect(() => { loadRank(); }, [loadRank]);

  const clearSector = useCallback(() => {
    setCurrentSector(null);
  }, [setCurrentSector]);

  return (
    <div className={`page rank-page ${themeClass}`}>
      <div className="rank-header">
        <div>
          <div className="section-title">热度指数</div>
          <div className="rank-scope">{scopeText}</div>
        </div>
        <div className="rank-actions">
          <button className="theme-toggle" onClick={toggleTheme}>{themeText}</button>
          {currentSector && <button className="clear-button" onClick={clearSector}>全市场</button>}
        </div>
      </div>

      <div className="filter-bar">
        <div className="tabs">
          <div className={`tab ${period === 'daily' ? 'active' : ''}`} onClick={() => setPeriod('daily')}>每日</div>
          <div className={`tab ${period === 'weekly' ? 'active' : ''}`} onClick={() => setPeriod('weekly')}>每周</div>
          <div className={`tab ${period === 'monthly' ? 'active' : ''}`} onClick={() => setPeriod('monthly')}>每月</div>
          <div className={`tab ${period === 'all' ? 'active' : ''}`} onClick={() => setPeriod('all')}>成立</div>
        </div>
        <div className={`purchasable-toggle ${purchasable ? 'active' : ''}`} onClick={() => setPurchasable(!purchasable)}>
          {purchasable ? '可申购' : '全部'}
        </div>
      </div>

      <div className="rank-list">
        {funds.map((item, index) => (
          <div key={item.code} className="rank-item" onClick={() => navigate(`/fund/${item.code}`)}>
            <div className={`rank-number ${index < 3 ? 'top' : ''}`}>{index + 1}</div>
            <div className="fund-info">
              <div className="fund-name">{item.name}</div>
              <div className="fund-meta">{item.code} · {item.sector}</div>
            </div>
            <div className={`fund-change ${item.change >= 0 ? 'rise' : 'fall'}`}>{item.changeText}</div>
          </div>
        ))}

        {!funds.length && (
          <div className="empty">
            <div className="empty-title">暂无排名数据</div>
            <div className="empty-desc">切换全市场或从世界网络重新选择板块</div>
          </div>
        )}
      </div>
    </div>
  );
}
