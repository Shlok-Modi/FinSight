import React, { useState, useEffect, useMemo } from 'react';
import WatchlistSidebar, { SECTOR_GROUPS } from './components/WatchlistSidebar';
import MainDashboard from './components/MainDashboard';
import StockDetail from './components/StockDetail';
import Flashcard from './components/Flashcard';
import Logo from './components/Logo';
import GoogleSignInModal from './components/GoogleSignInModal';
import { getMe, logout } from './services/authService';
import { RefreshCw, Radio, ChevronDown, Cpu, TrendingUp, TrendingDown, Clock, X, User, Settings, Sun, Moon, Columns, Newspaper, PanelRightClose, PanelRightOpen, LogIn, LogOut, ShieldCheck, ExternalLink } from 'lucide-react';

// URL for the PaperDesk trading app. Override at build time with VITE_PAPERDESK_URL if it's hosted elsewhere.
const PAPERDESK_URL = import.meta.env.VITE_PAPERDESK_URL || 'http://localhost/paperdesk/';

export default function App() {
  const [selectedStock, setSelectedStock] = useState(null);
  const [showWatchlist, setShowWatchlist] = useState(true);

  const handleSelectStock = (stockOrSymbol) => {
    if (!stockOrSymbol) {
      setSelectedStock(null);
      return;
    }
    if (typeof stockOrSymbol === 'string') {
      let foundStock = null;
      for (const sector in SECTOR_GROUPS) {
        const match = SECTOR_GROUPS[sector].find(s => s.symbol.toUpperCase() === stockOrSymbol.toUpperCase());
        if (match) {
          foundStock = match;
          break;
        }
      }
      if (foundStock) {
        setSelectedStock(foundStock);
      } else {
        setSelectedStock({ 
          symbol: stockOrSymbol.toUpperCase(), 
          name: `${stockOrSymbol.toUpperCase()} Equity`, 
          price: 150.0, 
          change: 0.0, 
          changePercent: 0.0 
        });
      }
    } else {
      setSelectedStock(stockOrSymbol);
    }
  };
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [onlineStatus, setOnlineStatus] = useState(true);
  const [ipos, setIpos] = useState([]);

  // User settings and scaling configuration
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('finSightTheme') || 'dark';
  });
  const [aiEnabled, setAiEnabled] = useState(true);
  const [scale, setScale] = useState(1.0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({ signedIn: false, name: 'Guest User' });
  const [watchlistWidth, setWatchlistWidth] = useState(330);
  const [isResizingWatchlist, setIsResizingWatchlist] = useState(false);
  const [viewMode, setViewMode] = useState('flashcard');
  const [selectedSector, setSelectedSector] = useState('ALL');
  const [showGAuthModal, setShowGAuthModal] = useState(false);
  const [authConfig, setAuthConfig] = useState({ googleClientId: '', configured: false });

  // Fetch Auth Config & restore session from token on page load
  useEffect(() => {
    fetch('/api/auth/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAuthConfig(data);
      })
      .catch(() => {});

    getMe().then((user) => {
      if (user) {
        setUserProfile({
          signedIn: true,
          name: user.name,
          email: user.email,
          picture: user.picture,
        });
      }
    });
  }, []);

  const handleSignOut = async () => {
    await logout();
    setUserProfile({ signedIn: false, name: 'Guest User' });
    setProfileOpen(false);
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingWatchlist) return;
      const newWidth = window.innerWidth - e.clientX;
      if (newWidth > 200 && newWidth < 600) {
        setWatchlistWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizingWatchlist(false);
    };
    if (isResizingWatchlist) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingWatchlist]);

  useEffect(() => {
    localStorage.setItem('finSightTheme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  // Welcome briefing state - active on open unless already dismissed in tab session
  const [showBriefing, setShowBriefing] = useState(() => {
    return !sessionStorage.getItem('briefingDismissed');
  });

  // Calculate the top 5 most urgent news headlines in the last 24 hours
  const topUrgentNews = useMemo(() => {
    const now = new Date();
    // Filter news in the last 24 hours
    let recentNews = news.filter(item => {
      const ageMs = now - new Date(item.publishedAt);
      return ageMs <= 24 * 60 * 60 * 1000;
    });

    // Fall back to all news if empty (ensures fallback data is always ready)
    if (recentNews.length === 0) {
      recentNews = news;
    }

    const getUrgency = (item) => {
      let horizonWeight = 1.5;
      if (item.impactHorizon === 'structural') horizonWeight = 3.0;
      else if (item.impactHorizon === 'short_term') horizonWeight = 2.0;
      else if (item.impactHorizon === 'intraday') horizonWeight = 1.0;

      let confidenceWeight = 1.5;
      if (item.confidence === 'high') confidenceWeight = 2.0;
      else if (item.confidence === 'medium') confidenceWeight = 1.5;
      else if (item.confidence === 'low') confidenceWeight = 1.0;

      return horizonWeight * confidenceWeight;
    };

    return [...recentNews]
      .sort((a, b) => getUrgency(b) - getUrgency(a))
      .slice(0, 5);
  }, [news]);

  // Dropdown overlay state
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Search/Filter states passed to MainDashboard
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState('ALL');

  // Fetch news list from API
  const fetchNews = async (showLoadingIndicator = false) => {
    if (showLoadingIndicator) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/news');
      if (!res.ok) {
        throw new Error(`Failed to load news: server returned ${res.status}`);
      }
      const data = await res.json();
      setNews(data.items || []);
      setOnlineStatus(true);

      // Fetch IPOs in parallel
      const ipoRes = await fetch('/api/ipo');
      if (ipoRes.ok) {
        const ipoData = await ipoRes.json();
        setIpos(ipoData.items || []);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to fetch data from server.");
      setOnlineStatus(false);
    } finally {
      if (showLoadingIndicator) setLoading(false);
    }
  };

  // Sync / Refresh RSS Feeds on backend
  const handleRefreshFeeds = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/news/refresh', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`Refresh request failed: status ${res.status}`);
      }
      const data = await res.json();
      console.log(`Feeds refreshed. Fetched ${data.fetched} headlines.`);
      await fetchNews();
    } catch (err) {
      console.error("Error refreshing feeds:", err);
      setError(err.message || "Failed to refresh RSS feeds.");
    } finally {
      setLoading(false);
    }
  };

  // Trigger manual AI sentiment analysis
  const handleTriggerAI = async () => {
    setAiProcessing(true);
    try {
      const res = await fetch('/api/news/analyze', { method: 'POST' });
      if (!res.ok) {
        throw new Error(`AI processing failed: status ${res.status}`);
      }
      const data = await res.json();
      console.log(`AI sentiment complete. Processed: ${data.processed}, failed: ${data.failed}.`);
      await fetchNews();
    } catch (err) {
      console.error("Error running AI processing:", err);
      alert(`AI Sentiment processing failed: ${err.message}`);
    } finally {
      setAiProcessing(false);
    }
  };

  // Fetch news on mount
  useEffect(() => {
    fetchNews(true);
    
    // Auto-refresh news list every 10 seconds to show live updates
    const interval = setInterval(() => {
      fetchNews(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  // Compute market-wide stats
  const stats = useMemo(() => {
    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    
    news.forEach(n => {
      if (n.sentiment === 'bullish') bullishCount++;
      else if (n.sentiment === 'bearish') bearishCount++;
      else if (n.sentiment === 'neutral') neutralCount++;
    });

    const total = bullishCount + bearishCount + neutralCount;
    const bullishPct = total ? Math.round((bullishCount / total) * 100) : 50;
    const bearishPct = total ? Math.round((bearishCount / total) * 100) : 50;

    let outlook = "Neutral";
    if (bullishCount > bearishCount * 1.2) outlook = "Bullish";
    else if (bearishCount > bullishCount * 1.2) outlook = "Bearish";

    return { total, bullishCount, bearishCount, neutralCount, bullishPct, bearishPct, outlook };
  }, [news]);

  // Market moving statement
  const marketMovingExplainer = useMemo(() => {
    const macroNews = news.filter(n => !n.ticker);
    const positiveMacro = macroNews.filter(n => n.sentiment === 'bullish');
    const negativeMacro = macroNews.filter(n => n.sentiment === 'bearish');

    if (stats.outlook === "Bullish") {
      const reason = positiveMacro[0]?.explanation || "strong corporate earnings and positive economic triggers in heavyweights.";
      return `Indian markets showing strong upward momentum today. Net sentiment skew is positive (${stats.bullishPct}% bullish). Key driver: ${reason}`;
    } else if (stats.outlook === "Bearish") {
      const reason = negativeMacro[0]?.explanation || "profit booking in Banking and IT, coupled with cautious global indices.";
      return `Indices are trading lower today under selling pressure (${stats.bearishPct}% bearish sentiment). Key drag: ${reason}`;
    } else {
      return `Trading remains rangebound. Flat market bias with balanced buying and selling indicators. Mixed cues from macro developments keeping overall direction unclear.`;
    }
  }, [news, stats]);

  return (
    <>
      <div 
        className="app-container"
        style={{
          filter: showBriefing ? 'blur(10px) brightness(0.5)' : 'none',
          transition: 'filter 0.35s ease-in-out, brightness 0.35s ease-in-out',
          pointerEvents: showBriefing ? 'none' : 'auto',
          '--content-scale': scale
        }}
      >
      
      {/* Top Stark Navigation Bar */}
      <header style={{
        height: 'var(--header-height)',
        borderBottom: '1px solid var(--border-primary)',
        backgroundColor: 'var(--bg-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 95
      }}>
        {/* Left branding & switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Logo size={28} style={{ color: '#ffffff' }} />
            <span style={{ fontWeight: 800, fontSize: '0.95rem', letterSpacing: '-0.02em', textTransform: 'uppercase', fontFamily: 'var(--font-title)' }}>
              FinSight
            </span>
          </div>

          <span style={{ height: '18px', width: '1px', backgroundColor: 'var(--border-primary)' }}></span>

          {/* Segmented Control Tab Bar elevated to Header Nav Bar */}
          <div style={{ 
            display: 'flex', 
            border: '1px solid var(--border-primary)', 
            padding: '2px', 
            borderRadius: '8px', 
            backgroundColor: 'var(--bg-primary)',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)'
          }}>
            <button
              onClick={() => { setViewMode('flashcard'); setSelectedStock(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: viewMode === 'flashcard' ? 'var(--border-secondary)' : 'transparent',
                color: viewMode === 'flashcard' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
              className="list-item-hover"
            >
              <Columns size={12} /> Flashcards
            </button>
            <button
              onClick={() => { setViewMode('feed'); setSelectedStock(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: viewMode === 'feed' ? 'var(--border-secondary)' : 'transparent',
                color: viewMode === 'feed' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
              className="list-item-hover"
            >
              <Newspaper size={12} /> List Trends
            </button>
            <button
              onClick={() => { setViewMode('ipo'); setSelectedStock(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: viewMode === 'ipo' ? 'var(--border-secondary)' : 'transparent',
                color: viewMode === 'ipo' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
              className="list-item-hover"
            >
              <Clock size={12} /> IPO Intel
            </button>
            <button
              onClick={() => { setViewMode('fiidii'); setSelectedStock(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: viewMode === 'fiidii' ? 'var(--border-secondary)' : 'transparent',
                color: viewMode === 'fiidii' ? 'var(--text-primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer'
              }}
              className="list-item-hover"
            >
              <TrendingUp size={12} /> FII/DII
            </button>
          </div>
        </div>

        {/* Dynamic Dropdown for Market Intelligence Summary */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setSummaryOpen(!summaryOpen)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-secondary)',
              padding: '6px 12px',
              borderRadius: '4px',
              color: stats.outlook === 'Bullish' ? 'var(--color-bullish)' : stats.outlook === 'Bearish' ? 'var(--color-bearish)' : 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.02em'
            }}
            className="list-item-hover"
          >
            <span className="live-indicator" style={{ 
              backgroundColor: stats.outlook === 'Bullish' ? 'var(--color-bullish)' : stats.outlook === 'Bearish' ? 'var(--color-bearish)' : 'var(--text-muted)',
              animation: 'pulse-subtle 1.8s infinite ease-in-out'
            }}></span>
            <span>OUTLOOK: {stats.outlook.toUpperCase()} ({stats.outlook === 'Bullish' ? stats.bullishPct : stats.outlook === 'Bearish' ? stats.bearishPct : '50'}%)</span>
            <ChevronDown size={12} style={{ 
              transform: summaryOpen ? 'rotate(180deg)' : 'none', 
              transition: 'transform 0.15s ease',
              color: 'var(--text-muted)' 
            }} />
          </button>
          
          {summaryOpen && (
            <>
              {/* Overlay Backdrop to capture outside clicks */}
              <div 
                onClick={() => setSummaryOpen(false)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'transparent',
                  zIndex: 99
                }}
              />
              
              {/* Floating Dropdown Card */}
              <div 
                className="dropdown-overlay"
                style={{
                  position: 'absolute',
                  top: '38px',
                  right: '50%',
                  transform: 'translateX(50%)',
                  width: '380px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: '6px',
                  padding: '18px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                  backgroundColor: 'var(--bg-secondary)'
                }}
              >
                <div>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-mono)', display: 'block', marginBottom: '4px' }}>
                    Broad Market Outlook
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: 800, 
                      color: stats.outlook === 'Bullish' ? 'var(--color-bullish)' : stats.outlook === 'Bearish' ? 'var(--color-bearish)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-title)'
                    }}>
                      {stats.outlook.toUpperCase()}
                    </span>
                    {stats.outlook === 'Bullish' ? (
                      <TrendingUp size={16} color="var(--color-bullish)" />
                    ) : stats.outlook === 'Bearish' ? (
                      <TrendingDown size={16} color="var(--color-bearish)" />
                    ) : null}
                  </div>
                </div>

                <p className="explainer-text" style={{ fontSize: '0.78rem', lineHeight: '1.45' }}>
                  {marketMovingExplainer}
                </p>

                {/* Progress bar metrics */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '5px', fontFamily: 'var(--font-mono)' }}>
                    <span style={{ color: 'var(--color-bullish)' }}>{stats.bullishCount} Bullish ({stats.bullishPct}%)</span>
                    <span style={{ color: 'var(--color-bearish)' }}>{stats.bearishCount} Bearish ({stats.bearishPct}%)</span>
                  </div>
                  <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', backgroundColor: 'var(--border-primary)' }}>
                    <div style={{ width: `${stats.bullishPct}%`, backgroundColor: 'var(--color-bullish)' }}></div>
                    <div style={{ width: `${100 - stats.bullishPct - stats.bearishPct}%`, backgroundColor: 'var(--border-secondary)' }}></div>
                    <div style={{ width: `${stats.bearishPct}%`, backgroundColor: 'var(--color-bearish)' }}></div>
                  </div>
                </div>

                {/* Live Demo Actions */}
                <div style={{ 
                  borderTop: '1px solid var(--border-primary)', 
                  paddingTop: '12px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px' 
                }}>
                  <div style={{ fontSize: '0.62rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em', marginBottom: '2px' }}>
                    Operations & Controls
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => { handleRefreshFeeds(); setSummaryOpen(false); }}
                      disabled={loading}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid var(--border-secondary)',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)'
                      }}
                      className="list-item-hover"
                    >
                      <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                      Sync Feeds
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>


        {/* Sizing Slider & User Profile Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>

          {/* PaperDesk Link */}
          <a
            href={PAPERDESK_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-secondary)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.72rem',
              fontWeight: 600,
              textDecoration: 'none'
            }}
            className="list-item-hover"
            title="Open PaperDesk paper-trading app"
          >
            <ExternalLink size={13} />
            <span>PAPERDESK by FinSight</span>
          </a>

          {/* Watchlist Toggle Button */}
          <button
            onClick={() => setShowWatchlist(!showWatchlist)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 11px',
              borderRadius: '4px',
              backgroundColor: showWatchlist ? 'rgba(255, 255, 255, 0.05)' : 'var(--bg-tertiary)',
              border: '1px solid var(--border-secondary)',
              color: showWatchlist ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.72rem',
              fontWeight: 600
            }}
            className="list-item-hover"
            title={showWatchlist ? "Close Watchlist Sidebar" : "Open Watchlist Sidebar"}
          >
            {showWatchlist ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
            <span>{showWatchlist ? 'Hide Watchlist' : 'Watchlist'}</span>
          </button>

          {/* User Profile */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.72rem',
                fontWeight: 600
              }}
              className="list-item-hover"
            >
              {userProfile.signedIn && userProfile.picture ? (
                <img
                  src={userProfile.picture}
                  alt={userProfile.name}
                  referrerPolicy="no-referrer"
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-bullish)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.6rem',
                  fontWeight: 800
                }}>
                  {userProfile.signedIn ? (userProfile.name?.charAt(0)?.toUpperCase() || 'U') : 'G'}
                </div>
              )}
              <span style={{ textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                {userProfile.signedIn ? userProfile.name : 'Guest'}
              </span>
              <ChevronDown size={11} style={{ transform: profileOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {profileOpen && (
              <>
                <div 
                  onClick={() => setProfileOpen(false)}
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9998, backgroundColor: 'transparent' }}
                />
                <div style={{
                  position: 'absolute',
                  top: '42px',
                  right: '4px',
                  width: '280px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-secondary)',
                  borderRadius: '12px',
                  padding: '16px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
                  zIndex: 9999,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0'
                }}>
                  {/* User Header Section */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                    {userProfile.picture ? (
                      <img
                        src={userProfile.picture}
                        alt={userProfile.name}
                        referrerPolicy="no-referrer"
                        style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: userProfile.signedIn ? 'linear-gradient(135deg, #4285F4, #34A853)' : 'var(--bg-tertiary)',
                          border: '1px solid var(--border-secondary)',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1.05rem',
                          fontWeight: 800,
                        }}
                      >
                        {userProfile.signedIn ? userProfile.name?.charAt(0)?.toUpperCase() : 'G'}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {userProfile.name}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        {userProfile.signedIn ? userProfile.email : 'Not signed in'}
                      </div>
                    </div>
                  </div>

                  {/* Primary Google Auth Action Button (Full-width row) */}
                  <button
                    type="button"
                    onClick={() => (userProfile.signedIn ? handleSignOut() : (() => { setShowGAuthModal(true); setProfileOpen(false); })())}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-secondary)',
                      backgroundColor: userProfile.signedIn ? 'rgba(234,67,53,0.08)' : 'rgba(66,133,244,0.1)',
                      color: userProfile.signedIn ? '#EA4335' : '#4285F4',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      marginBottom: '12px'
                    }}
                    className="list-item-hover"
                  >
                    {userProfile.signedIn ? <><LogOut size={13} /> Sign Out</> : <><LogIn size={13} /> Sign In with Google</>}
                  </button>

                  {/* Settings Section with Subtle Divider */}
                  <div style={{ borderTop: '1px solid var(--border-primary)', pt: '12px', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-dimmed)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Dashboard Settings
                    </div>

                    {/* Theme selector */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />} Theme
                      </span>
                      <button
                        type="button"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        style={{
                          padding: '4px 10px',
                          border: '1px solid var(--border-secondary)',
                          borderRadius: '4px',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          fontSize: '0.68rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {theme === 'dark' ? 'DARK' : 'LIGHT'}
                      </button>
                    </div>

                    {/* AI toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Cpu size={13} /> AI Analysis
                      </span>
                      <input 
                        type="checkbox"
                        checked={aiEnabled}
                        onChange={(e) => setAiEnabled(e.target.checked)}
                        style={{ accentColor: 'var(--color-bullish)', cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Server status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div className={`live-indicator ${onlineStatus ? '' : 'offline'}`}></div>
            <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
              {onlineStatus ? 'SYS_LIVE' : 'SYS_OFFLINE'}
            </span>
          </div>

        </div>
      </header>

      {/* Dedicated Global Indices Ticker Strip */}
      <div style={{
        height: '32px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        fontFamily: 'var(--font-mono)'
      }}>
        <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>NIFTY 50:</span>
          <span style={{ color: 'var(--color-bearish)', fontWeight: 600 }}>23,985.35</span>
          <span style={{ color: 'var(--color-bearish)', fontSize: '0.65rem' }}>-0.18%</span>
        </div>
        <div style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ color: 'var(--text-muted)' }}>SENSEX:</span>
          <span style={{ color: 'var(--color-bearish)', fontWeight: 600 }}>79,150.20</span>
          <span style={{ color: 'var(--color-bearish)', fontSize: '0.65rem' }}>-0.21%</span>
        </div>
      </div>

      {/* Main Workspace split */}
      <div className="main-content" style={{ height: 'calc(100vh - var(--header-height) - 32px)' }}>
        
        {/* Left Side: Dynamic Feed/Detail container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {selectedStock ? (
            <StockDetail 
              stock={selectedStock} 
              allNews={news} 
              onBack={() => setSelectedStock(null)}
              onSelectStock={handleSelectStock}
              loading={loading}
              error={error}
              onRefresh={handleRefreshFeeds}
              aiEnabled={aiEnabled}
            />
          ) : (
            <MainDashboard 
              news={news}
              ipos={ipos}
              loading={loading}
              error={error}
              onRefresh={handleRefreshFeeds}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              selectedSource={selectedSource}
              setSelectedSource={setSelectedSource}
              selectedSentiment={selectedSentiment}
              setSelectedSentiment={setSelectedSentiment}
              aiEnabled={aiEnabled}
              onSelectStock={handleSelectStock}
              viewMode={viewMode}
              setViewMode={setViewMode}
              selectedSector={selectedSector}
              setSelectedSector={setSelectedSector}
            />
          )}
        </div>
        
        {/* Right Side: Watchlist Sidebar & Resizer */}
        {showWatchlist && (
          <>
            {/* Drag Resizer Divider Handle for the Watchlist */}
            <div 
              style={{
                width: '4px',
                cursor: 'col-resize',
                backgroundColor: isResizingWatchlist ? 'var(--color-bullish)' : 'var(--border-primary)',
                transition: 'background-color 0.15s ease',
                height: '100%',
                zIndex: 10,
                flexShrink: 0
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingWatchlist(true);
              }}
            />

            <WatchlistSidebar 
              selectedSymbol={selectedStock?.symbol || null}
              onSelectStock={handleSelectStock}
              width={watchlistWidth}
              onClose={() => setShowWatchlist(false)}
            />
          </>
        )}

      </div>

    </div>

    {/* Welcome Urgent Intelligence Briefing Overlay Modal */}
    {showBriefing && (
      <div className="briefing-overlay">
        {/* Moving Market Ticker Tape Background */}
        <div className="moving-market-bg">
          <div className="ticker-track track-left-to-right">
            {Array(5).fill("RELIANCE +1.2%   NIFTY -0.4%   INFY +2.1%   TCS -0.8%   SBI +1.5%   HDFC +0.5%   ").map((text, idx) => (
              <span key={idx} className="ticker-item">{text}</span>
            ))}
          </div>
          <div className="ticker-track track-right-to-left">
            {Array(5).fill("BSE SENSEX +0.3%   TATA MOTORS -1.4%   ITC +0.8%   RELIANCE +1.2%   NIFTY -0.4%   ").map((text, idx) => (
              <span key={idx} className="ticker-item">{text}</span>
            ))}
          </div>
          <div className="ticker-track track-left-to-right slow">
            {Array(5).fill("USD/INR 83.42 -0.05%   GOLD 72,400 +0.6%   CRUDE OIL 81.20 -1.2%   NIFTY +0.5%   ").map((text, idx) => (
              <span key={idx} className="ticker-item">{text}</span>
            ))}
          </div>
          <div className="ticker-track track-right-to-left slow">
            {Array(5).fill("NASDAQ +1.5%   S&P 500 +0.9%   NIFTY BANK +1.1%   AUTO +1.8%   METAL -0.7%   ").map((text, idx) => (
              <span key={idx} className="ticker-item">{text}</span>
            ))}
          </div>
        </div>

        {/* Top Left Close exit button */}
        <button 
          className="briefing-close-btn"
          onClick={() => {
            setShowBriefing(false);
            sessionStorage.setItem('briefingDismissed', 'true');
          }}
        >
          <X size={16} /> <span>EXIT BRIEFING</span>
        </button>

        {/* Stack Container */}
        <div className="briefing-stack-container">
          <div className="briefing-header">
            <h1 className="briefing-title">Quick Overview</h1>
            <p className="briefing-subtitle">Top market-shifting developments in the last 24 hours</p>
          </div>

          <div className="briefing-vertical-list">
            {topUrgentNews.length > 0 ? (
              topUrgentNews.slice(0, 5).map((item) => (
                <Flashcard key={item.id} item={item} aiEnabled={aiEnabled} />
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-dimmed)', padding: '50px 0', fontFamily: 'var(--font-mono)' }}>
                NO UNRESOLVED MARKET INTEL LOADED
              </div>
            )}
          </div>
        </div>
      </div>
    )}
      {/* Real Google Auth Modal */}
      {showGAuthModal && (
        <GoogleSignInModal
          clientId={authConfig.googleClientId}
          onClose={() => setShowGAuthModal(false)}
          onSignIn={(user) => {
            setUserProfile({
              signedIn: true,
              name: user.name,
              email: user.email,
              picture: user.picture,
            });
            setShowGAuthModal(false);
          }}
        />
      )}
  </>
  );
}