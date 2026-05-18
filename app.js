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

const CATEGORIES = [
  { key: 'astock', label: 'A股基金', fundType: '0' },
  { key: 'index', label: '指数基金', fundType: '26' },
  { key: 'qdii', label: 'QDII基金', fundType: '6' },
  { key: 'bond', label: '债券基金', fundType: '31' },
];

const URL_SUBJECT_LIST = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNSubjectList';
const URL_FUND_RANK = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNRank';
const URL_FUND_DETAIL = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNDetailInformation';
const URL_FUND_HOLDINGS = 'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition';

App({
  onLaunch() {
    let theme = 'light';
    try {
      theme = wx.getStorageSync('theme') || 'light';
    } catch (error) {
      theme = 'light';
    }
    this.globalData.theme = theme;

    try {
      if (wx.cloud && !wx.cloudInited) {
        wx.cloud.init({ traceUser: true });
        wx.cloudInited = true;
        this.globalData.cloudReady = true;
      }
    } catch (error) {
      this.globalData.cloudReady = false;
    }
  },

  globalData: {
    cloudReady: false,
    currentSector: null,
    theme: 'light',
    sectorsCache: {},
    currentFundType: '0',
    fetchTime: '',
  },

  setCurrentSector(sector) {
    this.globalData.currentSector = sector || null;
  },

  clearCurrentSector() {
    this.globalData.currentSector = null;
  },

  toggleTheme() {
    const theme = this.globalData.theme === 'dark' ? 'light' : 'dark';
    this.globalData.theme = theme;
    try {
      wx.setStorageSync('theme', theme);
    } catch (error) {
      // Ignore storage failures so theme switching never blocks rendering.
    }
    return theme;
  },

  // --- API Layer ---

  request(url, params = {}) {
    return new Promise((resolve, reject) => {
      const merged = { ...EASTMONEY_BASE_PARAMS, ...params };
      const query = Object.entries(merged)
        .filter((entry) => entry[1] !== undefined && entry[1] !== null && entry[1] !== '')
        .map((entry) => `${encodeURIComponent(entry[0])}=${encodeURIComponent(entry[1])}`)
        .join('&');

      wx.request({
        url: `${url}${query ? '?' + query : ''}`,
        method: 'GET',
        header: {
          validmark: 'aKVEnBbJF9Nip2Wjf4de/fSvA8W3X3iB4L6vT0Y5cxvZbEfEm17udZKUD2qy37dLRY3bzzHLDv+up/Yn3OTo5Q==',
        },
        success(res) {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        },
        fail: reject,
      });
    });
  },

  unwrapList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.data)) return payload.data;
    if (payload && Array.isArray(payload.Datas)) return payload.Datas;
    if (payload && payload.data && Array.isArray(payload.data.Datas)) return payload.data.Datas;
    if (payload && payload.data && Array.isArray(payload.data.list)) return payload.data.list;
    if (payload && payload.result && Array.isArray(payload.result.data)) return payload.result.data;
    return [];
  },

  parseNumber(value, fallback) {
    const num = Number(String(value || '').replace(/[%亿,]/g, ''));
    return Number.isFinite(num) ? num : (fallback || 0);
  },

  fetchFundData(params = {}) {
    const directPromise = this.directApiFetch(params);

    if (this.globalData.cloudReady && wx.cloud && wx.cloud.callFunction) {
      return directPromise.catch(() => wx.cloud
        .callFunction({ name: 'fetchFundData', data: params })
        .then((res) => {
          const data = (res.result && res.result.data) || [];
          if (params.type === 'hotSectors' && data.length) {
            const ft = params.fundType || '0';
            this.globalData.sectorsCache[ft] = data;
            this.saveSectorsToStorage(ft, data);
          }
          return data;
        }));
    }

    return directPromise;
  },

  directApiFetch(params) {
    if (params.type === 'hotSectors') return this.fetchHotSectors(params.fundType, params.forceRefresh);
    if (params.type === 'sectorFunds') return this.fetchSectorFunds(params.sectorId, params.fundType, params.rawCode);
    if (params.type === 'fundRank') return this.fetchFundRank(params);
    if (params.type === 'fundDetail') return this.fetchFundDetail(params.code);
    if (params.type === 'fundHoldings') return this.fetchFundHoldings(params.code);
    return Promise.resolve([]);
  },

  fetchHotSectors(fundType, forceRefresh) {
    const ft = fundType || '0';

    if (!forceRefresh && this.globalData.sectorsCache[ft]) {
      return Promise.resolve(this.globalData.sectorsCache[ft]);
    }

    if (!forceRefresh) {
      const stored = this.loadSectorsFromStorage(ft);
      if (stored) {
        this.globalData.sectorsCache[ft] = stored.data;
        this.globalData.fetchTime = stored.time;
        return Promise.resolve(stored.data);
      }
    }

    if (ft === '6' || ft === '31') {
      return this.fetchHotSectorsFromFunds(ft);
    }
    return this.fetchHotSectorsFromSubjects(ft);
  },

  todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  loadSectorsFromStorage(fundType) {
    try {
      const raw = wx.getStorageSync(`sectors_${fundType}`);
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed.date !== this.todayKey()) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  },

  saveSectorsToStorage(fundType, data) {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const time = `${h}:${m}`;
    const entry = { date: this.todayKey(), time, data };
    try {
      wx.setStorageSync(`sectors_${fundType}`, entry);
    } catch (error) {
      // Ignore storage failures.
    }
    this.globalData.fetchTime = time;
  },

  fetchHotSectorsFromSubjects(fundType) {
    return this.request(URL_SUBJECT_LIST).then((raw) => {
      const list = this.unwrapList(raw);
      if (!list.length) return [];

      const subjects = list.slice(0, 24);
      const changePromises = subjects.map((item) => this.request(URL_FUND_RANK, {
        FundType: fundType,
        SortColumn: 'RZDF',
        Sort: 'desc',
        pageIndex: '1',
        pageSize: '1',
        ISABNORMAL: 'true',
        TOPICAL: item.INDEXCODE,
      }).then((rankRaw) => {
        const funds = this.unwrapList(rankRaw);
        return funds.length ? this.parseNumber(funds[0].RZDF, 0) : 0;
      }).catch(() => 0));

      return Promise.all(changePromises).then((changes) => {
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

        const linked = this.attachThemeLinks(valid);
        this.globalData.sectorsCache[fundType] = linked;
        this.saveSectorsToStorage(fundType, linked);
        return linked;
      });
    });
  },

  fetchHotSectorsFromFunds(fundType) {
    return this.request(URL_FUND_RANK, {
      FundType: fundType,
      SortColumn: 'RZDF',
      Sort: 'desc',
      pageIndex: '1',
      pageSize: '24',
      ISABNORMAL: 'true',
    }).then((raw) => {
      const list = this.unwrapList(raw);
      if (!list.length) return [];

      const sectors = list.slice(0, 24).map((item, index) => ({
        id: String(item.FCODE || `fund-${index}`),
        name: (item.SHORTNAME || item.NAME || `基金${index + 1}`).slice(0, 6),
        category: item.FTYPE || '其他',
        netInflow: Math.max(0.5, (24 - index) * 0.8 + Math.random() * 2),
        change: this.parseNumber(item.RZDF, 0),
        heat: Math.max(40, 99 - index * 2),
        rawCode: String(item.FCODE || ''),
        links: [],
      }));

      const linked = this.attachThemeLinks(sectors);
      this.globalData.sectorsCache[fundType] = linked;
      this.saveSectorsToStorage(fundType, linked);
      return linked;
    });
  },

  SORT_COLUMN_MAP: {
    daily: 'RZDF',
    weekly: 'SYL_Z',
    monthly: 'SYL_Y',
    all: 'SYL_LN',
  },

  CHANGE_FIELD_MAP: {
    daily: 'RZDF',
    weekly: 'SYL_Z',
    monthly: 'SYL_Y',
    all: 'SYL_LN',
  },

  fetchFundRank({ scope, sectorId, period, fundType, rawCode, purchasable }) {
    const ft = fundType || '0';
    const sortCol = this.SORT_COLUMN_MAP[period] || 'RZDF';
    const changeField = this.CHANGE_FIELD_MAP[period] || 'RZDF';
    const doFetch = (code) => {
      const params = {
        FundType: ft,
        SortColumn: sortCol,
        Sort: 'desc',
        pageIndex: '1',
        pageSize: '30',
        ISABNORMAL: 'true',
      };

      if (purchasable) {
        params.BUY = 'true';
      }

      if (scope === 'sector' && code) {
        params.TOPICAL = code;
      }

      return this.request(URL_FUND_RANK, params).then((raw) => {
        const list = this.unwrapList(raw);
        return list
          .filter((item) => !purchasable || item.BUY === true)
          .map((item) => ({
            name: item.SHORTNAME || item.NAME || '基金',
            code: item.FCODE || '',
            change: this.parseNumber(item[changeField], 0),
            sector: item.FTYPE || '其他',
            category: item.FTYPE || '其他',
          }));
      });
    };

    if (scope === 'sector' && rawCode) return doFetch(rawCode);

    if (scope === 'sector' && sectorId) {
      return this.ensureSectorsCache(ft).then(() => {
        const sector = this.getSectorById(sectorId, ft);
        return doFetch(sector && sector.rawCode);
      });
    }

    return doFetch(null);
  },

  ensureSectorsCache(fundType) {
    const ft = fundType || '0';
    if (this.globalData.sectorsCache[ft]) return Promise.resolve();
    return this.fetchHotSectors(ft).then(() => {});
  },

  fetchSectorFunds(sectorId, fundType, rawCode) {
    const ft = fundType || '0';
    const doFetch = (code) => {
      const params = {
        FundType: ft,
        SortColumn: 'RZDF',
        Sort: 'desc',
        pageIndex: '1',
        pageSize: '30',
        ISABNORMAL: 'true',
      };

      if (code) {
        params.TOPICAL = code;
      }

      return this.request(URL_FUND_RANK, params).then((raw) => {
        const list = this.unwrapList(raw);
        if (!list.length) return [];

        return list.slice(0, 30).map((item, index) => {
          const rawScale = this.parseNumber(item.ENDNAV, 0);
          const scale = rawScale > 100000 ? Math.max(1, Math.round(rawScale / 100000000)) : Math.max(1, Math.round(rawScale));
          const col = index % 4;
          const row = Math.floor(index / 4);

          return {
            id: `${sectorId}-${index}`,
            name: item.SHORTNAME || item.NAME || '基金',
            code: item.FCODE || '',
            company: item.JJGS || '',
            scale,
            change: this.parseNumber(item.RZDF, 0),
            x: 15 + col * 20,
            y: 15 + row * 12,
          };
        });
      });
    };

    if (rawCode) return doFetch(rawCode);

    return this.ensureSectorsCache(ft).then(() => {
      const sector = this.getSectorById(sectorId, ft);
      return doFetch(sector && sector.rawCode);
    });
  },

  getSectorById(sectorId, fundType) {
    const ft = fundType || '0';
    return (this.globalData.sectorsCache[ft] || []).find((s) => s.id === sectorId) || null;
  },

  attachThemeLinks(sectors) {
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
  },

  formatMoney(value) {
    if (value >= 100) return `${(value / 100).toFixed(1)}百亿`;
    return `${value.toFixed(1)}亿`;
  },

  getCategoryLabel(fundType) {
    const cat = CATEGORIES.find((c) => c.fundType === fundType);
    return cat ? cat.label : '基金';
  },

  // --- Visualization ---

  buildNetworkNodes(sectors, width, height) {
    const max = Math.max(...sectors.map((item) => item.netInflow), 1);
    const centerX = width / 2;
    const centerY = height / 2;
    const ring = Math.min(width, height) * 0.28;

    return sectors.map((item, index) => ({
      ...item,
      x: Math.round(centerX + Math.cos(index * 2.399) * ring * (0.8 + (index % 5) * 0.08)),
      y: Math.round(centerY + Math.sin(index * 2.399) * ring * (0.8 + (index % 4) * 0.08)),
      vx: 0,
      vy: 0,
      radius: Math.round(6 + (item.netInflow / max) * 14),
      labelLevel: index < 10 ? 1 : 0,
    }));
  },

  buildNetworkLinks(nodes) {
    const nodeMap = {};
    const links = [];
    const used = {};
    nodes.forEach((node) => {
      nodeMap[node.id] = node;
    });

    nodes.forEach((node) => {
      (node.links || []).forEach((targetId) => {
        const target = nodeMap[targetId];
        if (!target) return;

        const key = [node.id, target.id].sort().join('::');
        if (used[key]) return;
        used[key] = true;

        links.push({
          source: node,
          target,
          strength: node.category === target.category ? 1.18 : 0.86,
        });
      });
    });

    return links;
  },

  stepForceLayout(nodes, links, width, height, alpha = 0.08) {
    const centerX = width / 2;
    const centerY = height / 2;

    links.forEach((link) => {
      const source = link.source;
      const target = link.target;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const targetDistance = 46 + source.radius + target.radius;
      const force = (distance - targetDistance) * 0.018 * link.strength * alpha;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      if (!source.fixed) {
        source.vx += fx;
        source.vy += fy;
      }
      if (!target.fixed) {
        target.vx -= fx;
        target.vy -= fy;
      }
    });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distanceSq = Math.max(16, dx * dx + dy * dy);
        const distance = Math.sqrt(distanceSq);
        const charge = (a.category === b.category ? 620 : 920) * alpha / distanceSq;
        const fx = (dx / distance) * charge;
        const fy = (dy / distance) * charge;
        const minDistance = a.radius + b.radius + 14;

        if (!a.fixed) {
          a.vx -= fx;
          a.vy -= fy;
        }
        if (!b.fixed) {
          b.vx += fx;
          b.vy += fy;
        }

        if (distance < minDistance) {
          const push = (minDistance - distance) * 0.035 * alpha;
          if (!a.fixed) {
            a.vx -= (dx / distance) * push;
            a.vy -= (dy / distance) * push;
          }
          if (!b.fixed) {
            b.vx += (dx / distance) * push;
            b.vy += (dy / distance) * push;
          }
        }
      }
    }

    nodes.forEach((node) => {
      if (node.fixed) {
        node.vx = 0;
        node.vy = 0;
        return;
      }

      node.vx += (centerX - node.x) * 0.004 * alpha;
      node.vy += (centerY - node.y) * 0.004 * alpha;

      node.vx *= 0.88;
      node.vy *= 0.88;
      node.x += node.vx;
      node.y += node.vy;

      const padding = node.radius + 18;
      if (node.x < padding) {
        node.x = padding;
        node.vx *= -0.35;
      }
      if (node.x > width - padding) {
        node.x = width - padding;
        node.vx *= -0.35;
      }
      if (node.y < padding) {
        node.y = padding;
        node.vy *= -0.35;
      }
      if (node.y > height - padding) {
        node.y = height - padding;
        node.vy *= -0.35;
      }
    });
  },

  buildParticles(count, width, height) {
    return Array.from({ length: count }).map((_, index) => {
      const seed = index + 1;
      return {
        x: (seed * 47) % width,
        y: (seed * 71) % height,
        vx: (((seed * 13) % 11) - 5) / 18,
        vy: (((seed * 17) % 9) - 4) / 20,
        radius: 0.8 + (seed % 4) * 0.32,
        alpha: 0.18 + (seed % 5) * 0.05,
      };
    });
  },

  moveParticles(particles, width, height) {
    particles.forEach((particle) => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      if (particle.x < 0 || particle.x > width) particle.vx *= -1;
      if (particle.y < 0 || particle.y > height) particle.vy *= -1;
    });
    return particles;
  },

  fetchFundDetail(code) {
    return this.request(URL_FUND_DETAIL, { FCODE: code }).then((raw) => {
      const d = raw.Datas || raw.data || {};
      return {
        name: d.SHORTNAME || '',
        fullName: d.FULLNAME || '',
        type: d.FTYPE || '',
        company: d.JJGS || '',
        manager: d.JJJL || '',
        scale: this.parseNumber(d.ENDNAV, 0),
        established: d.ESTABDATE || '',
        benchmark: (d.BENCH || '').slice(0, 40),
        riskLevel: d.RISKLEVEL || '',
      };
    });
  },

  fetchFundHoldings(code) {
    return this.request(URL_FUND_HOLDINGS, { FCODE: code }).then((raw) => {
      const d = raw.Datas || {};
      const stocks = (d.fundStocks || []).map((s) => ({
        name: s.GPJC || '',
        code: s.GPDM || '',
        weight: this.parseNumber(s.JZBL, 0),
        change: s.PCTNVCHGTYPE || '',
        changeValue: this.parseNumber(s.PCTNVCHG, 0),
        industry: s.INDEXNAME || '',
      }));
      return stocks;
    });
  },

  hitTestNode(nodes, x, y) {
    return nodes.find((node) => {
      const dx = x - node.x;
      const dy = y - node.y;
      return Math.sqrt(dx * dx + dy * dy) <= node.radius + 8;
    });
  },
});
