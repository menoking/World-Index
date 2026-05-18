import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { fetchFundDetail, fetchFundHoldings } from '../api/eastmoney';
import './FundDetailPage.css';

export default function FundDetailPage() {
  const { code } = useParams();
  const { themeClass, themeText, toggleTheme } = useTheme();

  const [detail, setDetail] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDetail = useCallback(async () => {
    const data = await fetchFundDetail(code);
    let scaleText;
    if (data.scale > 100000000) {
      scaleText = `${(data.scale / 100000000).toFixed(2)} 亿`;
    } else if (data.scale > 10000) {
      scaleText = `${(data.scale / 10000).toFixed(2)} 万`;
    } else {
      scaleText = `${data.scale.toFixed(2)} 元`;
    }
    setDetail({ ...data, scaleText });
  }, [code]);

  const loadHoldings = useCallback(async () => {
    try {
      const data = await fetchFundHoldings(code);
      setHoldings(data);
    } catch { /* no holdings */ }
    setLoading(false);
  }, [code]);

  useEffect(() => {
    loadDetail();
    loadHoldings();
  }, [loadDetail, loadHoldings]);

  return (
    <div className={`page fund-page ${themeClass}`}>
      {detail && (
        <div className="fund-header">
          <div>
            <div className="section-title">{detail.name}</div>
            <div className="fund-subtitle">{detail.type} · {code}</div>
          </div>
          <button className="theme-toggle" onClick={toggleTheme}>{themeText}</button>
        </div>
      )}

      {detail && (
        <div className="info-grid">
          <div className="info-cell">
            <span className="info-value">{detail.company || '--'}</span>
            <span className="info-label">基金公司</span>
          </div>
          <div className="info-cell">
            <span className="info-value">{detail.manager || '--'}</span>
            <span className="info-label">基金经理</span>
          </div>
          <div className="info-cell">
            <span className="info-value">{detail.scaleText || '--'}</span>
            <span className="info-label">基金规模</span>
          </div>
          <div className="info-cell">
            <span className="info-value">{detail.established || '--'}</span>
            <span className="info-label">成立日期</span>
          </div>
        </div>
      )}

      <div className="section-title holdings-title">十大重仓股</div>

      {holdings.length > 0 && (
        <div className="holdings-table">
          <div className="table-header">
            <span className="col-rank">序号</span>
            <span className="col-name">股票名称</span>
            <span className="col-industry">行业</span>
            <span className="col-weight">占比</span>
            <span className="col-change">变动</span>
          </div>
          {holdings.map((item, index) => (
            <div key={item.code} className="table-row">
              <span className="col-rank">{index + 1}</span>
              <span className="col-name">{item.name}</span>
              <span className="col-industry">{item.industry}</span>
              <span className="col-weight">{item.weight}%</span>
              <span className={`col-change ${item.change === '增持' ? 'rise' : item.change === '减持' ? 'fall' : 'neutral'}`}>{item.change}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && !holdings.length && (
        <div className="empty">
          <div className="empty-title">暂无持仓数据</div>
        </div>
      )}

      {loading && <div className="loading"><span>加载中...</span></div>}
    </div>
  );
}
