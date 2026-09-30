const express = require('express');
const puppeteer = require('puppeteer');
const chromium = require('@sparticuz/chromium');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const cityMapping = {
  'gurgaon': 'Gurgaon',
  'mumbai': 'Mumbai',
  'delhi': 'Delhi',
  'bengaluru': 'Bengaluru'
};

let browser = null;

async function initBrowser() {
  if (!browser) {
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: executablePath,
      headless: chromium.headless,
    });
  }
  return browser;
}

async function fetchQuickCompareData(searchQuery) {
  let page = null;
  try {
    const browserInstance = await initBrowser();
    page = await browserInstance.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const url = `https://quickcompare.in/search-results?q=${encodeURIComponent(searchQuery)}`;
    console.log(`🔍 Fetching: ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    console.log('✅ Page loaded');

    const products = await page.evaluate(() => {
      const items = [];
      
      // Find all potential product elements
      const elements = document.querySelectorAll(
        '[data-testid*="product"], [class*="Product"], article, [role="article"], .item'
      );

      elements.forEach(el => {
        try {
          const name = el.querySelector('h2, h3, h4, [class*="name"]')?.textContent?.trim();
          if (!name || name.length < 2) return;

          const item = { name, platforms: {} };

          // Get prices
          const prices = el.querySelectorAll('button, [class*="price"], span');
          prices.forEach(p => {
            const text = p.textContent;
            const match = text.match(/₹?\s*(\d+)/);
            if (match) {
              const price = parseFloat(match[1]);
              if (price > 0) {
                const platform = text.split('₹')[0].trim() || 'Platform';
                item.platforms[platform] = { price, available: true };
              }
            }
          });

          if (Object.keys(item.platforms).length > 0) {
            items.push(item);
          }
        } catch (e) {}
      });

      return items;
    });

    console.log(`✅ Found ${products.length} products`);
    return products;

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    throw error;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

app.get('/api/products', async (req, res) => {
  try {
    const { search = 'sattviko' } = req.query;
    const products = await fetchQuickCompareData(search);
    
    res.json({
      success: true,
      productCount: products.length,
      data: products,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', server: 'Sattviko Backend' });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Sattviko Pricing Backend',
    endpoints: ['GET /api/health', 'GET /api/products?search=sattviko']
  });
});

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
