import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, X } from 'lucide-react';

export const SECTOR_GROUPS = {
  "Banking & Finance": [
    { symbol: "HDFCBANK", name: "HDFC Bank Ltd.", price: 1430.8, change: -14.9, changePercent: -1.03 },
    { symbol: "ICICIBANK", name: "ICICI Bank Ltd.", price: 955.4, change: -10.1, changePercent: -1.05 },
    { symbol: "SBIN", name: "State Bank of India", price: 588.2, change: 4.8, changePercent: 0.82 },
    { symbol: "AXISBANK", name: "Axis Bank Ltd.", price: 978.5, change: -3.2, changePercent: -0.33 },
    { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", price: 1785.4, change: -12.4, changePercent: -0.69 },
    { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd.", price: 7120.5, change: 15.6, changePercent: 0.22 },
  ],
  "IT & Technology": [
    { symbol: "TCS", name: "Tata Consultancy Services", price: 3410.5, change: -24.5, changePercent: -0.71 },
    { symbol: "INFY", name: "Infosys Ltd.", price: 1380.2, change: 18.4, changePercent: 1.35 },
    { symbol: "WIPRO", name: "Wipro Ltd.", price: 388.9, change: -2.1, changePercent: -0.54 },
    { symbol: "HCLTECH", name: "HCL Technologies Ltd.", price: 1120.4, change: 8.5, changePercent: 0.76 },
    { symbol: "TECHM", name: "Tech Mahindra Ltd.", price: 1045.0, change: -5.5, changePercent: -0.52 },
  ],
  "Energy & Resources": [
    { symbol: "RELIANCE", name: "Reliance Industries Ltd.", price: 2435.5, change: -22.3, changePercent: -0.91 },
    { symbol: "NTPC", name: "NTPC Ltd.", price: 220.4, change: 1.8, changePercent: 0.82 },
    { symbol: "ONGC", name: "Oil & Natural Gas Corp.", price: 175.2, change: -1.4, changePercent: -0.79 },
    { symbol: "POWERGRID", name: "Power Grid Corp.", price: 245.8, change: 0.9, changePercent: 0.37 },
    { symbol: "BPCL", name: "Bharat Petroleum Corp.", price: 362.4, change: -3.6, changePercent: -0.98 },
  ],
  "Automotive": [
    { symbol: "MARUTI", name: "Maruti Suzuki India", price: 9550.0, change: -48.2, changePercent: -0.50 },
    { symbol: "TATAMOTORS", name: "Tata Motors Ltd.", price: 620.5, change: 12.4, changePercent: 2.04 },
    { symbol: "EICHERMOT", name: "Eicher Motors Ltd.", price: 3380.0, change: -30.5, changePercent: -0.89 },
    { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd.", price: 2980.2, change: -15.4, changePercent: -0.51 },
  ],
  "Pharma & Healthcare": [
    { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Ind.", price: 1140.5, change: 6.2, changePercent: 0.55 },
    { symbol: "CIPLA", name: "Cipla Ltd.", price: 1180.2, change: -8.4, changePercent: -0.71 },
    { symbol: "DRREDDY", name: "Dr. Reddy's Laboratories", price: 5410.8, change: 22.4, changePercent: 0.42 },
  ],
  "Consumer Goods": [
    { symbol: "ITC", name: "ITC Ltd.", price: 445.5, change: -1.2, changePercent: -0.27 },
    { symbol: "NESTLEIND", name: "Nestle India Ltd.", price: 21850.0, change: -150.0, changePercent: -0.68 },
    { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd.", price: 2540.2, change: -18.5, changePercent: -0.72 },
    { symbol: "TITAN", name: "Titan Company Ltd.", price: 3010.4, change: 12.6, changePercent: 0.42 },
  ],
  "Conglomerates & Cement": [
    { symbol: "LT", name: "Larsen & Toubro Ltd.", price: 2650.4, change: -35.2, changePercent: -1.31 },
    { symbol: "ADANIENT", name: "Adani Enterprises Ltd.", price: 2480.5, change: 42.1, changePercent: 1.73 },
    { symbol: "ADANIPORTS", name: "Adani Ports & SEZ Ltd.", price: 820.4, change: 8.2, changePercent: 1.01 },
    { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd.", price: 8120.0, change: -45.6, changePercent: -0.56 },
  ]
};

// Generates a list of coordinates that climb for positive and slide for negative
const getSparklinePoints = (changePercent, idx) => {
  const isPositive = changePercent >= 0;
  const basePoints = [12, 11, 13, 10, 14, 11, 13];
  
  const trendedPoints = basePoints.map((val, i) => {
    // Trend factor pushes the line up or down
    const trend = isPositive ? (i * 0.9) : (-i * 0.9);
    // Deterministic noise based on index to make them look distinct
    const noise = Math.sin(i * 1.5 + idx) * 2;
    // Calculate final vertical coordinate (SVG heights are 0 at top, so invert trend)
    return 13 - (trend + noise);
  });
  
  // Scale and clamp points to fit in 45x24 SVG viewBox
  return trendedPoints.map((y, i) => ({
    x: i * 7 + 2,
    y: Math.max(2, Math.min(22, y))
  }));
};

export default function WatchlistSidebar({ selectedSymbol, onSelectStock, width = 330, onClose }) {
  const [stocks, setStocks] = useState(SECTOR_GROUPS);
  const [collapsedSectors, setCollapsedSectors] = useState({});

  // Simulate slight market price updates (1 ticker updates randomly every 4s) to make dashboard feel alive
  useEffect(() => {
    const interval = setInterval(() => {
      const sectors = Object.keys(stocks);
      const randomSector = sectors[Math.floor(Math.random() * sectors.length)];
      const sectorStocks = stocks[randomSector];
      const randomIndex = Math.floor(Math.random() * sectorStocks.length);
      
      const targetStock = sectorStocks[randomIndex];
      // Random price drift between -0.15% and +0.15%
      const driftPercent = (Math.random() * 0.3 - 0.15) / 100;
      const newPrice = Number((targetStock.price * (1 + driftPercent)).toFixed(2));
      const priceDiff = Number((newPrice - (targetStock.price - targetStock.change)).toFixed(2));
      const basePrice = targetStock.price - targetStock.change;
      const newPercent = Number(((priceDiff / basePrice) * 100).toFixed(2));

      setStocks(prev => {
        const updated = { ...prev };
        updated[randomSector] = [...updated[randomSector]];
        updated[randomSector][randomIndex] = {
          ...targetStock,
          price: newPrice,
          change: priceDiff,
          changePercent: newPercent
        };
        return updated;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [stocks]);

  const toggleSector = (sector) => {
    setCollapsedSectors(prev => ({
      ...prev,
      [sector]: !prev[sector]
    }));
  };

  return (
    <aside style={{
      width: `${width}px`,
      minWidth: '220px',
      maxWidth: '600px',
      borderLeft: '1px solid var(--border-primary)',
      backgroundColor: 'var(--bg-secondary)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      flexShrink: 0
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="live-indicator"></div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Watchlist</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>NIFTY 50</span>
          {onClose && (
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
              title="Close Watchlist"
              className="list-item-hover"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Sector Groups List */}
      <div className="scrollable-y" style={{ flex: 1 }}>
        {Object.entries(stocks).map(([sectorName, stockList], sectorIdx) => {
          const isCollapsed = collapsedSectors[sectorName];
          return (
            <div key={sectorName} style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {/* Sector Header */}
              <button 
                onClick={() => toggleSector(sectorName)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'rgba(255,255,255,0.01)',
                  textAlign: 'left'
                }}
              >
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  {sectorName}
                </span>
                {isCollapsed ? <ChevronRight size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
              </button>

              {/* Stocks in Sector */}
              {!isCollapsed && (
                <div style={{ paddingBottom: '4px' }}>
                  {stockList.map((stock, idx) => {
                    const isSelected = selectedSymbol === stock.symbol;
                    const isPositive = stock.changePercent >= 0;
                    const changeClass = isPositive ? 'color-bullish' : 'color-bearish';
                    const sign = isPositive ? '+' : '';
                    
                    const pts = getSparklinePoints(stock.changePercent, sectorIdx * 10 + idx);
                    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    const startPt = pts[0];
                    const endPt = pts[pts.length - 1];
                    
                    return (
                      <div 
                        key={stock.symbol}
                        onClick={() => onSelectStock(stock)}
                        className={`clickable list-item-hover ${isSelected ? 'list-item-active' : ''}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px 14px',
                          borderLeft: isSelected ? '3px solid var(--text-primary)' : '3px solid transparent'
                        }}
                      >
                        {/* Ticker Symbol & Name */}
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em' }}>{stock.symbol}</span>
                            <span className="mono" style={{ fontSize: '0.65rem', color: isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)', padding: '1px 3px', backgroundColor: isPositive ? 'rgba(0,176,96,0.08)' : 'rgba(255,59,48,0.08)', borderRadius: '2px', fontVariantNumeric: 'tabular-nums' }}>
                              {sign}{stock.changePercent}%
                            </span>
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                            {stock.name}
                          </div>
                        </div>

                        {/* Sparkline Micro-chart */}
                        <div style={{ paddingRight: '12px' }}>
                          <svg width="45" height="24" viewBox="0 0 45 24">
                            <path 
                              d={pathD} 
                              fill="none" 
                              stroke={isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)'} 
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx={startPt.x} cy={startPt.y} r="1.5" fill="var(--text-muted)" />
                            <circle cx={endPt.x} cy={endPt.y} r="2" fill={isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)'} />
                          </svg>
                        </div>

                        {/* Price & Absolute Change */}
                        <div style={{ textAlign: 'right' }}>
                          <div className="mono" style={{ fontSize: '0.85rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="mono" style={{ fontSize: '0.65rem', color: isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)', fontVariantNumeric: 'tabular-nums' }}>
                            {sign}{stock.change.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
