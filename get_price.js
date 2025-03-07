const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
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
    'DYDX', 'LTC', 'ETC', 'ENS', 'ARB',
    'MKR', 'AVAX', 'THETA', 'JUP'
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
    'STONKS': '6NcdiK8B5KK2DzKvzvCfqi8EHaEqu48fyEzC8Mm9pump',
    'pnut': 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',
    'ai16z': 'HeLp6NuQkmYB4pYWo2zYs22mESHXPQYzXbB8n4V98jwC',
    'Trump': '6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN'
};

// 添加用于处理文件上传的中间件
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// 添加 Telegram Bot API 配置
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramChatId = process.env.TELEGRAM_CHAT_ID;

// 添加日期时间格式化函数
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 添加代币颜色配置
const tokenColors = {
    'swarms': 'rgb(255, 99, 132)',
    'arc': 'rgb(54, 162, 235)',
    'pippin': 'rgb(75, 192, 192)',
    'LUMO': 'rgb(153, 102, 255)',
    'ACT': 'rgb(255, 159, 64)',
    'GOAT': 'rgb(255, 99, 71)',
    'Fartcoin': 'rgb(50, 205, 50)',
    'SNAI': 'rgb(0, 128, 128)',
    'GRIFFAIN': 'rgb(255, 215, 0)',
    'BUZZ': 'rgb(128, 0, 128)',
    'listen': 'rgb(0, 191, 255)',
    'AVA': 'rgb(220, 20, 60)',
    'STONKS': 'rgb(46, 139, 87)',
    'pnut': 'rgb(210, 105, 30)',
    'ai16z': 'rgb(0, 0, 205)',
    'Trump': 'rgb(178, 34, 34)'
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
                const firstPrice = parseFloat(prices[prices.length - 1].price);
                const lastPrice = parseFloat(prices[0].price);
                const percentageChange = ((lastPrice - firstPrice) / firstPrice) * 100;
                
                const pricesWithPercentage = prices.map(item => ({
                    ...item,
                    percentageChange: ((parseFloat(item.price) - firstPrice) / firstPrice) * 100
                }));
                
                if (pricesWithPercentage.length > 0) {
                    pricesWithPercentage[0].percentageChange = percentageChange;
                }
                
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
            const firstPrice = parseFloat(response.data[0][4]);
            const lastPrice = parseFloat(response.data[response.data.length - 1][4]);
            const percentageChange = ((lastPrice - firstPrice) / firstPrice) * 100;
            
            const processedData = response.data.map(kline => ({
                time: kline[0].toString(),
                price: kline[4],
                percentageChange: ((parseFloat(kline[4]) - firstPrice) / firstPrice) * 100
            }));
            
            if (processedData.length > 0) {
                processedData[processedData.length - 1].percentageChange = percentageChange;
            }
            
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

// 修改API路由 - 直接执行数据获取
app.get('/api/prices', async (req, res) => {
    try {
        // 执行数据获取，然后返回最新数据
        await processTokens();
        res.json(okxTokenPricesData);
    } catch (error) {
        console.error('获取OKX代币数据失败:', error);
        res.status(500).json({ error: '获取数据时发生错误' });
    }
});

app.get('/api/binance-prices', async (req, res) => {
    try {
        // 执行数据获取，然后返回最新数据
        await processBinanceTokens();
        res.json(binanceTokenPricesData);
    } catch (error) {
        console.error('获取Binance代币数据失败:', error);
        res.status(500).json({ error: '获取数据时发生错误' });
    }
});

// 修改 Telegram 发送图片API
app.post('/api/send-to-telegram', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: '没有接收到图片' });
        }

        if (!telegramBotToken || !telegramChatId) {
            return res.status(500).json({ success: false, message: 'Telegram配置缺失' });
        }

        // 使用 form-data 库创建表单
        const formData = new FormData();
        formData.append('chat_id', telegramChatId);
        // 直接使用 buffer，不需要 Blob
        formData.append('photo', req.file.buffer, {
            filename: req.file.originalname,
            contentType: 'image/png'
        });
        
        // 如果需要添加图片说明
        const caption = `代币价格快照 (${new Date().toLocaleString('zh-CN')})`;
        formData.append('caption', caption);

        // 发送到Telegram Bot API
        const telegramResponse = await axios.post(
            `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`,
            formData,
            {
                headers: formData.getHeaders() // 现在这个方法是有效的
            }
        );

        if (telegramResponse.data && telegramResponse.data.ok) {
            res.json({ success: true, message: '图片已成功发送到Telegram' });
        } else {
            throw new Error('Telegram API 返回错误');
        }
    } catch (error) {
        console.error('发送图片到Telegram失败:', error);
        res.status(500).json({ 
            success: false, 
            message: `发送失败: ${error.message || '未知错误'}`
        });
    }
});

// 启动服务器
const PORT = process.env.PORT || 3040;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    
    // 启动时获取一次初始数据
    Promise.all([
        processTokens(),
        processBinanceTokens()
    ]).then(() => {
        console.log('初始数据加载完成');
    }).catch(error => {
        console.error('初始数据加载失败:', error);
    });
}); 