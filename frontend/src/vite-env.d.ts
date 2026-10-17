/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GENLAYER_CLAIMLINE_CONTRACT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}