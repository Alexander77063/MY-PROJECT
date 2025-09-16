// OAuth 2.0 Authentication for Charles Schwab API
const crypto = require('crypto');
require('dotenv').config();

class SchwabAuth {
    constructor() {
        this.clientId = process.env.SCHWAB_API_KEY;
        this.clientSecret = process.env.SCHWAB_APP_SECRET;
        this.redirectUri = process.env.SCHWAB_CALLBACK_URL;
        this.baseUrl = 'https://api.schwabapi.com';
        this.tokenUrl = `${this.baseUrl}/v1/oauth/token`;
        this.authUrl = `${this.baseUrl}/v1/oauth/authorize`;
        
        // Store tokens in memory (in production, use secure database)
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.codeVerifier = null; // Store code verifier
    }

    // Generate OAuth authorization URL
    getAuthUrl() {
        const state = crypto.randomBytes(32).toString('hex');
        const codeChallenge = this.generateCodeChallenge();
        
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            scope: 'readonly',
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        return {
            authUrl: `${this.authUrl}?${params.toString()}`,
            state,
            codeChallenge
        };
    }

    // Generate PKCE code challenge
    generateCodeChallenge() {
        this.codeVerifier = crypto.randomBytes(32).toString('base64url');
        const codeChallenge = crypto
            .createHash('sha256')
            .update(this.codeVerifier)
            .digest('base64url');
        
        console.log('Generated code verifier:', this.codeVerifier);
        return codeChallenge;
    }

    // Exchange authorization code for access token
    async exchangeCodeForToken(authorizationCode) {
        try {
            console.log('Using code verifier:', this.codeVerifier);
            console.log('Authorization code:', authorizationCode);
            
            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'authorization_code',
                    code: authorizationCode,
                    redirect_uri: this.redirectUri,
                    code_verifier: this.codeVerifier
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Token exchange error response:', errorText);
                throw new Error(`Token exchange failed: ${response.statusText} - ${errorText}`);
            }

            const tokenData = await response.json();
            
            this.accessToken = tokenData.access_token;
            this.refreshToken = tokenData.refresh_token;
            this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));
            
            console.log('✅ Successfully obtained access token');
            return tokenData;
            
        } catch (error) {
            console.error('❌ Token exchange failed:', error);
            throw error;
        }
    }

    // Refresh access token using refresh token
    async refreshAccessToken() {
        if (!this.refreshToken) {
            throw new Error('No refresh token available');
        }

        try {
            const response = await fetch(this.tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: this.refreshToken
                })
            });

            if (!response.ok) {
                throw new Error(`Token refresh failed: ${response.statusText}`);
            }

            const tokenData = await response.json();
            
            this.accessToken = tokenData.access_token;
            this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000));
            
            console.log('✅ Successfully refreshed access token');
            return tokenData;
            
        } catch (error) {
            console.error('❌ Token refresh failed:', error);
            throw error;
        }
    }

    // Check if token is valid and refresh if needed
    async ensureValidToken() {
        if (!this.accessToken) {
            throw new Error('No access token. User needs to authenticate first.');
        }

        // Check if token expires in next 5 minutes
        const fiveMinutesFromNow = new Date(Date.now() + (5 * 60 * 1000));
        
        if (this.tokenExpiry && this.tokenExpiry <= fiveMinutesFromNow) {
            console.log('🔄 Token expiring soon, refreshing...');
            await this.refreshAccessToken();
        }

        return this.accessToken;
    }

    // Get authorization headers for API calls
    async getAuthHeaders() {
        const token = await this.ensureValidToken();
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Check if user is authenticated
    isAuthenticated() {
        return this.accessToken !== null && 
               this.tokenExpiry && 
               this.tokenExpiry > new Date();
    }

    // Clear authentication
    logout() {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        console.log('🔓 User logged out');
    }
}

module.exports = SchwabAuth;