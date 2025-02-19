const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.static('public'));

// 存储所有代币的价格数据
let okxTokenPricesData = {};
let binanceTokenPricesData = {};

// OKX配置
const okxConfig = {
    apiKey: process.env.OKX_API_KEY,
    secretKey: process.env.OKX_SECRET_KEY,
    passphrase: process.env.OKX_PASSPHRASE,
    projectId: process.env.OKX_PROJECT_ID
};

// Binance代币列表
const binanceTokens = [
    'BTC', 'ETH', 'SOL', 'BNB', 'SUI', 
    'XRP', 'DOGE', 'UNI', 'ADA', 'ATOM',
    'NEAR', 'APT', 'ENA', 'AAVE', 'LINK',
    'DYDX', 'LTC', 'ETC', 'ENS'
];

// 代币地址枚举
const tokenAddresses = {
    'swarms': '74SBV4zDXxTRgv1pEMoECskKBkZHc2yGPnc7GYVepump',
    'arc': '61V8vBaqAGMpgDQi4JcAwo1dmBGHsyhzodcPqnEVpump',
    'pippin': 'Dfh5DzRgSvvCFDoYc2ciTkMrbDfRKybA4SoFbPmApump',
    'LUMO': '4FkNq8RcCYg4ZGDWh14scJ7ej3m5vMjYTcWoJVkupump',
    'ACT': 'GJAFwWjJ3vnTsrQVabjBVK2TYB1YtRCQXRDfDgUnpump',
    'GOAT': 'CzLSujWBLFsSjncfkh59rUFqvafWcY5tzedWJSuypump',
    'Fartcoin': '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
    'SNAI': 'Hjw6bEcHtbHGpQr8onG3izfJY5DJiWdt7uk2BfdSpump',
    'GRIFFAIN': 'KENJSUYLASHUMfHyy5o4Hp2FdNqZg1AsUPhfH2kYvEP',
    'BUZZ': '9DHe3pycTuymFk4H4bbPoAJ4hQrr2kaLDF6J6aAKpump',
    'listen': 'Cn5Ne1vmR9ctMGY9z5NC71A3NYFvopjXNyxYtfVYpump',
    'AVA': 'DKu9kykSfbN5LBfFXtNNDPaX35o4Fv6vJ9FKk7pZpump',
    'STONKS': '6NcdiK8B5KK2DzKvzvCfqi8EHaEqu48fyEzC8Mm9pump'
};

// 生成签名
function sign(timestamp, method, requestPath, body = '') {
    const message = timestamp + method + requestPath + body;
    const hmac = crypto.createHmac('sha256', okxConfig.secretKey);
    return hmac.update(message).digest('base64');
}

// 延时函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 获取单个代币的历史价格
async function getTokenPrice(tokenName, tokenAddress) {
    const timestamp = new Date().toISOString();
    const method = 'GET';
    const chainIndex = '501';
    const baseUrl = 'https://www.okx.com';
    const requestPath = `/api/v5/wallet/token/historical-price?chainIndex=${chainIndex}&tokenAddress=${tokenAddress}&limit=144&period=1h`;

    try {
        const response = await axios({
            method: method,
            url: baseUrl + requestPath,
            headers: {
                'OK-ACCESS-KEY': okxConfig.apiKey,
                'OK-ACCESS-SIGN': sign(timestamp, method, requestPath),
                'OK-ACCESS-TIMESTAMP': timestamp,
                'OK-ACCESS-PASSPHRASE': okxConfig.passphrase,
                'OK-ACCESS-PROJECT': okxConfig.projectId
            }
        });

        if (response.data && response.data.data && response.data.data[0] && response.data.data[0].prices) {
            const prices = response.data.data[0].prices;
            if (prices.length > 0) {
                const basePrice = parseFloat(prices[prices.length - 1].price);
                const reversedPrices = [...prices].reverse();
                const pricesWithPercentage = reversedPrices.map(item => ({
                    ...item,
                    percentageChange: ((parseFloat(item.price) - basePrice) / basePrice) * 100
                }));
                okxTokenPricesData[tokenName] = pricesWithPercentage;
            } else {
                okxTokenPricesData[tokenName] = prices;
            }
            console.log(`获取 ${tokenName} 代币数据成功`);
            return true;
        } else {
            console.log(`获取 ${tokenName} 代币数据失败：数据格式不正确`);
            return false;
        }
    } catch (error) {
        console.error(`获取 ${tokenName} 代币数据失败：`, error.message);
        return false;
    }
}

// 获取单个Binance代币的K线数据
async function getBinanceTokenKlines(token) {
    try {
        const symbol = `${token}USDT`;
        const url = `https://api.binance.com/api/v3/klines`;
        const response = await axios.get(url, {
            params: {
                symbol: symbol,
                interval: '4h',
                limit: 120
            }
        });

        if (response.data && Array.isArray(response.data)) {
            const basePrice = parseFloat(response.data[0][4]);
            const processedData = response.data.map(kline => ({
                time: kline[0].toString(),
                price: kline[4],
                percentageChange: ((parseFloat(kline[4]) - basePrice) / basePrice) * 100
            }));
            
            binanceTokenPricesData[token] = processedData;
            console.log(`获取 Binance ${token} 数据成功`);
            return true;
        } else {
            console.log(`获取 Binance ${token} 数据失败：数据格式不正确`);
            return false;
        }
    } catch (error) {
        console.error(`获取 Binance ${token} 数据失败：`, error.message);
        return false;
    }
}

// 批量处理代币
async function processTokens() {
    const tokenEntries = Object.entries(tokenAddresses);
    const batchSize = 5;

    for (let i = 0; i < tokenEntries.length; i += batchSize) {
        const batch = tokenEntries.slice(i, i + batchSize);
        await Promise.all(batch.map(([name, address]) => getTokenPrice(name, address)));
        if (i + batchSize < tokenEntries.length) {
            await delay(1000);
        }
    }
}

// 批量处理Binance代币
async function processBinanceTokens() {
    const batchSize = 5;
    
    for (let i = 0; i < binanceTokens.length; i += batchSize) {
        const batch = binanceTokens.slice(i, i + batchSize);
        await Promise.all(batch.map(token => getBinanceTokenKlines(token)));
        if (i + batchSize < binanceTokens.length) {
            await delay(1000);
        }
    }
}

// API路由
app.get('/api/prices', (req, res) => {
    res.json(okxTokenPricesData);
});

app.get('/api/binance-prices', (req, res) => {
    res.json(binanceTokenPricesData);
});

// 启动服务器
const PORT = process.env.PORT || 3040;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    
    // 启动后立即获取数据
    processTokens();
    processBinanceTokens();
    
    // 使用 cron 设置定时任务，每4小时执行一次
    cron.schedule('0 */4 * * *', () => {
        console.log('执行定时任务：更新价格数据');
        processTokens();
        processBinanceTokens();
    });
}); 