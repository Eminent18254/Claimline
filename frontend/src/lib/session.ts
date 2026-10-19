import { useEffect, useState } from 'react';
import { restore, subscribe, type WalletState } from './genlayer/client';

export function useSession() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    isConnecting: false,
    isWrongChain: false,
  });
  useEffect(() => subscribe(setWallet), []);
  useEffect(() => {
    void restore();
  }, []);
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.removeItem('claimline.theme');
    } catch {
      /* Persistence is optional. */
    }
  }, []);
  return { wallet };
}
