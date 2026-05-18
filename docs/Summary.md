**你能改哪些**

- 标题/文字：改 app.json 和各页面 .wxml / .json
- 图标：替换 static/icon_map.png、static/icon_doc.png，或改 app.json 的 iconPath
- 主题颜色：改 app.less 里的 .theme-light / .theme-dark
- 板块/基金/指数基金/混合基金：改 utils/fetchFundData.js
- 云函数真实接口：改 cloudfunctions/fetchFundData/index.js
- 网络图布局/粒子/连线：改 utils/chart.js 和 pages/index/index.js

**文件树核心**

text



```
WorldIndex/ ├─ app.js                         # 全局状态：当前板块、主题 ├─ app.json                       # 页面路由、tabBar、云函数目录 ├─ app.less                       # 全局样式、亮/暗主题变量 ├─ pages/ │  ├─ index/                      # 世界网络：Canvas 粒子、节点、连线 │  ├─ rank/                       # 热度指数：每日/每周、全市场/板块榜 │  └─ sector-detail/              # 板块详情：可拖拽缩放热力图 ├─ utils/ │  ├─ fetchFundData.js            # 小程序端数据层与 mock 板块库 │  └─ chart.js                    # 网络节点布局、粒子、命中检测 ├─ cloudfunctions/ │  └─ fetchFundData/              # 云函数数据接口骨架 └─ static/                        # 图标与图片资源 
```