import React, { useMemo } from 'react';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import NewsFeed from './NewsFeed';

// Generates simulated historical coordinates for the SVG chart based on the current price & change
const generateChartPath = (price, change, width = 600, height = 110) => {
  const points = 16;
  const isPositive = change >= 0;
  const startPrice = price - change;
  
  const prices = [];
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    // Base trend
    const trend = change * progress;
    // Add realistic fluctuations using sine waves and pseudo-random offsets
    const cycle = Math.sin(progress * Math.PI * 2.5) * (Math.abs(change) * 0.4);
    const noise = Math.cos(progress * 12 + i) * (Math.abs(change) * 0.15);
    prices.push(startPrice + trend + cycle + noise);
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const spread = max - min === 0 ? 1 : max - min;

  const coords = prices.map((p, i) => {
    const x = (i / (points - 1)) * (width - 20) + 10;
    // SVG y=0 is at top, so invert
    const y = height - 15 - ((p - min) / spread) * (height - 30);
    return { x, y, p };
  });

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  
  // Create area path
  const areaPath = `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

  return { path, areaPath, coords, min, max };
};

export default function StockDetail({ stock, allNews, onBack, onSelectStock, loading, error, onRefresh, aiEnabled }) {
  const isPositive = stock.changePercent >= 0;
  const sign = isPositive ? '+' : '';

  const [chartHeight, setChartHeight] = React.useState(110);
  const [isResizingChart, setIsResizingChart] = React.useState(false);

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingChart) return;
      const chartContainerEl = document.querySelector('.chart-container-resizable');
      if (!chartContainerEl) return;
      const rect = chartContainerEl.getBoundingClientRect();
      const newHeight = e.clientY - rect.top;
      if (newHeight > 60 && newHeight < 350) {
        setChartHeight(newHeight);
      }
    };
    const handleMouseUp = () => {
      setIsResizingChart(false);
    };
    if (isResizingChart) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingChart]);

  // Generate chart details
  const { path, areaPath, coords, min, max } = useMemo(() => {
    return generateChartPath(stock.price, stock.change, 600, chartHeight);
  }, [stock.price, stock.change, chartHeight]);

  // Filter headlines
  // 1. Market-Wide News (using the new isMarketWide field, or fallback to general indices)
  const marketNews = useMemo(() => {
    return allNews.filter(n => n.isMarketWide === true || !n.ticker || n.ticker === 'NIFTY50' || n.ticker === 'SENSEX');
  }, [allNews]);

  // 2. Specific Stock News
  const stockNews = useMemo(() => {
    return allNews.filter(n => n.ticker === stock.symbol);
  }, [allNews, stock.symbol]);

  // 3. Related Sector News (specific to other tickers in the same sector)
  const sectorNews = useMemo(() => {
    const symbolToSector = {
      HDFCBANK: "Banking", ICICIBANK: "Banking", SBIN: "Banking", AXISBANK: "Banking", KOTAKBANK: "Banking", BAJFINANCE: "Banking",
      TCS: "IT", INFY: "IT", WIPRO: "IT", HCLTECH: "IT", TECHM: "IT",
      RELIANCE: "Energy", NTPC: "Energy", ONGC: "Energy", POWERGRID: "Energy", BPCL: "Energy",
      MARUTI: "Auto", TATAMOTORS: "Auto", EICHERMOT: "Auto", HEROMOTOCO: "Auto",
      SUNPHARMA: "Pharma", CIPLA: "Pharma", DRREDDY: "Pharma",
      ITC: "FMCG", NESTLEIND: "FMCG", HINDUNILVR: "FMCG", TITAN: "FMCG",
      LT: "Conglomerate", ADANIENT: "Conglomerate", ADANIPORTS: "Conglomerate", ULTRACEMCO: "Conglomerate"
    };

    const currentSector = symbolToSector[stock.symbol] || "General";
    return allNews.filter(n => n.ticker && n.ticker !== stock.symbol && symbolToSector[n.ticker] === currentSector);
  }, [allNews, stock.symbol]);

  // Generate dynamic overall "Why is it moving" analysis text based on current headlines and price change
  const whyIsItMovingExplainer = useMemo(() => {
    if (stockNews.length > 0) {
      const primeNews = stockNews.find(n => n.sentiment === (isPositive ? 'bullish' : 'bearish')) || stockNews[0];
      if (primeNews && primeNews.explanation) {
        return `Driven by: "${primeNews.explanation}" overall market actions reflect this localized trend.`;
      }
    }
    
    if (isPositive) {
      return `Stock price is trending upward today showing strong buying momentum at ${stock.price.toLocaleString('en-IN')}. Buyers are encouraged by sector-wide positive updates and overall optimistic indices.`;
    } else {
      return `Price is pulling back to ${stock.price.toLocaleString('en-IN')} amid profit-booking and minor selling pressure in the sector. Traders are showing caution pending further macro cues.`;
    }
  }, [stockNews, isPositive, stock.price]);

  // Drag and Drop ordering state
  const [blocks, setBlocks] = React.useState([
    { id: 'market', component: 'market' },
    { id: 'specific', component: 'specific' },
    { id: 'sector', component: 'sector' }
  ]);
  const [draggedId, setDraggedId] = React.useState(null);

  const handleDragStart = (id) => {
    setDraggedId(id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetId) => {
    if (draggedId === targetId) return;
    const newBlocks = [...blocks];
    const dragIdx = newBlocks.findIndex(b => b.id === draggedId);
    const targetIdx = newBlocks.findIndex(b => b.id === targetId);
    
    // Swap positions
    const temp = newBlocks[dragIdx];
    newBlocks[dragIdx] = newBlocks[targetIdx];
    newBlocks[targetIdx] = temp;
    
    setBlocks(newBlocks);
    setDraggedId(null);
  };

  const [leftWidthPercent, setLeftWidthPercent] = React.useState(55);
  const [isResizingCols, setIsResizingCols] = React.useState(false);
  const [topHeightPercent, setTopHeightPercent] = React.useState(50);
  const [isResizingRows, setIsResizingRows] = React.useState(false);

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingCols) {
        const gridEl = document.querySelector('.detail-grid');
        if (!gridEl) return;
        const gridRect = gridEl.getBoundingClientRect();
        const relativeX = e.clientX - gridRect.left;
        const percent = (relativeX / gridRect.width) * 100;
        if (percent > 25 && percent < 75) {
          setLeftWidthPercent(percent);
        }
      } else if (isResizingRows) {
        const rightEl = document.querySelector('.detail-right');
        if (!rightEl) return;
        const rightRect = rightEl.getBoundingClientRect();
        const relativeY = e.clientY - rightRect.top;
        const percent = (relativeY / rightRect.height) * 100;
        if (percent > 20 && percent < 80) {
          setTopHeightPercent(percent);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingCols(false);
      setIsResizingRows(false);
    };

    if (isResizingCols || isResizingRows) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingCols, isResizingRows]);

  const renderBlockContent = (componentKey) => {
    if (componentKey === 'market') {
      return (
        <>
          <div 
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              cursor: 'grab'
            }}
            draggable
            onDragStart={() => handleDragStart('market')}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop('market')}
            className="drag-header"
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>⋮⋮</span> Urgent Market-Wide News
            </span>
            <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{marketNews.length} Headlines</span>
          </div>
          <div className="scrollable-y" style={{ flex: 1 }}>
            <NewsFeed items={marketNews} loading={loading} error={error} onRefresh={onRefresh} aiEnabled={aiEnabled} onSelectStock={onSelectStock} />
          </div>
        </>
      );
    }
    
    if (componentKey === 'specific') {
      return (
        <>
          <div 
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              cursor: 'grab'
            }}
            draggable
            onDragStart={() => handleDragStart('specific')}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop('specific')}
            className="drag-header"
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>⋮⋮</span> {stock.symbol} Specific News
            </span>
            <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{stockNews.length} Headlines</span>
          </div>
          
          <div className="scrollable-y" style={{ flex: 1 }}>
            {/* "Why is it moving?" explainer card - only visible if AI is enabled */}
            {aiEnabled && (
              <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border-primary)',
                backgroundColor: 'rgba(255,255,255,0.01)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <div className="live-indicator"></div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    Why is it moving today?
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                  {whyIsItMovingExplainer}
                </p>
              </div>
            )}

            <NewsFeed items={stockNews} loading={loading} error={error} onRefresh={onRefresh} aiEnabled={aiEnabled} onSelectStock={onSelectStock} />
          </div>
        </>
      );
    }
    
    if (componentKey === 'sector') {
      return (
        <>
          <div 
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-secondary)',
              cursor: 'grab'
            }}
            draggable
            onDragStart={() => handleDragStart('sector')}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop('sector')}
            className="drag-header"
          >
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>⋮⋮</span> Related Sector News
            </span>
            <span className="mono" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{sectorNews.length} Headlines</span>
          </div>
          <div className="scrollable-y" style={{ flex: 1 }}>
            <NewsFeed items={sectorNews} loading={loading} error={error} onRefresh={onRefresh} aiEnabled={aiEnabled} onSelectStock={onSelectStock} />
          </div>
        </>
      );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', overflow: 'hidden' }}>
      
      {/* Stock Detail Header & Interactive Chart */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Navigation & Title */}
        <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              onClick={onBack}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                padding: '4px 8px',
                border: '1px solid var(--border-primary)',
                borderRadius: '3px'
              }}
              className="list-item-hover"
            >
              <ArrowLeft size={14} /> Back
            </button>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.02em' }}>{stock.symbol}</h1>
                <span className="mono" style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)',
                  padding: '2px 6px',
                  backgroundColor: isPositive ? 'rgba(0,176,96,0.08)' : 'rgba(255,59,48,0.08)',
                  borderRadius: '3px'
                }}>
                  {sign}{stock.changePercent.toFixed(2)}%
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stock.name}</div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: '1.4rem', fontWeight: 700 }}>
              {stock.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="mono" style={{ fontSize: '0.75rem', color: isPositive ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
              {sign}{stock.change.toFixed(2)} today
            </div>
          </div>
        </div>

        {/* SVG Sparkline Chart */}
        <div 
          className="chart-container-resizable"
          style={{ 
            height: `${chartHeight}px`, 
            position: 'relative', 
            border: '1px solid var(--border-primary)', 
            borderRadius: '4px',
            backgroundColor: 'var(--bg-primary)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Grid lines */}
          <div style={{ position: 'absolute', top: '25%', left: 0, right: 0, borderBottom: '1px dashed var(--border-primary)' }}></div>
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderBottom: '1px dashed var(--border-primary)' }}></div>
          <div style={{ position: 'absolute', top: '75%', left: 0, right: 0, borderBottom: '1px dashed var(--border-primary)' }}></div>
          
          <svg width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', flex: 1 }}>
            <defs>
              <linearGradient id="gradient-detail" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.15" />
                <stop offset="100%" stopColor={isPositive ? '#10B981' : '#EF4444'} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Area Path */}
            <path 
              d={areaPath} 
              fill="url(#gradient-detail)" 
            />
            {/* Line Path */}
            <path 
              d={path} 
              fill="none" 
              stroke={isPositive ? "var(--color-bullish)" : "var(--color-bearish)"} 
              strokeWidth="2" 
              strokeLinecap="round"
            />
          </svg>

          {/* Price tags */}
          <span className="mono" style={{ position: 'absolute', top: '4px', right: '8px', fontSize: '0.65rem', color: 'var(--text-dimmed)' }}>
            MAX: {max.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
          </span>
          <span className="mono" style={{ position: 'absolute', bottom: '12px', right: '8px', fontSize: '0.65rem', color: 'var(--text-dimmed)' }}>
            MIN: {min.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
          </span>

          {/* Drag Resizer Divider Handle for Chart (Double-headed arrow ns-resize) */}
          <div 
            style={{
              height: '6px',
              cursor: 'ns-resize',
              backgroundColor: isResizingChart ? 'var(--color-bullish)' : 'var(--border-primary)',
              transition: 'background-color 0.15s ease',
              width: '100%',
              position: 'absolute',
              bottom: 0,
              left: 0,
              zIndex: 20
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingChart(true);
            }}
          />
        </div>
      </div>

      {/* Grid splits for stock details - Rearrangeable dynamically & drag-to-resize enabled */}
      <div className="detail-grid" style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
        
        {/* Left vertical half */}
        <div className="detail-left" style={{ width: `${leftWidthPercent}%`, borderRight: 'none', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {renderBlockContent(blocks[0].component)}
        </div>

        {/* Drag Resizer Divider Handle for Columns */}
        <div 
          style={{
            width: '4px',
            cursor: 'col-resize',
            backgroundColor: isResizingCols ? 'var(--color-bullish)' : 'var(--border-primary)',
            transition: 'background-color 0.15s ease',
            height: '100%',
            zIndex: 10,
            flexShrink: 0
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizingCols(true);
          }}
        />

        {/* Right column (divided in two horizontally) */}
        <div className="detail-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          
          {/* Top Right */}
          <div className="detail-right-top" style={{ height: `${topHeightPercent}%`, borderBottom: 'none', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderBlockContent(blocks[1].component)}
          </div>

          {/* Drag Resizer Divider Handle for Rows */}
          <div 
            style={{
              height: '4px',
              cursor: 'row-resize',
              backgroundColor: isResizingRows ? 'var(--color-bullish)' : 'var(--border-primary)',
              transition: 'background-color 0.15s ease',
              width: '100%',
              zIndex: 10,
              flexShrink: 0
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizingRows(true);
            }}
          />

          {/* Bottom Right */}
          <div className="detail-right-bottom" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {renderBlockContent(blocks[2].component)}
          </div>

        </div>

      </div>

    </div>
  );
}
