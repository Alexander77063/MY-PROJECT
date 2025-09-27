// server.js - Schwab API Integration
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();

// Token storage (in production, use a database)
const TOKEN_FILE = path.join(__dirname, '.tokens.json');
let tokenStore = {};

// Load existing tokens
try {
  if (fs.existsSync(TOKEN_FILE)) {
    tokenStore = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  }
} catch (error) {
  console.log('No existing tokens found or error loading tokens');
}

// Simple but effective CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    // Log every CORS check for debugging
    console.log('CORS check for origin:', origin);
    
    // Allow requests with no origin (server-to-server)
    if (!origin) {
      console.log('No origin - allowing');
      return callback(null, true);
    }
    
    // Allow any Vercel app URL for your projects
    if (origin.includes('alexanders-projects-be738dc7.vercel.app')) {
      console.log('Vercel project origin - allowing');
      return callback(null, true);
    }
    
    // Allow localhost for development (any port)
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      console.log('Local development origin - allowing');
      return callback(null, true);
    }
    
    // Allow specific CORS origins from environment
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

// Health endpoint with clear deployment tracking
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    deployment: 'auth-fix-v4',
    message: 'Backend is working with simplified CORS'
  });
});

// Schwab OAuth endpoints (simplified per support recommendation)
app.get('/auth/login', (req, res) => {
  // Working format per Schwab support - only client_id and redirect_uri
  const authUrl = `${process.env.SCHWAB_BASE_URL}/v1/oauth/authorize` +
    `?client_id=${process.env.SCHWAB_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(process.env.SCHWAB_CALLBACK_URL)}`;

  res.json({ authUrl });
});

app.get('/auth/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code not provided' });
  }

  try {
    // URL decode the authorization code as per Schwab support guidance
    const decodedCode = decodeURIComponent(code);
    console.log(`Original code: ${code}`);
    console.log(`Decoded code: ${decodedCode}`);

    // Exchange code for tokens using URLSearchParams format
    const tokenResponse = await axios.post(`${process.env.SCHWAB_BASE_URL}/v1/oauth/token`,
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

    // Save tokens to file
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('Error saving tokens:', error);
    }

    // Return HTML success page with immediate redirect
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authentication Successful - Schwab Options Desktop</title>
        <meta http-equiv="refresh" content="2;url=${process.env.FRONTEND_URL || 'http://localhost:3055'}">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            color: white;
          }
          .container {
            text-align: center;
            background: rgba(255, 255, 255, 0.1);
            padding: 3rem;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            max-width: 500px;
          }
          .success-icon {
            font-size: 4rem;
            margin-bottom: 1rem;
          }
          .countdown {
            font-size: 1.5rem;
            font-weight: bold;
            color: #00d4aa;
            margin-top: 1rem;
          }
          .details {
            margin-top: 2rem;
            font-size: 0.9rem;
            opacity: 0.8;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Authentication Successful!</h1>
          <p>Your Schwab Options Desktop has been authenticated successfully.</p>
          <p>You can now:</p>
          <ul style="text-align: left; display: inline-block;">
            <li>Access live market data</li>
            <li>View account positions</li>
            <li>Place trading orders</li>
            <li>Import your watchlist</li>
          </ul>
          <div class="countdown" id="countdown">Redirecting in 2 seconds...</div>
          <div class="details">
            <p><strong>Connected:</strong> Schwab Market Data API</p>
            <p><strong>Token expires in:</strong> ${Math.floor((tokens.expires_in || 1800) / 60)} minutes</p>
          </div>
        </div>

        <script>
          let countdown = 2;
          const countdownElement = document.getElementById('countdown');

          const timer = setInterval(() => {
            if (countdown > 0) {
              countdownElement.textContent = 'Redirecting in ' + countdown + ' seconds...';
              countdown--;
            } else {
              countdownElement.textContent = 'Returning to your desktop app...';
              clearInterval(timer);
            }
          }, 1000);

          // Also try to signal the parent window if opened via desktop app
          if (window.opener) {
            window.opener.postMessage({
              type: 'SCHWAB_AUTH_SUCCESS',
              message: 'Authentication completed successfully'
            }, '*');
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to exchange authorization code for tokens' });
  }
});

// Check authentication status
app.get('/auth/status', (req, res) => {
  const isAuthenticated = tokenStore.access_token && tokenStore.expires_at > Date.now();
  res.json({
    authenticated: isAuthenticated,
    expires_at: tokenStore.expires_at,
    needs_refresh: tokenStore.access_token && tokenStore.expires_at <= Date.now() && tokenStore.refresh_expires_at > Date.now()
  });
});

// Refresh token endpoint
app.post('/auth/refresh', async (req, res) => {
  if (!tokenStore.refresh_token || tokenStore.refresh_expires_at <= Date.now()) {
    return res.status(401).json({ error: 'No valid refresh token available' });
  }

  try {
    const refreshResponse = await axios.post(`${process.env.SCHWAB_BASE_URL}/v1/oauth/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenStore.refresh_token
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.SCHWAB_API_KEY}:${process.env.SCHWAB_APP_SECRET}`).toString('base64')}`
        }
      }
    );

    const newTokens = refreshResponse.data;
    newTokens.expires_at = Date.now() + (newTokens.expires_in * 1000);
    newTokens.refresh_expires_at = Date.now() + (newTokens.refresh_token_expires_in * 1000);

    tokenStore = newTokens;

    // Save new tokens
    try {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokens, null, 2));
    } catch (error) {
      console.error('Error saving refreshed tokens:', error);
    }

    res.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Logout endpoint
app.post('/auth/logout', (req, res) => {
  tokenStore = {};
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      fs.unlinkSync(TOKEN_FILE);
    }
  } catch (error) {
    console.error('Error deleting token file:', error);
  }
  res.json({ success: true, message: 'Logged out successfully' });
});

// Middleware to ensure valid token
const ensureAuthenticated = async (req, res, next) => {
  if (!tokenStore.access_token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Check if token is expired
  if (tokenStore.expires_at <= Date.now()) {
    // Try to refresh if refresh token is available
    if (tokenStore.refresh_token && tokenStore.refresh_expires_at > Date.now()) {
      try {
        const refreshResponse = await axios.post(`${process.env.SCHWAB_BASE_URL}/v1/oauth/token`,
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: tokenStore.refresh_token
          }),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${Buffer.from(`${process.env.SCHWAB_API_KEY}:${process.env.SCHWAB_APP_SECRET}`).toString('base64')}`
            }
          }
        );

        const newTokens = refreshResponse.data;
        newTokens.expires_at = Date.now() + (newTokens.expires_in * 1000);
        newTokens.refresh_expires_at = Date.now() + (newTokens.refresh_token_expires_in * 1000);

        tokenStore = newTokens;
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(newTokens, null, 2));
      } catch (error) {
        return res.status(401).json({ error: 'Token expired and refresh failed' });
      }
    } else {
      return res.status(401).json({ error: 'Token expired, please re-authenticate' });
    }
  }

  req.accessToken = tokenStore.access_token;
  next();
};

// API endpoints with authentication
app.get('/api/accounts', ensureAuthenticated, async (req, res) => {
  console.log('Fetching accounts from Schwab API');

  try {
    const response = await axios.get(`${process.env.SCHWAB_BASE_URL}/trader/v1/accounts`, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching accounts:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch accounts',
      details: error.response?.data || error.message
    });
  }
});

app.get('/api/accounts/:accountNumber/positions', ensureAuthenticated, async (req, res) => {
  const { accountNumber } = req.params;
  console.log('Fetching positions for account:', accountNumber);

  try {
    const response = await axios.get(`${process.env.SCHWAB_BASE_URL}/trader/v1/accounts/${accountNumber}/positions`, {
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching positions:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch positions',
      details: error.response?.data || error.message
    });
  }
});

app.get('/api/quotes/:symbols', ensureAuthenticated, async (req, res) => {
  const { symbols } = req.params;
  console.log('Fetching quotes for symbols:', symbols);

  try {
    const response = await axios.get(`${process.env.SCHWAB_BASE_URL}/marketdata/v1/quotes`, {
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

app.get('/api/options/:symbol', ensureAuthenticated, async (req, res) => {
  const { symbol } = req.params;
  console.log('Fetching options chain for symbol:', symbol);

  try {
    const response = await axios.get(`${process.env.SCHWAB_BASE_URL}/marketdata/v1/chains`, {
      params: { symbol },
      headers: {
        'Authorization': `Bearer ${req.accessToken}`,
        'Accept': 'application/json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching options chain:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to fetch options chain',
      details: error.response?.data || error.message
    });
  }
});

// Place order endpoint
app.post('/api/accounts/:accountNumber/orders', ensureAuthenticated, async (req, res) => {
  const { accountNumber } = req.params;
  const orderData = req.body;

  console.log('Placing order for account:', accountNumber);
  console.log('Order data:', JSON.stringify(orderData, null, 2));

  try {
    const response = await axios.post(
      `${process.env.SCHWAB_BASE_URL}/trader/v1/accounts/${accountNumber}/orders`,
      orderData,
      {
        headers: {
          'Authorization': `Bearer ${req.accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    // Schwab API typically returns 201 for successful order placement
    // The response body may be empty for successful orders
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      orderId: response.headers.location ? response.headers.location.split('/').pop() : null
    });
  } catch (error) {
    console.error('Error placing order:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to place order',
      message: error.response?.data?.message || error.message,
      details: error.response?.data || error.message
    });
  }
});

// Test redirect endpoint (bypass token exchange, test redirect only)
app.get('/test/success-redirect', (req, res) => {
  console.log('🧪 Testing success page redirect functionality');

  // Mock token data for display purposes only
  const mockTokens = {
    expires_in: 1800, // 30 minutes
    access_token: 'test_token_for_display'
  };

  // Return the same HTML success page that would be shown after real authentication
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authentication Successful - Schwab Options Desktop</title>
      <meta http-equiv="refresh" content="2;url=${process.env.FRONTEND_URL || 'http://localhost:3055'}">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          margin: 0;
          padding: 0;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          color: white;
        }
        .container {
          text-align: center;
          background: rgba(255, 255, 255, 0.1);
          padding: 3rem;
          border-radius: 20px;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          max-width: 500px;
        }
        .success-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .countdown {
          font-size: 1.5rem;
          font-weight: bold;
          color: #00d4aa;
          margin-top: 1rem;
        }
        .details {
          margin-top: 2rem;
          font-size: 0.9rem;
          opacity: 0.8;
        }
        .test-badge {
          background: #e74c3c;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.8rem;
          margin-bottom: 1rem;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="test-badge">🧪 TEST MODE</div>
        <div class="success-icon">✅</div>
        <h1>Authentication Successful!</h1>
        <p>Your Schwab Options Desktop has been authenticated successfully.</p>
        <p>You can now:</p>
        <ul style="text-align: left; display: inline-block;">
          <li>Access live market data</li>
          <li>View account positions</li>
          <li>Place trading orders</li>
          <li>Import your watchlist</li>
        </ul>
        <div class="countdown" id="countdown">Redirecting in 2 seconds...</div>
        <div class="details">
          <p><strong>Connected:</strong> Schwab Market Data API</p>
          <p><strong>Token expires in:</strong> ${Math.floor((mockTokens.expires_in || 1800) / 60)} minutes</p>
          <p><strong>Test Mode:</strong> This is a redirect functionality test</p>
        </div>
      </div>

      <script>
        let countdown = 2;
        const countdownElement = document.getElementById('countdown');

        const timer = setInterval(() => {
          if (countdown > 0) {
            countdownElement.textContent = 'Redirecting in ' + countdown + ' seconds...';
            countdown--;
          } else {
            countdownElement.textContent = 'Returning to your desktop app...';
            clearInterval(timer);
          }
        }, 1000);

        // Also try to signal the parent window if opened via desktop app
        if (window.opener) {
          window.opener.postMessage({
            type: 'SCHWAB_AUTH_SUCCESS',
            message: 'Authentication completed successfully (TEST MODE)'
          }, '*');
        }
      </script>
    </body>
    </html>
  `);
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 request to:', req.originalUrl);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server if not being imported as module
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Schwab Options Backend running on port ${PORT}`);
    console.log(`📊 Backend health check: http://localhost:${PORT}/health`);
  });
}

module.exports = app;