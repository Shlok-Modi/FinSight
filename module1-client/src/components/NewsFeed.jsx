import React from 'react';
import { ExternalLink, AlertCircle, ArrowUpRight, ArrowDownRight, Minus, Clock, ShieldCheck } from 'lucide-react';

export default function NewsFeed({ items, loading, error, onRefresh, aiEnabled = true, onSelectStock }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', color: 'var(--text-muted)' }}>
        <div style={{ width: '20px', height: '20px', border: '2px solid var(--border-primary)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'pulse-subtle 1s infinite linear', marginBottom: '12px' }}></div>
        <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>INGESTING AND ANALYZING FEEDS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', border: '1px solid var(--color-bearish)', backgroundColor: 'rgba(255,59,48,0.03)', borderRadius: '4px', margin: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-bearish)', marginBottom: '8px' }}>
          <AlertCircle size={16} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Feed Sync Failed</span>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{error}</p>
        <button onClick={onRefresh} style={{ padding: '6px 12px', border: '1px solid var(--border-secondary)', fontSize: '0.72rem', fontWeight: 500 }} className="list-item-hover">
          Retry Sync
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>NO HEADLINES MATCHING SEARCH CRITERIA</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', backgroundColor: 'var(--border-primary)' }}>
      {items.map((item) => (
        <NewsItemCard key={item.id} item={item} aiEnabled={aiEnabled} onSelectStock={onSelectStock} />
      ))}
    </div>
  );
}

function NewsItemCard({ item, aiEnabled, onSelectStock }) {
  const [showAI, setShowAI] = React.useState(false);
  const cardRef = React.useRef(null);
  const [tooltipCoords, setTooltipCoords] = React.useState(null);
  const sentiment = item.sentiment || 'neutral';

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' | ' + date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch (e) {
      return isoString;
    }
  };

  const getSentimentIcon = (sentiment) => {
    switch (sentiment) {
      case 'bullish':
      case 'buy on dip':
        return <ArrowUpRight size={11} />;
      case 'bearish':
        return <ArrowDownRight size={11} />;
      default:
        return <Minus size={11} />;
    }
  };

  const handleCardClick = (e) => {
    if (e.target.closest('button') || e.target.closest('.mono')) return;
    window.open(item.url, '_blank');
  };

  const handleMouseEnter = () => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const positionBelow = spaceAbove < 130;
      setTooltipCoords({
        left: rect.left + 20,
        width: rect.width - 40,
        positionBelow,
        top: positionBelow ? rect.bottom + 2 : null,
        bottom: positionBelow ? null : window.innerHeight - rect.top + 2
      });
    }
  };

  const handleMouseLeave = () => {
    setTooltipCoords(null);
  };

  const sentimentLabel = React.useMemo(() => {
    const text = ((item.headline || '') + ' ' + (item.description || '')).toLowerCase();
    let baseSentiment = item.sentiment || 'neutral';
    
    if (text.includes('crash') || text.includes('profit falls 32%') || text.includes('revenue down 8%') || text.includes('profit falls') || text.includes('fell')) {
      if (text.includes('strong q1 results') || text.includes('despite strong')) {
        return 'BUY ON DIP';
      }
      return 'BEARISH';
    }
    
    if (baseSentiment === 'bullish') {
      if (text.includes('fall') || text.includes('drop') || text.includes('decline') || text.includes('down')) {
        return 'BUY ON DIP';
      }
    }
    return baseSentiment.toUpperCase();
  }, [item.sentiment, item.headline, item.description]);

  const sentimentColor = React.useMemo(() => {
    if (sentimentLabel === 'BEARISH') return 'var(--color-bearish)';
    if (sentimentLabel === 'BUY ON DIP' || sentimentLabel === 'BULLISH' || sentimentLabel === 'LONG-TERM BULLISH') return 'var(--color-bullish)';
    return 'var(--text-muted)';
  }, [sentimentLabel]);

  const getUnifiedBadgeText = () => {
    const horizon = (item.impactHorizon || 'SHORT-TERM').replace('_', '-').toUpperCase();
    const confidence = (item.confidence || 'HIGH').toUpperCase();
    return `⚡ ${horizon} • ${confidence}`;
  };

  return (
    <div 
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="news-card-wrapper"
    >
      <div 
        style={{
          padding: '18px 24px',
          backgroundColor: 'var(--bg-primary)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          transition: 'background-color 0.15s ease'
        }}
        className="list-item-hover"
        onClick={handleCardClick}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyItem: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' }}>
              {item.originalPublisher ? `${item.source} (${item.originalPublisher})` : item.source}
            </span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-dimmed)' }}>•</span>
            <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
              {formatTime(item.publishedAt)}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {item.ticker && (
              <span 
                className="mono list-item-hover" 
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectStock) onSelectStock(item.ticker);
                }}
                style={{ 
                  fontSize: '0.62rem', 
                  fontWeight: 700, 
                  border: '1px solid var(--border-secondary)', 
                  padding: '1px 6px', 
                  borderRadius: '3px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                {item.ticker.toUpperCase()}
              </span>
            )}
            <span className="mono" style={{ 
              fontSize: '0.62rem', 
              fontWeight: 700, 
              border: `1px solid ${sentimentColor === 'var(--color-bearish)' ? 'rgba(239,68,68,0.3)' : sentimentColor === 'var(--color-bullish)' ? 'rgba(16,185,129,0.3)' : 'var(--border-secondary)'}`, 
              padding: '1px 6px', 
              borderRadius: '3px', 
              backgroundColor: sentimentColor === 'var(--color-bearish)' ? 'rgba(239,68,68,0.08)' : sentimentColor === 'var(--color-bullish)' ? 'rgba(16,185,129,0.08)' : 'var(--bg-secondary)', 
              color: sentimentColor
            }}>
              {getSentimentIcon(sentimentLabel.toLowerCase())} {sentimentLabel}
            </span>
          </div>
        </div>

        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, lineHeight: '1.35' }}>
          {item.headline}
        </h4>

        {item.description && item.description !== item.headline && (
          <p className="explainer-text" style={{ 
            fontSize: '0.78rem', 
            color: 'var(--text-muted)', 
            margin: 0, 
            lineHeight: '1.5',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {item.description}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
          {item.sector && (
            <span>{item.sector.toUpperCase()}</span>
          )}
          <span style={{ color: 'var(--text-dimmed)' }}>•</span>
          <span>{getUnifiedBadgeText()}</span>
        </div>


        {item.alsoReportedBy && item.alsoReportedBy.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '6px', fontSize: '0.62rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
            <span>Also reported by:</span>
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
              {item.alsoReportedBy.map((src, sIdx) => (
                <span key={sIdx} style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                  {src}{sIdx < item.alsoReportedBy.length - 1 ? ' |' : ''}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
        {/* Floating Tooltip visible on hover */}
      {aiEnabled && tooltipCoords && (
        <div 
          className="ai-hover-tooltip"
          style={{
            position: 'fixed',
            left: `${tooltipCoords.left}px`,
            width: `${tooltipCoords.width}px`,
            top: tooltipCoords.positionBelow ? `${tooltipCoords.top}px` : 'auto',
            bottom: tooltipCoords.positionBelow ? 'auto' : `${tooltipCoords.bottom}px`,
            opacity: 1,
            pointerEvents: 'none',
            zIndex: 99999,
            transform: 'none'
          }}
        >
          {/* Full headline news */}
          <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)', paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{ display: 'block', fontSize: '0.58rem', fontWeight: 800, color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Full News Headline
            </span>
            <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
              {item.headline}
            </div>
          </div>

          {item.explanation && (
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.58rem', textTransform: 'uppercase', color: 'var(--color-bullish)', letterSpacing: '0.05em', marginBottom: '4px' }}>
                AI Real-Time Sentiment Impact
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {item.explanation}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
