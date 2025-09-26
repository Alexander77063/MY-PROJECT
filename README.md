# 🎯 Schwab Options Scanner

A professional-grade, real-time options scanning application that helps traders identify profitable options trading opportunities using the Charles Schwab API.

## 🌟 What This Scanner Does

### **Real-Time Options Discovery**
- **Scans 24+ popular stocks** (SPY, QQQ, AAPL, TSLA, MSFT, etc.) for options opportunities
- **Live data integration** with Charles Schwab API for real-time pricing
- **Automated scanning** every 60 seconds when active
- **Multi-strategy filtering** to find opportunities that match your trading style

### **Smart Opportunity Scoring**
- **LCE Score System** (Liquidity-Cost-Efficiency) - proprietary scoring from 0-100
- **Risk Assessment** - automatic affordability and risk calculations
- **Liquidity Analysis** - identifies high/medium/low liquidity options
- **Greek Analysis** - evaluates delta, gamma, theta, vega for optimal entries

### **5 Built-in Trading Strategies**
1. **🚀 High Momentum** - Options with strong directional movement
2. **💰 High Value** - Undervalued options with good risk/reward ratios
3. **📈 Volatility Expansion** - Options benefiting from increasing volatility
4. **📊 Earnings Plays** - Pre-earnings options opportunities (≤14 days to expiry)
5. **📐 Technical Setups** - Options at key technical support/resistance levels

### **Professional Risk Management**
- **Portfolio Risk Tracking** - monitors total risk exposure
- **Position Sizing** - automatic calculation of max risk per trade
- **Account Integration** - real-time account balance and position monitoring
- **Customizable Risk Parameters** - set your own risk limits and filters

### **Advanced Filtering & Analysis**
- **Time-based Filters** - min/max days to expiration
- **Volume Requirements** - minimum trading volume thresholds  
- **Spread Analysis** - bid/ask spread evaluation
- **Strike Price Ranges** - customizable strike price filtering
- **Premium Limits** - maximum option cost controls

## 🖥️ User Interface Features

### **Live Dashboard**
- **Real-time Connection Status** - shows Schwab API connectivity
- **Scanning Progress Bar** - visual progress of current scan
- **Live Activity Log** - real-time scanning updates and status messages
- **Account Overview** - balance, used risk, available risk, open positions

### **Interactive Options Table**
- **Sortable Columns** - sort by LCE score, volume, premium, expiration
- **Search Functionality** - filter by symbol, option type
- **Color-coded Indicators** - green/yellow/red for liquidity and affordability
- **Detailed Metrics** - bid/ask, volume, Greeks, breakeven points

### **Customizable Settings**
- **Risk Parameters** - max option price, max risk per trade, portfolio limits
- **Scanning Filters** - volume, spread, time to expiration
- **Strategy Selection** - choose your preferred trading approach
- **Account Selection** - multiple account support

## 🔍 How It Works

### **1. Market Data Collection**
```
Scanner → Schwab API → Options Chain Data → Real-time Quotes
```

### **2. Opportunity Analysis**
```
Raw Data → Strategy Filters → Risk Analysis → LCE Scoring → Ranking
```

### **3. Results Presentation**
```
Top Opportunities → User Dashboard → Sortable Table → Trading Decisions
```

## 📊 Sample Output

The scanner presents opportunities like this:

| Symbol | Type | Strike | Premium | Volume | LCE Score | Liquidity | Days Left |
|--------|------|--------|---------|--------|-----------|-----------|-----------|
| AAPL   | CALL | $180   | $2.45   | 1,250  | **87**    | HIGH      | 21d       |
| SPY    | PUT  | $420   | $1.80   | 3,400  | **82**    | HIGH      | 14d       |
| TSLA   | CALL | $250   | $3.20   | 890    | **79**    | MEDIUM    | 28d       |

## 🎯 Who This Is For

### **Day Traders**
- Quick identification of high-volume, liquid options
- Real-time scanning for momentum plays
- Immediate risk assessment

### **Swing Traders** 
- Multi-day opportunity identification
- Technical setup recognition
- Risk-managed position sizing

### **Options Specialists**
- Advanced Greeks analysis
- Volatility-based strategies
- Professional risk management tools

### **Portfolio Managers**
- Account-wide risk monitoring
- Position tracking and analysis
- Systematic opportunity discovery

## 🚀 Key Benefits

### **⚡ Speed & Efficiency**
- Scans 24+ stocks in under 30 seconds
- Real-time data updates every 60 seconds
- Instant sorting and filtering

### **🎯 Precision Targeting**
- LCE scoring system eliminates noise
- Strategy-specific filtering
- Risk-adjusted opportunity ranking

### **🛡️ Risk Protection**
- Built-in position sizing
- Portfolio risk monitoring
- Account balance integration

### **📱 User Experience**
- One-click startup
- Intuitive interface
- Real-time status updates
- Automatic browser launch

## 🔧 Technical Features

### **Backend (Node.js/Express)**
- RESTful API architecture
- Rate limiting and error handling
- CORS configuration for security
- Environment-based configuration
- Logging and monitoring

### **Frontend (React/TypeScript)**
- Modern React hooks architecture
- Real-time state management
- Responsive design
- TypeScript for type safety
- Tailwind CSS styling

### **Integration**
- Charles Schwab API integration
- Optional Alpha Vantage market data
- Environment variable configuration
- Local development and production modes

## 🚀 Quick Start

### **One-Command Startup:**
```bash
# Double-click this file:
start-scanner.bat

# Or from command line:
npm start
```

### **What Opens:**
- **Frontend**: http://localhost:3000 (opens automatically in browser)
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

## 📈 Trading Workflow

1. **Launch Scanner** - One-click startup
2. **Connect to Schwab** - Click "Connect" button
3. **Select Strategy** - Choose your preferred approach
4. **Start Scanning** - Click "Start Scanning" for live updates
5. **Review Opportunities** - Sort by LCE score or other metrics
6. **Analyze Risk** - Check affordability and risk metrics
7. **Execute Trades** - Use the data to make informed decisions

## 🔐 Security & Configuration

- API keys stored in environment files (not committed to git)
- CORS protection for API endpoints
- Rate limiting to respect API quotas
- Secure credential management

## 📋 System Requirements

- Node.js 16+ 
- Charles Schwab API credentials
- Windows/Mac/Linux support
- Modern web browser
- Internet connection for real-time data

---

**Ready to find your next profitable options trade? Launch the scanner and start discovering opportunities!** 🚀

*Note: This tool is for educational and informational purposes. Always conduct your own analysis before making trading decisions.*
