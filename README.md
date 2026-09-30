# Sattviko Live Pricing Dashboard

**Real-time Quick Commerce pricing dashboard pulling live data from QuickCompare.in**

---

## 🎯 What This Does

✅ **Live Data**: Fetches real-time pricing from QuickCompare  
✅ **Multi-City**: Compare prices across Gurgaon, Mumbai, Delhi, Bengaluru  
✅ **6 Platforms**: Tracks Blinkit, Zepto, Instamart, BigBasket, Minutes, Amazon Now  
✅ **Dynamic Search**: Filter products on the fly  
✅ **Auto-Calculations**: Generates statistics from live data  
✅ **No Hard-Coding**: 100% real data, no embedded numbers  

---

## 📦 What's Included

```
├── server.js                              Backend API (Node.js + Express)
├── package.json                           Dependencies
├── .env.example                           Configuration template
├── Sattviko_Live_Dashboard_with_API.html  Frontend dashboard
├── SETUP_GUIDE.md                         Detailed setup instructions
├── QUICK_START.txt                        Quick reference
└── README.md                              This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v14+ ([Download](https://nodejs.org/))
- **npm** (comes with Node.js)

### Installation (3 Steps)

**1. Install dependencies**
```bash
npm install
```

**2. Start the backend server**
```bash
npm start
```

You should see: `🚀 Sattviko Pricing Backend running on http://localhost:5000`

**3. Open the dashboard**
```
Open file in browser: Sattviko_Live_Dashboard_with_API.html
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────┐
│     Browser (Dashboard)          │
│  Sattviko_Live_Dashboard.html   │
│                                  │
│  - City selector                │
│  - Search & filter              │
│  - Display live prices          │
└──────────────┬──────────────────┘
               │ HTTP Requests
               │ /api/products?city=gurgaon
               │
┌──────────────▼──────────────────┐
│    Node.js Backend (Port 5000)   │
│          server.js               │
│                                  │
│  - Express API server           │
│  - Fetch from QuickCompare     │
│  - Parse HTML                   │
│  - Return JSON data             │
└──────────────┬──────────────────┘
               │ Network Request
               │ https://quickcompare.in
               │
┌──────────────▼──────────────────┐
│    QuickCompare Website          │
│   (Data Source)                  │
│                                  │
│  Live pricing across platforms  │
└──────────────────────────────────┘
```

---

## 📊 API Endpoints

| Endpoint | Description | Example |
|----------|-------------|---------|
| `GET /api/health` | Server status | `http://localhost:5000/api/health` |
| `GET /api/products?search=sattviko&city=gurgaon` | Fetch products | Returns JSON array |
| `GET /api/cities` | Available cities | Returns city list |

---

## 🎮 Features

### City Selector
- Click button to switch between cities
- Dashboard automatically fetches city-specific data
- Different pricing for each city

### Search & Filter
- Type product name to filter
- Statistics update in real-time
- "Clear Search" to reset

### Live Statistics
- **Products Found**: Total products in selected city
- **Platforms Available**: Number of unique platforms
- **Avg Lowest Price**: Average of best prices
- **Data Updated**: Last refresh time

### Responsive Table
- Product name and pricing for all 6 platforms
- Easy comparison across platforms
- Hover effects for better UX
- Mobile-friendly responsive design

---

## ⚙️ Configuration

### Changing Backend Port
Edit `.env` file:
```env
PORT=5000  # Change this to another port if 5000 is in use
```

### Changing API URL in Dashboard
Edit line 245 in `Sattviko_Live_Dashboard_with_API.html`:
```javascript
const API_BASE_URL = 'http://localhost:5000'; // Change URL here
```

---

## 🔧 Development

### Start with Live Reload
```bash
npm run dev  # Uses nodemon (auto-restarts on code change)
```

### Test API Endpoints
```bash
# In another terminal:
curl http://localhost:5000/api/health
curl "http://localhost:5000/api/products?search=sattviko&city=gurgaon"
```

---

## 🚢 Deployment

### Deploy Backend to Heroku
```bash
heroku login
heroku create your-app-name
git push heroku main
```

### Deploy Frontend to Vercel
1. Upload `Sattviko_Live_Dashboard_with_API.html` to Vercel
2. Update API_BASE_URL to your Heroku backend

---

## ⚠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Cannot find module 'express'" | Run `npm install` |
| "Port 5000 already in use" | Change PORT in .env or kill process |
| "Failed to fetch" | Ensure backend is running and CORS is enabled |
| "No products found" | QuickCompare structure may have changed; check server logs |

---

## 📝 Notes

- **Live Data**: Fetches fresh data on every request (no caching)
- **CORS Enabled**: Backend allows requests from any origin
- **Error Handling**: Clear error messages if QuickCompare is down
- **Performance**: Request timeout set to 10 seconds

---

## 🔐 Security Notes

- ⚠️ This is for **internal use only**
- QuickCompare may have terms against scraping - verify compliance
- Consider reaching out to QuickCompare for official API access
- This solution is for personal/business analysis

---

## 📞 Support

For issues:
1. Check browser console (F12)
2. Check server terminal output
3. Verify Node.js is installed (`node --version`)
4. Ensure both files are in correct location
5. See SETUP_GUIDE.md for detailed troubleshooting

---

## 📈 Future Enhancements

- [ ] Integrate official QuickCompare API (if available)
- [ ] Add data caching (Redis)
- [ ] Historical price tracking
- [ ] Export to CSV/Excel
- [ ] Email alerts on price drops
- [ ] Mobile app version
- [ ] Dark mode support
- [ ] Advanced analytics dashboard

---

## 📄 License

Built for Sattviko pricing analysis. Use responsibly.

---

**Last Updated**: September 2026  
**Status**: ✅ Ready to Deploy
