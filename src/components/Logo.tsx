/** Brand mark: a flight path from an open departure waypoint to an airliner. Mirrors src/app/icon.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="SimRoutes logo">
      <rect x="0.75" y="0.75" width="62.5" height="62.5" rx="14" fill="#152238" stroke="#f2eee3" strokeOpacity="0.18" strokeWidth="1.5" />
      <path d="M0 21.5H64M0 42.5H64M21.5 0V64M42.5 0V64" stroke="#f2eee3" strokeOpacity="0.1" strokeWidth="1" />
      <path d="M16 48C20 32 28.5 22.5 38.5 20" fill="none" stroke="#ff4f9a" strokeWidth="5" strokeLinecap="round" />
      <circle cx="16" cy="48" r="6.5" fill="#152238" stroke="#f2eee3" strokeWidth="4" />
      <path
        transform="translate(47 18.5) rotate(76)"
        fill="#f2eee3"
        d="M0 -11C1.4 -11 2.2 -9.6 2.2 -8V-2.6L11 2.4V5.4L2.2 2.8V7L5 9V11.2L0 10L-5 11.2V9L-2.2 7V2.8L-11 5.4V2.4L-2.2 -2.6V-8C-2.2 -9.6 -1.4 -11 0 -11Z"
      />
    </svg>
  );
}
