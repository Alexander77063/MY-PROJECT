// Live Charles Schwab API Client
const SchwabAuth = require('./auth');

class SchwabApiClient {
    constructor() {
        this.auth = new SchwabAuth();
        this.baseUrl = 'https://api.schwabapi.com';
        this.apiVersion = 'v1';
    }

    // Make authenticated API request
    async makeRequest(endpoint, options = {}) {
        try {
            const headers = await this.auth.getAuthHeaders();
            const url = `${this.baseUrl}/${this.apiVersion}${endpoint}`;
            
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`❌ API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    // Get user accounts
    async getAccounts() {
        try {
            const response = await this.makeRequest('/accounts');
            return response;
        } catch (error) {
            console.error('Failed to get accounts:', error);
            throw error;
        }
    }

    // Get account details
    async getAccount(accountNumber) {
        try {
            const response = await this.makeRequest(`/accounts/${accountNumber}`);
            return response;
        } catch (error) {
            console.error(`Failed to get account ${accountNumber}:`, error);
            throw error;
        }
    }

    // Get positions for an account
    async getPositions(accountNumber) {
        try {
            const response = await this.makeRequest(`/accounts/${accountNumber}/positions`);
            return response;
        } catch (error) {
            console.error(`Failed to get positions for ${accountNumber}:`, error);
            throw error;
        }
    }

    // Get quotes for symbols
    async getQuotes(symbols) {
        try {
            const symbolList = Array.isArray(symbols) ? symbols.join(',') : symbols;
            const response = await this.makeRequest(`/marketdata/quotes?symbols=${symbolList}`);
            return response;
        } catch (error) {
            console.error(`Failed to get quotes for ${symbols}:`, error);
            throw error;
        }
    }

    // Get option chain for a symbol
    async getOptionChain(symbol, params = {}) {
        try {
            const queryParams = new URLSearchParams({
                symbol: symbol,
                contractType: params.contractType || 'ALL',
                strikeCount: params.strikeCount || 10,
                includeQuotes: 'TRUE',
                strategy: 'SINGLE',
                range: 'ALL'
            });

            const response = await this.makeRequest(`/marketdata/chains?${queryParams}`);
            return response;
        } catch (error) {
            console.error(`Failed to get option chain for ${symbol}:`, error);
            throw error;
        }
    }

    // Get market hours
    async getMarketHours(market = 'equity', date = null) {
        try {
            const queryParams = new URLSearchParams({
                markets: market
            });
            
            if (date) {
                queryParams.append('date', date);
            }

            const response = await this.makeRequest(`/marketdata/markets?${queryParams}`);
            return response;
        } catch (error) {
            console.error(`Failed to get market hours:`, error);
            throw error;
        }
    }

    // Get price history (for technical analysis)
    async getPriceHistory(symbol, params = {}) {
        try {
            const queryParams = new URLSearchParams({
                symbol: symbol,
                periodType: params.periodType || 'day',
                period: params.period || 10,
                frequencyType: params.frequencyType || 'minute',
                frequency: params.frequency || 1,
                needExtendedHoursData: params.needExtendedHoursData || false
            });

            const response = await this.makeRequest(`/marketdata/pricehistory?${queryParams}`);
            return response;
        } catch (error) {
            console.error(`Failed to get price history for ${symbol}:`, error);
            throw error;
        }
    }

    // Place order (for future implementation)
    async placeOrder(accountNumber, order) {
        try {
            const response = await this.makeRequest(`/accounts/${accountNumber}/orders`, {
                method: 'POST',
                body: JSON.stringify(order)
            });
            return response;
        } catch (error) {
            console.error(`Failed to place order:`, error);
            throw error;
        }
    }

    // Get orders for an account
    async getOrders(accountNumber, params = {}) {
        try {
            const queryParams = new URLSearchParams();
            
            if (params.fromEnteredTime) queryParams.append('fromEnteredTime', params.fromEnteredTime);
            if (params.toEnteredTime) queryParams.append('toEnteredTime', params.toEnteredTime);
            if (params.status) queryParams.append('status', params.status);

            const endpoint = `/accounts/${accountNumber}/orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await this.makeRequest(endpoint);
            return response;
        } catch (error) {
            console.error(`Failed to get orders for ${accountNumber}:`, error);
            throw error;
        }
    }

    // Authentication methods
    getAuthUrl() {
        return this.auth.getAuthUrl();
    }

    async handleAuthCallback(authorizationCode) {
        return await this.auth.exchangeCodeForToken(authorizationCode);
    }

    isAuthenticated() {
        return this.auth.isAuthenticated();
    }

    logout() {
        this.auth.logout();
    }
}

module.exports = SchwabApiClient;