import React, { useState, useMemo } from 'react';
import { Clock, ShieldCheck, ExternalLink, Tag } from 'lucide-react';

const getStatusBadgeClass = (status) => {
  if (status === 'open') return 'sentiment-badge bullish';
  if (status === 'upcoming') return 'sentiment-badge neutral'; // blue/teal colored manually
  if (status === 'closed') return 'sentiment-badge bearish';
  return 'sentiment-badge'; // listed
};

const getStatusColor = (status) => {
  if (status === 'open') return 'var(--color-bullish)';
  if (status === 'upcoming') return '#00b4d8'; // teal
  if (status === 'closed') return 'var(--color-bearish)';
  return '#9d4edd'; // purple
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function IpoCard({ ipo }) {
  const [tiltStyle, setTiltStyle] = useState({});
  const statusColor = getStatusColor(ipo.status);

  const handleMouseMove = (e) => {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const width = rect.width;
    const height = rect.height;
    
    // Rotate -10 to 10 degrees based on hover position relative to card center
    const rotateX = ((y / height) - 0.5) * -12; 
    const rotateY = ((x / width) - 0.5) * 12;

    setTiltStyle({
      transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px) scale(1.025)`,
      boxShadow: '0 16px 36px rgba(0, 0, 0, 0.8)',
      borderColor: 'var(--text-muted)'
    });
  };

  const handleMouseLeave = () => {
    setTiltStyle({});
  };

  return (
    <div
      className="flashcard-card"
      style={{
        ...tiltStyle,
        height: '320px', // slightly taller to suit extra data rows nicely
        justifyContent: 'space-between'
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => window.open(ipo.link, '_blank')}
    >
      <div className="flashcard-body" style={{ height: '100%', justifyContent: 'space-between', padding: '18px' }}>
        
        {/* Top Meta: Status, Type and optional Hot Badge */}
        <div className="flashcard-meta-row">
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span 
              className={getStatusBadgeClass(ipo.status)} 
              style={{ 
                color: statusColor, 
                borderColor: `${statusColor}44`,
                backgroundColor: `${statusColor}08`
              }}
            >
              {ipo.status.toUpperCase()}
            </span>
            {ipo.trending && (
              <span 
                className="sentiment-badge"
                style={{ 
                  color: 'var(--color-bearish)', 
                  borderColor: 'rgba(255, 59, 48, 0.3)',
                  backgroundColor: 'rgba(255, 59, 48, 0.08)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                🔥 HOT
              </span>
            )}
          </div>
          <span className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {ipo.type.toUpperCase()}
          </span>
        </div>

        {/* Company Name */}
        <h3 
          className="flashcard-headline-title" 
          style={{ 
            fontSize: '1.05rem', 
            fontWeight: 800, 
            letterSpacing: '-0.02em',
            margin: '4px 0',
            color: 'var(--text-primary)'
          }}
        >
          {ipo.name}
        </h3>

        {/* Main pricing & GMP metrics */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', margin: '2px 0' }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Price Band
            </div>
            <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {ipo.priceBand}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              Grey Market Premium
            </div>
            <div className="mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: (ipo.gmp !== null && ipo.gmp !== undefined && ipo.gmp < 0) ? 'var(--color-bearish)' : 'var(--color-bullish)', marginTop: '2px' }}>
              {ipo.gmp !== null && ipo.gmp !== undefined
                ? `${ipo.gmp >= 0 ? '+' : ''}₹${ipo.gmp}${ipo.gmpPercent ? ` (${ipo.gmpPercent}%)` : ''}`
                : 'No GMP'}
            </div>
          </div>
        </div>

        {/* Est Listing price row */}
        {(ipo.estListing || ipo.gmp !== null) && (
          <div style={{ 
            fontSize: '0.65rem', 
            fontFamily: 'var(--font-mono)', 
            backgroundColor: 'rgba(0, 176, 96, 0.05)', 
            border: '1px solid rgba(0, 176, 96, 0.15)',
            borderRadius: '6px',
            padding: '4px 8px',
            color: 'var(--color-bullish)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            margin: '2px 0'
          }}>
            <span>EST. LISTING:</span>
            <strong style={{ fontWeight: 800 }}>
              ₹{ipo.estListing || ipo.gmp} {(ipo.gmpPercent || ipo.gainPercent) ? `(+${ipo.gmpPercent || ipo.gainPercent}% Gain)` : ''}
            </strong>
          </div>
        )}

        {/* Size and Dates Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '12px',
          borderTop: '1px solid var(--border-primary)',
          paddingTop: '10px',
          margin: '2px 0' 
        }}>
          <div>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Issue Size</div>
            <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              ₹{ipo.issueSizeCr} Cr
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.58rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Listing Date</div>
            <div className="mono" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={10} style={{ color: 'var(--text-dimmed)' }} /> {formatDate(ipo.listingDate)}
            </div>
          </div>
        </div>

        {/* Bottom Subscription timelines */}
        <div className="flashcard-duplicates-list" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0, paddingTop: '6px' }}>
          <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
            Bids: {formatDate(ipo.openDate)} – {formatDate(ipo.closeDate)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.58rem', color: 'var(--text-dimmed)' }}>
            prospectus <ExternalLink size={8} />
          </span>
        </div>

      </div>
    </div>
  );
}
