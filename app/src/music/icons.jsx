// Decorative icons for the chord explorer (aria-hidden): the star carries the
// *your shape* state as a word and a pressed button, never by the icon alone
// (standing a11y rule); the fill is the visible difference between starred and
// not. The plus is the *enter a shape* affordance. Drawn to match board W16.

function Svg({ children, filled = false }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 1.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function StarIcon({ filled = false }) {
  return (
    <Svg filled={filled}>
      <path d="M12 2l2.92 6.26 6.72.58-5.1 4.44 1.53 6.56L12 16.9l-6.09 3.54 1.53-6.56-5.1-4.44 6.72-.58z" />
    </Svg>
  );
}

export function PlusIcon() {
  return (
    <Svg>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function BackIcon() {
  return (
    <Svg>
      <path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}
