import { useState } from 'react';
import { AlertCircle, Loader2, Wallet, X } from 'lucide-react';
import { connect, readError } from '@/lib/genlayer/client';
import { Dialog } from './Dialog';

export function ConnectWalletModal({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connectWallet() {
    setConnecting(true);
    setError(null);
    try {
      await connect();
      onConnected();
    } catch (cause) {
      setError(readError(cause));
    } finally {
      setConnecting(false);
    }
  }
  return (
    <Dialog title="Connect to continue" variant="modal" onClose={onClose} busy={connecting}>
      <header className="drawer-head">
        <div>
          <span className="kicker">Your wallet, your actions</span>
          <h2>Connect to continue</h2>
        </div>
        <button className="icon-btn" onClick={onClose} disabled={connecting} aria-label="Close">
          <X size={18} />
        </button>
      </header>
      <div className="drawer-body connect-body">
        <span className="empty-icon">
          <Wallet size={24} />
        </span>
        <p>
          Connect your wallet to create policies, file claims, or request a decision. You can read
          the public ledger without connecting.
        </p>
        {error && (
          <div className="notice error" role="alert">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>
      <footer className="drawer-foot">
        <button className="btn primary" onClick={() => void connectWallet()} disabled={connecting}>
          {connecting ? <Loader2 size={16} className="spin" /> : <Wallet size={16} />}
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
        <button className="btn ghost" onClick={onClose} disabled={connecting}>
          Keep browsing
        </button>
      </footer>
    </Dialog>
  );
}
