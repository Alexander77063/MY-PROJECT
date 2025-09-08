// server.js - Minimal working version for Vercel
const express = require('express');
const cors = require('cors');

const app = express();

// Basic CORS setup
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://options-scanner-nu.vercel.app'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Basic API routes (placeholders)
app.get('/api/accounts', (req, res) => {
  res.json([]);
});

app.get('/api/accounts/:accountNumber/positions', (req, res) => {
  res.json([]);
});

app.get('/api/quotes/:symbols', (req, res) => {
  res.json({ message: 'Quotes endpoint not implemented yet' });
});

app.get('/api/options/:symbol', (req, res) => {
  res.json({ message: 'Options endpoint not implemented yet' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

module.exports = app;