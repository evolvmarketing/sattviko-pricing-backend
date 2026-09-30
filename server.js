// Keep Chrome inside the project folder so Render carries it from build to runtime.
// Must be set BEFORE puppeteer is required.
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || require('path').join(__dirname, '.cache', 'puppeteer');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());

// QuickCompare picks the delivery city from localStorage.geolocation
const CITIES = {
  gurgaon:   { latitude: 28.4595, longitude: 77.0266, name: 'Gurugram',  city: 'Gurugram',  formatted_address: 'Gurugram, Haryana, India',   pincode: '122001' },
  mumbai:    { latitude: 19.0760, longitude: 72.8777, name: 'Mumbai',    city: 'Mumbai',    formatted_address: 'Mumbai, Maharashtra, India', pincode: '400001' },
  delhi:     { latitude: 28.6139, longitude: 77.2090, name: 'New Delhi', city: 'New Delhi', formatted_address: 'New Delhi, Delhi, India',    pincode: '110001' },
  bengaluru: { latitude: 12.9716, longitude: 77.5946, name: 'Bengaluru', city: 'Bengaluru', formatted_address: 'Bengaluru, Karnataka, India', pincode: '560001' }
};

// QuickCompare logo alt text -> dashboard column name
const PLATFORM_MAP = {
  'blinkit': 'Blinkit',
  'zepto': 'Zepto',
  'swiggy': 'Instamart',
  'instamart': 'Instamart',
  'bigbasket': 'BigBasket',
  'minutes': 'Minutes',
  'now': 'Amazon Now',
  'amazon now': 'Amazon Now'
};

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();
let browser = null;
let queue = Promise.resolve(); // one scrape at a time (free tier has 512 MB RAM)

async function getBrowser() {
  if (browser && browser.isConnected()) return browser;
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote']
  });
  console.log('✅ Chrome launched:', puppeteer.executablePath());
  return browser;
}

async function scrape(search, cityKey) {
  const geo = { ...CITIES[cityKey], place_id: '', country_code: 'IN' };
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });
    // Block images/fonts to save memory and time
    await page.setRequestInterception(true);
    page.on('request', r => (['image', 'font', 'media'].includes(r.resourceType()) ? r.abort() : r.continue()));
    await page.evaluateOnNewDocument(g => {
      try { localStorage.setItem('geolocation', JSON.stringify(g)); } catch (e) {}
    }, geo);

    const url = `https://quickcompare.in/search-results?q=${encodeURIComponent(search)}`;
    console.log(`🔍 ${cityKey}: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Results stream in platform by platform - wait until the card count stops changing
    await page.waitForFunction(
      () => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Compare'),
      { timeout: 45000 }
    );
    let last = -1, stable = 0;
    for (let i = 0; i < 30 && stable < 4; i++) {
      const n = await page.evaluate(() => document.body.innerText.length);
      stable = n === last ? stable + 1 : 0;
      last = n;
      await new Promise(r => setTimeout(r, 1000));
    }

    const deliveringTo = await page.evaluate(() => {
      const m = document.body.innerText.match(/Delivering to\s*\n\s*([^\n]+)/);
      return m ? m[1].trim() : null;
    });

    const raw = await page.evaluate(brand => {
      const PRICE = /^₹\s?([\d,]+(?:\.\d+)?)$/;
      const lines = el => el.innerText.split('\n').map(s => s.trim()).filter(Boolean);
      const cards = new Set(
        [...document.querySelectorAll('button')]
          .filter(b => b.textContent.trim() === 'Compare')
          .map(b => {
            let c = b;
            for (let i = 0; i < 8 && c; i++) {
              if (c.querySelector('img[alt]:not([alt=""])') && c.innerText.includes('₹')) break;
              c = c.parentElement;
            }
            return c;
          })
          .filter(Boolean)
      );
      const out = [];
      for (const card of cards) {
        const ls = lines(card);
        const fp = ls.findIndex(l => PRICE.test(l));
        const name = ls.slice(0, fp).filter(l => l !== 'Compare').join(' ').replace(/\s+/g, ' ');
        if (brand && !name.toLowerCase().includes(brand.toLowerCase())) continue;
        const platforms = [];
        for (const img of card.querySelectorAll('img[alt]')) {
          const alt = img.alt.trim();
          if (!alt) continue;
          let row = img.parentElement;
          for (let i = 0; i < 6 && row && row !== card; i++) {
            if (row.innerText.split('\n').some(l => PRICE.test(l.trim())) && /mins?|Out Of Stock|N\/A/i.test(row.innerText)) break;
            row = row.parentElement;
          }
          if (!row || row === card) continue;
          const rl = lines(row);
          const prices = rl.filter(l => PRICE.test(l)).map(l => parseFloat(l.match(PRICE)[1].replace(/,/g, '')));
          if (!prices.length) continue;
          platforms.push({
            platform: alt,
            price: prices[prices.length - 1],
            mrp: prices[0],
            size: rl.find(l => !PRICE.test(l) && !/mins?$|out of stock|^N\/A$/i.test(l)) || null,
            eta: rl.find(l => /\d+\s*mins?/i.test(l)) || null,
            inStock: !rl.some(l => /out of stock/i.test(l))
          });
        }
        if (platforms.length) out.push({ name, platforms });
      }
      return out;
    }, search);

    // Shape for the dashboard: platforms keyed by column name
    const products = raw.map(p => {
      const platforms = {};
      for (const x of p.platforms) {
        const key = PLATFORM_MAP[x.platform.toLowerCase()] || x.platform;
        if (platforms[key] && platforms[key].price <= x.price) continue;
        platforms[key] = { price: x.price, mrp: x.mrp, size: x.size, eta: x.eta, available: x.inStock };
      }
      return { name: p.name, platforms };
    });

    console.log(`✅ ${cityKey}: ${products.length} products (delivering to ${deliveringTo})`);
    return { products, deliveringTo };
  } finally {
    await page.close().catch(() => {});
  }
}

app.get('/api/products', async (req, res) => {
  const search = (req.query.search || 'sattviko').toString();
  const cityKey = (req.query.city || 'gurgaon').toString().toLowerCase();
  if (!CITIES[cityKey]) {
    return res.status(400).json({ success: false, message: `Unknown city. Use one of: ${Object.keys(CITIES).join(', ')}` });
  }
  const key = `${search}|${cityKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS && req.query.refresh !== '1') {
    return res.json({ ...hit.body, cached: true });
  }
  const job = queue.then(() => scrape(search, cityKey));
  queue = job.catch(() => {});
  try {
    const { products, deliveringTo } = await job;
    if (!products.length) {
      return res.status(502).json({ success: false, message: 'QuickCompare returned no matching products (page may not have loaded). Try again.' });
    }
    const body = {
      success: true,
      source: 'quickcompare.in',
      city: cityKey,
      deliveringTo,
      productCount: products.length,
      data: products,
      timestamp: new Date().toISOString()
    };
    cache.set(key, { at: Date.now(), body });
    res.json(body);
  } catch (err) {
    console.error(`❌ ${cityKey}: ${err.message}`);
    if (browser) { browser.close().catch(() => {}); browser = null; }
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/health', (req, res) => {
  let chrome = null;
  try { chrome = puppeteer.executablePath(); } catch (e) { chrome = `missing: ${e.message}`; }
  res.json({ status: 'OK', chrome });
});

app.get('/', (req, res) => {
  res.json({ message: 'Sattviko Pricing Backend', endpoints: ['GET /api/health', 'GET /api/products?search=sattviko&city=gurgaon|mumbai|delhi|bengaluru'] });
});

app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
