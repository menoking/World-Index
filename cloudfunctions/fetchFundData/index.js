const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const EASTMONEY_BASE_PARAMS = {
  product: 'EFund',
  deviceid: '874C427C-7C24-4980-A835-66FD40B67605',
  MobileKey: '874C427C-7C24-4980-A835-66FD40B67605',
  plat: 'Iphone',
  PhoneType: 'IOS15.1.0',
  OSVersion: '15.5',
  version: '6.5.5',
  ServerVersion: '6.5.5',
  Version: '6.5.5',
  appVersion: '6.5.5',
};

const URL_SUBJECT_LIST = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNSubjectList';
const URL_FUND_RANK = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNRank';

const VALIDMARK = 'aKVEnBbJF9Nip2Wjf4de/fSvA8W3X3iB4L6vT0Y5cxvZbEfEm17udZKUD2qy37dLRY3bzzHLDv+up/Yn3OTo5Q==';

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        validmark: VALIDMARK,
      },
    };
    https
      .get(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function buildUrl(baseUrl, params = {}) {
  const merged = { ...EASTMONEY_BASE_PARAMS, ...params };
  const query = Object.keys(merged)
    .filter((key) => merged[key] !== undefined && merged[key] !== null && merged[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(merged[key])}`)
    .join('&');
  return `${baseUrl}${query ? '?' + query : ''}`;
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  if (payload && Array.isArray(payload.Datas)) return payload.Datas;
  if (payload && payload.data && Array.isArray(payload.data.Datas)) return payload.data.Datas;
  if (payload && payload.data && Array.isArray(payload.data.list)) return payload.data.list;
  if (payload && payload.result && Array.isArray(payload.result.data)) return payload.result.data;
  return [];
}

function parseNumber(value, fallback = 0) {
  const num = Number(String(value || '').replace(/[%亿,]/g, ''));
  return Number.isFinite(num) ? num : fallback;
}

function attachThemeLinks(items) {
  return items.map((item, index) => ({
    ...item,
    links: [
      items[index - 1] && items[index - 1].id,
      items[index + 1] && items[index + 1].id,
      items[(index + 5) % items.length] && items[(index + 5) % items.length].id,
    ].filter(Boolean),
  }));
}

const SORT_COLUMN_MAP = {
  daily: 'RZDF',
  weekly: 'SYL_Z',
  monthly: 'SYL_Y',
  all: 'SYL_LN',
};

const CHANGE_FIELD_MAP = {
  daily: 'RZDF',
  weekly: 'SYL_Z',
  monthly: 'SYL_Y',
  all: 'SYL_LN',
};

function normalizeFundRankItem(item, period) {
  const field = CHANGE_FIELD_MAP[period] || 'RZDF';
  return {
    name: item.SHORTNAME || item.NAME || '基金',
    code: item.FCODE || '',
    change: parseNumber(item[field], 0),
    sector: item.FTYPE || '其他',
    category: item.FTYPE || '其他',
  };
}

function normalizeSectorFund(item, index, sectorId) {
  const rawScale = parseNumber(item.ENDNAV, 0);
  const scale = rawScale > 100000 ? Math.max(1, Math.round(rawScale / 100000000)) : Math.max(1, Math.round(rawScale));
  const col = index % 4;
  const row = Math.floor(index / 4);

  return {
    id: `${sectorId}-${index}`,
    name: item.SHORTNAME || item.NAME || '基金',
    code: item.FCODE || '',
    company: item.JJGS || '基金公司',
    scale,
    change: parseNumber(item.RZDF, 0),
    x: 15 + col * 20,
    y: 20 + row * 30,
  };
}

async function fetchHotSectors() {
  const url = buildUrl(URL_SUBJECT_LIST);
  const raw = await requestJson(url);
  const list = unwrapList(raw);
  if (!list.length) return [];

  const subjects = list.slice(0, 24);

  const changePromises = subjects.map((item) => {
    const rankUrl = buildUrl(URL_FUND_RANK, {
      FundType: '0',
      SortColumn: 'RZDF',
      Sort: 'desc',
      pageIndex: '1',
      pageSize: '1',
      ISABNORMAL: 'true',
      TOPICAL: item.INDEXCODE,
    });
    return requestJson(rankUrl)
      .then((rankRaw) => {
        const funds = unwrapList(rankRaw);
        return funds.length ? parseNumber(funds[0].RZDF, 0) : 0;
      })
      .catch(() => 0);
  });

  const changes = await Promise.all(changePromises);

  const sectors = subjects.map((item, index) => ({
    id: String(item.INDEXCODE || `theme-${index}`),
    name: item.INDEXNAME || `板块${index + 1}`,
    category: item.TYPE === '1' ? '行业' : '概念',
    netInflow: Math.max(0.5, (24 - index) * 0.8 + Math.random() * 2),
    change: changes[index],
    heat: Math.max(40, 99 - index * 2),
    rawCode: String(item.INDEXCODE || ''),
    links: [],
  }));

  return attachThemeLinks(sectors);
}

async function fetchFundRank(event) {
  const sortCol = SORT_COLUMN_MAP[event.period] || 'RZDF';
  const params = {
    FundType: '0',
    SortColumn: sortCol,
    Sort: 'desc',
    pageIndex: '1',
    pageSize: '30',
    ISABNORMAL: 'true',
  };

  if (event.purchasable) {
    params.BUY = 'true';
  }

  if (event.scope === 'sector' && event.sectorId) {
    const sectors = await fetchHotSectors();
    const sector = sectors.find((s) => s.id === event.sectorId);
    if (sector && sector.rawCode) {
      params.TOPICAL = sector.rawCode;
    }
  }

  const url = buildUrl(URL_FUND_RANK, params);
  const raw = await requestJson(url);
  const list = unwrapList(raw);
  return list
    .filter((item) => !event.purchasable || item.BUY === true)
    .map((item) => normalizeFundRankItem(item, event.period));
}

async function fetchSectorFunds(event) {
  const params = {
    FundType: '0',
    SortColumn: 'RZDF',
    Sort: 'desc',
    pageIndex: '1',
    pageSize: '10',
    ISABNORMAL: 'true',
  };

  const sectors = await fetchHotSectors();
  const sector = sectors.find((s) => s.id === event.sectorId);
  if (sector && sector.rawCode) {
    params.TOPICAL = sector.rawCode;
  }

  const url = buildUrl(URL_FUND_RANK, params);
  const raw = await requestJson(url);
  const list = unwrapList(raw);
  if (!list.length) return [];

  return list.slice(0, 8).map((item, index) => normalizeSectorFund(item, index, event.sectorId));
}

exports.main = async (event = {}) => {
  let data = [];

  try {
    if (event.type === 'hotSectors') data = await fetchHotSectors();
    if (event.type === 'sectorFunds') data = await fetchSectorFunds(event);
    if (event.type === 'fundRank') data = await fetchFundRank(event);
  } catch (error) {
    console.error('fetchFundData error:', error);
  }

  return {
    code: 0,
    data,
  };
};
