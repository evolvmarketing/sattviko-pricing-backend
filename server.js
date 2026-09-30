const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// City mapping for filtering
const cityMapping = {
  'gurgaon': 'Gurgaon',
  'mumbai': 'Mumbai',
  'delhi': 'Delhi',
  'bengaluru': 'Bengaluru',
  'bangalore': 'Bengaluru'
};

/**
 * Fetch and parse data from QuickCompare
 * Supports: https://quickcompare.in/search-results?q=sattviko
 */
async function fetchQuickCompareData(searchQuery) {
  try {
    const url = `https://quickcompare.in/search-results?q=${encodeURIComponent(searchQuery)}`;

    console.log(`Fetching from: ${url}`);

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const products = [];

    // Parse product cards from QuickCompare
    // Adjust selectors based on actual QuickCompare HTML structure
    $('.product-card, [class*="product"], [data-product]').each((index, element) => {
      try {
        const productName = $(element).find('.product-name, [class*="name"]').text().trim();
        const productData = {
          name: productName,
          platforms: {}
        };

        // Parse platform prices
        // Look for price containers within each product
        $(element).find('[class*="price"], [data-price]').each((i, priceEl) => {
          const platformName = $(priceEl).find('[class*="platform"]').text().trim() ||
                              $(priceEl).data('platform') ||
                              'Unknown';
          const price = parseFloat($(priceEl).text().replace(/[^\d.]/g, ''));

          if (platformName && !isNaN(price)) {
            productData.platforms[platformName] = {
              price: price,
              available: true
            };
          }
        });

        if (productName && Object.keys(productData.platforms).length > 0) {
          products.push(productData);
        }
      } catch (err) {
        console.error('Error parsing product:', err.message);
      }
    });

    console.log(`Found ${products.length} products`);
    return products;
  } catch (error) {
    console.error('Error fetching from QuickCompare:', error.message);
    throw error;
  }
}

/**
 * API Endpoint: Get products by search query and optional city
 * GET /api/products?search=sattviko&city=gurgaon
 */
app.get('/api/products', async (req, res) => {
  try {
    const { search = 'sattviko', city } = req.query;

    console.log(`API Request: search="${search}", city="${city}"`);

    // Fetch data from QuickCompare
    const products = await fetchQuickCompareData(search);

    // Filter by city if provided
    let filteredProducts = products;
    if (city && cityMapping[city.toLowerCase()]) {
      const cityName = cityMapping[city.toLowerCase()];
      // Filter logic based on city (could be enhanced based on data structure)
      console.log(`Filtering for city: ${cityName}`);
    }

    res.json({
      success: true,
      city: city || 'all',
      productCount: filteredProducts.length,
      data: filteredProducts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('API Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to fetch data from QuickCompare. Make sure the search query is correct.'
    });
  }
});

/**
 * API Endpoint: Get available cities
 * GET /api/cities
 */
app.get('/api/cities', (req, res) => {
  res.json({
    cities: Object.keys(cityMapping).filter(key => !['bangalore'].includes(key))
  });
});

/**
 * Health check endpoint
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    server: 'Sattviko Pricing Backend',
    timestamp: new Date().toISOString()
  });
});

/**
 * Serve static dashboard (optional)
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Sattviko Pricing Backend API',
    endpoints: [
      'GET /api/health - Health check',
      'GET /api/products?search=sattviko&city=gurgaon - Fetch products',
      'GET /api/cities - Get available cities'
    ],
    note: 'Connect to http://localhost:5000 from your dashboard'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Sattviko Pricing Backend running on http://localhost:${PORT}`);
  console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
  console.log(`🔍 Example: http://localhost:${PORT}/api/products?search=sattviko&city=gurgaon`);
});
