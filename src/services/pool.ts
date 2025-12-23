import { API } from '@/lib/config';
import { bech32ToAccountId } from '@/lib/utils';
import type { PoolInfo, RawPoolInfo } from '@/providers/ZoroProvider';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

export const usePoolsInfo = () => {
  const info = useQuery({
    queryKey: ['pool-info'],
    queryFn: fetchPoolInfo,
    staleTime: 3600000,
  });

  const transformedData = useMemo(() => {
    if (!info.data) {
      return undefined;
    }
    return {
      poolAccountId: info.data.pool_account_id,
      liquidityPools: info.data.liquidity_pools.map(
        p => ({ ...p, faucet_id: bech32ToAccountId(p.faucet_id) } as PoolInfo),
      ),
    } as PoolsInfo;
  }, [info.data]);

  return {
    ...info,
    data: transformedData,
  };
};

export interface PoolsInfo {
  poolAccountId: string;
  liquidityPools: PoolInfo[];
}

export interface PoolsResponse {
  pool_account_id: string;
  liquidity_pools: RawPoolInfo[];
}

export async function fetchPoolInfo() {
  try {
    const response = await fetch(`${API.endpoint}/pools/info`);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch pool info: ${response.status} ${response.statusText}`,
      );
    }
    const data: PoolsResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching pool info:', error);
    throw error;
  }
}

export function findPoolBySymbol(
  pools: PoolInfo[],
  symbol: string,
): PoolInfo | undefined {
  return pools.find(pool => pool.symbol === symbol);
}
