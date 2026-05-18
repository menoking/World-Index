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

const VALIDMARK = 'aKVEnBbJF9Nip2Wjf4de/fSvA8W3X3iB4L6vT0Y5cxvZbEfEm17udZKUD2qy37dLRY3bzzHLDv+up/Yn3OTo5Q==';

// 统一走代理：开发 Vite proxy，生产 Vercel serverless
const URL_PROXY = '/api/eastmoney';

const ENDPOINTS = {
  subjectList: 'FundMNewApi/FundMNSubjectList',
  fundRank: 'FundMNewApi/FundMNRank',
  fundDetail: 'FundMNewApi/FundMNDetailInformation',
  fundHoldings: 'FundMNewApi/FundMNInverstPosition',
};

export const CATEGORIES = [
  { key: 'astock', label: 'A股基金', fundType: '0' },
  { key: 'index', label: '指数基金', fundType: '26' },
  { key: 'qdii', label: 'QDII基金', fundType: '6' },
  { key: 'bond', label: '债券基金', fundType: '31' },
];

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

async function request(endpoint, params = {}) {
  const merged = { endpoint, ...EASTMONEY_BASE_PARAMS, ...params };
  const query = Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const fullUrl = `${URL_PROXY}?${query}`;

  try {
    const res = await fetch(fullUrl, {
      headers: {
        validmark: VALIDMARK,
        'User-Agent': 'EFund/6.5.5 (iPhone; iOS 15.5; Scale/3.00)',
        Accept: '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
      },
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('[API] 请求失败:', fullUrl, err);
    throw err;
  }
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

export function parseNumber(value, fallback = 0) {
  const num = Number(String(value || '').replace(/[%亿,]/g, ''));
  return Number.isFinite(num) ? num : fallback;
}

export function formatMoney(value) {
  if (value >= 100) return `${(value / 100).toFixed(1)}百亿`;
  return `${value.toFixed(1)}亿`;
}

export function getCategoryLabel(fundType) {
  const cat = CATEGORIES.find((c) => c.fundType === fundType);
  return cat ? cat.label : '基金';
}

function attachThemeLinks(sectors) {
  const len = sectors.length;
  if (len === 0) return sectors;
  const topEnd = Math.min(7, len - 1);
  const pairStart = Math.min(8, len);
  const pairEnd = Math.min(16, len);

  return sectors.map((item, index) => {
    const links = [];
    if (index < topEnd) links.push(sectors[index + 1].id);
    if (index === 0 && sectors[Math.min(4, len - 1)]) links.push(sectors[Math.min(4, len - 1)].id);
    if (index === 2 && sectors[Math.min(6, len - 1)]) links.push(sectors[Math.min(6, len - 1)].id);
    if (index >= pairStart && index < pairEnd && index % 2 === 0 && sectors[index + 1]) {
      links.push(sectors[index + 1].id);
    }
    return { ...item, links };
  });
}

export function todayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function loadSectorsFromStorage(fundType) {
  try {
    const raw = localStorage.getItem(`sectors_${fundType}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSectorsToStorage(fundType, data) {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const time = `${h}:${m}`;
  const entry = { date: todayKey(), time, data };
  try {
    localStorage.setItem(`sectors_${fundType}`, JSON.stringify(entry));
  } catch { /* storage full */ }
  return time;
}

export async function fetchHotSectors(fundType, forceRefresh, cache = {}) {
  const ft = fundType || '0';

  if (!forceRefresh && cache[ft]) return { data: cache[ft], time: cache._fetchTime || '' };

  if (!forceRefresh) {
    const stored = loadSectorsFromStorage(ft);
    if (stored) return { data: stored.data, time: stored.time };
  }

  if (ft === '6' || ft === '31') {
    return fetchHotSectorsFromFunds(ft);
  }
  return fetchHotSectorsFromSubjects(ft);
}

async function fetchHotSectorsFromSubjects(fundType) {
  const raw = await request(ENDPOINTS.subjectList);
  const list = unwrapList(raw);
  if (!list.length) return { data: [], time: '' };

  const subjects = list.slice(0, 24);
  const changePromises = subjects.map((item) =>
    request(ENDPOINTS.fundRank, {
      FundType: fundType,
      SortColumn: 'RZDF',
      Sort: 'desc',
      pageIndex: '1',
      pageSize: '1',
      ISABNORMAL: 'true',
      TOPICAL: item.INDEXCODE,
    })
      .then((rankRaw) => {
        const funds = unwrapList(rankRaw);
        return funds.length ? parseNumber(funds[0].RZDF, 0) : 0;
      })
      .catch(() => 0)
  );

  const changes = await Promise.all(changePromises);
  const valid = subjects
    .map((item, index) => ({
      id: String(item.INDEXCODE || `theme-${index}`),
      name: item.INDEXNAME || `板块${index + 1}`,
      category: item.TYPE === '1' ? '行业' : '概念',
      netInflow: Math.max(0.5, (24 - index) * 0.8 + Math.random() * 2),
      change: changes[index],
      heat: Math.max(40, 99 - index * 2),
      rawCode: String(item.INDEXCODE || ''),
      links: [],
    }))
    .filter((s) => s.change !== 0);

  const linked = attachThemeLinks(valid);
  const time = saveSectorsToStorage(fundType, linked);
  return { data: linked, time };
}

async function fetchHotSectorsFromFunds(fundType) {
  const raw = await request(ENDPOINTS.fundRank, {
    FundType: fundType,
    SortColumn: 'RZDF',
    Sort: 'desc',
    pageIndex: '1',
    pageSize: '24',
    ISABNORMAL: 'true',
  });
  const list = unwrapList(raw);
  if (!list.length) return { data: [], time: '' };

  const sectors = list.slice(0, 24).map((item, index) => ({
    id: String(item.FCODE || `fund-${index}`),
    name: (item.SHORTNAME || item.NAME || `基金${index + 1}`).slice(0, 6),
    category: item.FTYPE || '其他',
    netInflow: Math.max(0.5, (24 - index) * 0.8 + Math.random() * 2),
    change: parseNumber(item.RZDF, 0),
    heat: Math.max(40, 99 - index * 2),
    rawCode: String(item.FCODE || ''),
    links: [],
  }));

  const linked = attachThemeLinks(sectors);
  const time = saveSectorsToStorage(fundType, linked);
  return { data: linked, time };
}

export async function fetchFundRank({ scope, sectorId, period, fundType, rawCode, purchasable, ensureSector }) {
  const ft = fundType || '0';
  const sortCol = SORT_COLUMN_MAP[period] || 'RZDF';
  const changeField = CHANGE_FIELD_MAP[period] || 'RZDF';

  const doFetch = async (code) => {
    const params = {
      FundType: ft,
      SortColumn: sortCol,
      Sort: 'desc',
      pageIndex: '1',
      pageSize: '30',
      ISABNORMAL: 'true',
    };

    if (purchasable) params.BUY = 'true';
    if (scope === 'sector' && code) params.TOPICAL = code;

    const raw = await request(ENDPOINTS.fundRank, params);
    const list = unwrapList(raw);
    return list
      .filter((item) => !purchasable || item.BUY === true)
      .map((item) => ({
        name: item.SHORTNAME || item.NAME || '基金',
        code: item.FCODE || '',
        change: parseNumber(item[changeField], 0),
        sector: item.FTYPE || '其他',
        category: item.FTYPE || '其他',
      }));
  };

  if (scope === 'sector' && rawCode) return doFetch(rawCode);

  if (scope === 'sector' && sectorId && ensureSector) {
    const sectors = await ensureSector();
    const sector = sectors.find((s) => s.id === sectorId);
    return doFetch(sector && sector.rawCode);
  }

  return doFetch(null);
}

export async function fetchSectorFunds(sectorId, fundType, rawCode, ensureSector) {
  const ft = fundType || '0';

  const doFetch = async (code) => {
    const params = {
      FundType: ft,
      SortColumn: 'RZDF',
      Sort: 'desc',
      pageIndex: '1',
      pageSize: '30',
      ISABNORMAL: 'true',
    };
    if (code) params.TOPICAL = code;

    const raw = await request(ENDPOINTS.fundRank, params);
    const list = unwrapList(raw);
    if (!list.length) return [];

    return list.slice(0, 30).map((item, index) => {
      const rawScale = parseNumber(item.ENDNAV, 0);
      const scale = rawScale > 100000 ? Math.max(1, Math.round(rawScale / 100000000)) : Math.max(1, Math.round(rawScale));
      const col = index % 4;
      const row = Math.floor(index / 4);

      return {
        id: `${sectorId}-${index}`,
        name: item.SHORTNAME || item.NAME || '基金',
        code: item.FCODE || '',
        company: item.JJGS || '',
        scale,
        change: parseNumber(item.RZDF, 0),
        x: 15 + col * 20,
        y: 15 + row * 12,
      };
    });
  };

  if (rawCode) return doFetch(rawCode);

  if (ensureSector) {
    const sectors = await ensureSector();
    const sector = sectors.find((s) => s.id === sectorId);
    return doFetch(sector && sector.rawCode);
  }

  return doFetch(null);
}

export async function fetchFundDetail(code) {
  const raw = await request(ENDPOINTS.fundDetail, { FCODE: code });
  const d = raw.Datas || raw.data || {};
  return {
    name: d.SHORTNAME || '',
    fullName: d.FULLNAME || '',
    type: d.FTYPE || '',
    company: d.JJGS || '',
    manager: d.JJJL || '',
    scale: parseNumber(d.ENDNAV, 0),
    established: d.ESTABDATE || '',
    benchmark: (d.BENCH || '').slice(0, 40),
    riskLevel: d.RISKLEVEL || '',
  };
}

export async function fetchFundHoldings(code) {
  const raw = await request(ENDPOINTS.fundHoldings, { FCODE: code });
  const d = raw.Datas || {};
  return (d.fundStocks || []).map((s) => ({
    name: s.GPJC || '',
    code: s.GPDM || '',
    weight: parseNumber(s.JZBL, 0),
    change: s.PCTNVCHGTYPE || '',
    changeValue: parseNumber(s.PCTNVCHG, 0),
    industry: s.INDEXNAME || '',
  }));
}
