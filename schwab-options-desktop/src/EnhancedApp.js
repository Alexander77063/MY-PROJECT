import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import OptionsScanner from './OptionsScanner';
import './App.css';

const API_BASE_URL = 'https://my-project-ityv.onrender.com';

function EnhancedApp() {
  const [authStatus, setAuthStatus] = useState(null);
  const [marketData, setMarketData] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [optionsData, setOptionsData] = useState(null);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState([]);
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
  const [activeTab, setActiveTab] = useState('scanner');

  const fileInputRef = useRef(null);
  const liveDataInterval = useRef(null);

  const popularSymbols = ['AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'SPY', 'QQQ'];

  // Initialize app
  useEffect(() => {
    checkAuthStatus();

    // Listen for authentication success messages from popup window
    const handleMessage = (event) => {
      if (event.data.type === 'SCHWAB_AUTH_SUCCESS') {
        console.log('Authentication success message received:', event.data);
        setError('🎉 Authentication successful! Loading your dashboard...');
        setLoading(true);

        // Immediate check, then progressively check with longer intervals
        checkAuthStatus();
        setTimeout(() => {
          checkAuthStatus();
          setLoading(false);
        }, 1500);
        setTimeout(checkAuthStatus, 4000);
        setTimeout(checkAuthStatus, 8000);

        // Clear the success message after authentication is confirmed
        setTimeout(() => {
          if (authStatus?.authenticated) {
            setError('');
          }
        }, 10000);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus?.authenticated, liveDataEnabled]);

  const loadWatchlistFromStorage = () => {
    const stored = localStorage.getItem('schwab-watchlist');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setWatchlist(parsed);
        // Auto-fetch quotes for watchlist
        parsed.forEach(symbol => fetchQuote(symbol, true));
      } catch (error) {
        console.error('Failed to load watchlist:', error);
      }
    }
  };

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

  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/accounts`);
      if (response.data.length > 0) {
        setSelectedAccount(response.data[0]);
        fetchPositions(response.data[0].accountNumber);
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  const fetchPositions = async (accountNumber) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/accounts/${accountNumber}/positions`);
      setPositions(response.data);
    } catch (error) {
      console.error('Failed to fetch positions:', error);
    }
  };

  const startLiveDataUpdates = () => {
    if (liveDataInterval.current) {
      clearInterval(liveDataInterval.current);
    }

    liveDataInterval.current = setInterval(() => {
      watchlist.forEach(symbol => {
        fetchQuote(symbol, true);
      });

      if (selectedAccount) {
        fetchPositions(selectedAccount.accountNumber);
      }
    }, 5000);
  };

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
            const newWatchlist = [...new Set([...watchlist, ...symbols])];
            setWatchlist(newWatchlist);
            saveWatchlistToStorage(newWatchlist);
            symbols.forEach(symbol => fetchQuote(symbol, true));
            setError(`Imported ${symbols.length} symbols to watchlist`);
          }
        } catch (error) {
          setError('Failed to parse watchlist file');
        }
      };
      reader.readAsText(file);
    }
  };

  const addToWatchlist = (symbol) => {
    if (!watchlist.includes(symbol)) {
      const newWatchlist = [...watchlist, symbol];
      setWatchlist(newWatchlist);
      saveWatchlistToStorage(newWatchlist);
      fetchQuote(symbol, true);
    }
  };

  const removeFromWatchlist = (symbol) => {
    const newWatchlist = watchlist.filter(s => s !== symbol);
    setWatchlist(newWatchlist);
    saveWatchlistToStorage(newWatchlist);
  };

  const handleAuthenticate = async () => {
    try {
      setError('Starting authentication process...');
      setLoading(true);

      // Get the auth URL from the API
      const response = await axios.get(`${API_BASE_URL}/auth/login`);
      if (response.data && response.data.authUrl) {
        setError('Opening Schwab login page...');

        // Open the actual Schwab login URL
        window.open(response.data.authUrl, '_blank');

        setError('Please complete authentication in the browser tab. This will auto-update when complete.');

        // Check auth status after a delay, with multiple attempts
        setTimeout(checkAuthStatus, 3000);
        setTimeout(checkAuthStatus, 8000);
        setTimeout(checkAuthStatus, 15000);
        setTimeout(checkAuthStatus, 30000);

        // Clear the loading state
        setTimeout(() => setLoading(false), 3000);
      } else {
        setError('Failed to get authentication URL');
        setLoading(false);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Failed to start authentication process');
      setLoading(false);
    }
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
      if (!silent) {
        setError(`Failed to fetch data for ${symbol}`);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const fetchOptionsChain = async (symbol) => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE_URL}/api/options/${symbol}`);
      setOptionsData(response.data);
    } catch (error) {
      setError(`Failed to fetch options data for ${symbol}`);
    } finally {
      setLoading(false);
    }
  };

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

      await axios.post(
        `${API_BASE_URL}/api/accounts/${selectedAccount.accountNumber}/orders`,
        order
      );

      setError('Order placed successfully!');
      setOrderForm({
        symbol: '',
        quantity: 1,
        price: '',
        orderType: 'MARKET',
        instruction: 'BUY'
      });

      fetchPositions(selectedAccount.accountNumber);
    } catch (error) {
      setError(`Failed to place order: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => price ? `$${price.toFixed(2)}` : '--';
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
          {liveDataEnabled && authStatus?.authenticated && (
            <div className="live-indicator">
              <span className="status-positive">● Live Data</span>
            </div>
          )}
        </div>
        <div className="header-right">
          {authStatus?.authenticated && (
            <button
              className={`btn ${liveDataEnabled ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => setLiveDataEnabled(!liveDataEnabled)}
            >
              {liveDataEnabled ? 'Stop Live Data' : 'Start Live Data'}
            </button>
          )}
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
              <p>Please authenticate with your Schwab account to access live data and trading.</p>
              <button className="btn btn-primary" onClick={handleAuthenticate}>
                Authenticate with Schwab
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Navigation */}
            <div className="tab-nav">
              {['scanner', 'quotes', 'watchlist', 'positions', 'trading', 'options'].map(tab => (
                <button
                  key={tab}
                  className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'scanner' ? 'Options Scanner' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'scanner' && (
              <OptionsScanner apiUrl={API_BASE_URL} />
            )}

            {activeTab === 'quotes' && (
              <div className="tab-content">
                <div className="symbol-panel">
                  <div className="card">
                    <h3>Quote Lookup</h3>
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
                        onClick={() => addToWatchlist(selectedSymbol)}
                        disabled={!selectedSymbol}
                      >
                        Add to Watchlist
                      </button>
                    </div>

                    <div className="popular-symbols">
                      <h4>Popular:</h4>
                      <div className="symbol-buttons">
                        {popularSymbols.map(symbol => (
                          <button
                            key={symbol}
                            className="btn btn-secondary"
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

                {selectedSymbol && marketData[selectedSymbol] && (
                  <div className="quote-display card">
                    <div className="quote-header">
                      <h4>{selectedSymbol}</h4>
                      <div className="quote-price">
                        {formatPrice(marketData[selectedSymbol].quote?.last)}
                        <span className={getChangeClass(marketData[selectedSymbol].quote?.netChange)}>
                          ({formatPercent(marketData[selectedSymbol].quote?.netPercentChange)})
                        </span>
                      </div>
                    </div>
                    <div className="quote-details">
                      <div className="quote-row">
                        <span>Open:</span>
                        <span>{formatPrice(marketData[selectedSymbol].quote?.openPrice)}</span>
                      </div>
                      <div className="quote-row">
                        <span>High:</span>
                        <span>{formatPrice(marketData[selectedSymbol].quote?.highPrice)}</span>
                      </div>
                      <div className="quote-row">
                        <span>Low:</span>
                        <span>{formatPrice(marketData[selectedSymbol].quote?.lowPrice)}</span>
                      </div>
                      <div className="quote-row">
                        <span>Volume:</span>
                        <span>{marketData[selectedSymbol].quote?.totalVolume?.toLocaleString() || '--'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'watchlist' && (
              <div className="tab-content">
                <div className="card">
                  <div className="watchlist-header">
                    <h3>Watchlist ({watchlist.length})</h3>
                    <div className="watchlist-controls">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleWatchlistImport}
                        accept=".csv,.txt"
                        style={{display: 'none'}}
                      />
                      <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Import CSV
                      </button>
                    </div>
                  </div>

                  <div className="watchlist-grid">
                    {watchlist.map(symbol => (
                      <div key={symbol} className="watchlist-item">
                        <div className="watchlist-symbol">
                          <span className="symbol">{symbol}</span>
                          <button
                            className="btn-close"
                            onClick={() => removeFromWatchlist(symbol)}
                          >
                            ×
                          </button>
                        </div>
                        {marketData[symbol] && (
                          <div className="watchlist-data">
                            <div className="price">
                              {formatPrice(marketData[symbol].quote?.last)}
                            </div>
                            <div className={`change ${getChangeClass(marketData[symbol].quote?.netChange)}`}>
                              {formatPercent(marketData[symbol].quote?.netPercentChange)}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {watchlist.length === 0 && (
                      <p>No symbols in watchlist. Import a CSV file or add symbols from quotes tab.</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'positions' && (
              <div className="tab-content">
                <div className="card">
                  <h3>Account Positions</h3>
                  {selectedAccount && (
                    <p>Account: {selectedAccount.accountNumber}</p>
                  )}

                  {positions.length > 0 ? (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Quantity</th>
                          <th>Avg Cost</th>
                          <th>Market Value</th>
                          <th>P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {positions.map((position, index) => (
                          <tr key={index}>
                            <td>{position.instrument?.symbol || 'N/A'}</td>
                            <td>{position.longQuantity || position.shortQuantity || 0}</td>
                            <td>{formatPrice(position.averagePrice)}</td>
                            <td>{formatPrice(position.marketValue)}</td>
                            <td className={getChangeClass(position.currentDayProfitLoss)}>
                              {formatPrice(position.currentDayProfitLoss)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p>No positions found.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'trading' && (
              <div className="tab-content">
                <div className="card">
                  <h3>Place Order</h3>
                  <div className="order-form">
                    <div className="form-row">
                      <label>Symbol:</label>
                      <input
                        type="text"
                        className="input"
                        value={orderForm.symbol}
                        onChange={(e) => setOrderForm(prev => ({
                          ...prev,
                          symbol: e.target.value.toUpperCase()
                        }))}
                      />
                    </div>

                    <div className="form-row">
                      <label>Action:</label>
                      <select
                        className="input"
                        value={orderForm.instruction}
                        onChange={(e) => setOrderForm(prev => ({
                          ...prev,
                          instruction: e.target.value
                        }))}
                      >
                        <option value="BUY">Buy</option>
                        <option value="SELL">Sell</option>
                      </select>
                    </div>

                    <div className="form-row">
                      <label>Quantity:</label>
                      <input
                        type="number"
                        className="input"
                        min="1"
                        value={orderForm.quantity}
                        onChange={(e) => setOrderForm(prev => ({
                          ...prev,
                          quantity: parseInt(e.target.value) || 1
                        }))}
                      />
                    </div>

                    <div className="form-row">
                      <label>Order Type:</label>
                      <select
                        className="input"
                        value={orderForm.orderType}
                        onChange={(e) => setOrderForm(prev => ({
                          ...prev,
                          orderType: e.target.value
                        }))}
                      >
                        <option value="MARKET">Market</option>
                        <option value="LIMIT">Limit</option>
                      </select>
                    </div>

                    {orderForm.orderType === 'LIMIT' && (
                      <div className="form-row">
                        <label>Limit Price:</label>
                        <input
                          type="number"
                          step="0.01"
                          className="input"
                          value={orderForm.price}
                          onChange={(e) => setOrderForm(prev => ({
                            ...prev,
                            price: e.target.value
                          }))}
                        />
                      </div>
                    )}

                    <button
                      className="btn btn-primary"
                      onClick={placeOrder}
                      disabled={loading || !orderForm.symbol}
                    >
                      Place Order
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'options' && (
              <div className="tab-content">
                <div className="card">
                  <h3>Options Chain</h3>
                  <div className="symbol-input">
                    <input
                      type="text"
                      className="input"
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
                      placeholder="Enter symbol"
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => fetchOptionsChain(selectedSymbol)}
                      disabled={loading}
                    >
                      Get Options
                    </button>
                  </div>

                  {optionsData && (
                    <div className="options-data">
                      <p>Options data loaded for {selectedSymbol}</p>
                      <pre>{JSON.stringify(optionsData, null, 2).substring(0, 1000)}...</pre>
                    </div>
                  )}
                </div>
              </div>
            )}

            {loading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
              </div>
            )}

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

export default EnhancedApp;