import { ArrowUpRight } from 'lucide-react';
import { contractLink } from '@/config/genlayer';
import { Brand } from './Brand';

export function Footer() {
  return (
    <footer className="site-footer minimal-footer">
      <Brand compact />
      <span>Studionet · Test funds only</span>
      <nav aria-label="Footer navigation">
        <a href="/docs">Documentation</a>
        <a href={contractLink()} target="_blank" rel="noreferrer">
          Contract <ArrowUpRight size={12} />
        </a>
      </nav>
    </footer>
  );
}
