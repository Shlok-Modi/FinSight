import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Newspaper, BarChart2, Clock, ShieldCheck, ExternalLink, Columns } from 'lucide-react';
import NewsFeed from './NewsFeed';
import Flashcard from './Flashcard';
import IpoCard from './IpoCard';
import FiiDiiFlow from './FiiDiiFlow';

// Case-insensitive substring match
const matchText = (text, query) => {
  if (!query) return true;
  if (!text) return false;
  return text.toLowerCase().includes(query.toLowerCase());
};

const SECTORS = [
  "Banking & Financial Services",
  "IT",
  "Pharma & Healthcare",
  "Auto",
  "FMCG",
  "Energy & Power",
  "Metals & Mining",
  "Infrastructure",
  "Other / Macro"
];

// Helper to determine bubble color based on sentiment & sector
const getBubbleColor = (sentiment, sector) => {
  if (sentiment === 'bullish') {
    return {
      fill: 'rgba(0, 176, 96, 0.55)',
      stroke: 'var(--color-bullish)',
      glow: 'rgba(0, 176, 96, 0.2)'
    };
  } else if (sentiment === 'bearish') {
    return {
      fill: 'rgba(255, 59, 48, 0.55)',
      stroke: 'var(--color-bearish)',
      glow: 'rgba(255, 59, 48, 0.2)'
    };
  } else if (sector === 'Other / Macro') {
    return {
      fill: 'rgba(99, 99, 102, 0.55)',
      stroke: 'var(--color-neutral)',
      glow: 'rgba(99, 99, 102, 0.15)'
    };
  } else {
    // Neutral sector specific news (Yellow)
    return {
      fill: 'rgba(212, 175, 55, 0.55)',
      stroke: '#d4af37',
      glow: 'rgba(212, 175, 55, 0.15)'
    };
  }
};

export default function MainDashboard({ 
  news, 
  ipos = [],
  loading, 
  error, 
  onRefresh, 
  searchQuery, 
  setSearchQuery, 
  selectedSource, 
  setSelectedSource, 
  selectedSentiment, 
  setSelectedSentiment,
  aiEnabled,
 
  onSelectStock,
  viewMode,
  setViewMode,
  selectedSector,
  setSelectedSector
}) {
  const [selectedIpoStatus, setSelectedIpoStatus] = useState('ALL');
  
  const [filteredNews, setFilteredNews] = useState([]);
  const [filteredIpos, setFilteredIpos] = useState([]);

  // Filter headlines and IPOs
  useEffect(() => {
    const q = searchQuery.trim();

    // Filter news
    const newsMatches = news.filter((item) => {
      const matchesSource = selectedSource === "ALL" || item.source === selectedSource;
      const matchesSentiment = selectedSentiment === "ALL" || 
        (selectedSentiment === "BULLISH" && item.sentiment === "bullish") ||
        (selectedSentiment === "BEARISH" && item.sentiment === "bearish") ||
        (selectedSentiment === "NEUTRAL" && item.sentiment === "neutral");
      const matchesSector = selectedSector === "ALL" || item.sector === selectedSector;

      if (!matchesSource || !matchesSentiment || !matchesSector) return false;
      if (!q) return true;

      return (
        matchText(item.headline, q) ||
        matchText(item.ticker || '', q) ||
        matchText(item.sector || '', q) ||
        matchText(item.source || '', q) ||
        matchText(item.description || '', q) ||
        matchText(item.explanation || '', q)
      );
    });

    // Filter IPOs
    const ipoMatches = ipos.filter((ipo) => {
      const matchesStatus = selectedIpoStatus === 'ALL' || ipo.status === selectedIpoStatus.toLowerCase();
      if (!matchesStatus) return false;
      if (!q) return true;

      return (
        matchText(ipo.name, q) ||
        matchText(ipo.type || '', q) ||
        matchText(ipo.priceBand || '', q) ||
        matchText(ipo.status || '', q)
      );
    });

    setFilteredNews(newsMatches);
    setFilteredIpos(ipoMatches);
  }, [news, ipos, searchQuery, selectedSource, selectedSentiment, selectedSector, selectedIpoStatus]);

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%',
      overflow: 'hidden' 
    }}>
      
      {/* Header Controls */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Newspaper size={18} color="var(--text-muted)" />
          <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-title)' }}>
            Market Intelligence Map
          </span>
        </div>

        {/* Universal Search & Filter Toolbar */}
        {viewMode !== 'fiidii' && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Universal Search bar */}
          <div style={{
            flex: 1,
            minWidth: '200px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid var(--border-primary)',
            borderRadius: '6px',
            padding: '5px 10px',
            backgroundColor: 'var(--bg-primary)'
          }}>
            <Search size={14} color="var(--text-dimmed)" />
            <input 
              type="text" 
              placeholder={viewMode === 'ipo' ? "Search IPOs by name..." : "Search stocks, news, sectors..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                background: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                outline: 'none',
                fontFamily: 'var(--font-sans)'
              }}
            />
          </div>

          {viewMode === 'ipo' ? (
            /* IPO Status Sub-Filters Dropdown */
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '5px 10px', backgroundColor: 'var(--bg-primary)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>STATUS:</span>
              <select
                value={selectedIpoStatus}
                onChange={(e) => setSelectedIpoStatus(e.target.value)}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  border: 'none',
                  fontSize: '0.68rem',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontFamily: 'var(--font-sans)'
                }}
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="OPEN">OPEN</option>
                <option value="UPCOMING">UPCOMING</option>
                <option value="CLOSED">CLOSED</option>
                <option value="LISTED">LISTED</option>
              </select>
            </div>
          ) : (
            /* Consolidated news filters as dropdowns adjacent to search */
            <>
              {/* Sector selector dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '5px 10px', backgroundColor: 'var(--bg-primary)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>SECTOR:</span>
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.68rem',
                    outline: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  <option value="ALL">ALL SECTORS</option>
                  <option value="Banking & Financial Services">BANKING & FINANCE</option>
                  <option value="IT">IT & TECH</option>
                  <option value="Pharma & Healthcare">PHARMA & HEALTHCARE</option>
                  <option value="Auto">AUTOMOTIVE</option>
                  <option value="FMCG">FMCG / CONSUMER</option>
                  <option value="Energy & Power">ENERGY & POWER</option>
                  <option value="Metals & Mining">METALS & MINING</option>
                  <option value="Infrastructure">INFRASTRUCTURE</option>
                  <option value="Other / Macro">OTHER / MACRO</option>
                </select>
              </div>

              {/* Consolidated Source selector dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '5px 10px', backgroundColor: 'var(--bg-primary)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>SOURCE:</span>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.68rem',
                    outline: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  <option value="ALL">ALL SOURCES</option>
                  <option value="ET Markets">ET MARKETS</option>
                  <option value="Moneycontrol">MONEYCONTROL</option>
                  <option value="Livemint">LIVEMINT</option>
                  <option value="BusinessLine">BUSINESSLINE</option>
                  <option value="Google News (Markets)">GOOGLE NEWS</option>
                  <option value="CNBC-TV18">CNBC-TV18</option>
                </select>
              </div>

              {/* Consolidated Sentiment selector dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '5px 10px', backgroundColor: 'var(--bg-primary)' }}>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>SENTIMENT:</span>
                <select
                  value={selectedSentiment}
                  onChange={(e) => setSelectedSentiment(e.target.value)}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    border: 'none',
                    fontSize: '0.68rem',
                    outline: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)'
                  }}
                >
                  <option value="ALL">ALL SENTIMENTS</option>
                  <option value="BULLISH">BULLISH</option>
                  <option value="BEARISH">BEARISH</option>
                  <option value="NEUTRAL">NEUTRAL</option>
                </select>
              </div>
            </>
          )}
        </div>
        )}
      </div>

      {/* Main Workspace Frame */}
      {viewMode === 'fiidii' ? (
        <div className="scrollable-y" style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}>
          <FiiDiiFlow />
        </div>
      ) : viewMode === 'feed' ? (
        <div className="scrollable-y" style={{ flex: 1 }}>
          <NewsFeed items={filteredNews} loading={loading} error={error} onRefresh={onRefresh} aiEnabled={aiEnabled} onSelectStock={onSelectStock} />
        </div>
      ) : viewMode === 'ipo' ? (
        <div className="scrollable-y" style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}>
          {filteredIpos.length > 0 ? (
            <div className="flashcard-grid">
              {filteredIpos.map((ipo) => (
                <IpoCard key={ipo.id} ipo={ipo} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '80px 0', fontFamily: 'var(--font-mono)' }}>
              NO IPOs FOUND FOR THE SELECTED STATUS
            </div>
          )}
        </div>
      ) : (
        <div className="scrollable-y" style={{ flex: 1, backgroundColor: 'var(--bg-primary)' }}>
          {filteredNews.length > 0 ? (
            <div className="flashcard-grid">
              {filteredNews.map((item) => (
                <Flashcard key={item.id} item={item} aiEnabled={aiEnabled} onSelectStock={onSelectStock} />
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '80px 0', fontFamily: 'var(--font-mono)' }}>
              NO HEADLINES MATCH FILTER CRITERIA
            </div>
          )}
        </div>
      )}

    </div>
  );
}
