// src/routes/auth.js - Authentication routes
const express = require('express');
const SchwabAPIService = require('../services/schwabApi');
const logger = require('../utils/logger');

const router = express.Router();
const schwabApi = new SchwabAPIService();

// Initiate OAuth authentication
router.get('/initiate', async (req, res) => {
  try {
    logger.info('Initiating OAuth authentication');
    
    const { authUrl, state } = await schwabApi.initiateOAuth();
    
    res.json({
      authUrl,
      state,
      instructions: 'Open this URL in a new window to authenticate with Schwab'
    });
    
  } catch (error) {
    logger.error('Failed to initiate OAuth:', error);
    res.status(500).json({
      error: 'Authentication Error',
      message: 'Failed to generate authentication URL'
    });
  }
});

// Handle OAuth callback
router.post('/callback', async (req, res) => {
  try {
    const { code, state } = req.body;
    
    if (!code) {
      return res.status(400).json({
        error: 'Missing Code',
        message: 'Authorization code is required'
      });
    }
    
    logger.info('Processing OAuth callback');
    
    const result = await schwabApi.exchangeCodeForTokens(code, state);
    
    res.json({
      success: true,
      message: 'Authentication successful',
      expiresIn: result.expiresIn,
      tokenType: result.tokenType
    });
    
  } catch (error) {
    logger.error('OAuth callback failed:', error);
    res.status(400).json({
      error: 'Authentication Failed',
      message: error.message || 'Failed to exchange authorization code for tokens'
    });
  }
});

// Check authentication status
router.get('/status', async (req, res) => {
  try {
    const isAuthenticated = await schwabApi.isAuthenticated();
    
    res.json({
      authenticated: isAuthenticated,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to check auth status:', error);
    res.status(500).json({
      error: 'Status Check Failed',
      message: 'Unable to verify authentication status'
    });
  }
});

// Logout
router.post('/logout', async (req, res) => {
  try {
    await schwabApi.logout();
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    
  } catch (error) {
    logger.error('Logout failed:', error);
    res.status(500).json({
      error: 'Logout Failed',
      message: 'Failed to clear authentication tokens'
    });
  }
});

module.exports = router;