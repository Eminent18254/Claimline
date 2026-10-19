import type { MouseEvent } from 'react';

export function Brand({ onHome, compact = false }: { onHome?: () => void; compact?: boolean }) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (!onHome || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onHome();
  }
  return (
    <a
      className={`brand${compact ? ' brand-compact' : ''}`}
      href="/"
      onClick={navigate}
      aria-label="Claimline home"
    >
      <img src="/claimline-mark.svg" alt="" width="38" height="38" />
      <span className="brand-word">Claimline</span>
    </a>
  );
}
