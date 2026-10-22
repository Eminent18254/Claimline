/**
 * GenLayer network configuration.
 *
 * Claimline runs on GenLayer Studionet (chain 61999). The chain object comes
 * from the SDK so the id, RPC and currency cannot drift from the client.
 *
 * The verified deployment manifest is updated by npm run deploy:contract.
 * Every Vercel build uses it, even if an older address remains in host env vars.
 */
import { studionet } from 'genlayer-js/chains';
import deployment from './deployment.json';

export const GENLAYER_CHAIN = studionet;

/** The Claimline deployment. Public, so it can live in source. */
const DEPLOYED_CONTRACT = deployment.address;

const EXPLORER_URL = 'https://explorer-studio.genlayer.com';
const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

export const GENLAYER = {
  chainId: GENLAYER_CHAIN.id,
  chainName: GENLAYER_CHAIN.name,
  rpcUrl: GENLAYER_CHAIN.rpcUrls.default.http[0],
  explorerUrl: EXPLORER_URL,
  contract: DEPLOYED_CONTRACT,
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
