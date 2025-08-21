/**
 * Environment configuration for Zoro AMM
 * Centralizes all environment variables with type safety and validation
 */

export interface TokenConfig {
  readonly symbol: string;
  readonly name: string;
  readonly priceId: string;
  readonly icon: string;
  readonly iconClass?: string;
}

export interface NetworkConfig {
  readonly rpcEndpoint: string;
  readonly txProverEndpoint: string;
}

export interface OracleConfig {
  readonly endpoint: string;
  readonly cacheTtlSeconds: number;
}

export interface ApiConfig {
  readonly endpoint: string;
}

export interface FaucetConfig {
  readonly testFaucetId: string;
}

export interface UiConfig {
  readonly defaultSlippage: number;
}

/**
 * Get environment variable with fallback and validation
 */
function getEnvVar(key: string, fallback?: string): string {
  const value = import.meta.env[key] || fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Parse and validate numeric environment variable
 */
function getNumericEnvVar(key: string, fallback: number): number {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(`Invalid numeric value for ${key}: ${value}`);
  }
  return parsed;
}

// Network Configuration
export const NETWORK: NetworkConfig = {
  rpcEndpoint: getEnvVar('VITE_RPC_ENDPOINT', 'https://rpc.testnet.miden.io:443'),
  txProverEndpoint: getEnvVar('VITE_TX_PROVER_ENDPOINT', 'https://tx-prover.testnet.miden.io'),
} as const;

// Oracle Configuration
export const ORACLE: OracleConfig = {
  endpoint: getEnvVar('VITE_PRICE_ORACLE_ENDPOINT', 'https://antenna.nabla.fi/v1/updates/price/latest'),
  cacheTtlSeconds: getNumericEnvVar('VITE_PRICE_CACHE_TTL_SECONDS', 3000),
} as const;

// API Configuration  
export const API: ApiConfig = {
  endpoint: getEnvVar('VITE_API_ENDPOINT', 'https://api.zoroswap.com'),
} as const;

// Faucet Configuration
export const FAUCET: FaucetConfig = {
  testFaucetId: getEnvVar('VITE_TEST_FAUCET_ID', 'mtst1qppen8yngje35gr223jwe6ptjy7gedn9'),
} as const;

// UI Configuration
export const UI: UiConfig = {
  defaultSlippage: getNumericEnvVar('VITE_DEFAULT_SLIPPAGE', 0.5),
} as const;

// Token Configuration - Centralized with env variable support
export const TOKENS: Record<string, TokenConfig> = {
  BTC: {
    symbol: getEnvVar('VITE_BTC_FAUCET_SYMBOL', 'BTC'),
    name: 'Bitcoin',
    priceId: getEnvVar('VITE_BTC_PRICE_ID', 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'),
    icon: '/BTC.svg',
    iconClass: '',
  },
  ETH: {
    symbol: getEnvVar('VITE_ETH_FAUCET_SYMBOL', 'ETH'),
    name: 'Ethereum', 
    priceId: getEnvVar('VITE_ETH_PRICE_ID', 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace'),
    icon: '/ETH.svg',
    iconClass: 'dark:invert',
  },
} as const;

// Token Symbol Type
export type TokenSymbol = keyof typeof TOKENS;

// Faucet Mapping - Each token can have its own faucet
export const FAUCETS: Record<TokenSymbol, string> = {
  BTC: getEnvVar('VITE_BTC_FAUCET_ID', FAUCET.testFaucetId),
  ETH: getEnvVar('VITE_ETH_FAUCET_ID', FAUCET.testFaucetId),
} as const;

// Derived configurations
export const SUPPORTED_ASSET_IDS: Record<string, string> = Object.fromEntries(
  Object.entries(TOKENS).map(([key, token]) => [token.priceId, `${token.symbol}/USD`])
);

export const ASSET_IDS: readonly string[] = Object.values(TOKENS).map(token => token.priceId);

/**
 * Validate all configurations on module load
 */
function validateConfig(): void {
  // Validate slippage bounds
  if (UI.defaultSlippage < 0 || UI.defaultSlippage > 50) {
    throw new Error(`Invalid slippage configuration: default=${UI.defaultSlippage}`);
  }
  
  // Validate URLs
  const urlFields = [NETWORK.rpcEndpoint, NETWORK.txProverEndpoint, ORACLE.endpoint, API.endpoint];
  for (const url of urlFields) {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL in configuration: ${url}`);
    }
  }
  
  // Validate price IDs (should be hex strings)
  for (const [symbol, token] of Object.entries(TOKENS)) {
    if (!/^[a-fA-F0-9]{64}$/.test(token.priceId)) {
      console.warn(`Price ID for ${symbol} may be invalid: ${token.priceId}`);
    }
  }

  // Validate faucet IDs (should be valid Bech32 format)
  for (const [symbol, faucetId] of Object.entries(FAUCETS)) {
    if (!faucetId.startsWith('mtst1') && !faucetId.startsWith('mden1')) {
      console.warn(`Faucet ID for ${symbol} may be invalid: ${faucetId}`);
    }
  }
}

// Run validation
validateConfig();