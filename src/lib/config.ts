/**
 * Environment configuration for Zoro AMM
 * Centralizes all environment variables with type safety and validation
 */

export interface PoolInfo {
  readonly decimals: number;
  readonly faucet_id: string;
  readonly name: string;
  readonly oracle_id: string;
  readonly symbol: string;
}

/**
 * Extended pool information with additional metadata
 */
export interface ExtendedPoolInfo extends PoolInfo {
  readonly icon?: string;
  readonly iconClass?: string;
  readonly isActive?: boolean;
  readonly lastUpdated?: number;
}

export interface PoolsResponse {
  readonly liquidity_pools: PoolInfo[];
}

export interface TokenConfig {
  readonly symbol: string;
  readonly name: string;
  readonly priceId: string;
  readonly icon: string;
  readonly iconClass?: string;
  readonly decimals: number;
  readonly faucetId: string;
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

// UI Configuration
export const UI: UiConfig = {
  defaultSlippage: getNumericEnvVar('VITE_DEFAULT_SLIPPAGE', 0.5),
} as const;

// Fallback pool data from your actual API response
const FALLBACK_POOLS: PoolInfo[] = [
  {
    decimals: 8,
    faucet_id: "mtst1qp35fyhljwdecgq79gu2das7vq2jcl0g",
    name: "Bitcoin pool",
    oracle_id: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    symbol: "BTC"
  },
  {
    decimals: 12,
    faucet_id: "mtst1qr0req9cd3q5vgrq4wdqnx7hzy36w3jv", 
    name: "Ethereum pool",
    oracle_id: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    symbol: "ETH"
  }
] as const;

// Token icon mapping - only includes the two supported tokens
const TOKEN_ICONS: Record<string, { icon: string; iconClass?: string }> = {
  BTC: {
    icon: '/BTC.svg',
    iconClass: '',
  },
  ETH: {
    icon: '/ETH.svg',
    iconClass: 'dark:invert',
  },
} as const;

/**
 * Build token configuration from server pool data
 * Only processes tokens that have icon configurations
 */
export function buildTokenConfigFromPools(pools: PoolInfo[]): Record<string, TokenConfig> {
  const tokens: Record<string, TokenConfig> = {};
  
  for (const pool of pools) {
    const iconConfig = TOKEN_ICONS[pool.symbol];
    
    if (!iconConfig) {
      console.warn(`No icon configuration for pool symbol: ${pool.symbol} - skipping`);
      continue;
    }
    
    tokens[pool.symbol] = {
      symbol: pool.symbol,
      name: pool.name,
      priceId: pool.oracle_id,
      decimals: pool.decimals,
      faucetId: pool.faucet_id,
      ...iconConfig,
    };
  }
  
  return tokens;
}

// Will be populated dynamically from server
export let TOKENS: Record<string, TokenConfig> = {};

// Token Symbol Type - will be updated when tokens are loaded
export type TokenSymbol = keyof typeof TOKENS;

/**
 * Initialize token configuration from server
 * Falls back to hardcoded pool data if server is unavailable
 */
export async function initializeTokenConfig(): Promise<void> {
  let pools: PoolInfo[] = [];
  let usingFallback = false;

  try {
    const { fetchPoolInfo } = await import('./poolService');
    pools = await fetchPoolInfo();
    console.log('✅ Successfully fetched pools from server:', pools);
  } catch (error) {
    console.warn('⚠️ Failed to fetch pools from server, using fallback data:', error);
    pools = FALLBACK_POOLS;
    usingFallback = true;
  }

  // Filter pools to only those we have icons for
  const supportedPools = pools.filter(pool => TOKEN_ICONS[pool.symbol]);
  
  if (supportedPools.length === 0) {
    throw new Error(`No supported tokens found. Available pools: ${pools.map(p => p.symbol).join(', ')}`);
  }
  
  TOKENS = buildTokenConfigFromPools(supportedPools);
  
  console.log('🪙 Initialized token configuration:', {
    data_source: usingFallback ? 'fallback' : 'server',
    total_pools: pools.length,
    supported_tokens: Object.keys(TOKENS),
    token_details: TOKENS,
  });

  // Log warning if using fallback data
  if (usingFallback) {
    console.warn('🔧 Using fallback pool configuration - some data may be stale');
  }
}

/**
 * Check if tokens have been initialized
 */
export function areTokensInitialized(): boolean {
  return Object.keys(TOKENS).length > 0;
}

// Derived configurations - these will be computed after TOKENS is populated
export function getAssetIds(): readonly string[] {
  return Object.values(TOKENS).map(token => token.priceId);
}

export function getSupportedAssetIds(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(TOKENS).map(([key, token]) => [token.priceId, `${token.symbol}/USD`])
  );
}

export function getFaucets(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(TOKENS).map(([symbol, token]) => [symbol, token.faucetId])
  );
}

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
}

// Run validation
validateConfig();