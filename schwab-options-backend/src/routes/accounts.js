// src/routes/accounts.js - Account and trading routes
const express = require('express');
const SchwabAPIService = require('../services/schwabApi');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const schwabApi = new SchwabAPIService();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all accounts
router.get('/', async (req, res) => {
  try {
    logger.info('Fetching account information');
    
    const accounts = await schwabApi.getAccountInfo();
    
    res.json({
      success: true,
      data: accounts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get accounts:', error);
    res.status(500).json({
      error: 'Account Fetch Failed',
      message: error.message || 'Failed to retrieve account information'
    });
  }
});

// Get positions for an account
router.get('/:accountNumber/positions', async (req, res) => {
  try {
    const { accountNumber } = req.params;
    
    if (!accountNumber || !/^\d+$/.test(accountNumber)) {
      return res.status(400).json({
        error: 'Invalid Account Number',
        message: 'Please provide a valid numeric account number'
      });
    }
    
    logger.info(`Fetching positions for account ${accountNumber}`);
    
    const positions = await schwabApi.getPositions(accountNumber);
    
    res.json({
      success: true,
      accountNumber: accountNumber,
      data: positions,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to get positions:', error);
    res.status(500).json({
      error: 'Positions Fetch Failed',
      message: error.message || 'Failed to retrieve account positions'
    });
  }
});

// Place a new order
router.post('/:accountNumber/orders', async (req, res) => {
  try {
    const { accountNumber } = req.params;
    const orderData = req.body;
    
    if (!accountNumber || !/^\d+$/.test(accountNumber)) {
      return res.status(400).json({
        error: 'Invalid Account Number',
        message: 'Please provide a valid numeric account number'
      });
    }
    
    logger.info(`Placing order for account ${accountNumber}:`, {
      orderType: orderData.orderType,
      symbol: orderData.orderLegCollection?.[0]?.instrument?.symbol,
      quantity: orderData.orderLegCollection?.[0]?.quantity
    });
    
    const result = await schwabApi.placeOrder(accountNumber, orderData);
    
    res.json({
      success: true,
      accountNumber: accountNumber,
      orderId: result.orderId || result.id,
      message: 'Order placed successfully',
      data: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Failed to place order:', error);
    res.status(500).json({
      error: 'Order Placement Failed',
      message: error.message || 'Failed to place order'
    });
  }
});

module.exports = router;