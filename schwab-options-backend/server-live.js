// Live Trading Server with Charles Schwab API Integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const SchwabApiClient = require('./src/schwabClient');

const app = express();
const schwabClient = new SchwabApiClient();

// CORS configuration for live trading
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS check for origin:', origin);
    
    if (!origin) {
      return callback(null, true);
    }
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('Local development origin - allowing');
      return callback(null, true);
    }
    
    // Allow production origins
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
    if (allowedOrigins.includes(origin)) {
      console.log('Environment allowed origin - allowing');
      return callback(null, true);
    }
    
    console.log('Origin not allowed:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    deployment: 'live-trading-v1',
    message: 'Live trading server running',
    authenticated: schwabClient.isAuthenticated()
  });
});

// Authentication endpoints
app.get('/auth/login', (req, res) => {
  try {
    console.log('🔐 Initiating Schwab OAuth login...');
    const { authUrl, state, codeChallenge } = schwabClient.getAuthUrl();
    
    // In production, store state and codeChallenge securely
    console.log('Generated auth URL:', authUrl);
    
    res.json({
      authUrl,
      state,
      message: 'Redirect user to authUrl for Schwab authentication'
    });
  } catch (error) {
    console.error('❌ Auth login error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL', details: error.message });
  }
});

// Handle OAuth callback (GET request from Schwab)
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    console.log('🔄 Processing OAuth callback (GET)...');
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const tokenData = await schwabClient.handleAuthCallback(code);
    console.log('✅ Successfully authenticated with Schwab');
    
    res.json({
      success: true,
      message: 'Successfully authenticated with Charles Schwab',
      expiresIn: tokenData.expires_in
    });
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(400).json({ error: 'Authentication failed', details: error.message });
  }
});

app.post('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    console.log('🔄 Processing OAuth callback (POST)...');
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code required' });
    }

    const tokenData = await schwabClient.handleAuthCallback(code);
    console.log('✅ Successfully authenticated with Schwab');
    
    res.json({
      success: true,
      message: 'Successfully authenticated with Charles Schwab',
      expiresIn: tokenData.expires_in
    });
  } catch (error) {
    console.error('❌ OAuth callback error:', error);
    res.status(400).json({ error: 'Authentication failed', details: error.message });
  }
});

app.get('/auth/status', (req, res) => {
  const authenticated = schwabClient.isAuthenticated();
  console.log('Auth status check:', authenticated ? 'authenticated' : 'not authenticated');
  
  res.json({
    authenticated,
    timestamp: new Date().toISOString()
  });
});

app.post('/auth/logout', (req, res) => {
  schwabClient.logout();
  console.log('🔓 User logged out');
  
  res.json({
    success: true,
    message: 'Successfully logged out'
  });
});

// Account endpoints (require authentication)
app.get('/api/accounts', async (req, res) => {
  try {
    if (!schwabClient.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    console.log('📊 Fetching user accounts...');
    const accounts = await schwabClient.getAccounts();
    res.json(accounts);
  } catch (error) {
    console.error('❌ Get accounts error:', error);
    res.status(500).json({ error: 'Failed to fetch accounts', details: error.message });
  }
});

app.get('/api/accounts/:accountNumber', async (req, res) => {
  try {
    if (!schwabClient.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    const { accountNumber } = req.params;
    console.log(`📊 Fetching account details for ${accountNumber}...`);
    
    const account = await schwabClient.getAccount(accountNumber);
    res.json(account);
  } catch (error) {
    console.error('❌ Get account error:', error);
    res.status(500).json({ error: 'Failed to fetch account', details: error.message });
  }
});

app.get('/api/accounts/:accountNumber/positions', async (req, res) => {
  try {
    if (!schwabClient.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    const { accountNumber } = req.params;
    console.log(`📊 Fetching positions for account ${accountNumber}...`);
    
    const positions = await schwabClient.getPositions(accountNumber);
    res.json(positions);
  } catch (error) {
    console.error('❌ Get positions error:', error);
    res.status(500).json({ error: 'Failed to fetch positions', details: error.message });
  }
});

// Market data endpoints
app.get('/api/quotes/:symbols', async (req, res) => {
  try {
    if (!schwabClient.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    const { symbols } = req.params;
    console.log(`📈 Fetching quotes for symbols: ${symbols}`);
    
    const quotes = await schwabClient.getQuotes(symbols);
    res.json(quotes);
  } catch (error) {
    console.error('❌ Get quotes error:', error);
    res.status(500).json({ error: 'Failed to fetch quotes', details: error.message });
  }
});

app.get('/api/options/:symbol', async (req, res) => {
  try {
    if (!schwabClient.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    const { symbol } = req.params;
    const { contractType, strikeCount } = req.query;
    
    console.log(`⚡ Fetching option chain for ${symbol}...`);
    
    const optionChain = await schwabClient.getOptionChain(symbol, {
      contractType: contractType || 'ALL',
      strikeCount: parseInt(strikeCount) || 10
    });
    
    res.json(optionChain);
  } catch (error) {
    console.error('❌ Get option chain error:', error);
    res.status(500).json({ error: 'Failed to fetch option chain', details: error.message });
  }
});

// Market hours endpoint
app.get('/api/market-hours', async (req, res) => {
  try {
    if (!schwabClient.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    console.log('🕒 Fetching market hours...');
    const marketHours = await schwabClient.getMarketHours();
    res.json(marketHours);
  } catch (error) {
    console.error('❌ Get market hours error:', error);
    res.status(500).json({ error: 'Failed to fetch market hours', details: error.message });
  }
});

// Order endpoints (for future trading functionality)
app.get('/api/accounts/:accountNumber/orders', async (req, res) => {
  try {
    if (!schwabClient.isAuthenticated()) {
      return res.status(401).json({ error: 'Not authenticated. Please login first.' });
    }

    const { accountNumber } = req.params;
    console.log(`📋 Fetching orders for account ${accountNumber}...`);
    
    const orders = await schwabClient.getOrders(accountNumber, req.query);
    res.json(orders);
  } catch (error) {
    console.error('❌ Get orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 request to:', req.originalUrl);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    availableEndpoints: [
      'GET /health',
      'GET /auth/login',
      'POST /auth/callback', 
      'GET /auth/status',
      'POST /auth/logout',
      'GET /api/accounts',
      'GET /api/accounts/:accountNumber',
      'GET /api/accounts/:accountNumber/positions',
      'GET /api/quotes/:symbols',
      'GET /api/options/:symbol',
      'GET /api/market-hours'
    ]
  });
});

// Start server
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Live Trading Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Authentication required for live trading`);
  });
}

module.exports = app;