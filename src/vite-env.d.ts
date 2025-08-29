/// <reference types="vite/client" />

// MASM file types
declare module '*.masm' {
  const content: string;
  export default content;
}

declare module '*.masm?raw' {
  const content: string;
  export default content;
}

interface ImportMetaEnv {
  // Network Configuration
  readonly VITE_RPC_ENDPOINT?: string;
  readonly VITE_TX_PROVER_ENDPOINT?: string;

  // Oracle Configuration
  readonly VITE_PRICE_ORACLE_ENDPOINT?: string;
  readonly VITE_PRICE_CACHE_TTL_SECONDS?: string;

  // Backend API
  readonly VITE_API_ENDPOINT?: string;

  // Asset Configuration
  readonly VITE_BTC_PRICE_ID?: string;
  readonly VITE_ETH_PRICE_ID?: string;

  // Faucet Configuration
  readonly VITE_TEST_FAUCET_ID?: string;
  readonly VITE_BTC_FAUCET_SYMBOL?: string;
  readonly VITE_ETH_FAUCET_SYMBOL?: string;

  // UI Configuration
  readonly VITE_DEFAULT_SLIPPAGE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
