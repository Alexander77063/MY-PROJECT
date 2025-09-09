// server.js - Enhanced debugging version for CORS troubleshooting
const express = require('express');
const cors = require('cors');

const app = express();

// Enhanced CORS setup with comprehensive debugging
app.use(cors({
  origin: function (origin, callback) {
    console.log(`=== CORS Origin Check ===`);
    console.log(`Incoming request from origin: ${origin}`);
    console.log(`Request timestamp: ${new Date().toISOString()}`);
    
    // Allow requests with no origin
    if (!origin) {
      console.log('No origin header - allowing (likely server-to-server)');
      return callback(null, true);
    }

    // Define and test each pattern individually for clear debugging
    const patterns = [
      {
        name: 'Local Development',
        pattern: 'http://localhost:3000',
        test: (origin) => origin === 'http://localhost:3000'
      },
      {
        name: 'Options Scanner Any Deployment',
        pattern: '/^https:\\/\\/options-scanner.*\\.vercel\\.app$/',
        test: (origin) => /^https:\/\/options-scanner.*\.vercel\.app$/.test(origin)
      },
      {
        name: 'Team Domain Pattern',
        pattern: '/^https:\\/\\/.*alexanders-projects-be738dc7\\.vercel\\.app$/',
        test: (origin) => /^https:\/\/.*alexanders-projects-be738dc7\.vercel\.app$/.test(origin)
      },
      {
        name: 'Original Frontend URL',
        pattern: 'https://options-scanner-nu.vercel.app',
        test: (origin) => origin === 'https://options-scanner-nu.vercel.app'
      }
    ];
    
    console.log('Testing against patterns:');
    let matchFound = false;
    
    patterns.forEach(patternObj => {
      const matches = patternObj.test(origin);
      console.log(`  ${patternObj.name} (${patternObj.pattern}): ${matches ? 'MATCH' : 'NO MATCH'}`);
      if (matches) matchFound = true;
    });
    
    if (matchFound) {
      console.log(`✅ CORS: Origin ${origin} ALLOWED`);
      console.log(`=== End CORS Check ===\n`);
      return callback(null, true);
    } else {
      console.log(`❌ CORS: Origin ${origin} REJECTED`);
      console.log(`=== End CORS Check ===\n`);
      return callback(new Error(`CORS policy rejected origin: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

app.use(express.json());

// Diagnostic endpoint to test CORS patterns manually
app.get('/test-cors/:testOrigin(*)', (req, res) => {
  const testOrigin = decodeURIComponent(req.params.testOrigin);
  
  const patterns = [
    {
      name: 'Options Scanner Pattern',
      regex: /^https:\/\/options-scanner.*\.vercel\.app$/,
      matches: /^https:\/\/options-scanner.*\.vercel\.app$/.test(testOrigin)
    },
    {
      name: 'Team Domain Pattern', 
      regex: /^https:\/\/.*alexanders-projects-be738dc7\.vercel\.app$/,
      matches: /^https:\/\/.*alexanders-projects-be738dc7\.vercel\.app$/.test(testOrigin)
    }
  ];
  
  res.json({
    testOrigin,
    patterns: patterns,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    corsVersion: 'enhanced-debugging-v1'
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
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health',
      'GET /test-cors/:testOrigin',
      'GET /api/accounts',
      'GET /api/quotes/:symbols',
      'GET /api/options/:symbol'
    ]
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