// src/routes/market.js - Market data routes with enhanced validation and error handling
const express = require('express');
const SchwabAPIService = require('../services/schwabApi');
const authMiddleware = require('../middleware/auth');
const { createValidator } = require('../utils/validation');
const logger = require('../utils/logger');

const router = express.Router();
const schwabApi = new SchwabAPIService();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get quotes for one or more symbols
router.get('/quotes/:symbols', 
  createValidator({
    params: {
      symbols: 'symbols'
    }
  }),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { symbols } = req.validatedParams;
      
      logger.info(`Fetching quotes for: ${symbols.join(', ')} [${req.ip}]`);
      
      const quotes = await schwabApi.getQuotes(symbols);
      
      const duration = Date.now() - startTime;
      logger.info(`Quote request completed in ${duration}ms for ${symbols.length} symbols`);
      
      res.json({
        success: true,
        symbols: symbols,
        count: symbols.length,
        data: quotes,
        timestamp: new Date().toISOString(),
        responseTimeMs: duration
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.status === 429) {
        logger.warn(`Rate limited quote request (${duration}ms):`, { 
          symbols: req.validatedParams?.symbols?.join(',') || 'unknown',
          ip: req.ip 
        });
        
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'Too many quote requests. Please slow down.',
          retryAfter: 60,
          responseTimeMs: duration
        });
      }
      
      logger.error(`Quote fetch failed (${duration}ms):`, {
        symbols: req.validatedParams?.symbols?.join(',') || 'unknown',
        error: error.message,
        status: error.status,
        ip: req.ip
      });
      
      const statusCode = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
      
      res.status(statusCode).json({
        error: 'Quote Fetch Failed',
        message: error.message || 'Failed to retrieve market quotes',
        responseTimeMs: duration
      });
    }
  }
);

// Get option chain for a symbol
router.get('/options/:symbol',
  createValidator({
    params: {
      symbol: 'symbol'
    },
    query: {
      contractType: 'contractType',
      strikeCount: 'strikeCount'
    }
  }),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { symbol } = req.validatedParams;
      const { contractType, strikeCount } = req.validatedQuery;
      
      logger.info(`Fetching option chain for ${symbol} (${contractType}, ${strikeCount} strikes) [${req.ip}]`);
      
      const optionChain = await schwabApi.getOptionChain(symbol, contractType, strikeCount);
      
      const duration = Date.now() - startTime;
      logger.info(`Option chain request completed in ${duration}ms`);
      
      // Calculate chain statistics
      let totalContracts = 0;
      if (optionChain.data) {
        if (optionChain.data.callExpDateMap) {
          totalContracts += Object.values(optionChain.data.callExpDateMap)
            .reduce((sum, strikes) => sum + Object.keys(strikes).length, 0);
        }
        if (optionChain.data.putExpDateMap) {
          totalContracts += Object.values(optionChain.data.putExpDateMap)
            .reduce((sum, strikes) => sum + Object.keys(strikes).length, 0);
        }
      }
      
      res.json({
        success: true,
        symbol: symbol,
        contractType: contractType,
        strikeCount: strikeCount,
        totalContracts: totalContracts,
        data: optionChain,
        timestamp: new Date().toISOString(),
        responseTimeMs: duration
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (error.status === 429) {
        logger.warn(`Rate limited option chain request (${duration}ms):`, { 
          symbol: req.validatedParams?.symbol || 'unknown',
          ip: req.ip 
        });
        
        return res.status(429).json({
          error: 'Rate Limit Exceeded',
          message: 'Too many option chain requests. Please slow down.',
          retryAfter: 60,
          responseTimeMs: duration
        });
      }
      
      if (error.status === 404) {
        logger.warn(`Option chain not found (${duration}ms):`, { 
          symbol: req.validatedParams?.symbol || 'unknown',
          ip: req.ip 
        });
        
        return res.status(404).json({
          error: 'Option Chain Not Found',
          message: `No option chain available for symbol ${req.validatedParams?.symbol}`,
          responseTimeMs: duration
        });
      }
      
      logger.error(`Option chain fetch failed (${duration}ms):`, {
        symbol: req.validatedParams?.symbol || 'unknown',
        error: error.message,
        status: error.status,
        ip: req.ip
      });
      
      const statusCode = error.status && error.status >= 400 && error.status < 600 ? error.status : 500;
      
      res.status(statusCode).json({
        error: 'Option Chain Fetch Failed',
        message: error.message || 'Failed to retrieve option chain data',
        responseTimeMs: duration
      });
    }
  }
);

// Health check endpoint for market data service
router.get('/health', (req, res) => {
  res.json({
    service: 'Market Data',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

module.exports = router;