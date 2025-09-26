import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

// API base URL - production Schwab backend
const API_BASE_URL = 'https://my-project-ityv.onrender.com';

function App() {
  const [authStatus, setAuthStatus] = useState(null);
  const [marketData, setMarketData] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [optionsData, setOptionsData] = useState(null);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [positions, setPositions] = useState([]);
  const [liveDataEnabled, setLiveDataEnabled] = useState(false);
  const [orderForm, setOrderForm] = useState({
    symbol: '',
    quantity: 1,
    price: '',
    orderType: 'MARKET',
    instruction: 'BUY'
  });

  const fileInputRef = useRef(null);
  const liveDataInterval = useRef(null);

  // Popular symbols for quick access
  const popularSymbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'SPY', 'QQQ'];

  // Check authentication status on load
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Initialize live data when authenticated
  useEffect(() => {
    if (authStatus?.authenticated) {
      fetchAccounts();
      loadWatchlistFromStorage();
      if (liveDataEnabled) {
        startLiveDataUpdates();
      }
    }
    return () => {
      if (liveDataInterval.current) {
        clearInterval(liveDataInterval.current);
      }
    };
  }, [authStatus?.authenticated, liveDataEnabled]);

  // Load watchlist from localStorage
  const loadWatchlistFromStorage = () => {
    const stored = localStorage.getItem('schwab-watchlist');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setWatchlist(parsed);
      } catch (error) {
        console.error('Failed to load watchlist:', error);
      }
    }
  };

  // Save watchlist to localStorage
  const saveWatchlistToStorage = (newWatchlist) => {
    localStorage.setItem('schwab-watchlist', JSON.stringify(newWatchlist));
  };

  const checkAuthStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/status`);
      setAuthStatus(response.data);
    } catch (error) {
      console.error('Auth status check failed:', error);
      setAuthStatus({ authenticated: false });
    }
  };

  // Fetch accounts
  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/accounts`);
      setAccounts(response.data);
      if (response.data.length > 0) {
        setSelectedAccount(response.data[0]);
        fetchPositions(response.data[0].accountNumber);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  // Fetch positions for selected account
  const fetchPositions = async (accountNumber) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/accounts/${accountNumber}/positions`);
      setPositions(response.data);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  // Start live data updates
  const startLiveDataUpdates = () => {
    if (liveDataInterval.current) {
      clearInterval(liveDataInterval.current);
    }

    liveDataInterval.current = setInterval(() => {
      // Update watchlist quotes
      watchlist.forEach(symbol => {
        fetchQuote(symbol, true); // silent mode
      });

      // Update positions
      if (selectedAccount) {
        fetchPositions(selectedAccount.accountNumber);
      }
    }, 5000); // Update every 5 seconds
  };

  // Import watchlist from CSV file
  const handleWatchlistImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.split('\n');
          const symbols = [];

          lines.forEach(line => {
            const trimmed = line.trim().toUpperCase();
            if (trimmed && /^[A-Z]{1,5}$/.test(trimmed)) {
              symbols.push(trimmed);
            }
          });

          if (symbols.length > 0) {
            const newWatchlist = [...new Set([...watchlist, ...symbols])]; // Remove duplicates
            setWatchlist(newWatchlist);
            saveWatchlistToStorage(newWatchlist);
            setError(`Imported ${symbols.length} symbols to watchlist`);
          } else {
            setError('No valid symbols found in file');
          }
        } catch (error) {
          setError('Failed to parse watchlist file');
        }
      };
      reader.readAsText(file);
    }
  };

  // Add symbol to watchlist
  const addToWatchlist = (symbol) => {
    if (!watchlist.includes(symbol)) {
      const newWatchlist = [...watchlist, symbol];
      setWatchlist(newWatchlist);
      saveWatchlistToStorage(newWatchlist);
    }
  };

  // Remove symbol from watchlist
  const removeFromWatchlist = (symbol) => {
    const newWatchlist = watchlist.filter(s => s !== symbol);
    setWatchlist(newWatchlist);
    saveWatchlistToStorage(newWatchlist);
  };

  const handleAuthenticate = () => {
    // Open authentication in browser
    window.open(`${API_BASE_URL}/auth/login`, '_blank');
    // Check status after a delay
    setTimeout(checkAuthStatus, 3000);
  };

  const fetchQuote = async (symbol, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }

    try {
      const response = await axios.get(`${API_BASE_URL}/api/quotes/${symbol}`);
      setMarketData(prev => ({
        ...prev,
        [symbol]: response.data
      }));
    } catch (error) {
      console.error(`Failed to fetch quote for ${symbol}:`, error);
      if (!silent) {
        setError(`Failed to fetch data for ${symbol}`);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Place order
  const placeOrder = async () => {
    if (!selectedAccount || !orderForm.symbol) {
      setError('Please select account and symbol');
      return;
    }

    setLoading(true);
    try {
      const order = {
        orderType: orderForm.orderType,
        session: 'NORMAL',
        duration: 'DAY',
        orderStrategyType: 'SINGLE',
        orderLegCollection: [{
          instruction: orderForm.instruction,
          quantity: orderForm.quantity,
          instrument: {
            symbol: orderForm.symbol,
            assetType: 'EQUITY'
          }
        }]
      };

      if (orderForm.orderType === 'LIMIT') {
        order.price = orderForm.price;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/accounts/${selectedAccount.accountNumber}/orders`,
        order
      );

      setError(`Order placed successfully: ${JSON.stringify(response.data)}`);

      // Reset form
      setOrderForm({
        symbol: '',
        quantity: 1,
        price: '',
        orderType: 'MARKET',
        instruction: 'BUY'
      });

      // Refresh positions
      fetchPositions(selectedAccount.accountNumber);

    } catch (error) {
      console.error('Failed to place order:', error);
      setError(`Failed to place order: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchOptionsChain = async (symbol) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/options/${symbol}`);
      setOptionsData(response.data);
    } catch (error) {
      console.error(`Failed to fetch options for ${symbol}:`, error);
      setError(`Failed to fetch options data for ${symbol}`);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return price ? `$${price.toFixed(2)}` : '--';
  };

  const formatPercent = (percent) => {
    if (!percent) return '--';
    const sign = percent > 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const getChangeClass = (value) => {
    if (value > 0) return 'status-positive';
    if (value < 0) return 'status-negative';
    return 'status-neutral';
  };

  return (
    <div className="App">
      {/* Header */}
      <div className="app-header">
        <div className="header-left">
          <h1>Schwab Options Desktop</h1>
          <div className="auth-status">
            {authStatus?.authenticated ? (
              <span className="status-positive">● Connected</span>
            ) : (
              <span className="status-negative">● Not Connected</span>
            )}
          </div>
        </div>
        <div className="header-right">
          {!authStatus?.authenticated && (
            <button className="btn btn-primary" onClick={handleAuthenticate}>
              Authenticate
            </button>
          )}
          <button className="btn btn-secondary" onClick={checkAuthStatus}>
            Refresh Status
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="app-content">
        {!authStatus?.authenticated ? (
          <div className="auth-panel">
            <div className="card text-center">
              <h2>Authentication Required</h2>
              <p>Please authenticate with your Schwab account to access market data and trading features.</p>
              <button className="btn btn-primary" onClick={handleAuthenticate}>
                Authenticate with Schwab
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Symbol Selection */}
            <div className="symbol-panel">
              <div className="card">
                <h3>Symbol Selection</h3>
                <div className="symbol-input">
                  <input
                    type="text"
                    className="input"
                    value={selectedSymbol}
                    onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
                    placeholder="Enter symbol (e.g., AAPL)"
                  />
                  <button
                    className="btn btn-primary"
                    onClick={() => fetchQuote(selectedSymbol)}
                    disabled={loading}
                  >
                    Get Quote
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => fetchOptionsChain(selectedSymbol)}
                    disabled={loading}
                  >
                    Options Chain
                  </button>
                </div>

                <div className="popular-symbols">
                  <h4>Popular Symbols:</h4>
                  <div className="symbol-buttons">
                    {popularSymbols.map(symbol => (
                      <button
                        key={symbol}
                        className={`btn btn-secondary ${selectedSymbol === symbol ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedSymbol(symbol);
                          fetchQuote(symbol);
                        }}
                      >
                        {symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Market Data Display */}
            {Object.keys(marketData).length > 0 && (
              <div className="market-data-panel">
                <h3>Market Data</h3>
                {Object.entries(marketData).map(([symbol, data]) => (
                  <div key={symbol} className="card">
                    <div className="quote-header">
                      <h4>{symbol}</h4>
                      <div className="quote-price">
                        {formatPrice(data.quote?.last)}
                        <span className={getChangeClass(data.quote?.netChange)}>
                          ({formatPercent(data.quote?.netPercentChange)})
                        </span>
                      </div>
                    </div>

                    <div className="quote-details">
                      <div className="quote-row">
                        <span>Open:</span>
                        <span>{formatPrice(data.quote?.openPrice)}</span>
                      </div>
                      <div className="quote-row">
                        <span>High:</span>
                        <span>{formatPrice(data.quote?.highPrice)}</span>
                      </div>
                      <div className="quote-row">
                        <span>Low:</span>
                        <span>{formatPrice(data.quote?.lowPrice)}</span>
                      </div>
                      <div className="quote-row">
                        <span>Volume:</span>
                        <span>{data.quote?.totalVolume?.toLocaleString() || '--'}</span>
                      </div>
                      <div className="quote-row">
                        <span>Bid/Ask:</span>
                        <span>
                          {formatPrice(data.quote?.bidPrice)} / {formatPrice(data.quote?.askPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Options Data Display */}
            {optionsData && (
              <div className="options-panel">
                <h3>Options Chain for {selectedSymbol}</h3>
                <div className="card">
                  <p>Options data structure: {JSON.stringify(Object.keys(optionsData), null, 2)}</p>
                  {/* TODO: Format options chain data properly */}
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {loading && (
              <div className="loading">
                <div className="spinner"></div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="error-panel">
                <div className="card">
                  <div className="error-message">{error}</div>
                  <button className="btn btn-secondary" onClick={() => setError('')}>
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;