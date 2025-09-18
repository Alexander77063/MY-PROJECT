// Schwab API Client that works with dual authentication
class SchwabApiClient {
    constructor(authManager) {
        this.auth = authManager;
        this.baseUrl = 'https://api.schwabapi.com';
        this.apiVersion = 'v1';
    }

    // Make authenticated API request
    async makeRequest(endpoint, service = 'marketData', options = {}) {
        try {
            const headers = await this.auth.getAuthHeaders(service);
            // Build URL - endpoint should include version if needed
            const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
            
            console.log(`Making API request to: ${url}`);
            
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

    // Get user accounts (requires trading authentication)
    async getAccounts() {
        try {
            const response = await this.makeRequest('/accounts', 'trading');
            return response;
        } catch (error) {
            console.error('Failed to get accounts:', error);
            throw error;
        }
    }

    // Get account details (requires trading authentication)
    async getAccount(accountNumber) {
        try {
            const response = await this.makeRequest(`/accounts/${accountNumber}`, 'trading');
            return response;
        } catch (error) {
            console.error(`Failed to get account ${accountNumber}:`, error);
            throw error;
        }
    }

    // Get positions for an account (requires trading authentication)
    async getPositions(accountNumber) {
        try {
            const response = await this.makeRequest(`/accounts/${accountNumber}/positions`, 'trading');
            return response;
        } catch (error) {
            console.error(`Failed to get positions for ${accountNumber}:`, error);
            throw error;
        }
    }

    // Get quotes for symbols (requires market data authentication)
    async getQuotes(symbols) {
        try {
            const symbolList = Array.isArray(symbols) ? symbols.join(',') : symbols;
            // Try the trader API endpoint structure instead
            const response = await this.makeRequest(`/trader/v1/marketdata/quotes?symbols=${symbolList}`, 'marketData');
            return response;
        } catch (error) {
            console.error(`Failed to get quotes for ${symbols}:`, error);
            throw error;
        }
    }

    // Get option chain for a symbol (requires market data authentication)
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

            const response = await this.makeRequest(`/marketdata/chains?${queryParams}`, 'marketData');
            return response;
        } catch (error) {
            console.error(`Failed to get option chain for ${symbol}:`, error);
            throw error;
        }
    }

    // Get market hours (requires market data authentication)
    async getMarketHours(market = 'equity', date = null) {
        try {
            const queryParams = new URLSearchParams({
                markets: market
            });
            
            if (date) {
                queryParams.append('date', date);
            }

            const response = await this.makeRequest(`/marketdata/markets?${queryParams}`, 'marketData');
            return response;
        } catch (error) {
            console.error(`Failed to get market hours:`, error);
            throw error;
        }
    }

    // Get price history (requires market data authentication)
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

            const response = await this.makeRequest(`/marketdata/pricehistory?${queryParams}`, 'marketData');
            return response;
        } catch (error) {
            console.error(`Failed to get price history for ${symbol}:`, error);
            throw error;
        }
    }

    // Place order (requires trading authentication)
    async placeOrder(accountNumber, order) {
        try {
            const response = await this.makeRequest(`/accounts/${accountNumber}/orders`, 'trading', {
                method: 'POST',
                body: JSON.stringify(order)
            });
            return response;
        } catch (error) {
            console.error(`Failed to place order:`, error);
            throw error;
        }
    }

    // Get orders for an account (requires trading authentication)
    async getOrders(accountNumber, params = {}) {
        try {
            const queryParams = new URLSearchParams();
            
            if (params.fromEnteredTime) queryParams.append('fromEnteredTime', params.fromEnteredTime);
            if (params.toEnteredTime) queryParams.append('toEnteredTime', params.toEnteredTime);
            if (params.status) queryParams.append('status', params.status);

            const endpoint = `/accounts/${accountNumber}/orders${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await this.makeRequest(endpoint, 'trading');
            return response;
        } catch (error) {
            console.error(`Failed to get orders for ${accountNumber}:`, error);
            throw error;
        }
    }

    // Check authentication status
    isAuthenticated(service = 'marketData') {
        return this.auth.isAuthenticated(service);
    }
}

module.exports = SchwabApiClient;