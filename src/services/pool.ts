import { API } from '@/lib/config';
import type { PoolsResponse, PoolInfo } from '@/lib/config';

/**
 * Fetch pool information from the Zoro backend
 */
export async function fetchPoolInfo(): Promise<PoolInfo[]> {
  try {
    const response = await fetch(`${API.endpoint}/pools/info`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pool info: ${response.status} ${response.statusText}`);
    }
    
    const data: PoolsResponse = await response.json();
    return data.liquidity_pools;
  } catch (error) {
    console.error('Error fetching pool info:', error);
    throw error;
  }
}

/**
 * Find pool by symbol
 */
export function findPoolBySymbol(pools: PoolInfo[], symbol: string): PoolInfo | undefined {
  return pools.find(pool => pool.symbol === symbol);
}

/**
 * Validate pool configuration against server data
 */
export function validatePoolConfig(localConfig: Record<string, any>, serverPools: PoolInfo[]): boolean {
  const serverSymbols = new Set(serverPools.map(pool => pool.symbol));
  const localSymbols = new Set(Object.keys(localConfig));
  
  // Check if all local symbols exist on server
  for (const symbol of localSymbols) {
    if (!serverSymbols.has(symbol)) {
      console.warn(`Local symbol ${symbol} not found on server`);
      return false;
    }
  }
  
  return true;
}