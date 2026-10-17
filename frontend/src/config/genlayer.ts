/**
 * GenLayer network configuration.
 *
 * Claimline runs on GenLayer Studionet (chain 61999). The chain object comes
 * from the SDK so the id, RPC and currency cannot drift from the client.
 *
 * The contract address has a compiled-in fallback because `.env` is gitignored:
 * without it a fresh clone or a host with no env vars would boot with no
 * contract. A stored override is validated before it is trusted.
 */
import { studionet } from 'genlayer-js/chains';

export const GENLAYER_CHAIN = studionet;

/** The Claimline deployment. Public, so it can live in source. */
const DEPLOYED_CONTRACT = '0x7eC02176fe18FE2f2E5f5F5b0E731D8471416829';

const EXPLORER_URL = 'https://explorer-studio.genlayer.com';
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const CONFIGURED_CONTRACT = String(
  import.meta.env.VITE_GENLAYER_CLAIMLINE_CONTRACT ?? '',
).trim();

export const GENLAYER = {
  chainId: GENLAYER_CHAIN.id,
  chainName: GENLAYER_CHAIN.name,
  rpcUrl: GENLAYER_CHAIN.rpcUrls.default.http[0],
  explorerUrl: EXPLORER_URL,
  contract: ADDRESS_PATTERN.test(CONFIGURED_CONTRACT) ? CONFIGURED_CONTRACT : DEPLOYED_CONTRACT,
} as const;

export function isConfigured(): boolean {
  return ADDRESS_PATTERN.test(GENLAYER.contract);
}

export function contractLink(): string {
  return `${GENLAYER.explorerUrl}/address/${GENLAYER.contract}`;
}

export function txLink(hash: string): string {
  return `${GENLAYER.explorerUrl}/tx/${hash}`;
}