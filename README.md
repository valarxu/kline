# OKX Token Price Tracker

这是一个用于获取 OKX 平台上代币历史价格的 Node.js 程序。

## 功能特点

- 支持通过 OKX API 获取代币历史价格数据
- 支持本地代理配置
- 使用环境变量管理敏感配置

## 安装

1. 克隆仓库：
```bash
git clone [repository-url]
cd okx-token-price
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
```

## 使用方法

运行程序：
```bash
node get_price.js
```

## 代理配置

程序默认使用本地 4780 端口作为代理。如需修改，请在 `get_price.js` 中更新 `proxyConfig` 配置：

```javascript
const proxyConfig = {
    host: '127.0.0.1',
    port: 4780
};
```

## 注意事项

- 请确保 `.env` 文件不被提交到版本控制系统
- 使用前请确保本地代理服务器正常运行
- 请妥善保管 API 密钥等敏感信息 