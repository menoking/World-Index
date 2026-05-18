const CANVAS_WIDTH = 343;
const CANVAS_HEIGHT = 380;
const CATEGORIES = [
  { key: 'astock', label: 'A股基金', fundType: '0' },
  { key: 'index', label: '指数基金', fundType: '26' },
  { key: 'qdii', label: 'QDII基金', fundType: '6' },
  { key: 'bond', label: '债券基金', fundType: '31' },
];

Page({
  data: {
    sectors: [],
    topSector: {},
    categories: CATEGORIES,
    currentCategory: '0',
    fetchTime: '',
    themeClass: 'theme-light',
    themeText: '暗色',
  },

  onLoad() {
    this.nodes = [];
    this.links = [];
    this.viewport = { scale: 1, x: 0, y: 0 };
    this.touchState = null;
    this.particles = getApp().buildParticles(28, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.loadSectors('0');
  },

  onShow() {
    this.syncTheme();
    if (this.data.sectors.length) {
      this.startNetworkLoop();
    }
  },

  onHide() {
    this.stopNetworkLoop();
  },

  onUnload() {
    this.stopNetworkLoop();
  },

  onReady() {
    this.canvasRect = null;
    this.getCanvasRect();
  },

  switchCategory(event) {
    const fundType = event.currentTarget.dataset.type;
    if (fundType === this.data.currentCategory) return;
    this.setData({ currentCategory: fundType, sectors: [], topSector: {} });
    this.stopNetworkLoop();
    getApp().globalData.currentFundType = fundType;
    this.loadSectors(fundType);
  },

  refreshData() {
    const fundType = this.data.currentCategory;
    this.setData({ sectors: [], topSector: {} });
    this.stopNetworkLoop();
    delete getApp().globalData.sectorsCache[fundType];
    this.loadSectors(fundType, true);
  },

  loadSectors(fundType, forceRefresh) {
    getApp().fetchFundData({ type: 'hotSectors', fundType, forceRefresh }).then((data) => {
      const sectors = data.map((item) => ({
        ...item,
        netInflowText: getApp().formatMoney(item.netInflow),
        changeText: `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`,
      }));

      this.setData({
        sectors,
        topSector: sectors[0] || {},
        fetchTime: getApp().globalData.fetchTime || '',
      });
      this.nodes = getApp().buildNetworkNodes(sectors, CANVAS_WIDTH, CANVAS_HEIGHT);
      this.links = getApp().buildNetworkLinks(this.nodes);
      this.prewarmForceLayout();
      this.startNetworkLoop();
    });
  },

  prewarmForceLayout() {
    for (let i = 0; i < 220; i += 1) {
      const alpha = Math.max(0.18, 1 - i / 220);
      getApp().stepForceLayout(this.nodes, this.links, CANVAS_WIDTH, CANVAS_HEIGHT, alpha);
    }
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
    this.drawNetworkFrame();
  },

  startNetworkLoop() {
    this.stopNetworkLoop();
    this.drawNetworkFrame();
    this.networkTimer = setInterval(() => {
      this.drawNetworkFrame();
    }, 80);
  },

  stopNetworkLoop() {
    if (this.networkTimer) {
      clearInterval(this.networkTimer);
      this.networkTimer = null;
    }
  },

  drawNetworkFrame() {
    const ctx = wx.createCanvasContext('worldNetwork', this);
    const theme = getApp().globalData.theme || 'light';
    const palette = this.getPalette(theme);
    const nodes = this.nodes;
    const links = this.links;
    getApp().stepForceLayout(nodes, links, CANVAS_WIDTH, CANVAS_HEIGHT, 0.055);
    this.particles = getApp().moveParticles(this.particles, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.drawBackground(ctx, palette);

    this.drawParticles(ctx, this.particles, palette);
    this.drawLinks(ctx, links, palette);
    this.drawNodes(ctx, nodes, palette);
    ctx.draw();
  },

  getPalette(theme) {
    if (theme === 'dark') {
      return {
        background: '#191e29',
        glowA: 'rgba(231, 160, 168, 0.16)',
        glowB: 'rgba(121, 211, 181, 0.10)',
        particle: 'rgba(238, 242, 247, ',
        link: 'rgba(186, 197, 214, 0.23)',
        linkStrong: 'rgba(231, 160, 168, 0.36)',
        text: '#eef2f7',
        positive: 'rgba(239, 160, 168, 0.9)',
        negative: 'rgba(121, 211, 181, 0.86)',
        halo: 'rgba(231, 160, 168, 0.16)',
        labelBg: 'rgba(25, 30, 41, 0.58)',
      };
    }

    return {
      background: '#fffaf4',
      glowA: 'rgba(217, 107, 117, 0.12)',
      glowB: 'rgba(47, 154, 127, 0.08)',
      particle: 'rgba(36, 48, 68, ',
      link: 'rgba(86, 100, 124, 0.21)',
      linkStrong: 'rgba(217, 107, 117, 0.34)',
      text: '#243044',
      positive: 'rgba(217, 107, 117, 0.88)',
      negative: 'rgba(47, 154, 127, 0.86)',
      halo: 'rgba(217, 107, 117, 0.14)',
      labelBg: 'rgba(255, 250, 244, 0.72)',
    };
  },

  drawBackground(ctx, palette) {
    ctx.setFillStyle(palette.background);
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.beginPath();
    ctx.setFillStyle(palette.glowA);
    ctx.arc(CANVAS_WIDTH * 0.34, CANVAS_HEIGHT * 0.28, 116, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.setFillStyle(palette.glowB);
    ctx.arc(CANVAS_WIDTH * 0.72, CANVAS_HEIGHT * 0.7, 132, 0, Math.PI * 2);
    ctx.fill();
  },

  drawParticles(ctx, particles, palette) {
    particles.forEach((particle) => {
      const point = this.toScreen(particle.x, particle.y);
      ctx.beginPath();
      ctx.setFillStyle(`${palette.particle}${particle.alpha})`);
      ctx.arc(point.x, point.y, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    });
  },

  drawLinks(ctx, links, palette) {
    links.forEach((link) => {
      const source = link.source;
      const target = link.target;
      const sourcePoint = this.toScreen(source.x, source.y);
      const targetPoint = this.toScreen(target.x, target.y);
      ctx.beginPath();
      ctx.setStrokeStyle(source.category === target.category ? palette.linkStrong : palette.link);
      ctx.setLineWidth((source.category === target.category ? 1.4 : 0.8) * Math.sqrt(this.viewport.scale));
      ctx.moveTo(sourcePoint.x, sourcePoint.y);
      ctx.lineTo(targetPoint.x, targetPoint.y);
      ctx.stroke();
    });
  },

  drawNodes(ctx, nodes, palette) {
    nodes.forEach((node) => {
      const positive = node.change >= 0;
      const point = this.toScreen(node.x, node.y);
      const radius = this.getScreenRadius(node);
      ctx.beginPath();
      ctx.setFillStyle(palette.halo);
      ctx.arc(point.x, point.y, radius + 9 * Math.sqrt(this.viewport.scale), 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setFillStyle(positive ? palette.positive : palette.negative);
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.setStrokeStyle('rgba(255, 255, 255, 0.72)');
      ctx.setLineWidth(1.4);
      ctx.arc(point.x, point.y, radius + 2, 0, Math.PI * 2);
      ctx.stroke();

      this.drawNodeLabel(ctx, node, palette, point, radius);
    });
  },

  drawNodeLabel(ctx, node, palette, point, radius) {
    const text = node.name;
    const fontSize = this.getLabelFontSize(node);
    const labelWidth = Math.max(30, text.length * fontSize + 10);
    const labelHeight = fontSize + 8;
    const labelX = point.x - labelWidth / 2;
    const labelY = point.y + radius + 5;

    ctx.setFillStyle(palette.labelBg);
    ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
    ctx.setFillStyle(palette.text);
    ctx.setFontSize(fontSize);
    ctx.setTextAlign('center');
    ctx.fillText(text, point.x, labelY + fontSize + 2);
  },

  getScreenRadius(node) {
    return Math.max(4, node.radius * Math.sqrt(this.viewport.scale));
  },

  getLabelFontSize(node) {
    const base = node.radius >= 16 ? 10 : node.radius >= 11 ? 8 : 7;
    return Math.max(7, Math.min(15, Math.round(base * Math.sqrt(this.viewport.scale))));
  },

  toScreen(x, y) {
    return {
      x: x * this.viewport.scale + this.viewport.x,
      y: y * this.viewport.scale + this.viewport.y,
    };
  },

  toWorld(x, y) {
    return {
      x: (x - this.viewport.x) / this.viewport.scale,
      y: (y - this.viewport.y) / this.viewport.scale,
    };
  },

  onCanvasTap(event) {
    this.getCanvasRect().then((rect) => {
      const touches = event.touches || [];
      if (touches.length >= 2) {
        this.touchState = this.createPinchState(touches, rect);
        return;
      }

      const touch = touches[0];
      if (!touch) return;

      const canvasPoint = this.clientToCanvas(touch, rect);
      const worldPoint = this.toWorld(canvasPoint.x, canvasPoint.y);
      const node = getApp().hitTestNode(this.nodes, worldPoint.x, worldPoint.y);
      if (node) {
        node.fixed = true;
        this.touchState = {
          type: 'node',
          node,
          moved: false,
          startX: canvasPoint.x,
          startY: canvasPoint.y,
          lastX: canvasPoint.x,
          lastY: canvasPoint.y,
        };
        return;
      }

      this.touchState = {
        type: 'pan',
        moved: false,
        startX: canvasPoint.x,
        startY: canvasPoint.y,
        lastX: canvasPoint.x,
        lastY: canvasPoint.y,
      };
    });
  },

  onCanvasMove(event) {
    if (!this.touchState) return;

    this.getCanvasRect().then((rect) => {
      const touches = event.touches || [];
      if (touches.length >= 2) {
        if (this.touchState.type !== 'pinch') {
          this.touchState = this.createPinchState(touches, rect);
        }
        this.updatePinch(touches, rect);
        return;
      }

      const touch = touches[0];
      if (!touch) return;
      const point = this.clientToCanvas(touch, rect);
      const state = this.touchState;
      const dx = point.x - state.lastX;
      const dy = point.y - state.lastY;
      const totalMove = Math.abs(point.x - state.startX) + Math.abs(point.y - state.startY);
      state.moved = state.moved || totalMove > 5;

      if (state.type === 'node') {
        const worldPoint = this.toWorld(point.x, point.y);
        state.node.x = worldPoint.x;
        state.node.y = worldPoint.y;
        state.node.vx = 0;
        state.node.vy = 0;
      }

      if (state.type === 'pan') {
        this.viewport.x += dx;
        this.viewport.y += dy;
      }

      state.lastX = point.x;
      state.lastY = point.y;
    });
  },

  onCanvasEnd() {
    if (!this.touchState) return;

    if (this.touchState.type === 'node') {
      this.touchState.node.fixed = false;
      if (!this.touchState.moved) {
        this.openSector(this.touchState.node);
      }
    }

    this.touchState = null;
  },

  clientToCanvas(touch, rect) {
    return {
      x: ((touch.clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((touch.clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    };
  },

  createPinchState(touches, rect) {
    const first = this.clientToCanvas(touches[0], rect);
    const second = this.clientToCanvas(touches[1], rect);
    const center = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };

    return {
      type: 'pinch',
      startDistance: this.getTouchDistance(first, second),
      startScale: this.viewport.scale,
      startOffsetX: this.viewport.x,
      startOffsetY: this.viewport.y,
      center,
      worldCenter: this.toWorld(center.x, center.y),
    };
  },

  updatePinch(touches, rect) {
    const first = this.clientToCanvas(touches[0], rect);
    const second = this.clientToCanvas(touches[1], rect);
    const distance = this.getTouchDistance(first, second);
    const state = this.touchState;
    const nextScale = Math.max(0.7, Math.min(3.2, state.startScale * (distance / state.startDistance)));
    const center = {
      x: (first.x + second.x) / 2,
      y: (first.y + second.y) / 2,
    };

    this.viewport.scale = nextScale;
    this.viewport.x = center.x - state.worldCenter.x * nextScale;
    this.viewport.y = center.y - state.worldCenter.y * nextScale;
  },

  getTouchDistance(first, second) {
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    return Math.max(1, Math.sqrt(dx * dx + dy * dy));
  },

  getCanvasRect() {
    if (this.canvasRect) {
      return Promise.resolve(this.canvasRect);
    }

    return new Promise((resolve) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#worldNetwork')
        .boundingClientRect((rect) => {
          this.canvasRect = rect;
          resolve(rect);
        })
        .exec();
    });
  },

  openSectorFromList(event) {
    const id = event.currentTarget.dataset.id;
    const sector = this.data.sectors.find((item) => item.id === id);
    if (sector) {
      this.openSector(sector);
    }
  },

  openSector(sector) {
    const fundType = this.data.currentCategory;

    if (fundType === '6' || fundType === '31') {
      wx.navigateTo({
        url: `/pages/fund-detail/fund-detail?code=${sector.rawCode}`,
      });
      return;
    }

    getApp().setCurrentSector({
      id: sector.id,
      name: sector.name,
      rawCode: sector.rawCode || '',
    });

    wx.navigateTo({
      url: `/pages/sector-detail/sector-detail?id=${sector.id}&name=${encodeURIComponent(sector.name)}&fundType=${fundType}&rawCode=${encodeURIComponent(sector.rawCode || '')}`,
    });
  },

  goRank() {
    getApp().globalData.currentFundType = this.data.currentCategory;
    wx.switchTab({
      url: '/pages/rank/rank',
    });
  },
});
