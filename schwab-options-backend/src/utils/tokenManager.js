// src/utils/tokenManager.js - Token management utility
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class TokenManager {
  constructor() {
    this.tokenFile = path.join(process.cwd(), '.tokens.enc');
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
    
    if (this.encryptionKey === 'default-key-change-in-production') {
      logger.warn('Using default encryption key. Change ENCRYPTION_KEY in production!');
    }
  }

  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipherGCM('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipherGCM('aes-256-gcm', key, Buffer.from(encryptedData.iv, 'hex'));
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  async storeTokens(tokens) {
    try {
      const tokenData = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type || 'Bearer',
        expiresIn: tokens.expires_in,
        expiresAt: Date.now() + (tokens.expires_in * 1000),
        createdAt: Date.now()
      };

      const encryptedData = this.encrypt(JSON.stringify(tokenData));
      await fs.writeFile(this.tokenFile, JSON.stringify(encryptedData));
      
      logger.info('Tokens stored securely with AES-256-GCM encryption');
      
    } catch (error) {
      logger.error('Failed to store tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  async getTokenInfo() {
    try {
      const fileData = await fs.readFile(this.tokenFile, 'utf8');
      
      let encryptedData;
      try {
        // Try to parse as JSON (new format)
        encryptedData = JSON.parse(fileData);
      } catch {
        // Fallback to old format (raw string)
        logger.warn('Using deprecated token encryption format. Will upgrade on next token refresh.');
        const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
        let decrypted = decipher.update(fileData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        const tokenData = JSON.parse(decrypted);
        
        return {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          tokenType: tokenData.tokenType,
          expiresAt: tokenData.expiresAt,
          isExpired: tokenData.expiresAt <= Date.now()
        };
      }
      
      const decryptedData = this.decrypt(encryptedData);
      const tokenData = JSON.parse(decryptedData);
      
      return {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken,
        tokenType: tokenData.tokenType,
        expiresAt: tokenData.expiresAt,
        isExpired: tokenData.expiresAt <= Date.now()
      };
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist
        return {
          accessToken: null,
          refreshToken: null,
          tokenType: null,
          expiresAt: null,
          isExpired: true
        };
      }
      
      logger.error('Failed to read tokens:', error);
      throw new Error('Failed to retrieve authentication tokens');
    }
  }

  async getRefreshToken() {
    const tokenInfo = await this.getTokenInfo();
    return tokenInfo.refreshToken;
  }

  async clearTokens() {
    try {
      await fs.unlink(this.tokenFile);
      logger.info('Tokens cleared');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error('Failed to clear tokens:', error);
      }
    }
  }
}

module.exports = TokenManager;