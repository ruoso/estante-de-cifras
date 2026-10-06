// Decorative icons for the instrument surface (aria-hidden; each named by the
// control that holds it). Drawn as the W15 board draws them.

function Icon({ children, size = 24 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export function BackIcon() {
  return (
    <Icon>
      <path d="M15 18l-6-6 6-6" />
    </Icon>
  );
}

export function CloseIcon() {
  return (
    <Icon>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function PlusIcon() {
  return (
    <Icon size={20}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function TrashIcon() {
  return (
    <Icon size={20}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </Icon>
  );
}
