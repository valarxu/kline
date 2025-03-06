const axios = require('axios');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const multer = require('multer');
const FormData = require('form-data');
const { createCanvas, registerFont, Image } = require('canvas');
const Chart = require('chart.js/auto');
require('chartjs-adapter-date-fns');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
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

// 修改图表生成函数，确保正确处理日期
async function generateChartsAndSendToTelegram() {
    console.log('开始执行自动图表生成任务...');
    
    try {
        // 1. 确保数据已更新
        await Promise.all([
            processTokens(),
            processBinanceTokens()
        ]);
        
        console.log('数据已更新，准备生成图表...');
        
        // 2. 创建大型画布
        const width = 1800;
        const height = 2400;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
            width, 
            height, 
            backgroundColour: '#ffffff',
            plugins: {
                modern: ['chartjs-adapter-date-fns']
            }
        });
        
        // 3. 创建主画布
        const mainCanvas = createCanvas(width, height);
        const mainCtx = mainCanvas.getContext('2d');
        mainCtx.fillStyle = '#ffffff';
        mainCtx.fillRect(0, 0, width, height);
        
        // 4. 添加标题
        mainCtx.fillStyle = '#333333';
        mainCtx.font = 'bold 32px Arial';
        mainCtx.fillText('链上MEME代币', 20, 40);
        
        // 添加更新时间
        const updateTime = `更新时间: ${formatDateTime(new Date())}`;
        mainCtx.font = '18px Arial';
        mainCtx.fillStyle = '#999999';
        mainCtx.fillText(updateTime, width - 400, 40);
        
        // 5. 绘制MEME代币图表
        // 获取并排序代币数据
        const memeTokenChanges = {};
        Object.entries(okxTokenPricesData).forEach(([tokenName, prices]) => {
            if (prices && prices.length > 0) {
                try {
                    const sortedPrices = [...prices].sort((a, b) => parseInt(a.time) - parseInt(b.time));
                    const firstPrice = parseFloat(sortedPrices[0].price);
                    const lastPrice = parseFloat(sortedPrices[sortedPrices.length - 1].price);
                    const percentageChange = ((lastPrice - firstPrice) / firstPrice) * 100;
                    memeTokenChanges[tokenName] = {
                        change: percentageChange,
                        prices: sortedPrices.map(item => ({
                            time: new Date(parseInt(item.time)),
                            price: parseFloat(item.price)
                        }))
                    };
                } catch (err) {
                    console.error(`处理${tokenName}数据时出错:`, err);
                }
            }
        });
        
        // 按涨跌幅排序
        const sortedMemeTokens = Object.entries(memeTokenChanges)
            .sort((a, b) => b[1].change - a[1].change)
            .map(([token, data]) => ({ 
                name: token, 
                change: data.change, 
                prices: data.prices 
            }));
        
        // 绘制每个MEME代币图表
        const chartWidth = 400;
        const chartHeight = 200;
        const cols = 4;
        let row = 0;
        let col = 0;
        
        for (const token of sortedMemeTokens.slice(0, 16)) { // 限制为16个代币
            try {
                const chartData = token.prices.map(item => ({
                    x: item.time,
                    y: item.price
                }));
                
                const color = tokenColors[token.name] || `rgb(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)})`;
                
                // 创建单个图表
                const chartConfig = {
                    type: 'line',
                    data: {
                        datasets: [{
                            label: token.name,
                            data: chartData,
                            borderColor: color,
                            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.2)'),
                            fill: true,
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: false,
                        plugins: {
                            title: {
                                display: true,
                                text: `${token.name} (${token.change >= 0 ? '+' : ''}${token.change.toFixed(1)}%)`,
                                color: token.change >= 0 ? '#2ecc40' : '#ff4136'
                            },
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: 'day',
                                    displayFormats: {
                                        day: 'MM/dd'
                                    }
                                },
                                ticks: {
                                    maxRotation: 0
                                }
                            },
                            y: {
                                ticks: {
                                    callback: (value) => '$' + value.toFixed(4)
                                }
                            }
                        }
                    }
                };
                
                const chartImage = await chartJSNodeCanvas.renderToBuffer(chartConfig);
                const chartImg = new Image();
                chartImg.onload = () => {
                    const xPos = 20 + col * (chartWidth + 20);
                    const yPos = 60 + row * (chartHeight + 30);
                    mainCtx.drawImage(chartImg, xPos, yPos, chartWidth, chartHeight);
                };
                chartImg.onerror = (err) => {
                    console.error(`加载${token.name}图表图片失败:`, err);
                };
                chartImg.src = chartImage;
                
                // 等待图片加载
                await new Promise((resolve) => {
                    if (chartImg.complete) {
                        const xPos = 20 + col * (chartWidth + 20);
                        const yPos = 60 + row * (chartHeight + 30);
                        mainCtx.drawImage(chartImg, xPos, yPos, chartWidth, chartHeight);
                        resolve();
                    } else {
                        chartImg.onload = () => {
                            const xPos = 20 + col * (chartWidth + 20);
                            const yPos = 60 + row * (chartHeight + 30);
                            mainCtx.drawImage(chartImg, xPos, yPos, chartWidth, chartHeight);
                            resolve();
                        };
                        chartImg.onerror = () => {
                            console.error(`加载${token.name}图表图片失败`);
                            resolve();
                        };
                    }
                });
                
                col++;
                if (col >= cols) {
                    col = 0;
                    row++;
                }
            } catch (err) {
                console.error(`绘制${token.name}图表时出错:`, err);
            }
        }
        
        // 6. 添加币安主流币标题
        const binanceStartY = row * (chartHeight + 30) + 120;
        mainCtx.fillStyle = '#333333';
        mainCtx.font = 'bold 32px Arial';
        mainCtx.fillText('币安主流币', 20, binanceStartY);
        
        // 添加更新时间
        mainCtx.font = '18px Arial';
        mainCtx.fillStyle = '#999999';
        mainCtx.fillText(updateTime, width - 400, binanceStartY);
        
        // 7. 处理币安数据
        const binanceTokenChanges = {};
        Object.entries(binanceTokenPricesData).forEach(([tokenName, prices]) => {
            if (prices && prices.length > 0) {
                try {
                    const sortedPrices = [...prices].sort((a, b) => parseInt(a.time) - parseInt(b.time));
                    const firstPrice = parseFloat(sortedPrices[0].price);
                    const lastPrice = parseFloat(sortedPrices[sortedPrices.length - 1].price);
                    const percentageChange = ((lastPrice - firstPrice) / firstPrice) * 100;
                    binanceTokenChanges[tokenName] = {
                        change: percentageChange,
                        prices: sortedPrices.map(item => ({
                            time: new Date(parseInt(item.time)),
                            price: parseFloat(item.price)
                        }))
                    };
                } catch (err) {
                    console.error(`处理币安${tokenName}数据时出错:`, err);
                }
            }
        });
        
        // 按涨跌幅排序
        const sortedBinanceTokens = Object.entries(binanceTokenChanges)
            .sort((a, b) => b[1].change - a[1].change)
            .map(([token, data]) => ({ 
                name: token, 
                change: data.change, 
                prices: data.prices 
            }));
        
        // 8. 绘制币安代币图表
        row = 0; // 重置行计数
        col = 0; // 重置列计数
        
        for (const token of sortedBinanceTokens.slice(0, 16)) { // 限制为16个代币
            try {
                const chartData = token.prices.map(item => ({
                    x: item.time,
                    y: item.price
                }));
                
                // 为币安代币使用不同的颜色
                const color = `rgb(${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)}, ${Math.floor(Math.random() * 200)})`;
                
                // 创建单个图表配置
                const chartConfig = {
                    type: 'line',
                    data: {
                        datasets: [{
                            label: token.name,
                            data: chartData,
                            borderColor: color,
                            backgroundColor: color.replace('rgb', 'rgba').replace(')', ', 0.2)'),
                            fill: true,
                            tension: 0.1
                        }]
                    },
                    options: {
                        responsive: false,
                        plugins: {
                            title: {
                                display: true,
                                text: `${token.name} (${token.change >= 0 ? '+' : ''}${token.change.toFixed(1)}%)`,
                                color: token.change >= 0 ? '#2ecc40' : '#ff4136'
                            },
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            x: {
                                type: 'time',
                                time: {
                                    unit: 'day',
                                    displayFormats: {
                                        day: 'MM/dd'
                                    }
                                },
                                ticks: {
                                    maxRotation: 0
                                }
                            },
                            y: {
                                ticks: {
                                    callback: (value) => '$' + value.toFixed(2)
                                }
                            }
                        }
                    }
                };
                
                const chartImage = await chartJSNodeCanvas.renderToBuffer(chartConfig);
                const chartImg = new Image();
                
                // 等待图片加载
                await new Promise((resolve) => {
                    chartImg.onload = () => {
                        const xPos = 20 + col * (chartWidth + 20);
                        const yPos = binanceStartY + 40 + row * (chartHeight + 30);
                        mainCtx.drawImage(chartImg, xPos, yPos, chartWidth, chartHeight);
                        resolve();
                    };
                    chartImg.onerror = () => {
                        console.error(`加载币安${token.name}图表图片失败`);
                        resolve();
                    };
                    chartImg.src = chartImage;
                });
                
                col++;
                if (col >= cols) {
                    col = 0;
                    row++;
                }
            } catch (err) {
                console.error(`绘制币安${token.name}图表时出错:`, err);
            }
        }
        
        // 9. 将整个画布转换为Buffer
        const buffer = mainCanvas.toBuffer('image/png');
        
        console.log('图表已生成，准备发送到Telegram...');
        
        // 10. 发送图片到Telegram
        const formData = new FormData();
        formData.append('chat_id', telegramChatId);
        
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        const fileName = `代币价格快照_${dateStr}_${timeStr}.png`;
        
        formData.append('photo', buffer, {
            filename: fileName,
            contentType: 'image/png'
        });
        
        const caption = `每日代币价格更新 (${now.toLocaleString('zh-CN')})`;
        formData.append('caption', caption);
        
        const telegramResponse = await axios.post(
            `https://api.telegram.org/bot${telegramBotToken}/sendPhoto`,
            formData,
            {
                headers: formData.getHeaders()
            }
        );
        
        if (telegramResponse.data && telegramResponse.data.ok) {
            console.log('每日图表已成功发送到Telegram');
        } else {
            throw new Error('Telegram API 返回错误');
        }
    } catch (error) {
        console.error('生成图表并发送失败:', error);
        
        // 发送错误信息
        try {
            const formData = new FormData();
            formData.append('chat_id', telegramChatId);
            formData.append('text', `生成图表失败: ${error.message}`);
            
            await axios.post(
                `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
                formData,
                {
                    headers: formData.getHeaders()
                }
            );
        } catch (telegramError) {
            console.error('发送错误信息到Telegram失败:', telegramError);
        }
    }
}

// 替换定时任务中的函数
cron.schedule('0 8 * * *', () => {
    console.log('执行定时任务：生成每日图表');
    generateChartsAndSendToTelegram();
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
    
    // 只保留每天早上8点自动截图并发送到Telegram的任务
    cron.schedule('0 8 * * *', () => {
        console.log('执行定时任务：生成每日图表');
        generateChartsAndSendToTelegram();
    });
    
    // 可选：服务启动后测试一次截图功能
    generateChartsAndSendToTelegram();
}); 