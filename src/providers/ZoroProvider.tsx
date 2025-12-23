import { TOKEN_ICONS } from '@/lib/config';
import { bech32ToAccountId, instantiateClient } from '@/lib/utils';
import { usePoolsInfo } from '@/services/pool';
import { AccountId, Address, WebClient } from '@demox-labs/miden-sdk';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ZoroContext } from './ZoroContext';

export interface RawPoolInfo {
  decimals: number;
  faucet_id: string;
  name: string;
  oracle_id: string;
  symbol: string;
}
export interface PoolInfo {
  decimals: number;
  faucet_id: AccountId;
  name: string;
  oracle_id: string;
  symbol: string;
}

export function ZoroProvider({
  children,
}: { children: ReactNode }) {
  const poolsInfo = usePoolsInfo();
  const { address } = useWallet();
  const accountId = useMemo(
    () => address ? Address.fromBech32(address).accountId() : undefined,
    [address],
  );
  const [client, setClient] = useState<WebClient | undefined>(undefined);

  useEffect(() => {
    (async () => {
      const c = await instantiateClient({
        accountsToImport: [
          ...(accountId ? [accountId] : []),
        ],
      });
      setClient(c);
    })();
  }, [accountId]);

  const value = useMemo(() => ({
    tokens: generateTokenMetadata(poolsInfo?.data?.liquidityPools || []),
    tokensLoading: !poolsInfo?.isFetched,
    liquidity_pools: poolsInfo?.data?.liquidityPools || [],
    poolAccountId: poolsInfo?.data?.poolAccountId
      ? bech32ToAccountId(poolsInfo.data.poolAccountId)
      : undefined,
    accountId,
    client,
  }), [client, accountId, poolsInfo]);

  return (
    <ZoroContext.Provider value={value}>
      {children}
    </ZoroContext.Provider>
  );
}

export interface TokenConfig {
  symbol: string;
  name: string;
  priceId: string;
  icon: string;
  iconClass?: string;
  decimals: number;
  faucetId: AccountId;
  oracleId: string;
}

const generateTokenMetadata = (pools: PoolInfo[]) => {
  const tokens: Record<string, TokenConfig> = {};
  for (const pool of pools) {
    const iconConfig = TOKEN_ICONS[pool.symbol];
    tokens[pool.symbol] = {
      symbol: pool.symbol,
      name: pool.name,
      priceId: pool.oracle_id,
      decimals: pool.decimals,
      faucetId: pool.faucet_id,
      oracleId: pool.oracle_id,
      ...iconConfig,
    };
  }
  return tokens;
};
