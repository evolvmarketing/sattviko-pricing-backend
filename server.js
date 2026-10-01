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
// Built-in coordinates for common quick-commerce cities: no external lookup needed (fast, never rate-limited)
const BUILTIN_CITIES = {
  'Agartala': [23.8312, 91.2824, 'Tripura'],
  'Agra': [27.1753, 78.0098, 'Uttar Pradesh'],
  'Ahmedabad': [23.0215, 72.5801, 'Gujarat'],
  'Ajmer': [26.4691, 74.639, 'Rajasthan'],
  'Aligarh': [27.8815, 78.069, 'Uttar Pradesh'],
  'Allahabad': [25.4381, 81.8338, 'Uttar Pradesh'],
  'Amritsar': [31.6357, 74.8787, 'Punjab'],
  'Anand': [22.5587, 72.9627, 'Gujarat'],
  'Aurangabad': [19.8762, 75.3433, 'Maharashtra'],
  'Bareilly': [28.3551, 79.4179, 'Uttar Pradesh'],
  'Bathinda': [30.2068, 74.9464, 'Punjab'],
  'Belgaum': [15.8573, 74.5069, 'Karnataka'],
  'Bengaluru': [12.9768, 77.5901, 'Karnataka'],
  'Bhavnagar': [21.7719, 72.1416, 'Gujarat'],
  'Bhilai': [21.2121, 81.3733, 'Chhattisgarh'],
  'Bhiwadi': [28.2039, 76.8374, 'Rajasthan'],
  'Bhopal': [23.2585, 77.402, 'Madhya Pradesh'],
  'Bhubaneswar': [20.2603, 85.8395, 'Odisha'],
  'Bikaner': [28.0159, 73.3171, 'Rajasthan'],
  'Bilaspur': [22.0797, 82.1409, 'Chhattisgarh'],
  'Chandigarh': [30.7334, 76.7797, 'Chandigarh'],
  'Chennai': [13.0837, 80.2702, 'Tamil Nadu'],
  'Coimbatore': [11.0018, 76.9628, 'Tamil Nadu'],
  'Cuttack': [20.4686, 85.8792, 'Odisha'],
  'Davanagere': [14.4661, 75.9206, 'Karnataka'],
  'Dehradun': [30.3256, 78.0437, 'Uttarakhand'],
  'Delhi': [28.6328, 77.2198, 'Delhi'],
  'Dhanbad': [23.7953, 86.431, 'Jharkhand'],
  'Durgapur': [23.535, 87.338, 'West Bengal'],
  'Erode': [11.3306, 77.7277, 'Tamil Nadu'],
  'Faridabad': [28.4031, 77.3106, 'Haryana'],
  'Gandhinagar': [23.2233, 72.6492, 'Gujarat'],
  'Ghaziabad': [28.6712, 77.412, 'Uttar Pradesh'],
  'Goa': [15.4909, 73.8278, 'Goa'],
  'Gorakhpur': [26.76, 83.3668, 'Uttar Pradesh'],
  'Greater Noida': [28.4671, 77.5138, 'Uttar Pradesh'],
  'Guntur': [16.2915, 80.4542, 'Andhra Pradesh'],
  'Gurugram': [28.4595, 77.0266, 'Haryana'],
  'Guwahati': [26.1806, 91.7539, 'Assam'],
  'Gwalior': [26.2037, 78.1574, 'Madhya Pradesh'],
  'Haridwar': [29.9384, 78.1453, 'Uttarakhand'],
  'Hisar': [29.1563, 75.7292, 'Haryana'],
  'Hubli': [15.3518, 75.138, 'Karnataka'],
  'Hyderabad': [17.3606, 78.4741, 'Telangana'],
  'Imphal': [24.7991, 93.9364, 'Manipur'],
  'Indore': [22.7204, 75.8682, 'Madhya Pradesh'],
  'Jabalpur': [23.1702, 79.9325, 'Madhya Pradesh'],
  'Jaipur': [26.9155, 75.819, 'Rajasthan'],
  'Jalandhar': [31.3324, 75.5769, 'Punjab'],
  'Jammu': [32.7186, 74.8581, 'Jammu and Kashmir'],
  'Jamnagar': [22.4732, 70.0552, 'Gujarat'],
  'Jamshedpur': [22.8015, 86.203, 'Jharkhand'],
  'Jhansi': [25.4502, 78.58, 'Uttar Pradesh'],
  'Jodhpur': [26.2968, 73.0351, 'Rajasthan'],
  'Kanpur': [26.4609, 80.3218, 'Uttar Pradesh'],
  'Karnal': [29.6667, 76.8333, 'Haryana'],
  'Kochi': [9.9679, 76.2444, 'Kerala'],
  'Kolhapur': [16.7028, 74.2405, 'Maharashtra'],
  'Kolkata': [22.5726, 88.3639, 'West Bengal'],
  'Kota': [25.1737, 75.8574, 'Rajasthan'],
  'Kozhikode': [11.2451, 75.7755, 'Kerala'],
  'Kurukshetra': [29.9694, 76.8483, 'Haryana'],
  'Lucknow': [26.8381, 80.9346, 'Uttar Pradesh'],
  'Ludhiana': [30.909, 75.8516, 'Punjab'],
  'Madurai': [9.9261, 78.1141, 'Tamil Nadu'],
  'Mangaluru': [12.8698, 74.843, 'Karnataka'],
  'Mathura': [27.4956, 77.6856, 'Uttar Pradesh'],
  'Meerut': [28.9963, 77.7062, 'Uttar Pradesh'],
  'Mohali': [30.6909, 76.7115, 'Punjab'],
  'Moradabad': [28.8335, 78.7733, 'Uttar Pradesh'],
  'Mumbai': [19.055, 72.8692, 'Maharashtra'],
  'Mysuru': [12.3052, 76.6554, 'Karnataka'],
  'Nagpur': [21.1498, 79.0821, 'Maharashtra'],
  'Nashik': [20.0112, 73.7902, 'Maharashtra'],
  'Navi Mumbai': [19.0308, 73.0199, 'Maharashtra'],
  'Navsari': [20.9524, 72.9324, 'Gujarat'],
  'Nellore': [14.4494, 79.9874, 'Andhra Pradesh'],
  'New Delhi': [28.6139, 77.209, 'Delhi'],
  'Noida': [28.5706, 77.3272, 'Uttar Pradesh'],
  'Panchkula': [30.6975, 76.8551, 'Haryana'],
  'Patiala': [30.3302, 76.4008, 'Punjab'],
  'Patna': [25.6093, 85.1235, 'Bihar'],
  'Puducherry': [11.9341, 79.8306, 'Puducherry'],
  'Pune': [18.5214, 73.8545, 'Maharashtra'],
  'Raipur': [21.2381, 81.6337, 'Chhattisgarh'],
  'Rajkot': [22.3053, 70.8028, 'Gujarat'],
  'Ranchi': [23.3701, 85.325, 'Jharkhand'],
  'Rishikesh': [30.1087, 78.2916, 'Uttarakhand'],
  'Rohtak': [28.9011, 76.5802, 'Haryana'],
  'Sagar': [23.8418, 78.7467, 'Madhya Pradesh'],
  'Salem': [11.6552, 78.1582, 'Tamil Nadu'],
  'Sangli': [16.8503, 74.5949, 'Maharashtra'],
  'Shillong': [25.576, 91.8828, 'Meghalaya'],
  'Shimla': [31.104, 77.1708, 'Himachal Pradesh'],
  'Siliguri': [26.7164, 88.431, 'West Bengal'],
  'Solapur': [17.67, 75.9008, 'Maharashtra'],
  'Sonipat': [28.9954, 77.0234, 'Haryana'],
  'Srinagar': [34.0747, 74.8204, 'Jammu and Kashmir'],
  'Surat': [21.2095, 72.8317, 'Gujarat'],
  'Thane': [19.1943, 72.9702, 'Maharashtra'],
  'Thiruvananthapuram': [8.4882, 76.9476, 'Kerala'],
  'Thrissur': [10.527, 76.2146, 'Kerala'],
  'Tiruchirappalli': [10.8071, 78.6881, 'Tamil Nadu'],
  'Tirupati': [13.6316, 79.4232, 'Andhra Pradesh'],
  'Udaipur': [24.5787, 73.6863, 'Rajasthan'],
  'Udupi': [13.3419, 74.7473, 'Karnataka'],
  'Ujjain': [23.1885, 75.7717, 'Madhya Pradesh'],
  'Vadodara': [22.2973, 73.1943, 'Gujarat'],
  'Vapi': [20.3716, 72.9167, 'Gujarat'],
  'Varanasi': [25.3356, 83.0076, 'Uttar Pradesh'],
  'Vellore': [12.9072, 79.131, 'Tamil Nadu'],
  'Vijayawada': [16.5115, 80.616, 'Andhra Pradesh'],
  'Visakhapatnam': [17.6936, 83.2921, 'Andhra Pradesh'],
  'Zirakpur': [30.6557, 76.8201, 'Punjab']
};
const KNOWN_CITIES = Object.keys(BUILTIN_CITIES);
const ALIASES = { gurgaon: 'Gurugram', bangalore: 'Bengaluru', banglore: 'Bengaluru', bombay: 'Mumbai', calcutta: 'Kolkata', madras: 'Chennai', mysore: 'Mysuru', mangalore: 'Mangaluru', trivandrum: 'Thiruvananthapuram', cochin: 'Kochi', vizag: 'Visakhapatnam', prayagraj: 'Allahabad', baroda: 'Vadodara', poona: 'Pune', panaji: 'Goa', pondicherry: 'Puducherry', 'gr noida': 'Greater Noida', hubballi: 'Hubli', belagavi: 'Belgaum', trichy: 'Tiruchirappalli', calicut: 'Kozhikode' };
const OK_TYPES = new Set(['city', 'town', 'municipality', 'city_district', 'borough', 'suburb', 'county', 'state_district', 'district', 'village', 'neighbourhood', 'quarter']);
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

function makeCity(name, state, lat, lng, pincode, corrected) {
  const label = state && state.toLowerCase() !== name.toLowerCase() ? `${name}, ${state}` : name;
  return {
    city: {
      name, state, label, corrected,
      geo: {
        latitude: lat, longitude: lng, name, city: name,
        formatted_address: [name, state, 'India'].filter(Boolean).join(', '),
        pincode: pincode || '', place_id: '', country_code: 'IN'
      }
    }
  };
}

// External lookups (only for cities not in the built-in list). Returns [{name, state, lat, lng, pincode}]
async function nominatimSearch(q) {
  const wait = 1100 - (Date.now() - lastGeoCall); // Nominatim: max 1 request/second
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  lastGeoCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=in&format=jsonv2&addressdetails=1&limit=5&featureType=settlement`;
  const r = await fetch(url, { headers: { 'User-Agent': 'SattvikoPricingDashboard/1.2 (evolvmarketing)', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`nominatim ${r.status}`);
  return (await r.json())
    .filter(x => OK_TYPES.has(x.addresstype))
    .sort((a, b) => b.importance - a.importance)
    .map(x => ({ name: x.name, state: (x.address || {}).state || '', lat: +x.lat, lng: +x.lon, pincode: (x.address || {}).postcode }));
}

async function photonSearch(q) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&osm_tag=place&bbox=68,6,98,37`;
  const r = await fetch(url, { headers: { 'User-Agent': 'SattvikoPricingDashboard/1.2' }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`photon ${r.status}`);
  return ((await r.json()).features || [])
    .filter(f => f.properties.countrycode === 'IN' && OK_TYPES.has(f.properties.osm_value === 'state' ? 'x' : f.properties.osm_value))
    .map(f => ({ name: f.properties.name, state: f.properties.state || '', lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], pincode: f.properties.postcode }));
}

const norm = t => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, '').trim();

async function resolveCity(input) {
  const raw = (input || '').toString().trim().replace(/\s+/g, ' ');
  if (raw.length < 2 || !/^[\p{L} .,'-]+$/u.test(raw)) return { error: 'Please type a valid city name (letters only).', suggestions: [] };
  const key = norm(raw);
  if (geoCache.has(key)) return geoCache.get(key);

  // 1) Built-in list / aliases (also accepts "Pune, Maharashtra")
  const first = norm(raw.split(',')[0]);
  const aliasHit = ALIASES[first];
  const builtinName = aliasHit || KNOWN_CITIES.find(c => norm(c) === first);
  if (builtinName) {
    const [lat, lng, state] = BUILTIN_CITIES[builtinName];
    const out = makeCity(builtinName, state, lat, lng, '', norm(builtinName) !== first);
    geoCache.set(key, out);
    return out;
  }

  // 2) Any other Indian city via OpenStreetMap (Nominatim, falling back to Photon if rate-limited)
  let results = null;
  for (const search of [nominatimSearch, photonSearch]) {
    try { results = await search(raw); break; } catch (e) { console.warn(`City lookup failed (${e.message}), trying fallback`); }
  }
  if (results === null) throw new Error('City lookup service is busy. Please try again in a minute.');

  // Only accept an exact name match - a fuzzy match is offered as "Did you mean" instead
  const exact = results.find(x => norm(x.name) === first);
  let out;
  if (exact) {
    out = makeCity(exact.name, exact.state, exact.lat, exact.lng, exact.pincode, false);
  } else {
    const suggestions = [...new Set([...suggestCities(first), ...results.slice(0, 2).map(x => x.name)])].slice(0, 3);
    out = { error: `City "${raw}" not found. Please check the spelling${suggestions.length ? '' : ' and type the full city name'}.`, suggestions };
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

// Serve the dashboard itself at the root URL, so the backend link is the shareable dashboard link
const DASHBOARD_FILE = require('path').join(__dirname, 'dashboard.html');
app.get('/', (req, res) => {
  if (require('fs').existsSync(DASHBOARD_FILE)) return res.sendFile(DASHBOARD_FILE);
  res.json({ message: 'Sattviko Pricing Backend', endpoints: ['GET /api/health', 'GET /api/city?q=pune', 'GET /api/products?search=sattviko&city=<any Indian city>'] });
});

app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
