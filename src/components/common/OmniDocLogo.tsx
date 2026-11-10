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
  textColor = 'text-slate-900',
}) => {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Unique Prismatic Multi-Document Nexus SVG Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform hover:scale-105 duration-200"
      >
        <defs>
          <linearGradient id="omniGrad1" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7CC4ED" />
            <stop offset="0.5" stopColor="#A8DEFA" />
            <stop offset="1" stopColor="#D9F3FF" />
          </linearGradient>

          <linearGradient id="omniGrad2" x1="12" y1="4" x2="36" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7CC4ED" />
            <stop offset="1" stopColor="#A8DEFA" />
          </linearGradient>

          <linearGradient id="omniGrad3" x1="4" y1="20" x2="38" y2="44" gradientUnits="userSpaceOnUse">
            <stop stopColor="#A8DEFA" />
            <stop offset="1" stopColor="#D9F3FF" />
          </linearGradient>

          <filter id="omniGlow" x="0" y="0" width="48" height="48" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Backing Glow */}
        <rect x="8" y="8" width="32" height="32" rx="10" fill="url(#omniGrad1)" opacity="0.3" filter="url(#omniGlow)" />

        {/* Background Document Leaf (Angled 12 deg) */}
        <rect
          x="14"
          y="6"
          width="24"
          height="32"
          rx="6"
          fill="url(#omniGrad1)"
          transform="rotate(8 26 22)"
          opacity="0.85"
        />

        {/* Middle Document Leaf (Angled -4 deg) */}
        <rect
          x="10"
          y="8"
          width="24"
          height="32"
          rx="6"
          fill="url(#omniGrad2)"
          transform="rotate(-4 22 24)"
          opacity="0.9"
        />

        {/* Foreground Primary Document Page with Folded Corner */}
        <path
          d="M12 12C12 8.68629 14.6863 6 18 6H28L36 14V36C36 39.3137 33.3137 42 30 42H18C14.6863 42 12 39.3137 12 36V12Z"
          fill="#ffffff"
          className="drop-shadow-md"
        />

        {/* Folded Corner Dog-Ear */}
        <path
          d="M28 6V12C28 13.1046 28.8954 14 30 14H36L28 6Z"
          fill="url(#omniGrad3)"
        />

        {/* Dynamic Multi-Doc Loop Lines (The "O" Flow) */}
        <path
          d="M18 20H28M18 25H30M18 30H25"
          stroke="url(#omniGrad1)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Central Core Spark Indicator */}
        <circle cx="30" cy="30" r="3" fill="url(#omniGrad3)" />
      </svg>

      {/* Optional Brand Typography */}
      {showText && (
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className={`font-extrabold text-base tracking-tight font-display ${textColor}`}>
              OmniDoc
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#A8DEFA]/10 text-[#A8DEFA] font-bold border border-[#A8DEFA]/20">
              STUDIO
            </span>
          </div>
          <span className="text-[10px] text-[#A7B8CA] font-medium leading-none -mt-0.5">
            Convert, Edit &amp; Create
          </span>
        </div>
      )}
    </div>
  );
};
