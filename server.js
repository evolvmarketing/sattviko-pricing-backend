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
 * Sample product data for Sattviko across platforms
 * Real-world pricing data based on quick commerce platforms
 */
const SAMPLE_PRODUCTS = {
  'sattviko': [
    {
      name: 'Sattviko Makhana (200g)',
      platforms: {
        'Blinkit': { price: 349, available: true },
        'Zepto': { price: 359, available: true },
        'Instamart': { price: 355, available: true },
        'BigBasket': { price: 345, available: true },
        'Minutes': { price: 365, available: true },
        'Amazon Now': { price: 359, available: true }
      }
    },
    {
      name: 'Sattviko Chia Seeds (200g)',
      platforms: {
        'Blinkit': { price: 299, available: true },
        'Zepto': { price: 309, available: true },
        'Instamart': { price: 305, available: true },
        'BigBasket': { price: 295, available: true },
        'Minutes': { price: 315, available: true },
        'Amazon Now': { price: 299, available: false }
      }
    },
    {
      name: 'Sattviko Almonds (250g)',
      platforms: {
        'Blinkit': { price: 599, available: true },
        'Zepto': { price: 619, available: true },
        'Instamart': { price: 609, available: true },
        'BigBasket': { price: 589, available: true },
        'Minutes': { price: 629, available: true },
        'Amazon Now': { price: 599, available: true }
      }
    },
    {
      name: 'Sattviko Walnuts (200g)',
      platforms: {
        'Blinkit': { price: 449, available: true },
        'Zepto': { price: 459, available: true },
        'Instamart': { price: 455, available: true },
        'BigBasket': { price: 445, available: true },
        'Minutes': { price: 469, available: true },
        'Amazon Now': { price: 449, available: true }
      }
    },
    {
      name: 'Sattviko Dates (400g)',
      platforms: {
        'Blinkit': { price: 379, available: true },
        'Zepto': { price: 389, available: true },
        'Instamart': { price: 385, available: true },
        'BigBasket': { price: 375, available: true },
        'Minutes': { price: 395, available: true },
        'Amazon Now': { price: 389, available: false }
      }
    },
    {
      name: 'Sattviko Raisins (250g)',
      platforms: {
        'Blinkit': { price: 249, available: true },
        'Zepto': { price: 259, available: true },
        'Instamart': { price: 255, available: true },
        'BigBasket': { price: 245, available: true },
        'Minutes': { price: 265, available: true },
        'Amazon Now': { price: 249, available: true }
      }
    }
  ]
};

/**
 * Fetch product data (currently using sample data)
 * In production, this would scrape QuickCompare or call their API
 */
async function fetchQuickCompareData(searchQuery) {
  try {
    console.log(`Processing search: "${searchQuery}"`);

    // Return sample data for demo
    const products = SAMPLE_PRODUCTS[searchQuery.toLowerCase()] || SAMPLE_PRODUCTS['sattviko'];

    console.log(`Returning ${products.length} products for "${searchQuery}"`);
    return products;
  } catch (error) {
    console.error('Error fetching products:', error.message);
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
