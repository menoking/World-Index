Page({
  data: {
    code: '',
    detail: null,
    holdings: [],
    loading: true,
    themeClass: 'theme-light',
    themeText: '暗色',
  },

  onLoad(options) {
    this.setData({ code: options.code || '' });
    this.loadDetail(options.code);
    this.loadHoldings(options.code);
  },

  onShow() {
    this.syncTheme();
  },

  syncTheme() {
    const theme = getApp().globalData.theme || 'light';
    this.setData({
      themeClass: `theme-${theme}`,
      themeText: theme === 'dark' ? '亮色' : '暗色',
    });
  },

  toggleTheme() {
    getApp().toggleTheme();
    this.syncTheme();
  },

  loadDetail(code) {
    getApp().fetchFundData({ type: 'fundDetail', code }).then((detail) => {
      const scaleNum = detail.scale;
      let scaleText;
      if (scaleNum > 100000000) {
        scaleText = `${(scaleNum / 100000000).toFixed(2)} 亿`;
      } else if (scaleNum > 10000) {
        scaleText = `${(scaleNum / 10000).toFixed(2)} 万`;
      } else {
        scaleText = `${scaleNum.toFixed(2)} 元`;
      }
      this.setData({ detail: { ...detail, scaleText } });
    }).catch(() => {});
  },

  loadHoldings(code) {
    getApp().fetchFundData({ type: 'fundHoldings', code }).then((holdings) => {
      this.setData({ holdings, loading: false });
    }).catch(() => {
      this.setData({ loading: false });
    });
  },
});
