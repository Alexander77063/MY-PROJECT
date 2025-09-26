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

    // Return HTML success page that auto-closes and signals completion
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Authentication Successful - Schwab Options Desktop</title>
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
          <p>You can now access live market data and use the professional options scanner.</p>
          <div class="countdown" id="countdown">Returning to desktop in 3 seconds...</div>
          <div class="details">
            <p><strong>Connected:</strong> Schwab Market Data API</p>
            <p><strong>Token expires in:</strong> ${Math.floor((tokens.expires_in || 1800) / 60)} minutes</p>
          </div>
        </div>

        <script>
          let countdown = 3;
          const countdownElement = document.getElementById('countdown');

          const timer = setInterval(() => {
            countdown--;
            if (countdown > 0) {
              countdownElement.textContent = 'Returning to desktop in ' + countdown + ' seconds...';
            } else {
              countdownElement.textContent = 'Returning to your desktop app...';
              clearInterval(timer);

              // Try to close the window/tab
              try {
                window.close();
              } catch (e) {
                // If window.close() fails, show manual instruction
                countdownElement.innerHTML = '<strong>You can now close this tab and return to your desktop app!</strong>';
              }
            }
          }, 1000);

          // Redirect back to the desktop app after a short delay
          setTimeout(() => {
            window.location.href = 'http://localhost:3055';
          }, 2000);

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