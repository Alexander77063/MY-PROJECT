// src/services/schwabApi.js - Core Schwab API service
const crypto = require('crypto');
const logger = require('../utils/logger');
const TokenManager = require('../utils/tokenManager');

class SchwabAPIService {
  constructor() {
    this.apiKey = process.env.SCHWAB_API_KEY;
    this.appSecret = process.env.SCHWAB_APP_SECRET;
    this.callbackUrl = process.env.SCHWAB_CALLBACK_URL || 'https://127.0.0.1:8182';
    this.baseUrl = process.env.SCHWAB_BASE_URL || 'https://api.schwabapi.com';
    
    if (!this.apiKey || !this.appSecret) {
      throw new Error('Missing required Schwab API credentials in environment variables');
    }
    
    this.tokenManager = new TokenManager();
    logger.info('Schwab API service initialized');
  }

  // OAuth Authentication Flow
  async initiateOAuth() {
    try {
      const state = crypto.randomBytes(16).toString('hex');
      
      const authParams = new URLSearchParams({
        response_type: 'code',
        client_id: this.apiKey,
        redirect_uri: this.callbackUrl,
        scope: 'readonly',
        state: state
      });
      
      const authUrl = `${this.baseUrl}/v1/oauth/authorize?${authParams.toString()}`;
      
      logger.info('Generated OAuth URL for authentication');
      return { authUrl, state };
      
    } catch (error) {
      logger.error('Failed to initiate OAuth:', error);
      throw new Error('Failed to generate authentication URL');
    }
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(authCode, state = null) {
    try {
      logger.info('Exchanging authorization code for tokens');
      
      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: this.callbackUrl
      });

      const authHeader = Buffer.from(`${this.apiKey}:${this.appSecret}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/v1/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`
        },
        body: tokenParams.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Token exchange failed:', { status: response.status, error: errorText });
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
      }

      const tokens = await response.json();
      
      // Store tokens securely
      await this.tokenManager.storeTokens(tokens);
      
      logger.info('Successfully exchanged code for tokens');
      return {
        success: true,
        expiresIn: tokens.expires_in,
        tokenType: tokens.token_type || 'Bearer'
      };
      
    } catch (error) {
      logger.error('Token exchange error:', error);
      throw error;
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const refreshToken = await this.tokenManager.getRefreshToken();
      
      if (!refreshToken) {
        throw new Error('No refresh token available. Re-authentication required.');
      }

      logger.info('Refreshing access token');
      
      const tokenParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      });

      const authHeader = Buffer.from(`${this.apiKey}:${this.appSecret}`).toString('base64');
      
      const response = await fetch(`${this.baseUrl}/v1/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${authHeader}`
        },
        body: tokenParams.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Token refresh failed:', { status: response.status, error: errorText });
        
        // If refresh fails, clear stored tokens
        await this.tokenManager.clearTokens();
        throw new Error('Token refresh failed. Re-authentication required.');
      }

      const tokens = await response.json();
      
      // Update stored tokens
      await this.tokenManager.storeTokens(tokens);
      
      logger.info('Successfully refreshed access token');
      return tokens;
      
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  // Ensure valid token before API calls
  async ensureValidToken() {
    const tokenInfo = await this.tokenManager.getTokenInfo();
    
    if (!tokenInfo.accessToken) {
      throw new Error('No access token available. Authentication required.');
    }

    // Refresh token if it expires in the next 5 minutes
    if (tokenInfo.expiresAt && (tokenInfo.expiresAt - Date.now()) < 300000) {
      logger.info('Token expiring soon, refreshing...');
      await this.refreshAccessToken();
    }
    
    return await this.tokenManager.getTokenInfo();
  }

  // Generic API request method with retry logic and caching
  async makeRequest(endpoint, method = 'GET', body = null, retries = 2, cacheSeconds = 0) {
    const cacheKey = `${method}:${endpoint}:${JSON.stringify(body)}`;
    
    // Check cache for GET requests
    if (method === 'GET' && cacheSeconds > 0) {
      const cached = this.cache?.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < (cacheSeconds * 1000)) {
        logger.debug(`Cache hit for: ${endpoint}`);
        return cached.data;
      }
    }
    
    let lastError;
    const startTime = Date.now();
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const tokenInfo = await this.ensureValidToken();
        
        const options = {
          method,
          headers: {
            'Authorization': `Bearer ${tokenInfo.accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'Options-Scanner/1.0'
          },
          timeout: 30000 // 30 second timeout
        };

        if (body && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(body);
        }

        const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
        logger.debug(`Making ${method} request to: ${fullUrl} (attempt ${attempt + 1})`);
        
        const response = await fetch(fullUrl, options);
        
        if (response.status === 401 && attempt < retries) {
          logger.warn('Received 401, attempting token refresh and retry');
          await this.tokenManager.clearTokens();
          continue;
        }
        
        if (response.status === 429) {
          // Rate limit hit - wait longer before retry
          const retryAfter = parseInt(response.headers.get('Retry-After')) || Math.pow(2, attempt + 2);
          logger.warn(`Rate limited, waiting ${retryAfter} seconds before retry`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          const error = new Error(`API request failed: ${response.status} ${response.statusText}`);
          error.status = response.status;
          error.responseText = errorText;
          throw error;
        }

        const data = await response.json();
        const duration = Date.now() - startTime;
        
        logger.debug(`API request successful: ${method} ${endpoint} (${duration}ms)`);
        
        // Cache successful GET requests
        if (method === 'GET' && cacheSeconds > 0) {
          if (!this.cache) this.cache = new Map();
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
          
          // Clean old cache entries periodically
          if (Math.random() < 0.1) { // 10% chance
            this.cleanCache();
          }
        }
        
        return data;
        
      } catch (error) {
        lastError = error;
        const duration = Date.now() - startTime;
        
        logger.error(`API request attempt ${attempt + 1} failed (${duration}ms):`, {
          endpoint,
          method,
          error: error.message,
          status: error.status
        });
        
        if (attempt === retries) {
          break;
        }
        
        // Exponential backoff with jitter
        const backoffTime = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffTime));
      }
    }
    
    throw lastError;
  }

  // Cache management
  cleanCache() {
    if (!this.cache) return;
    
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes max cache age
    
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.cache.delete(key);
      }
    }
    
    logger.debug(`Cache cleaned, ${this.cache.size} entries remaining`);
  }

  // Account Information APIs
  async getAccountInfo() {
    return await this.makeRequest('/trader/v1/accounts');
  }

  async getAccount(accountNumber) {
    return await this.makeRequest(`/trader/v1/accounts/${accountNumber}`);
  }

  async getPositions(accountNumber) {
    return await this.makeRequest(`/trader/v1/accounts/${accountNumber}/positions`);
  }

  // Market Data APIs with caching
  async getQuotes(symbols) {
    const symbolsParam = Array.isArray(symbols) ? symbols.join(',') : symbols;
    // Cache quotes for 15 seconds
    return await this.makeRequest(`/marketdata/v1/quotes?symbol=${encodeURIComponent(symbolsParam)}`, 'GET', null, 2, 15);
  }

  async getOptionChain(symbol, contractType = 'ALL', strikeCount = 10) {
    const params = new URLSearchParams({
      symbol: symbol,
      contractType: contractType,
      strikeCount: strikeCount.toString(),
      includeUnderlyingQuote: 'true'
    });
    
    // Cache option chains for 30 seconds (they change less frequently)
    return await this.makeRequest(`/marketdata/v1/chains?${params.toString()}`, 'GET', null, 2, 30);
  }

  // Trading APIs
  async placeOrder(accountNumber, orderData) {
    return await this.makeRequest(
      `/trader/v1/accounts/${accountNumber}/orders`,
      'POST',
      orderData
    );
  }

  async getOrder(accountNumber, orderId) {
    return await this.makeRequest(`/trader/v1/accounts/${accountNumber}/orders/${orderId}`);
  }

  async cancelOrder(accountNumber, orderId) {
    return await this.makeRequest(
      `/trader/v1/accounts/${accountNumber}/orders/${orderId}`,
      'DELETE'
    );
  }

  // Utility methods
  async isAuthenticated() {
    try {
      const tokenInfo = await this.tokenManager.getTokenInfo();
      return !!tokenInfo.accessToken && tokenInfo.expiresAt > Date.now();
    } catch (error) {
      return false;
    }
  }

  async logout() {
    await this.tokenManager.clearTokens();
    logger.info('User logged out, tokens cleared');
  }
}

module.exports = SchwabAPIService;