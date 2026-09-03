import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Download,
  Upload,
  Search,
  Calendar,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Table as TableIcon,
  BarChart2,
  X,
  CheckCircle2
} from 'lucide-react';

const formatCr = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  return `${sign}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Cr`;
};

const formatDateShort = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const formatDateFull = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

function SummaryStat({ label, value, sublabel, type = 'net' }) {
  const positive = (value || 0) >= 0;
  return (
    <div style={{ flex: 1, minWidth: '150px' }}>
      <div style={{ fontSize: '0.62rem', color: 'var(--text-dimmed)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {type === 'net' && (
          positive ? (
            <TrendingUp size={14} color="var(--color-bullish)" />
          ) : (
            <TrendingDown size={14} color="var(--color-bearish)" />
          )
        )}
        <span className="mono" style={{ fontSize: '1.05rem', fontWeight: 800, color: type === 'net' ? (positive ? 'var(--color-bullish)' : 'var(--color-bearish)') : 'var(--text-primary)' }}>
          {typeof value === 'number' ? formatCr(value) : value}
        </span>
      </div>
      {sublabel && (
        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: '2px' }}>{sublabel}</div>
      )}
    </div>
  );
}

function StanceBadge({ fiiNet, diiNet }) {
  const combined = (fiiNet || 0) + (diiNet || 0);
  let label = 'Neutral';
  let bgColor = 'rgba(255, 255, 255, 0.05)';
  let color = 'var(--text-muted)';

  if (combined > 2000) {
    label = 'Strong Bullish';
    bgColor = 'rgba(0, 200, 83, 0.15)';
    color = 'var(--color-bullish)';
  } else if (combined > 300) {
    label = 'Bullish';
    bgColor = 'rgba(0, 200, 83, 0.08)';
    color = 'var(--color-bullish)';
  } else if (combined < -2000) {
    label = 'Strong Bearish';
    bgColor = 'rgba(255, 59, 48, 0.15)';
    color = 'var(--color-bearish)';
  } else if (combined < -300) {
    label = 'Bearish';
    bgColor = 'rgba(255, 59, 48, 0.08)';
    color = 'var(--color-bearish)';
  }

  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '0.65rem',
        fontWeight: 700,
        backgroundColor: bgColor,
        color: color,
        border: `1px solid ${color}33`,
        display: 'inline-block',
        whiteSpace: 'nowrap'
      }}
    >
      {label}
    </span>
  );
}

/**
 * Dependency-free SVG grouped bar chart: one FII bar + one DII bar per trading day.
 */
function FlowChart({ data }) {
  if (!data || data.length === 0) return null;

  const width = 900;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 44, left: 64 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const maxAbs = Math.max(
    1,
    ...data.map((d) => Math.max(Math.abs(d.fiiNetCr || 0), Math.abs(d.diiNetCr || 0)))
  );
  const scale = (plotHeight / 2) / (maxAbs * 1.15);
  const zeroY = padding.top + plotHeight / 2;

  const groupWidth = plotWidth / data.length;
  const barWidth = Math.max(2, Math.min(14, groupWidth * 0.38));
  const barGap = groupWidth > 15 ? 3 : 1;

  // Collision-free label index calculation (minimum 28px horizontal gap)
  const minPixelGap = 28;
  const visibleLabelIndices = new Set();
  let lastX = -999;

  data.forEach((d, i) => {
    const cx = padding.left + groupWidth * i + groupWidth / 2;
    const isFirst = i === 0;
    const isLast = i === data.length - 1;

    if (isFirst || (cx - lastX >= minPixelGap && (plotWidth + padding.left - cx) >= minPixelGap * 0.8)) {
      visibleLabelIndices.add(i);
      lastX = cx;
    }
  });
  // Always include the last date, ensuring no overlap with prior label
  const lastIndex = data.length - 1;
  const lastXPos = padding.left + groupWidth * lastIndex + groupWidth / 2;
  if (lastXPos - lastX < minPixelGap * 0.8) {
    // Remove the previous label if it's too close to the last one
    visibleLabelIndices.delete(Array.from(visibleLabelIndices).pop());
  }
  visibleLabelIndices.add(lastIndex);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Zero baseline */}
      <line
        x1={padding.left}
        y1={zeroY}
        x2={width - padding.right}
        y2={zeroY}
        stroke="var(--border-secondary)"
        strokeWidth="1.5"
      />

      {/* Y-axis gridlines & labels */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={width - padding.right}
        y2={padding.top}
        stroke="var(--border-primary)"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="var(--border-primary)"
        strokeWidth="0.5"
        strokeDasharray="3 3"
      />

      <text x={padding.left - 8} y={padding.top + 4} textAnchor="end" fontSize="9" fill="var(--text-dimmed)" fontFamily="var(--font-mono)">
        +₹{Math.round(maxAbs * 1.15).toLocaleString('en-IN')}
      </text>
      <text x={padding.left - 8} y={zeroY + 4} textAnchor="end" fontSize="9" fill="var(--text-dimmed)" fontFamily="var(--font-mono)">
        0
      </text>
      <text x={padding.left - 8} y={height - padding.bottom} textAnchor="end" fontSize="9" fill="var(--text-dimmed)" fontFamily="var(--font-mono)">
        -₹{Math.round(maxAbs * 1.15).toLocaleString('en-IN')}
      </text>

      {data.map((d, i) => {
        const groupCenter = padding.left + groupWidth * i + groupWidth / 2;
        const fiiX = groupCenter - barWidth - barGap / 2;
        const diiX = groupCenter + barGap / 2;

        const fiiH = Math.abs(d.fiiNetCr || 0) * scale;
        const diiH = Math.abs(d.diiNetCr || 0) * scale;
        const fiiY = (d.fiiNetCr || 0) >= 0 ? zeroY - fiiH : zeroY;
        const diiY = (d.diiNetCr || 0) >= 0 ? zeroY - diiH : zeroY;

        const showLabel = visibleLabelIndices.has(i);

        return (
          <g key={d.date || i}>
            <rect
              x={fiiX}
              y={fiiY}
              width={barWidth}
              height={Math.max(fiiH, 1)}
              fill={(d.fiiNetCr || 0) >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)'}
              opacity="0.9"
              rx="1"
            >
              <title>{`FII Net on ${formatDateFull(d.date)}: ${formatCr(d.fiiNetCr)}`}</title>
            </rect>
            <rect
              x={diiX}
              y={diiY}
              width={barWidth}
              height={Math.max(diiH, 1)}
              fill={(d.diiNetCr || 0) >= 0 ? '#00b4d8' : '#f59e0b'}
              opacity="0.9"
              rx="1"
            >
              <title>{`DII Net on ${formatDateFull(d.date)}: ${formatCr(d.diiNetCr)}`}</title>
            </rect>
            {showLabel && (
              <text
                x={groupCenter}
                y={height - padding.bottom + 14}
                transform={`rotate(-25, ${groupCenter}, ${height - padding.bottom + 14})`}
                textAnchor="end"
                fontSize="8.5"
                fill="var(--text-dimmed)"
                fontFamily="var(--font-mono)"
              >
                {formatDateShort(d.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
/**
 * 4-Section Scatter Plot: X-axis = FII Net Flow (₹ Cr), Y-axis = DII Net Flow (₹ Cr).
 * Each point represents 1 trading session.
 */
function ScatterPlot({ data }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!data || data.length === 0) return null;

  const width = 900;
  const height = 450;
  const padding = { top: 32, right: 32, bottom: 42, left: 45 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  // Headroom scale factor (1.48x / 1.52x) to ensure scatter points never overlap quadrant titles
  const maxFiiAbs = Math.max(
    500,
    ...data.map((d) => Math.abs(d.fiiNetCr || 0))
  ) * 1.48;
  const maxDiiAbs = Math.max(
    500,
    ...data.map((d) => Math.abs(d.diiNetCr || 0))
  ) * 1.52;

  const zeroX = padding.left + plotWidth / 2;
  const zeroY = padding.top + plotHeight / 2;

  const getX = (val) => zeroX + (val / maxFiiAbs) * (plotWidth / 2);
  const getY = (val) => zeroY - (val / maxDiiAbs) * (plotHeight / 2);

  // Section counters & net money calculations (FII Net + DII Net)
  let q1Count = 0, q2Count = 0, q3Count = 0, q4Count = 0;
  let q1NetSum = 0, q2NetSum = 0, q3NetSum = 0, q4NetSum = 0;

  data.forEach((d) => {
    const fii = d.fiiNetCr || 0;
    const dii = d.diiNetCr || 0;
    const combined = fii + dii;

    if (fii >= 0 && dii >= 0) {
      q1Count++;
      q1NetSum += combined;
    } else if (fii < 0 && dii >= 0) {
      q2Count++;
      q2NetSum += combined;
    } else if (fii < 0 && dii < 0) {
      q3Count++;
      q3NetSum += combined;
    } else {
      q4Count++;
      q4NetSum += combined;
    }
  });

  // Calculate coordinates with micro-collision avoidance for tightly clustered points
  const rawPoints = data.map((d, idx) => {
    const rawX = getX(d.fiiNetCr || 0);
    const rawY = getY(d.diiNetCr || 0);
    return { ...d, rawX, rawY, idx };
  });

  // Apply collision repulsion / micro-jitter to prevent overlaps
  const processedPoints = rawPoints.map((p, idx) => {
    let cx = p.rawX;
    let cy = p.rawY;

    // Check overlap with prior points
    let overlaps = 0;
    for (let j = 0; j < idx; j++) {
      const prev = rawPoints[j];
      const dist = Math.hypot(cx - prev.rawX, cy - prev.rawY);
      if (dist < 14) {
        overlaps++;
      }
    }

    if (overlaps > 0) {
      const angle = (idx * 2.1) + (overlaps * 1.3);
      const radius = 7 * Math.sqrt(overlaps);
      cx += Math.cos(angle) * radius;
      cy += Math.sin(angle) * radius;
    }

    return { ...p, cx, cy };
  });

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs>
          {/* Gradient for Dual Buying (Top-Right Green) */}
          <linearGradient id="grad-q1" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-bullish)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-bullish)" stopOpacity="0.01" />
          </linearGradient>

          {/* Gradient for DII Support (Top-Left Cyan) */}
          <linearGradient id="grad-q2" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#00b4d8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#00b4d8" stopOpacity="0.01" />
          </linearGradient>

          {/* Gradient for Dual Selling (Bottom-Left Red) */}
          <linearGradient id="grad-q3" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-bearish)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-bearish)" stopOpacity="0.01" />
          </linearGradient>

          {/* Gradient for FII Inflow (Bottom-Right Amber) */}
          <linearGradient id="grad-q4" x1="1" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Section Background Edge Gradients */}
        <rect
          x={zeroX}
          y={padding.top}
          width={plotWidth / 2}
          height={plotHeight / 2}
          fill="url(#grad-q1)"
        />
        <rect
          x={padding.left}
          y={padding.top}
          width={plotWidth / 2}
          height={plotHeight / 2}
          fill="url(#grad-q2)"
        />
        <rect
          x={padding.left}
          y={zeroY}
          width={plotWidth / 2}
          height={plotHeight / 2}
          fill="url(#grad-q3)"
        />
        <rect
          x={zeroX}
          y={zeroY}
          width={plotWidth / 2}
          height={plotHeight / 2}
          fill="url(#grad-q4)"
        />

        {/* Outer Plot Border */}
        <rect
          x={padding.left}
          y={padding.top}
          width={plotWidth}
          height={plotHeight}
          fill="none"
          stroke="var(--border-primary)"
          strokeWidth="1"
        />

        {/* Center Quadrant Grid Dividers (X = 0, Y = 0) */}
        <line
          x1={zeroX}
          y1={padding.top}
          x2={zeroX}
          y2={height - padding.bottom}
          stroke="var(--border-secondary)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <line
          x1={padding.left}
          y1={zeroY}
          x2={width - padding.right}
          y2={zeroY}
          stroke="var(--border-secondary)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />

        {/* LAYER 1: Scatter Points */}
        <g id="scatter-points">
          {processedPoints.map((d, i) => {
            const fii = d.fiiNetCr || 0;
            const dii = d.diiNetCr || 0;
            const isLatest = i === processedPoints.length - 1;

            let color = '#f59e0b';
            if (fii >= 0 && dii >= 0) color = 'var(--color-bullish)';
            else if (fii < 0 && dii >= 0) color = '#00b4d8';
            else if (fii < 0 && dii < 0) color = 'var(--color-bearish)';

            const isHovered = hoveredPoint && hoveredPoint.date === d.date;

            return (
              <g key={d.date || i} style={{ cursor: 'pointer' }} onMouseEnter={() => setHoveredPoint(d)} onMouseLeave={() => setHoveredPoint(null)}>
                {(isLatest || isHovered) && (
                  <circle
                    cx={d.cx}
                    cy={d.cy}
                    r={isLatest ? 11 : 9}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    opacity="0.85"
                  />
                )}
                <circle
                  cx={d.cx}
                  cy={d.cy}
                  r={isLatest ? 6 : 5}
                  fill={color}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                  opacity="0.9"
                />
              </g>
            );
          })}
        </g>

        {/* LAYER 2 (TOPMOST): Borderless Watermark Quadrant Titles with 50% Opacity */}
        <g id="section-titles">
          {/* Top-Right: Dual Buying */}
          <g transform={`translate(${zeroX + 16}, ${padding.top + 22})`}>
            <text x="0" y="0" fontSize="12" fontWeight="700" fill="var(--color-bullish)" opacity="0.50" fontFamily="var(--font-sans)" letterSpacing="0.02em">
              Dual Buying
            </text>
            <text x="0" y="16" fontSize="9.5" fontWeight="600" fill="var(--text-muted)" fontFamily="var(--font-sans)">
              Net Institutional Flow: <tspan fontFamily="var(--font-mono)" fontWeight="700" fill="var(--color-bullish)" opacity="0.9">{formatCr(q1NetSum)}</tspan>
            </text>
          </g>

          {/* Top-Left: DII Support */}
          <g transform={`translate(${padding.left + 16}, ${padding.top + 22})`}>
            <text x="0" y="0" fontSize="12" fontWeight="700" fill="#00b4d8" opacity="0.50" fontFamily="var(--font-sans)" letterSpacing="0.02em">
              DII Support
            </text>
            <text x="0" y="16" fontSize="9.5" fontWeight="600" fill="var(--text-muted)" fontFamily="var(--font-sans)">
              Net Institutional Flow: <tspan fontFamily="var(--font-mono)" fontWeight="700" fill="#00b4d8" opacity="0.9">{formatCr(q2NetSum)}</tspan>
            </text>
          </g>

          {/* Bottom-Left: Dual Selling */}
          <g transform={`translate(${padding.left + 16}, ${height - padding.bottom - 28})`}>
            <text x="0" y="0" fontSize="12" fontWeight="700" fill="var(--color-bearish)" opacity="0.50" fontFamily="var(--font-sans)" letterSpacing="0.02em">
              Dual Selling
            </text>
            <text x="0" y="16" fontSize="9.5" fontWeight="600" fill="var(--text-muted)" fontFamily="var(--font-sans)">
              Net Institutional Flow: <tspan fontFamily="var(--font-mono)" fontWeight="700" fill="var(--color-bearish)" opacity="0.9">{formatCr(q3NetSum)}</tspan>
            </text>
          </g>

          {/* Bottom-Right: FII Inflow */}
          <g transform={`translate(${zeroX + 16}, ${height - padding.bottom - 28})`}>
            <text x="0" y="0" fontSize="12" fontWeight="700" fill="#f59e0b" opacity="0.50" fontFamily="var(--font-sans)" letterSpacing="0.02em">
              FII Inflow
            </text>
            <text x="0" y="16" fontSize="9.5" fontWeight="600" fill="var(--text-muted)" fontFamily="var(--font-sans)">
              Net Institutional Flow: <tspan fontFamily="var(--font-mono)" fontWeight="700" fill="#f59e0b" opacity="0.9">{formatCr(q4NetSum)}</tspan>
            </text>
          </g>
        </g>

        {/* LAYER 3: Clean Outer Margin Axis Labels (Terminal Style) */}
        <g id="outer-axis-labels">
          {/* X-Axis Outer Margin Label (Bottom) */}
          <text
            x={zeroX}
            y={height - 10}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="var(--text-muted)"
            fontFamily="var(--font-sans)"
            letterSpacing="0.03em"
          >
            FII Net Flow (₹ Cr)
          </text>

          {/* Y-Axis Outer Margin Label (Left) */}
          <text
            x={18}
            y={zeroY}
            transform={`rotate(-90, 18, ${zeroY})`}
            textAnchor="middle"
            fontSize="11"
            fontWeight="600"
            fill="var(--text-muted)"
            fontFamily="var(--font-sans)"
            letterSpacing="0.03em"
          >
            DII Net Flow (₹ Cr)
          </text>
        </g>
      </svg>

      {/* Hover Tooltip Card */}
      {hoveredPoint && (
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-secondary)',
            borderRadius: '8px',
            padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: '220px'
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '4px' }}>
            SESSION: {formatDateFull(hoveredPoint.date)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>FII Net:</span>
              <span style={{ fontWeight: 800, color: (hoveredPoint.fiiNetCr || 0) >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                {formatCr(hoveredPoint.fiiNetCr)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>DII Net:</span>
              <span style={{ fontWeight: 800, color: (hoveredPoint.diiNetCr || 0) >= 0 ? '#00b4d8' : '#f59e0b' }}>
                {formatCr(hoveredPoint.diiNetCr)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-primary)', paddingTop: '4px', marginTop: '2px' }}>
              <span style={{ color: 'var(--text-dimmed)' }}>Combined Net:</span>
              <span style={{ fontWeight: 800, color: ((hoveredPoint.fiiNetCr || 0) + (hoveredPoint.diiNetCr || 0)) >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                {formatCr((hoveredPoint.fiiNetCr || 0) + (hoveredPoint.diiNetCr || 0))}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Section Summary Micro Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '16px' }}>
        <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(0, 200, 83, 0.05)', border: '1px solid rgba(0, 200, 83, 0.2)' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--color-bullish)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>DUAL BUYING</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0' }}>{q1Count} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>days ({Math.round((q1Count / data.length) * 100)}%)</span></div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-bullish)', fontFamily: 'var(--font-mono)' }}>Net: {formatCr(q1NetSum)}</div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(0, 180, 216, 0.05)', border: '1px solid rgba(0, 180, 216, 0.2)' }}>
          <div style={{ fontSize: '0.62rem', color: '#00b4d8', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>DII SUPPORT</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0' }}>{q2Count} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>days ({Math.round((q2Count / data.length) * 100)}%)</span></div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#00b4d8', fontFamily: 'var(--font-mono)' }}>Net: {formatCr(q2NetSum)}</div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(255, 59, 48, 0.05)', border: '1px solid rgba(255, 59, 48, 0.2)' }}>
          <div style={{ fontSize: '0.62rem', color: 'var(--color-bearish)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>DUAL SELLING</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0' }}>{q3Count} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>days ({Math.round((q3Count / data.length) * 100)}%)</span></div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-bearish)', fontFamily: 'var(--font-mono)' }}>Net: {formatCr(q3NetSum)}</div>
        </div>

        <div style={{ padding: '10px 12px', borderRadius: '6px', backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
          <div style={{ fontSize: '0.62rem', color: '#f59e0b', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>FII INFLOW</div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0' }}>{q4Count} <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>days ({Math.round((q4Count / data.length) * 100)}%)</span></div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>Net: {formatCr(q4NetSum)}</div>
        </div>
      </div>
    </div>
  );
}

export default function FiiDiiFlow() {
  const [flows, setFlows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filtering & controls
  const [daysOption, setDaysOption] = useState('30'); // 5, 10, 15, 30, 60, 90, 'all', 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('scatter'); // 'scatter', 'chart', 'table'
  
  // Table sorting & pagination
  const [sortField, setSortField] = useState('date'); // 'date', 'fiiNetCr', 'diiNetCr', 'combinedNet'
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc', 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  
  // Import CSV modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvInputText, setCsvInputText] = useState('');
  const [importStatus, setImportStatus] = useState(null);
  const [meta, setMeta] = useState(null);

  const fetchFlows = async ({ forceRefresh = false } = {}) => {
    setLoading(true);
    setError(null);
    try {
      let url = '/api/fii-dii?';
      if (daysOption === 'custom' && fromDate && toDate) {
        url += `from=${fromDate}&to=${toDate}`;
      } else {
        url += `days=${daysOption}`;
      }
      if (forceRefresh) url += '&refresh=true';

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || `Server returned ${res.status}`);
      
      setFlows(data.data || []);
      setSummary(data.summary || null);
      setMeta({ lastFetchedAt: data.lastFetchedAt || null, lastError: data.lastError || null });
    } catch (err) {
      console.error('Error fetching FII/DII flows:', err);
      setError(err.message || 'Failed to load FII/DII data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlows();
  }, [daysOption, fromDate, toDate]);

  // Client-side filtering & sorting for table
  const processedTableData = useMemo(() => {
    let result = [...flows];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (r) =>
          r.date?.toLowerCase().includes(q) ||
          formatDateFull(r.date).toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      let valA, valB;
      if (sortField === 'date') {
        valA = a.date || '';
        valB = b.date || '';
      } else if (sortField === 'combinedNet') {
        valA = (a.fiiNetCr || 0) + (a.diiNetCr || 0);
        valB = (b.fiiNetCr || 0) + (b.diiNetCr || 0);
      } else {
        valA = a[sortField] || 0;
        valB = b[sortField] || 0;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [flows, searchQuery, sortField, sortDirection]);

  // Paginated table rows
  const paginatedData = useMemo(() => {
    if (rowsPerPage === 'all') return processedTableData;
    const startIdx = (currentPage - 1) * rowsPerPage;
    return processedTableData.slice(startIdx, startIdx + rowsPerPage);
  }, [processedTableData, currentPage, rowsPerPage]);

  const totalPages = rowsPerPage === 'all' ? 1 : Math.ceil(processedTableData.length / rowsPerPage);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // CSV Download export handler
  const exportToCsv = () => {
    if (!flows || flows.length === 0) return;

    const headers = [
      'Date',
      'FII Buy (Cr)',
      'FII Sell (Cr)',
      'FII Net (Cr)',
      'DII Buy (Cr)',
      'DII Sell (Cr)',
      'DII Net (Cr)',
      'Combined Net (Cr)',
      'Institutional Stance'
    ];

    const rows = flows.map((r) => {
      const combined = (r.fiiNetCr || 0) + (r.diiNetCr || 0);
      const stance = combined > 2000 ? 'Strong Bullish' : combined > 300 ? 'Bullish' : combined < -2000 ? 'Strong Bearish' : combined < -300 ? 'Bearish' : 'Neutral';
      return [
        r.date,
        r.fiiBuyCr ?? '',
        r.fiiSellCr ?? '',
        r.fiiNetCr ?? '',
        r.diiBuyCr ?? '',
        r.diiSellCr ?? '',
        r.diiNetCr ?? '',
        combined.toFixed(2),
        stance
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `FII_DII_History_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import CSV Handler
  const handleImportCsv = async () => {
    if (!csvInputText.trim()) return;
    setImportStatus({ loading: true, message: 'Importing CSV...' });
    try {
      const res = await fetch('/api/fii-dii/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: csvInputText })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Import failed');

      setImportStatus({
        success: true,
        message: `Successfully imported ${data.importedDays} trading day(s)! Total history now has ${data.totalStoredDays} days.`
      });
      fetchFlows({ forceRefresh: false });
      setTimeout(() => {
        setShowImportModal(false);
        setCsvInputText('');
        setImportStatus(null);
      }, 2000);
    } catch (err) {
      setImportStatus({ success: false, error: err.message });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvInputText(event.target.result);
    };
    reader.readAsText(file);
  };

  if (loading && flows.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        <div style={{ width: '24px', height: '24px', border: '2px solid var(--border-primary)', borderTopColor: 'var(--text-primary)', borderRadius: '50%', animation: 'pulse-subtle 1s infinite linear', marginBottom: '16px' }}></div>
        <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>FETCHING FII/DII HISTORICAL DATA...</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
              FII / DII Institutional Flow Tracker
            </h2>
            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-dimmed)' }}>
              {summary?.totalStoredDays || flows.length} Days Stored
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Daily net institutional buying & selling activity on Indian stock markets (₹ Crores)
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={exportToCsv}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid var(--border-secondary)', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            className="list-item-hover"
            title="Export historical flows to CSV"
          >
            <Download size={13} /> Export CSV
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid var(--border-secondary)', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            className="list-item-hover"
            title="Import official NSE CSV report"
          >
            <Upload size={13} /> Import CSV
          </button>

          <button
            onClick={() => fetchFlows({ forceRefresh: true })}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', border: '1px solid var(--border-secondary)', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', cursor: 'pointer' }}
            className="list-item-hover"
          >
            <RefreshCw size={12} /> Refresh Live
          </button>
        </div>
      </div>

      {/* Control Bar: Time Range Selector & View Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', border: '1px solid var(--border-primary)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
        
        {/* Time Preset Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)', fontWeight: 600, marginRight: '4px' }}>
            RANGE:
          </span>
          {['5', '10', '15', '30', '60', '90', 'all'].map((opt) => (
            <button
              key={opt}
              onClick={() => { setDaysOption(opt); setFromDate(''); setToDate(''); }}
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '4px',
                backgroundColor: daysOption === opt ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                color: daysOption === opt ? 'var(--bg-primary)' : 'var(--text-muted)',
                border: '1px solid var(--border-primary)',
                cursor: 'pointer'
              }}
              className="list-item-hover"
            >
              {opt === 'all' ? 'ALL' : `${opt}D`}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '2px', backgroundColor: 'var(--bg-tertiary)' }}>
          <button
            onClick={() => setViewMode('scatter')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, border: 'none', backgroundColor: viewMode === 'scatter' ? 'var(--border-secondary)' : 'transparent', color: viewMode === 'scatter' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <Calendar size={12} /> Scatter Plot
          </button>
          <button
            onClick={() => setViewMode('chart')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, border: 'none', backgroundColor: viewMode === 'chart' ? 'var(--border-secondary)' : 'transparent', color: viewMode === 'chart' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <BarChart2 size={12} /> Bar Chart
          </button>
          <button
            onClick={() => setViewMode('table')}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, border: 'none', backgroundColor: viewMode === 'table' ? 'var(--border-secondary)' : 'transparent', color: viewMode === 'table' ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer' }}
          >
            <TableIcon size={12} /> Table Only
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', padding: '16px', border: '1px solid var(--border-primary)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)' }}>
          <SummaryStat
            label={`FII Net (${formatDateShort(summary.latestDate)})`}
            value={summary.latestFiiNetCr}
            sublabel={summary.latestFiiNetCr >= 0 ? 'Foreign net buying' : 'Foreign net selling'}
          />
          <SummaryStat
            label={`DII Net (${formatDateShort(summary.latestDate)})`}
            value={summary.latestDiiNetCr}
            sublabel={summary.latestDiiNetCr >= 0 ? 'Domestic net buying' : 'Domestic net selling'}
          />
          <SummaryStat
            label={`FII Cumulative (${summary.windowDays}D)`}
            value={summary.cumulativeFiiNetCr}
          />
          <SummaryStat
            label={`DII Cumulative (${summary.windowDays}D)`}
            value={summary.cumulativeDiiNetCr}
          />
          <SummaryStat
            label={`FII MTD Net`}
            value={summary.mtdFiiNetCr}
            sublabel="Month-to-date total"
          />
          <SummaryStat
            label={`DII MTD Net`}
            value={summary.mtdDiiNetCr}
            sublabel="Month-to-date total"
          />
        </div>
      )}

      {/* Scatter Plot Section */}
      {(viewMode === 'scatter' || viewMode === 'split') && (
        <div style={{ border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                FII vs DII 4-Quadrant Scatter Analysis (<span style={{ fontFamily: 'var(--font-mono)' }}>{flows.length}</span> Sessions)
              </h3>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '3px 0 0 0', fontFamily: 'var(--font-sans)' }}>
                FII Net Flow vs DII Net Flow (Each point = 1 trading day)
              </p>
            </div>
          </div>
          <ScatterPlot data={flows} />
        </div>
      )}

      {/* Bar Chart Section */}
      {(viewMode === 'chart') && (
        <div style={{ border: '1px solid var(--border-primary)', borderRadius: '8px', padding: '16px', backgroundColor: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, fontFamily: 'var(--font-sans)', letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Institutional Flow Bar Chart (<span style={{ fontFamily: 'var(--font-mono)' }}>{flows.length}</span> Sessions)
            </h3>
            
            {/* Dynamic 4-Color Legend Key */}
            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '6px 16px', fontSize: '0.68rem', fontFamily: 'var(--font-sans)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: 'var(--color-bullish)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>FII Net Buy (+)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: 'var(--color-bearish)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>FII Net Sell (-)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#00b4d8', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>DII Net Buy (+)</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#f59e0b', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-muted)' }}>DII Net Sell (-)</span>
              </span>
            </div>
          </div>
          <FlowChart data={flows} />
        </div>
      )}

      {/* Detailed Previous Days Data Table - Always displayed below the plot */}
      <div style={{ border: '1px solid var(--border-primary)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', overflow: 'hidden' }}>
          
          {/* Table Header & Search Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
                Historical Daily Breakdown
              </h3>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                Showing {processedTableData.length} records
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Search Box */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', color: 'var(--text-dimmed)' }} />
                <input
                  type="text"
                  placeholder="Filter date..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  style={{
                    padding: '5px 10px 5px 28px',
                    fontSize: '0.72rem',
                    borderRadius: '5px',
                    border: '1px solid var(--border-primary)',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                    width: '140px'
                  }}
                />
              </div>

              {/* Rows Per Page */}
              <select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }}
                style={{ padding: '5px 8px', fontSize: '0.72rem', borderRadius: '5px', border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', cursor: 'pointer' }}
              >
                <option value={10}>10 / page</option>
                <option value={15}>15 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value="all">All Rows</option>
              </select>
            </div>
          </div>

          {/* Table Element */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-primary)' }}>
                  <th onClick={() => handleSort('date')} style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      DATE <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'right' }}>FII BUY (₹ Cr)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'right' }}>FII SELL (₹ Cr)</th>
                  <th onClick={() => handleSort('fiiNetCr')} style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      FII NET <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'right' }}>DII BUY (₹ Cr)</th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'right' }}>DII SELL (₹ Cr)</th>
                  <th onClick={() => handleSort('diiNetCr')} style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      DII NET <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th onClick={() => handleSort('combinedNet')} style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      COMBINED NET <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-dimmed)', textAlign: 'center' }}>STANCE</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((r, i) => {
                    const combinedNet = (r.fiiNetCr || 0) + (r.diiNetCr || 0);
                    return (
                      <tr
                        key={r.date || i}
                        style={{ borderBottom: '1px solid var(--border-primary)' }}
                        className="list-item-hover"
                      >
                        <td style={{ padding: '10px 14px', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          {formatDateFull(r.date)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {r.fiiBuyCr ? `₹${r.fiiBuyCr.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {r.fiiSellCr ? `₹${r.fiiSellCr.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: (r.fiiNetCr || 0) >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                          {formatCr(r.fiiNetCr)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {r.diiBuyCr ? `₹${r.diiBuyCr.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                          {r.diiSellCr ? `₹${r.diiSellCr.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: (r.diiNetCr || 0) >= 0 ? '#00b4d8' : '#f59e0b' }}>
                          {formatCr(r.diiNetCr)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-mono)', color: combinedNet >= 0 ? 'var(--color-bullish)' : 'var(--color-bearish)' }}>
                          {formatCr(combinedNet)}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <StanceBadge fiiNet={r.fiiNetCr} diiNet={r.diiNetCr} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Bar */}
          {rowsPerPage !== 'all' && totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)' }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.68rem', fontWeight: 600, border: '1px solid var(--border-primary)', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: currentPage === 1 ? 'var(--text-dimmed)' : 'var(--text-primary)', cursor: currentPage === 1 ? 'default' : 'pointer' }}
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', fontSize: '0.68rem', fontWeight: 600, border: '1px solid var(--border-primary)', borderRadius: '4px', backgroundColor: 'var(--bg-secondary)', color: currentPage === totalPages ? 'var(--text-dimmed)' : 'var(--text-primary)', cursor: currentPage === totalPages ? 'default' : 'pointer' }}
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>

      {/* Footer Info & Disclaimers */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '8px' }}>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-dimmed)', margin: 0 }}>
          Source: Official NSE India Daily Activity Reports (nseindia.com/reports/fii-dii).
          {meta?.lastFetchedAt ? ` Last sync check: ${new Date(meta.lastFetchedAt).toLocaleString('en-IN')}` : ''}
        </p>
        {meta?.lastError && (
          <p style={{ fontSize: '0.65rem', color: 'var(--color-bearish)', margin: 0 }}>
            NSE Auto-refresh notice: {meta.lastError} (Displaying stored history)
          </p>
        )}
      </div>

      {/* Import CSV Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ width: '100%', maxWidth: '540px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', borderRadius: '10px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="var(--text-primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Import Official NSE CSV</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
              Download the official FII/DII combined CSV export from <strong>nseindia.com/reports/fii-dii</strong>, then select or paste its raw content below to merge past sessions into your history store.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
                SELECT CSV FILE:
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-dimmed)', fontFamily: 'var(--font-mono)' }}>
                OR PASTE CSV CONTENT DIRECTLY:
              </label>
              <textarea
                rows={6}
                value={csvInputText}
                onChange={(e) => setCsvInputText(e.target.value)}
                placeholder={`"CATEGORY","DATE","BUY VALUE (₹ Crores)","SELL VALUE (₹ Crores)","NET VALUE (₹ Crores)"\n"DII","30-Jul-2026","17,979.63","19,843.66","-1,864.03"\n"FII/FPI","30-Jul-2026","17,431.96","13,808.45","3,623.51"`}
                style={{ padding: '10px', fontSize: '0.7rem', fontFamily: 'var(--font-mono)', borderRadius: '6px', border: '1px solid var(--border-primary)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', resize: 'vertical' }}
              />
            </div>

            {importStatus && (
              <div style={{ padding: '10px 14px', borderRadius: '6px', fontSize: '0.72rem', backgroundColor: importStatus.success ? 'rgba(0,200,83,0.1)' : 'rgba(255,59,48,0.1)', color: importStatus.success ? 'var(--color-bullish)' : 'var(--color-bearish)', border: `1px solid ${importStatus.success ? 'var(--color-bullish)' : 'var(--color-bearish)'}33` }}>
                {importStatus.message || importStatus.error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                onClick={() => setShowImportModal(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 600, border: '1px solid var(--border-primary)', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleImportCsv}
                disabled={!csvInputText.trim() || importStatus?.loading}
                style={{ padding: '8px 16px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, border: 'none', backgroundColor: 'var(--text-primary)', color: 'var(--bg-primary)', cursor: csvInputText.trim() ? 'pointer' : 'not-allowed', opacity: csvInputText.trim() ? 1 : 0.6 }}
              >
                {importStatus?.loading ? 'Importing...' : 'Import Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

