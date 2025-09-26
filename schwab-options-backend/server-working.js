// Working Server Configuration - Based on Successful AAPL Data Response
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

// Token storage
const TOKEN_FILE = path.join(__dirname, '.tokens.json');
let tokenStore = {};

// Load existing tokens
try {
  if (fs.existsSync(TOKEN_FILE)) {
    tokenStore = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  }
} catch (error) {
  console.log('No existing tokens found');
}

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS check for origin:', origin);

    if (!origin) {
      return callback(null, true);
    }

    if (origin.includes('vercel.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin.includes('onrender.com')) {
      return callback(null, true);
    }

    return callback(null, true); // Allow all for now
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: true
}));

app.use(express.json());

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Working server configuration'
  });
});

// ORIGINAL OAuth endpoints - simple format that would have worked
app.get('/auth/login', (req, res) => {
  const authUrl = `https://api.schwabapi.com/v1/oauth/authorize` +
    `?client_id=${process.env.SCHWAB_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(process.env.SCHWAB_CALLBACK_URL)}`;

  res.json({ authUrl });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    console.log(`Received authorization code: ${code}`);

    // Token exchange with URLSearchParams format per Schwab support
    const tokenResponse = await axios.post(`https://api.schwabapi.com/v1/oauth/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.SCHWAB_CALLBACK_URL
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SCHWAB_API_KEY}:${process.env.SCHWAB_APP_SECRET}`).toString('base64')}`
        }
      }
    );

    const tokens = tokenResponse.data;
    tokens.expires_at = Date.now() + (tokens.expires_in * 1000);
    tokens.refresh_expires_at = Date.now() + (tokens.refresh_token_expires_in * 1000);

    tokenStore = tokens;

    // Save tokens
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));

    res.json({ success: true, message: 'Authentication successful' });
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to exchange authorization code for tokens',
      details: error.response?.data || error.message
    });
  }
});

// Auth status
app.get('/auth/status', (req, res) => {
  const isAuthenticated = tokenStore.access_token && tokenStore.expires_at > Date.now();
  res.json({
    authenticated: isAuthenticated,
    expires_at: tokenStore.expires_at
  });
});

// Middleware to ensure valid token
const ensureAuthenticated = async (req, res, next) => {
  if (!tokenStore.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (tokenStore.expires_at <= Date.now()) {
    return res.status(401).json({ error: 'Token expired, please re-authenticate' });
  }

  req.accessToken = tokenStore.access_token;
  next();
};

// API endpoints that would have returned your AAPL data
app.get('/api/quotes/:symbols', ensureAuthenticated, async (req, res) => {
  const { symbols } = req.params;
  console.log('Fetching quotes for symbols:', symbols);

  try {
    const response = await axios.get(`https://api.schwabapi.com/marketdata/v1/quotes`, {
      params: { symbols },
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching quotes:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch quotes',
      details: error.response?.data || error.message
    });
  }
});

// Start server
if (require.main === module) {
  const PORT = process.env.PORT || 3009;
  app.listen(PORT, () => {
    console.log(`🚀 Working Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;