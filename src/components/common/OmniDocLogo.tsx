import React from 'react';

interface OmniDocLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  textColor?: string;
}

export const OmniDocLogo: React.FC<OmniDocLogoProps> = ({
  size = 36,
  className = '',
  showText = false,
  textColor = 'text-[#F8FAFC]',
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* 3D Faceted Hexagonal Liquid Crystal Prism */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform hover:scale-105 duration-200"
      >
        <defs>
          <linearGradient id="hexPinkRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF3366" />
            <stop offset="50%" stopColor="#FF2E5B" />
            <stop offset="100%" stopColor="#E11D48" />
          </linearGradient>

          <linearGradient id="hexCyanBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#1677FF" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          <linearGradient id="hexPurpleTop" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF6688" />
            <stop offset="50%" stopColor="#9B5CFF" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>

          <filter id="hexGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Backing Glow */}
        <path
          d="M24 4L42 14V34L24 44L6 34V14L24 4Z"
          fill="url(#hexPinkRed)"
          opacity="0.25"
          filter="url(#hexGlow)"
        />

        {/* Outer Hexagon Outer Segments */}
        {/* Top/Left Face (Pink/Magenta) */}
        <path
          d="M24 4L42 14L34 18.5L24 13L14 18.5L6 14L24 4Z"
          fill="url(#hexPurpleTop)"
        />
        {/* Left Side Face (Hot Pink / Red) */}
        <path
          d="M6 14L14 18.5V29.5L6 34V14Z"
          fill="url(#hexPinkRed)"
        />
        {/* Bottom Left Face */}
        <path
          d="M6 34L14 29.5L24 35L24 44L6 34Z"
          fill="url(#hexPinkRed)"
          opacity="0.9"
        />
        {/* Right Side Face (Cyan / Blue) */}
        <path
          d="M42 14L42 34L34 29.5V18.5L42 14Z"
          fill="url(#hexCyanBlue)"
        />
        {/* Bottom Right Face */}
        <path
          d="M42 34L24 44V35L34 29.5L42 34Z"
          fill="url(#hexCyanBlue)"
          opacity="0.85"
        />

        {/* Inner Floating Document Core Diamond */}
        <path
          d="M24 16L32 21V27L24 32L16 27V21L24 16Z"
          fill="#030817"
          stroke="url(#hexPurpleTop)"
          strokeWidth="1.5"
        />

        {/* Central Core Luminescent Node */}
        <circle cx="24" cy="24" r="2.5" fill="#38BDF8" className="animate-pulse" />
      </svg>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col text-left leading-tight">
          <div className="flex items-center gap-1.5">
            <span className={`font-black text-sm tracking-tight font-display ${textColor}`}>
              OmniDoc Studio
            </span>
          </div>
          <span className="text-[10px] text-[#A7B5CC] font-medium tracking-wide">
            Create • Convert • Organize
          </span>
        </div>
      )}
    </div>
  );
};
