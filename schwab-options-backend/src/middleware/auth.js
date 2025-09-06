// src/middleware/auth.js - Authentication middleware
const SchwabAPIService = require('../services/schwabApi');
const logger = require('../utils/logger');

const schwabApi = new SchwabAPIService();

const authMiddleware = async (req, res, next) => {
  try {
    const isAuthenticated = await schwabApi.isAuthenticated();
    
    if (!isAuthenticated) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'Please authenticate with Schwab before accessing this resource',
        authUrl: '/api/auth/initiate'
      });
    }
    
    next();
    
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Authentication Check Failed',
      message: 'Unable to verify authentication status'
    });
  }
};

module.exports = authMiddleware;