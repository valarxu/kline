# DEX 代币价格追踪器

这是一个用于追踪和展示加密货币价格走势的 Node.js 应用程序。支持OKX平台上的代币和币安主流币种的价格数据展示。

## 功能特点

- 支持通过 OKX API 获取代币历史价格数据
- 支持通过 Binance API 获取主流币种价格数据
- 提供美观的Web界面展示价格走势图
- 支持多币种同时展示和对比
- 自动定时更新数据（每4小时）
- 支持图表交互（缩放、保存等）
- 使用环境变量管理敏感配置

## 安装

1. 克隆仓库：
```bash
git clone [repository-url]
cd dex-kline
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量：
创建 `.env` 文件并添加以下配置：
```
OKX_API_KEY=你的API密钥
OKX_SECRET_KEY=你的Secret密钥
OKX_PASSPHRASE=你的API密码
OKX_PROJECT_ID=你的项目ID
PORT=3040 # 可选，默认3040
```

## 使用方法

1. 启动服务器：
```bash
node get_price.js
```

2. 访问Web界面：
打开浏览器访问 `http://localhost:3040`

## 数据更新

- 服务启动时会自动获取首次数据
- 系统每4小时自动更新一次数据
- 可以通过Web界面的"刷新数据"按钮手动更新

## 图表功能

- 支持查看链上MEME代币和币安主流币的价格走势
- 提供144根1小时K线（6天）的MEME代币数据
- 提供120根4小时K线（20天）的币安主流币数据
- 支持图表缩放、数据筛选、图表保存等功能
- 显示实时价格和涨跌幅数据

## 支持的代币

### MEME代币
- swarms, arc, pippin, LUMO, ACT
- GOAT, Fartcoin, SNAI, GRIFFAIN
- BUZZ, listen, AVA, STONKS

### 币安主流币
- BTC, ETH, SOL, BNB, SUI
- XRP, DOGE, UNI, ADA, ATOM
- NEAR, APT, ENA, AAVE, LINK
- DYDX, LTC, ETC, ENS

## 注意事项

- 请确保 `.env` 文件不被提交到版本控制系统
- 请妥善保管 API 密钥等敏感信息
- 确保服务器有足够的内存来运行应用
- 建议使用PM2等进程管理工具来运行服务 