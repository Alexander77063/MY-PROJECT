// src/utils/validation.js - Input validation utilities
const logger = require('./logger');

class ValidationError extends Error {
  constructor(message, field = null, code = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

const validators = {
  // Symbol validation
  symbol: (symbol) => {
    if (!symbol) {
      throw new ValidationError('Symbol is required', 'symbol', 'REQUIRED');
    }
    
    if (typeof symbol !== 'string') {
      throw new ValidationError('Symbol must be a string', 'symbol', 'INVALID_TYPE');
    }
    
    const cleanSymbol = symbol.trim().toUpperCase();
    
    if (!/^[A-Z]{1,5}$/.test(cleanSymbol)) {
      throw new ValidationError('Symbol must be 1-5 letters only', 'symbol', 'INVALID_FORMAT');
    }
    
    return cleanSymbol;
  },

  // Symbols list validation
  symbols: (symbols) => {
    if (!symbols) {
      throw new ValidationError('Symbols are required', 'symbols', 'REQUIRED');
    }
    
    let symbolArray;
    
    if (Array.isArray(symbols)) {
      symbolArray = symbols;
    } else if (typeof symbols === 'string') {
      symbolArray = symbols.split(',').map(s => s.trim()).filter(s => s.length > 0);
    } else {
      throw new ValidationError('Symbols must be an array or comma-separated string', 'symbols', 'INVALID_TYPE');
    }
    
    if (symbolArray.length === 0) {
      throw new ValidationError('At least one symbol is required', 'symbols', 'EMPTY');
    }
    
    if (symbolArray.length > 100) {
      throw new ValidationError('Maximum 100 symbols allowed per request', 'symbols', 'TOO_MANY');
    }
    
    return symbolArray.map(symbol => validators.symbol(symbol));
  },

  // Contract type validation
  contractType: (contractType) => {
    if (!contractType) {
      return 'ALL'; // Default value
    }
    
    const validTypes = ['CALL', 'PUT', 'ALL'];
    const cleanType = contractType.toString().toUpperCase();
    
    if (!validTypes.includes(cleanType)) {
      throw new ValidationError(
        `Contract type must be one of: ${validTypes.join(', ')}`, 
        'contractType', 
        'INVALID_VALUE'
      );
    }
    
    return cleanType;
  },

  // Strike count validation
  strikeCount: (strikeCount) => {
    if (!strikeCount) {
      return 10; // Default value
    }
    
    const count = parseInt(strikeCount);
    
    if (isNaN(count)) {
      throw new ValidationError('Strike count must be a number', 'strikeCount', 'INVALID_TYPE');
    }
    
    if (count < 1) {
      throw new ValidationError('Strike count must be at least 1', 'strikeCount', 'TOO_SMALL');
    }
    
    if (count > 200) {
      throw new ValidationError('Strike count cannot exceed 200', 'strikeCount', 'TOO_LARGE');
    }
    
    return count;
  },

  // Account number validation
  accountNumber: (accountNumber) => {
    if (!accountNumber) {
      throw new ValidationError('Account number is required', 'accountNumber', 'REQUIRED');
    }
    
    if (typeof accountNumber !== 'string') {
      throw new ValidationError('Account number must be a string', 'accountNumber', 'INVALID_TYPE');
    }
    
    const cleanAccount = accountNumber.trim();
    
    if (cleanAccount.length < 8 || cleanAccount.length > 20) {
      throw new ValidationError('Account number must be 8-20 characters', 'accountNumber', 'INVALID_LENGTH');
    }
    
    if (!/^[A-Z0-9-]+$/i.test(cleanAccount)) {
      throw new ValidationError('Account number contains invalid characters', 'accountNumber', 'INVALID_FORMAT');
    }
    
    return cleanAccount;
  },

  // Date validation
  date: (dateString, fieldName = 'date') => {
    if (!dateString) {
      return null;
    }
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      throw new ValidationError(`Invalid ${fieldName} format`, fieldName, 'INVALID_FORMAT');
    }
    
    return date;
  },

  // Pagination validation
  pagination: (page, limit) => {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 50;
    
    if (pageNum < 1) {
      throw new ValidationError('Page must be 1 or greater', 'page', 'TOO_SMALL');
    }
    
    if (pageNum > 10000) {
      throw new ValidationError('Page cannot exceed 10000', 'page', 'TOO_LARGE');
    }
    
    if (limitNum < 1) {
      throw new ValidationError('Limit must be 1 or greater', 'limit', 'TOO_SMALL');
    }
    
    if (limitNum > 1000) {
      throw new ValidationError('Limit cannot exceed 1000', 'limit', 'TOO_LARGE');
    }
    
    return { page: pageNum, limit: limitNum, offset: (pageNum - 1) * limitNum };
  }
};

// Validation middleware factory
const createValidator = (schema) => {
  return (req, res, next) => {
    try {
      const validated = {};
      
      // Validate parameters
      if (schema.params) {
        for (const [key, validator] of Object.entries(schema.params)) {
          if (typeof validator === 'function') {
            validated[key] = validator(req.params[key]);
          } else if (typeof validator === 'string' && validators[validator]) {
            validated[key] = validators[validator](req.params[key]);
          }
        }
        req.validatedParams = validated;
      }
      
      // Validate query parameters
      if (schema.query) {
        const validatedQuery = {};
        for (const [key, validator] of Object.entries(schema.query)) {
          if (typeof validator === 'function') {
            validatedQuery[key] = validator(req.query[key]);
          } else if (typeof validator === 'string' && validators[validator]) {
            validatedQuery[key] = validators[validator](req.query[key]);
          }
        }
        req.validatedQuery = validatedQuery;
      }
      
      // Validate body
      if (schema.body) {
        const validatedBody = {};
        for (const [key, validator] of Object.entries(schema.body)) {
          if (typeof validator === 'function') {
            validatedBody[key] = validator(req.body[key]);
          } else if (typeof validator === 'string' && validators[validator]) {
            validatedBody[key] = validators[validator](req.body[key]);
          }
        }
        req.validatedBody = validatedBody;
      }
      
      next();
      
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.warn('Validation error:', {
          field: error.field,
          message: error.message,
          code: error.code,
          path: req.path,
          ip: req.ip
        });
        
        return res.status(400).json({
          error: 'Validation Error',
          message: error.message,
          field: error.field,
          code: error.code
        });
      }
      
      logger.error('Unexpected validation error:', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      });
    }
  };
};

module.exports = {
  validators,
  createValidator,
  ValidationError
};