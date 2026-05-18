function getNodeColor(change) {
  const alpha = Math.min(0.95, 0.55 + Math.abs(change) / 8);
  if (change >= 0) {
    return `rgba(233, 75, 95, ${alpha})`;
  }
  return `rgba(22, 161, 119, ${alpha})`;
}

Page({
  data: {
    sectorId: '',
    sectorName: '板块详情',
    fundType: '0',
    funds: [],
    activeFund: null,
    themeClass: 'theme-light',
    themeText: '暗色',
  },

  onLoad(options) {
    const sectorId = options.id || '';
    const sectorName = decodeURIComponent(options.name || '板块');
    const fundType = options.fundType || '0';
    const rawCode = decodeURIComponent(options.rawCode || '');

    this.setData({
      sectorId,
      sectorName,
      fundType,
    });

    getApp().setCurrentSector({
      id: sectorId,
      name: sectorName,
      rawCode,
    });

    this.loadFunds(sectorId, fundType, rawCode);
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

  loadFunds(sectorId, fundType, rawCode) {
    getApp().fetchFundData({
      type: 'sectorFunds',
      sectorId,
      fundType,
      rawCode,
    }).then((funds) => {
      const maxScale = Math.max(...funds.map((item) => item.scale), 1);
      this.setData({
        funds: funds.map((item) => {
          const size = Math.round(92 + (item.scale / maxScale) * 58);
          return {
            ...item,
            size,
            halfSize: Math.round(size / 2),
            borderWidth: Math.max(2, Math.round(Math.abs(item.change))),
            color: getNodeColor(item.change),
            companyShort: (item.name || '').slice(0, 4),
            changeText: `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`,
          };
        }),
      });
    });
  },

  showFund(event) {
    const id = event.currentTarget.dataset.id;
    const fund = this.data.funds.find((item) => item.id === id);
    if (fund && fund.code) {
      wx.navigateTo({
        url: `/pages/fund-detail/fund-detail?code=${fund.code}`,
      });
    }
  },

  closeFund() {
    this.setData({ activeFund: null });
  },

  noop() {},

  goRank() {
    getApp().globalData.currentFundType = this.data.fundType;
    wx.switchTab({
      url: '/pages/rank/rank',
    });
  },
});
