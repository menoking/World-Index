Page({
  data: {
    period: 'daily',
    purchasable: false,
    currentSector: null,
    scopeText: '全市场基金涨幅榜',
    funds: [],
    themeClass: 'theme-light',
    themeText: '暗色',
  },

  onShow() {
    this.syncTheme();
    this.syncScope();
    this.loadRank();
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

  syncScope() {
    const currentSector = getApp().globalData.currentSector;
    const fundType = getApp().globalData.currentFundType || '0';
    const catLabel = getApp().getCategoryLabel(fundType);
    this.setData({
      currentSector,
      scopeText: currentSector
        ? `${currentSector.name} · ${catLabel}涨幅榜`
        : `${catLabel}涨幅榜`,
    });
  },

  loadRank() {
    const currentSector = this.data.currentSector;
    const fundType = getApp().globalData.currentFundType || '0';
    getApp().fetchFundData({
      type: 'fundRank',
      scope: currentSector ? 'sector' : 'all',
      sectorId: currentSector && currentSector.id,
      rawCode: currentSector && currentSector.rawCode,
      period: this.data.period,
      fundType,
      purchasable: this.data.purchasable,
    }).then((funds) => {
      this.setData({
        funds: funds.map((item) => ({
          ...item,
          changeText: `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`,
        })),
      });
    });
  },

  switchPeriod(event) {
    const period = event.currentTarget.dataset.period;
    if (period === this.data.period) return;

    this.setData({ period });
    this.loadRank();
  },

  togglePurchasable() {
    const purchasable = !this.data.purchasable;
    this.setData({ purchasable });
    this.loadRank();
  },

  clearSector() {
    getApp().clearCurrentSector();
    this.syncScope();
    this.loadRank();
  },

  openFund(event) {
    const code = event.currentTarget.dataset.code;
    if (code) {
      wx.navigateTo({
        url: `/pages/fund-detail/fund-detail?code=${code}`,
      });
    }
  },
});
