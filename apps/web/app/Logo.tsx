export default function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={`${className} transition-all duration-300 hover:scale-110 hover:drop-shadow-[0_0_8px_rgba(74,222,128,0.6)] cursor-pointer`}
      aria-label="QuizFlow logo"
    >
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feFlood floodColor="currentColor" floodOpacity="0.45" result="glowColor" />
          <feComposite in="glowColor" in2="blur" operator="in" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter="url(#glow)" className="text-brand-green">
        <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" />
      </g>
      <rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor" className="text-brand-green" />
      <g stroke="white" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M9 7h10l4 4v14a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" strokeWidth="1.6" />
        <path d="M19 7v4h4" strokeWidth="1.6" />
        <path d="M14 12.5v4m-2-2h4" strokeWidth="1.3" />
        <path d="M9 24q3.5-3 7 0q3.5 3 7 0" strokeWidth="1.5" />
      </g>
    </svg>
  )
}
