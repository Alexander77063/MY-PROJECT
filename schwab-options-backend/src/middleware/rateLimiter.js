// src/middleware/rateLimiter.js - Advanced rate limiting middleware
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

// Different rate limits for different endpoints
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000),
      endpoint: req.path
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks and auth callbacks
    return req.path === '/health' || req.path === '/auth/callback';
  },
  keyGenerator: (req) => {
    // Use IP + User-Agent for more granular limiting
    return `${req.ip}:${req.get('User-Agent')}`;
  }
});

// General API rate limiter (more permissive)
const generalLimiter = createRateLimiter(
  parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 200, // 200 requests per minute
  {
    error: 'Rate Limit Exceeded',
    message: 'Too many requests from this IP. Please try again later.'
  }
);

// Strict limiter for market data endpoints (to comply with broker API limits)
const marketDataLimiter = createRateLimiter(
  60000, // 1 minute
  30, // 30 requests per minute for market data
  {
    error: 'Market Data Rate Limit Exceeded',
    message: 'Too many market data requests. Schwab API has strict rate limits.'
  }
);

// Very strict limiter for trading endpoints
const tradingLimiter = createRateLimiter(
  60000, // 1 minute
  10, // 10 trading requests per minute
  {
    error: 'Trading Rate Limit Exceeded',
    message: 'Too many trading requests. Please slow down for safety.'
  }
);

// Export middleware function that applies appropriate limiter based on path
module.exports = (req, res, next) => {
  const path = req.path.toLowerCase();
  
  if (path.includes('/quotes') || path.includes('/options') || path.includes('/chains')) {
    return marketDataLimiter(req, res, next);
  } else if (path.includes('/orders') || path.includes('/trade')) {
    return tradingLimiter(req, res, next);
  } else {
    return generalLimiter(req, res, next);
  }
};