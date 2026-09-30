// Keep Chrome inside the project folder so Render carries it from build to runtime.
// Must be set BEFORE puppeteer is required.
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || require('path').join(__dirname, '.cache', 'puppeteer');
const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
app.use(cors());

// ---------- City lookup (any Indian city) ----------
// Free-text city -> coordinates via OpenStreetMap Nominatim (India only).
// QuickCompare picks the delivery location from localStorage.geolocation, so we just need lat/lng.
const KNOWN_CITIES = ['Agra','Ahmedabad','Ajmer','Aligarh','Allahabad','Amritsar','Aurangabad','Bareilly','Belgaum','Bengaluru','Bhopal','Bhubaneswar','Bikaner','Chandigarh','Chennai','Coimbatore','Cuttack','Dehradun','Delhi','Dhanbad','Durgapur','Faridabad','Ghaziabad','Goa','Gorakhpur','Greater Noida','Gurugram','Guwahati','Gwalior','Hubli','Hyderabad','Indore','Jabalpur','Jaipur','Jalandhar','Jammu','Jamshedpur','Jodhpur','Kanpur','Kochi','Kolhapur','Kolkata','Kota','Kozhikode','Lucknow','Ludhiana','Madurai','Mangaluru','Meerut','Mohali','Moradabad','Mumbai','Mysuru','Nagpur','Nashik','Navi Mumbai','New Delhi','Noida','Panchkula','Patna','Pune','Raipur','Rajkot','Ranchi','Surat','Thane','Thiruvananthapuram','Tiruchirappalli','Udaipur','Vadodara','Varanasi','Vijayawada','Visakhapatnam','Zirakpur'];
const ALIASES = { gurgaon: 'Gurugram', bangalore: 'Bengaluru', bombay: 'Mumbai', calcutta: 'Kolkata', madras: 'Chennai', mysore: 'Mysuru', mangalore: 'Mangaluru', trivandrum: 'Thiruvananthapuram', cochin: 'Kochi', vizag: 'Visakhapatnam', prayagraj: 'Allahabad', baroda: 'Vadodara', poona: 'Pune' };
const OK_TYPES = new Set(['city', 'town', 'municipality', 'city_district', 'borough', 'suburb', 'county', 'state_district', 'village', 'neighbourhood', 'quarter']);
const geoCache = new Map();
let lastGeoCall = 0;

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

function suggestCities(q) {
  const s = q.toLowerCase();
  return KNOWN_CITIES
    .map(c => ({ c, d: Math.min(editDistance(s, c.toLowerCase()), c.toLowerCase().startsWith(s) && s.length >= 3 ? 0 : 99) }))
    .filter(x => x.d <= Math.max(2, Math.floor(s.length / 3)))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
    .map(x => x.c);
}

async function resolveCity(input) {
  const raw = (input || '').toString().trim().replace(/\s+/g, ' ');
  if (raw.length < 2 || !/^[\p{L} .,'-]+$/u.test(raw)) return { error: 'Please type a valid city name (letters only).', suggestions: [] };
  const q = ALIASES[raw.toLowerCase()] || raw;
  const key = q.toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key);

  const wait = 1100 - (Date.now() - lastGeoCall); // Nominatim: max 1 request/second
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastGeoCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=jsonv2&addressdetails=1&limit=5&featureType=settlement`;
  const r = await fetch(url, { headers: { 'User-Agent': 'SattvikoPricingDashboard/1.1 (evolvmarketing)', 'Accept-Language': 'en' } });
  if (!r.ok) throw new Error(`City lookup service error (${r.status}). Try again in a moment.`);
  const results = (await r.json()).filter(x => OK_TYPES.has(x.addresstype));

  let out;
  if (!results.length) {
    const suggestions = suggestCities(raw);
    out = { error: `City "${raw}" not found. Please check the spelling${suggestions.length ? '' : ' and type the full city name'}.`, suggestions };
  } else {
    const best = results.sort((a, b) => b.importance - a.importance)[0];
    const a = best.address || {};
    const name = best.name;
    const state = a.state || '';
    out = {
      city: {
        name,
        state,
        label: state && state.toLowerCase() !== name.toLowerCase() ? `${name}, ${state}` : name,
        corrected: name.toLowerCase() !== raw.toLowerCase(),
        geo: {
          latitude: parseFloat(best.lat), longitude: parseFloat(best.lon),
          name, city: a.city || a.town || name,
          formatted_address: [name, state, 'India'].filter(Boolean).join(', '),
          pincode: a.postcode || '', place_id: '', country_code: 'IN'
        }
      }
    };
  }
  geoCache.set(key, out);
  return out;
}

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

async function scrape(search, cityKey, geo) {
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
    try {
      await page.waitForFunction(
        () => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Compare'),
        { timeout: 45000 }
      );
    } catch (e) {
      console.log(`⚠️ ${cityKey}: no product cards appeared`);
      return { products: [], deliveringTo: null };
    }
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

app.get('/api/city', async (req, res) => {
  try {
    const r = await resolveCity(req.query.q);
    if (r.error) return res.status(404).json({ success: false, message: r.error, suggestions: r.suggestions });
    res.json({ success: true, city: { name: r.city.name, state: r.city.state, label: r.city.label, corrected: r.city.corrected } });
  } catch (e) {
    res.status(503).json({ success: false, message: e.message });
  }
});

app.get('/api/products', async (req, res) => {
  const search = (req.query.search || 'sattviko').toString();
  let resolved;
  try {
    resolved = await resolveCity(req.query.city || 'Gurugram');
  } catch (e) {
    return res.status(503).json({ success: false, message: e.message });
  }
  if (resolved.error) {
    return res.status(404).json({ success: false, code: 'CITY_NOT_FOUND', message: resolved.error, suggestions: resolved.suggestions });
  }
  const { city } = resolved;
  const cityKey = city.label.toLowerCase();
  const key = `${search}|${cityKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS && req.query.refresh !== '1') {
    return res.json({ ...hit.body, cached: true });
  }
  const job = queue.then(() => scrape(search, city.name, city.geo));
  queue = job.catch(() => {});
  try {
    const { products, deliveringTo } = await job;
    if (!products.length) {
      return res.status(404).json({ success: false, code: 'NO_PRODUCTS', city: city.label, message: `No ${search} products found on quick commerce in ${city.label}. Quick commerce may not deliver here yet.` });
    }
    const body = {
      success: true,
      source: 'quickcompare.in',
      city: city.label,
      cityCorrected: city.corrected,
      deliveringTo,
      productCount: products.length,
      data: products,
      timestamp: new Date().toISOString()
    };
    cache.set(key, { at: Date.now(), body });
    res.json(body);
  } catch (err) {
    console.error(`❌ ${city.label}: ${err.message}`);
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
  res.json({ message: 'Sattviko Pricing Backend', endpoints: ['GET /api/health', 'GET /api/city?q=pune', 'GET /api/products?search=sattviko&city=<any Indian city>'] });
});

app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
