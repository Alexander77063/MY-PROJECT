// Dual OAuth 2.0 Authentication for Charles Schwab APIs
// Handles both Market Data and Accounts & Trading separately
const crypto = require('crypto');
require('dotenv').config();

class SchwabDualAuth {
    constructor() {
        this.baseUrl = 'https://api.schwabapi.com';
        this.tokenUrl = `${this.baseUrl}/v1/oauth/token`;
        this.authUrl = `${this.baseUrl}/v1/oauth/authorize`;
        this.redirectUri = process.env.SCHWAB_CALLBACK_URL;
        
        // Market Data API credentials (using your actual app)
        this.marketData = {
            clientId: '1SeWofRJEAbegPc5K67DK3SVOWGKVxZNG2HMJKQgm69ohBNO',
            clientSecret: process.env.SCHWAB_APP_SECRET,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            scope: ''
        };
        
        // Accounts & Trading API credentials (using your actual app)
        this.trading = {
            clientId: '1SeWofRJEAbegPc5K67DK3SVOWGKVxZNG2HMJKQgm69ohBNO',
            clientSecret: process.env.SCHWAB_APP_SECRET,
            accessToken: null,
            refreshToken: null,
            tokenExpiry: null,
            scope: ''
        };
    }

    // Generate OAuth URL for specific service (simplified per Schwab support)
    getAuthUrl(service = 'marketData') {
        const config = service === 'marketData' ? this.marketData : this.trading;
        
        const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: this.redirectUri
        });

        return {
            authUrl: `${this.authUrl}?${params.toString()}`,
            service: service,
            message: 'Simplified OAuth URL per Schwab support - removed extra parameters'
        };
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(authorizationCode, service) {
        try {
            const config = service === 'marketData' ? this.marketData : this.trading;
            
            console.log(`🔄 Exchanging token for ${service} service...`);
            console.log('Using client ID:', config.clientId);
            
            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: authorizationCode,
                    redirect_uri: this.redirectUri
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Token exchange error for ${service}:`, errorText);
                throw new Error(`Token exchange failed for ${service}: ${response.statusText} - ${errorText}`);
            }

            const tokenData = await response.json();
            
            // Store tokens in the appropriate service config
            config.accessToken = tokenData.access_token;
            config.refreshToken = tokenData.refresh_token;
            config.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));
            
            console.log(`✅ Successfully obtained ${service} access token`);
            return { service, tokenData };
            
        } catch (error) {
            console.error(`❌ Token exchange failed for ${service}:`, error);
            throw error;
        }
    }

    // Refresh access token for specific service
    async refreshAccessToken(service) {
        const config = service === 'marketData' ? this.marketData : this.trading;
        
        if (!config.refreshToken) {
            throw new Error(`No refresh token available for ${service}`);
        }

        try {
            console.log(`🔄 Refreshing ${service} token...`);
            
            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: config.refreshToken
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ Token refresh error for ${service}:`, errorText);
                throw new Error(`Token refresh failed for ${service}: ${response.statusText} - ${errorText}`);
            }

            const tokenData = await response.json();
            
            config.accessToken = tokenData.access_token;
            config.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));
            
            console.log(`✅ Successfully refreshed ${service} access token`);
            return tokenData;
            
        } catch (error) {
            console.error(`❌ Token refresh failed for ${service}:`, error);
            throw error;
        }
    }

    // Ensure valid token for specific service
    async ensureValidToken(service) {
        const config = service === 'marketData' ? this.marketData : this.trading;
        
        if (!config.accessToken) {
            throw new Error(`No access token for ${service}. User needs to authenticate first.`);
        }

        // Check if token expires in next 5 minutes
        const fiveMinutesFromNow = new Date(Date.now() + (5 * 60 * 1000));
        
        if (config.tokenExpiry && config.tokenExpiry <= fiveMinutesFromNow) {
            console.log(`🔄 ${service} token expiring soon, refreshing...`);
            await this.refreshAccessToken(service);
        }

        return config.accessToken;
    }

    // Get authorization headers for API calls
    async getAuthHeaders(service) {
        const token = await this.ensureValidToken(service);
        return {
            'Authorization': `Bearer ${token}`
            // Remove Content-Type for GET requests per Schwab support
        };
    }

    // Check if service is authenticated
    isAuthenticated(service) {
        const config = service === 'marketData' ? this.marketData : this.trading;
        return config.accessToken !== null && 
               config.tokenExpiry && 
               config.tokenExpiry > new Date();
    }

    // Get authentication status for both services
    getAuthStatus() {
        return {
            marketData: {
                authenticated: this.isAuthenticated('marketData'),
                tokenExpiry: this.marketData.tokenExpiry
            },
            trading: {
                authenticated: this.isAuthenticated('trading'),
                tokenExpiry: this.trading.tokenExpiry
            }
        };
    }

    // Clear authentication for specific service
    logout(service) {
        const config = service === 'marketData' ? this.marketData : this.trading;
        config.accessToken = null;
        config.refreshToken = null;
        config.tokenExpiry = null;
        console.log(`🔓 User logged out of ${service}`);
    }

    // Clear all authentication
    logoutAll() {
        this.logout('marketData');
        this.logout('trading');
        console.log('🔓 User logged out of all services');
    }
}

module.exports = SchwabDualAuth;