const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// City mapping
const cityMapping = {
  'gurgaon': 'Gurgaon',
  'mumbai': 'Mumbai',
  'delhi': 'Delhi',
  'bengaluru': 'Bengaluru',
  'bangalore': 'Bengaluru'
};

// Global browser instance
let browser = null;

/**
 * Initialize Puppeteer browser
 */
async function initBrowser() {
  if (!browser) {
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process'
        ]
      });
      console.log('✅ Puppeteer browser initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Puppeteer:', error.message);
      throw error;
    }
  }
  return browser;
}

/**
 * Fetch LIVE data from QuickCompare
 * NO SAMPLE DATA - ONLY LIVE DATA FROM QUICKCOMPARE
 */
async function fetchQuickCompareData(searchQuery) {
  let page = null;
  try {
    const browserInstance = await initBrowser();
    page = await browserInstance.newPage();

    await page.setViewport({ width: 1280, height: 720 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

    const url = `https://quickcompare.in/search-results?q=${encodeURIComponent(searchQuery)}`;
    console.log(`🔍 Fetching LIVE data from: ${url}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    await page.waitForSelector('[class*="product"]', { timeout: 10000 }).catch(() => {
      console.log('⚠️  Waiting for products to load...');
    });

    // Extract LIVE data
    const products = await page.evaluate(() => {
      const productList = [];
      const productElements = document.querySelectorAll('[class*="product"], [data-testid*="product"], .item, [class*="card"]');

      productElements.forEach((el) => {
        try {
          const nameEl = el.querySelector('[class*="name"], [class*="title"], h2, h3, .productName');
          const name = nameEl ? nameEl.textContent.trim() : null;

          if (!name || name.length < 3) return;

          const productData = {
            name: name,
            platforms: {}
          };

          const priceElements = el.querySelectorAll('[class*="price"], [data-price], .amount, .cost');

          if (priceElements.length > 0) {
            priceElements.forEach((priceEl) => {
              try {
                const priceText = priceEl.textContent;
                const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));

                const platformEl = priceEl.closest('[class*="platform"]') ||
                                 priceEl.parentElement?.querySelector('[class*="platform"]') ||
                                 priceEl.previousElementSibling;
                const platform = platformEl ? platformEl.textContent.trim() : 'Platform';

                if (!isNaN(price) && price > 0) {
                  productData.platforms[platform] = {
                    price: price,
                    available: true
                  };
                }
              } catch (e) {}
            });
          }

          if (Object.keys(productData.platforms).length > 0) {
            productList.push(productData);
          }
        } catch (err) {}
      });

      return productList;
    });

    console.log(`✅ Found ${products.length} LIVE products from QuickCompare`);
    return products;

  } catch (error) {
    console.error(`❌ Error fetching from QuickCompare: ${error.message}`);
    throw error; // THROW ERROR - NO FALLBACK DATA
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * API: Get products
 * GET /api/products?search=sattviko&city=gurgaon
 */
app.get('/api/products', async (req, res) => {
  try {
    const { search = 'sattviko', city } = req.query;
    console.log(`\n📊 API Request: search="${search}", city="${city}"`);

    const products = await fetchQuickCompareData(search);

    res.json({
      success: true,
      city: city || 'all',
      productCount: products.length,
      data: products,
      timestamp: new Date().toISOString(),
      dataSource: 'QuickCompare LIVE (Puppeteer)'
    });

  } catch (error) {
    console.error('❌ API Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch LIVE data from QuickCompare'
    });
  }
});

/**
 * API: Get cities
 */
app.get('/api/cities', (req, res) => {
  res.json({
    cities: Object.keys(cityMapping).filter(key => !['bangalore'].includes(key))
  });
});

/**
 * Health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    server: 'Sattviko Pricing Backend - LIVE DATA ONLY',
    timestamp: new Date().toISOString()
  });
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Sattviko Pricing Backend',
    endpoints: [
      'GET /api/health',
      'GET /api/products?search=sattviko&city=gurgaon',
      'GET /api/cities'
    ],
    dataSource: 'QuickCompare LIVE (No Sample Data)'
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

// Start
app.listen(PORT, () => {
  console.log(`\n🚀 Sattviko Backend - LIVE DATA ONLY`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`📊 Source: QuickCompare LIVE Scraping\n`);
});
