import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './OptionsScanner.css';

const API_BASE_URL = 'https://my-project-ityv.onrender.com';

const POPULAR_SYMBOLS = [
  'SPY', 'QQQ', 'AAPL', 'TSLA', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'NFLX',
  'AMD', 'BABA', 'DIS', 'UBER', 'PYPL', 'ZOOM', 'CRM', 'SHOP', 'SQ', 'ROKU',
  'PELOTON', 'GME', 'AMC', 'BB'
];

const TRADING_STRATEGIES = {
  HIGH_MOMENTUM: 'High Momentum 🚀',
  HIGH_VALUE: 'High Value 💰',
  VOLATILITY_EXPANSION: 'Volatility Expansion 📈',
  EARNINGS_PLAYS: 'Earnings Plays 📊',
  TECHNICAL_SETUPS: 'Technical Setups 📐'
};

const LIQUIDITY_LEVELS = {
  HIGH: { label: 'HIGH', color: '#00C851', minVolume: 1000 },
  MEDIUM: { label: 'MEDIUM', color: '#ffbb33', minVolume: 500 },
  LOW: { label: 'LOW', color: '#ff4444', minVolume: 0 }
};

function OptionsScanner({ authStatus }) {
  // Core State Management
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [opportunities, setOpportunities] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Scanner Configuration
  const [selectedStrategy, setSelectedStrategy] = useState('HIGH_MOMENTUM');
  const [riskSettings, setRiskSettings] = useState({
    maxOptionPrice: 500,
    maxRiskPerTrade: 1000,
    portfolioRiskLimit: 5000,
    minVolume: 500,
    maxSpreadPercent: 10,
    minDaysToExpiry: 7,
    maxDaysToExpiry: 45
  });

  // Live Data State
  const [scanInterval, setScanInterval] = useState(null);
  const [lastScanTime, setLastScanTime] = useState(null);
  const [activityLog, setActivityLog] = useState([]);

  // UI State
  const [sortColumn, setSortColumn] = useState('lceScore');
  const [sortDirection, setSortDirection] = useState('desc');
  const [searchFilter, setSearchFilter] = useState('');

  const scanIntervalRef = useRef(null);

  useEffect(() => {
    if (authStatus?.authenticated) {
      fetchAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus?.authenticated]);

  // LCE Scoring Algorithm (Liquidity-Cost-Efficiency)
  const calculateLCEScore = (option) => {
    try {
      const volume = option.totalVolume || 0;
      const bid = parseFloat(option.bid || 0);
      const ask = parseFloat(option.ask || 0);
      const premium = (bid + ask) / 2;
      const spread = ask - bid;
      const spreadPercent = premium > 0 ? (spread / premium) * 100 : 100;

      // Liquidity Score (40% weight)
      let liquidityScore = 0;
      if (volume >= 1000) liquidityScore = 100;
      else if (volume >= 500) liquidityScore = 75;
      else if (volume >= 100) liquidityScore = 50;
      else if (volume >= 50) liquidityScore = 25;

      // Cost Efficiency Score (35% weight)
      let costScore = 0;
      if (spreadPercent <= 3) costScore = 100;
      else if (spreadPercent <= 5) costScore = 80;
      else if (spreadPercent <= 10) costScore = 60;
      else if (spreadPercent <= 15) costScore = 40;
      else if (spreadPercent <= 25) costScore = 20;

      // Value Score (25% weight)
      let valueScore = 0;
      const impliedVol = option.volatility || 0;
      const timeValue = option.timeValue || 0;
      if (timeValue > 0 && impliedVol > 0) {
        valueScore = Math.min(100, (timeValue / premium) * 100);
      }

      const lceScore = Math.round(
        (liquidityScore * 0.4) +
        (costScore * 0.35) +
        (valueScore * 0.25)
      );

      return Math.max(0, Math.min(100, lceScore));
    } catch (error) {
      return 0;
    }
  };

  // Strategy Filters
  const applyStrategyFilter = (options, strategy) => {
    const filtered = options.filter(option => {
      switch (strategy) {
        case 'HIGH_MOMENTUM':
          return option.delta && Math.abs(option.delta) > 0.4 && option.totalVolume >= 500;

        case 'HIGH_VALUE':
          return option.lceScore >= 70 && option.premium <= riskSettings.maxOptionPrice;

        case 'VOLATILITY_EXPANSION':
          return option.volatility && option.volatility > 0.3 && option.gamma > 0.01;

        case 'EARNINGS_PLAYS':
          return option.daysToExpiry <= 14 && option.totalVolume >= 1000;

        case 'TECHNICAL_SETUPS':
          return option.delta && Math.abs(option.delta) >= 0.3 && option.theta < -0.05;

        default:
          return true;
      }
    });

    return filtered.sort((a, b) => b.lceScore - a.lceScore).slice(0, 50);
  };

  // Account Management
  const fetchAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/accounts`);
      if (response.data.length > 0) {
        setSelectedAccount(response.data[0]);
      }
    } catch (error) {
      addActivityLog('ERROR: Failed to fetch accounts', 'error');
    }
  };

  // Activity Logging
  const addActivityLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      message,
      type,
      id: Date.now()
    };

    setActivityLog(prev => [logEntry, ...prev.slice(0, 99)]); // Keep last 100 entries
  };

  // Options Chain Data Fetching
  const fetchOptionsChain = async (symbol) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/options/${symbol}`, {
        timeout: 30000
      });

      if (!response.data || (!response.data.callExpDateMap && !response.data.putExpDateMap)) {
        throw new Error(`No options data for ${symbol}`);
      }

      const options = [];
      const processExpDateMap = (expDateMap, type) => {
        Object.entries(expDateMap || {}).forEach(([expDate, strikes]) => {
          const expiryDate = new Date(expDate);
          const daysToExpiry = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));

          if (daysToExpiry >= riskSettings.minDaysToExpiry &&
              daysToExpiry <= riskSettings.maxDaysToExpiry) {

            Object.entries(strikes).forEach(([strike, contractArray]) => {
              if (contractArray && contractArray.length > 0) {
                const contract = contractArray[0];

                const premium = (parseFloat(contract.bid || 0) + parseFloat(contract.ask || 0)) / 2;
                if (premium <= riskSettings.maxOptionPrice && premium > 0) {

                  const option = {
                    symbol: symbol,
                    type: type,
                    strike: parseFloat(strike),
                    premium: premium,
                    bid: parseFloat(contract.bid || 0),
                    ask: parseFloat(contract.ask || 0),
                    volume: contract.totalVolume || 0,
                    totalVolume: contract.totalVolume || 0,
                    openInterest: contract.openInterest || 0,
                    delta: contract.delta || 0,
                    gamma: contract.gamma || 0,
                    theta: contract.theta || 0,
                    vega: contract.vega || 0,
                    volatility: contract.volatility || 0,
                    timeValue: contract.timeValue || 0,
                    daysToExpiry: daysToExpiry,
                    expDate: expDate,
                    contractId: contract.description || `${symbol}_${type}_${strike}_${expDate}`
                  };

                  option.lceScore = calculateLCEScore(option);
                  option.liquidity = option.totalVolume >= LIQUIDITY_LEVELS.HIGH.minVolume ? 'HIGH' :
                                   option.totalVolume >= LIQUIDITY_LEVELS.MEDIUM.minVolume ? 'MEDIUM' : 'LOW';

                  options.push(option);
                }
              }
            });
          }
        });
      };

      processExpDateMap(response.data.callExpDateMap, 'CALL');
      processExpDateMap(response.data.putExpDateMap, 'PUT');

      return options.filter(opt => opt.totalVolume >= riskSettings.minVolume);

    } catch (error) {
      addActivityLog(`Failed to fetch options for ${symbol}: ${error.message}`, 'error');
      return [];
    }
  };

  // Main Scanning Function
  const startScan = async () => {
    if (!authStatus?.authenticated) {
      addActivityLog('ERROR: Not authenticated with Schwab', 'error');
      return;
    }

    setIsScanning(true);
    setScanProgress(0);
    setOpportunities([]);
    addActivityLog(`🚀 Starting ${TRADING_STRATEGIES[selectedStrategy]} scan...`);

    const allOpportunities = [];
    const totalSymbols = POPULAR_SYMBOLS.length;

    for (let i = 0; i < totalSymbols; i++) {
      const symbol = POPULAR_SYMBOLS[i];
      setScanProgress(Math.round(((i + 1) / totalSymbols) * 100));

      addActivityLog(`Scanning ${symbol}... (${i + 1}/${totalSymbols})`);

      try {
        const options = await fetchOptionsChain(symbol);
        const filtered = applyStrategyFilter(options, selectedStrategy);
        allOpportunities.push(...filtered);

        if (filtered.length > 0) {
          addActivityLog(`✅ Found ${filtered.length} opportunities in ${symbol}`, 'success');
        }

      } catch (error) {
        addActivityLog(`❌ Error scanning ${symbol}: ${error.message}`, 'error');
      }

      // Brief pause to prevent API rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Final sorting and ranking
    const topOpportunities = allOpportunities
      .sort((a, b) => b.lceScore - a.lceScore)
      .slice(0, 100); // Top 100 opportunities

    setOpportunities(topOpportunities);
    setLastScanTime(new Date());
    setIsScanning(false);
    setScanProgress(100);

    addActivityLog(`🎯 Scan complete! Found ${topOpportunities.length} opportunities`, 'success');
  };

  // Live Scanning
  const startLiveScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(() => {
      if (!isScanning) {
        startScan();
      }
    }, 60000); // Every 60 seconds

    setScanInterval(scanIntervalRef.current);
    addActivityLog('🔄 Live scanning activated (60s intervals)', 'info');
    startScan(); // Initial scan
  };

  const stopLiveScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanInterval(null);
    addActivityLog('⏹️ Live scanning stopped', 'info');
  };

  // Table Sorting
  const handleSort = (column) => {
    const direction = sortColumn === column && sortDirection === 'desc' ? 'asc' : 'desc';
    setSortColumn(column);
    setSortDirection(direction);

    const sorted = [...opportunities].sort((a, b) => {
      const aVal = a[column] || 0;
      const bVal = b[column] || 0;

      if (direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setOpportunities(sorted);
  };

  // Filtered opportunities for display
  const filteredOpportunities = opportunities.filter(opp =>
    !searchFilter ||
    opp.symbol.toLowerCase().includes(searchFilter.toLowerCase()) ||
    opp.type.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="options-scanner">
      {/* Header Dashboard */}
      <div className="scanner-header">
        <div className="header-left">
          <h2>📊 Professional Options Scanner</h2>
          <div className="connection-status">
            <span className={`status-indicator ${authStatus?.authenticated ? 'connected' : 'disconnected'}`}>
              {authStatus?.authenticated ? '● Connected to Schwab API' : '● Not Connected'}
            </span>
          </div>
        </div>

        <div className="header-right">
          <div className="account-info">
            {selectedAccount && (
              <div className="account-details">
                <span>Account: {selectedAccount.accountNumber}</span>
                <span>Available Risk: ${riskSettings.portfolioRiskLimit - 0}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Control Panel */}
      <div className="control-panel">
        <div className="control-section">
          <label>Trading Strategy:</label>
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            className="strategy-select"
          >
            {Object.entries(TRADING_STRATEGIES).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </div>

        <div className="control-section">
          <label>Max Option Price:</label>
          <input
            type="number"
            value={riskSettings.maxOptionPrice}
            onChange={(e) => setRiskSettings(prev => ({...prev, maxOptionPrice: parseInt(e.target.value)}))}
            className="risk-input"
          />
        </div>

        <div className="control-section">
          <label>Min Volume:</label>
          <input
            type="number"
            value={riskSettings.minVolume}
            onChange={(e) => setRiskSettings(prev => ({...prev, minVolume: parseInt(e.target.value)}))}
            className="risk-input"
          />
        </div>

        <div className="scan-controls">
          <button
            onClick={startScan}
            disabled={!authStatus?.authenticated || isScanning}
            className={`scan-btn ${isScanning ? 'scanning' : 'ready'}`}
          >
            {isScanning ? '🔄 Scanning...' : '🚀 Start Scan'}
          </button>

          <button
            onClick={scanInterval ? stopLiveScanning : startLiveScanning}
            disabled={!authStatus?.authenticated}
            className={`live-btn ${scanInterval ? 'active' : 'inactive'}`}
          >
            {scanInterval ? '⏹️ Stop Live' : '🔄 Start Live'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isScanning && (
        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${scanProgress}%` }}
            ></div>
          </div>
          <span className="progress-text">{scanProgress}% Complete</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="search-section">
        <input
          type="text"
          placeholder="Search by symbol or option type..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="search-input"
        />
        <span className="results-count">
          {filteredOpportunities.length} opportunities found
        </span>
        {lastScanTime && (
          <span className="last-scan">
            Last scan: {lastScanTime.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Opportunities Table */}
      <div className="opportunities-table-container">
        <table className="opportunities-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('symbol')} className="sortable">
                Symbol {sortColumn === 'symbol' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => handleSort('type')} className="sortable">
                Type {sortColumn === 'type' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => handleSort('strike')} className="sortable">
                Strike {sortColumn === 'strike' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => handleSort('premium')} className="sortable">
                Premium {sortColumn === 'premium' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => handleSort('totalVolume')} className="sortable">
                Volume {sortColumn === 'totalVolume' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th onClick={() => handleSort('lceScore')} className="sortable">
                LCE Score {sortColumn === 'lceScore' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th>Liquidity</th>
              <th onClick={() => handleSort('daysToExpiry')} className="sortable">
                Days Left {sortColumn === 'daysToExpiry' && (sortDirection === 'desc' ? '↓' : '↑')}
              </th>
              <th>Greeks</th>
            </tr>
          </thead>
          <tbody>
            {filteredOpportunities.map((opportunity, index) => (
              <tr key={opportunity.contractId || index} className="opportunity-row">
                <td className="symbol-cell">
                  <strong>{opportunity.symbol}</strong>
                </td>
                <td className={`type-cell ${opportunity.type.toLowerCase()}`}>
                  {opportunity.type}
                </td>
                <td className="strike-cell">
                  ${opportunity.strike}
                </td>
                <td className="premium-cell">
                  <strong>${opportunity.premium.toFixed(2)}</strong>
                  <small>{opportunity.bid.toFixed(2)}/{opportunity.ask.toFixed(2)}</small>
                </td>
                <td className="volume-cell">
                  {opportunity.totalVolume.toLocaleString()}
                </td>
                <td className="lce-cell">
                  <div className={`lce-score score-${Math.floor(opportunity.lceScore / 20)}`}>
                    {opportunity.lceScore}
                  </div>
                </td>
                <td className="liquidity-cell">
                  <span className={`liquidity-badge ${opportunity.liquidity.toLowerCase()}`}>
                    {opportunity.liquidity}
                  </span>
                </td>
                <td className="days-cell">
                  {opportunity.daysToExpiry}d
                </td>
                <td className="greeks-cell">
                  <small>
                    Δ{opportunity.delta.toFixed(2)}<br/>
                    Θ{opportunity.theta.toFixed(2)}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredOpportunities.length === 0 && !isScanning && (
          <div className="no-opportunities">
            <p>No opportunities found. Try adjusting your strategy or risk parameters.</p>
            <button onClick={startScan} className="retry-btn">
              🔄 Run Scan
            </button>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="activity-log">
        <h3>📝 Activity Log</h3>
        <div className="log-container">
          {activityLog.map((entry) => (
            <div key={entry.id} className={`log-entry ${entry.type}`}>
              <span className="log-time">{entry.timestamp}</span>
              <span className="log-message">{entry.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OptionsScanner;