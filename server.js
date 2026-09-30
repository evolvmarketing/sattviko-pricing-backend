const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let browser = null;

async function initBrowser() {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
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
    console.log(`\n🔍 Fetching: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForTimeout(3000); // Wait for JS to render
    console.log('✅ Page loaded and rendered');

    // Debug: Get page structure
    const debugInfo = await page.evaluate(() => {
      return {
        title: document.title,
        bodyLength: document.body.innerText.length,
        allDivs: document.querySelectorAll('div').length,
        allSpans: document.querySelectorAll('span').length,
        allButtons: document.querySelectorAll('button').length,
        allArticles: document.querySelectorAll('article').length,
        hasRupee: document.body.innerText.includes('₹'),
        hasBlinkit: document.body.innerText.includes('Blinkit'),
        hasZepto: document.body.innerText.includes('Zepto'),
        hasSattviko: document.body.innerText.includes('Sattviko'),
        firstDivClass: document.querySelector('div')?.className || 'none'
      };
    });

    console.log('📊 Page Debug Info:', JSON.stringify(debugInfo, null, 2));

    // Now extract products with detailed logging
    const products = await page.evaluate(() => {
      const results = [];

      // Log all text nodes to find product names
      const bodyText = document.body.innerText;
      const lines = bodyText.split('\n').filter(l => l.trim().length > 0);

      console.log(`Found ${lines.length} text lines`);

      // Look for Sattviko products
      const sattuikoLines = lines.filter(l => l.toLowerCase().includes('sattviko'));
      console.log(`Sattviko mentions: ${sattuikoLines.length}`);

      // Try all possible selectors
      const selectors = [
        'div[class*="product"]',
        '[class*="card"]',
        '[data-testid*="product"]',
        'article',
        '[role="article"]',
        'li',
        'button',
        '[class*="item"]'
      ];

      let elementsFound = 0;
      selectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Selector "${selector}": ${elements.length} elements`);
          elementsFound += elements.length;
        }
      });

      console.log(`Total elements found: ${elementsFound}`);

      // Try to extract any text that looks like a product
      const potentialProducts = [];
      lines.forEach((line, i) => {
        if (line.trim().length > 3 && !line.includes('http')) {
          // Check if next lines have prices
          const nextLines = lines.slice(i, i + 5).join(' ');
          if (nextLines.includes('₹') || nextLines.includes('Blinkit')) {
            potentialProducts.push({
              name: line.trim(),
              context: nextLines.substring(0, 100)
            });
          }
        }
      });

      return {
        productsFound: potentialProducts.slice(0, 5),
        totalPotential: potentialProducts.length,
        pageHasPrices: bodyText.includes('₹'),
        pagePlatforms: {
          hasBlinkit: bodyText.includes('Blinkit'),
          hasZepto: bodyText.includes('Zepto'),
          hasInstamart: bodyText.includes('Instamart'),
          hasBigBasket: bodyText.includes('BigBasket')
        }
      };
    });

    console.log('📦 Products Debug:', JSON.stringify(products, null, 2));

    // Screenshot for manual inspection
    await page.screenshot({ path: '/tmp/quickcompare-screenshot.png' });
    console.log('📸 Screenshot saved to /tmp/quickcompare-screenshot.png');

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
    const debugData = await fetchQuickCompareData(search);

    res.json({
      success: true,
      debug: debugData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', server: 'Sattviko Backend - DEBUG MODE' });
});

app.get('/', (req, res) => {
  res.json({ message: 'Sattviko Backend - DEBUG' });
});

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 DEBUG Backend on port ${PORT}`);
});
