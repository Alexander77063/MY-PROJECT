// server.js - Clean, minimal version with working CORS
const express = require('express');
const cors = require('cors');

const app = express();

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
    
    // Allow localhost for development
    if (origin.includes('localhost')) {
      console.log('Localhost origin - allowing');
      return callback(null, true);
    }
    
    console.log('Origin not allowed:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json());

// Health endpoint with clear deployment tracking
app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    deployment: 'clean-v3',
    message: 'Backend is working with simplified CORS'
  });
});

// Placeholder API endpoints
app.get('/api/accounts', (req, res) => {
  console.log('Accounts endpoint called');
  res.json([]);
});

app.get('/api/accounts/:accountNumber/positions', (req, res) => {
  console.log('Positions endpoint called for account:', req.params.accountNumber);
  res.json([]);
});

app.get('/api/quotes/:symbols', (req, res) => {
  console.log('Quotes endpoint called for symbols:', req.params.symbols);
  res.json({ message: 'Quotes endpoint placeholder' });
});

app.get('/api/options/:symbol', (req, res) => {
  console.log('Options endpoint called for symbol:', req.params.symbol);
  res.json({ message: 'Options endpoint placeholder' });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('404 request to:', req.originalUrl);
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

module.exports = app;