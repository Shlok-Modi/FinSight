import React from 'react';

export default function Logo({ className = '', size = 32 }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Bottom stem curving left */}
      <path 
        d="M38,55 L38,70 C38,80 28,84 20,80 C15,77 15,70 20,68 C25,66 28,68 28,70 L28,55 Z" 
        fill="currentColor"
      />
      {/* Vertical stem */}
      <path 
        d="M28,34 L38,34 L38,55 L28,55 Z" 
        fill="currentColor"
      />
      {/* Upward arrow at top-left stem */}
      <path 
        d="M23,34 L43,34 L33,18 Z" 
        fill="currentColor"
      />
      {/* Middle horizontal bar */}
      <path 
        d="M38,48 L70,48 C74,48 74,56 70,56 L38,56 Z" 
        fill="currentColor"
      />
      {/* Top bar curving up-right and ending with arrow */}
      <path 
        d="M38,34 C52,34 68,36 78,24" 
        stroke="currentColor" 
        strokeWidth="10" 
        strokeLinecap="square"
        fill="none"
      />
      {/* Up-Right arrow at top-right */}
      <path 
        d="M72,12 L92,20 L80,36 Z" 
        fill="currentColor"
      />
    </svg>
  );
}
