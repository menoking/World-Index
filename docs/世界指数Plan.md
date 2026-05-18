# 世界指数Plan

### 🗺️ 分阶段执行计划

#### 第一阶段：基础页面框架搭建 (Foundation)

1. **`app.json` 全局配置**
   - 创建 `pages/index/index`（首页）和 `pages/rank/rank`（排名页）。
   - 在 `app.json` 中配置 `tabBar`，包含上述两个页面，设置图标与文字。
2. **首页 `pages/index/index`**
   - 页面顶部标题设为“世界网络”。
   - 页面中部预留一个 `canvas` 组件区域，用于后续绘制网络图。
3. **排名页 `pages/rank/rank`**
   - 页面顶部标题设为“热度指数”。
   - 添加两个 `view` 组件作为Tab切换“每日”和“每周”，并为选中态添加高亮样式。
   - 下方预留一个 `scroll-view` 组件用于展示排名列表。

#### 第二阶段：数据处理层建设 (Data Layer)

1. **创建云函数 `fetchFundData`**
   - 实现以下三个核心功能：
     - **`type='hotSectors'`**：请求东方财富行业/概念板块资金流向接口，获取资金净流入排名靠前的板块，作为“热度板块”数据。
     - **`type='sectorFunds'`**：输入板块名称/ID，请求天天基金接口，返回该板块内按规模或涨幅排序的知名基金列表。
     - **`type='fundRank'`**：输入“全市场”或“某板块”，请求天天基金排行接口，返回对应范围内涨幅最高的基金榜单。

#### 第三阶段：核心功能开发 (Core Features)

1. **“世界网络”交互功能** (`pages/index/index`)

   - **网络图绘制**：调用 `fetchFundData({type:'hotSectors'})` 获取数据后，使用canvas绑定触摸事件实现：
     - **节点**：每个板块作为一个圆形节点，节点大小与该板块“资金净流入”数额成正比。
     - **连线**：在存在联动关系的板块之间绘制连线，连线的粗细代表关联度（后续可根据实际算法调整）。
     - **节点位置**：为简化实现，可先预设几个坐标位置；后续可优化为根据数据动态布局。
     - **点击事件**：点击节点时调用 `wx.navigateTo` 跳转至“子级网络”页面，并携带该板块的ID和名称。
   - **全局状态管理**：
     - 在 `app.js` 中设置 `globalData.currentSector` 变量。
     - 首页点击进入子页面时更新该变量，返回时根据此变量判断排名页如何展示。

2. **“子级网络”交互功能** (新建 `pages/sector-detail/sector-detail`)

   - **参数接收**：通过 `onLoad(options)` 接收上一页传递的板块ID/名称。
   - **数据获取**：调用 `fetchFundData({type:'sectorFunds', sectorId: options.id})`。
   - **UI设计**：采用**地图式热力图**展示基金公司：
     - 页面背景可设置为中国地图轮廓或抽象棋盘格。
     - 每个基金公司以一个圆形节点或卡片形式呈现，**位置相对固定但分布在地图上**（可预设坐标或让AI设计简单布局）。
     - 节点大小表示基金公司的资产规模/资金容量。
     - 节点颜色深浅/边框粗细表示资本走势（上涨用红色系，下跌用绿色系，幅度越大颜色越深）。
     - 支持缩放和平移手势（可让AI使用 `movable-view` 或处理触摸事件实现）。
     - 点击节点可进一步查看该公司详细数据（弹窗或新页面）。

3. **“热度指数”智能切换** (`pages/rank/rank`)

   - **默认状态**：`app.globalData.currentSector` 为空时，调用 `fetchFundData({type:'fundRank', scope:'all'})` 展示全市场基金涨幅榜。

   - **联动状态**：`currentSector` 不为空时，调用 `fetchFundData({type:'fundRank', scope:'sector', sectorId: currentSector.id})` 展示该板块基金涨幅榜。

   - **列表渲染**：用 `wx:for` 渲染基金排名列表，每个item展示基金名称、代码、估算涨幅（红色/绿色标识）。

     

     

     ## 项目目录示例

miniprogram/
├── app.js
├── app.json
├── app.wxss
├── pages/
│   ├── index/              # 世界网络首页
│   │   ├── index.js
│   │   ├── index.wxml
│   │   └── index.wxss
│   ├── rank/               # 热度指数排名
│   │   ├── rank.js
│   │   ├── rank.wxml
│   │   └── rank.wxss
│   └── sector-detail/      # 子级网络（板块详情）
│       ├── sector-detail.js
│       ├── sector-detail.wxml
│       └── sector-detail.wxss
├── cloudfunctions/         # 云函数
│   └── fetchFundData/
│       ├── index.js
│       └── package.json
└── utils/                  # 工具函数
    └── chart.js            # Canvas绘图辅助