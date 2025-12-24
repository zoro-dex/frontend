import { type PoolInfo, usePoolsInfo } from '@/hooks/usePoolsInfo';
import { bech32ToAccountId, instantiateClient } from '@/lib/utils';
import { AccountId, Address, WebClient } from '@demox-labs/miden-sdk';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ZoroContext } from './ZoroContext';

export function ZoroProvider({
  children,
}: { children: ReactNode }) {
  const { data: poolsInfo, isFetched: isPoolsInfoFetched } = usePoolsInfo();
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
    tokens: generateTokenMetadata(poolsInfo?.liquidityPools || []),
    tokensLoading: !isPoolsInfoFetched,
    liquidity_pools: poolsInfo?.liquidityPools || [],
    poolAccountId: poolsInfo?.poolAccountId
      ? bech32ToAccountId(poolsInfo.poolAccountId)
      : undefined,
    accountId,
    client,
  }), [client, accountId, poolsInfo, isPoolsInfoFetched]);

  return (
    <ZoroContext.Provider value={value}>
      {children}
    </ZoroContext.Provider>
  );
}

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  faucetId: AccountId;
  faucetIdBech32: string;
  oracleId: string;
}

const generateTokenMetadata = (pools: PoolInfo[]) => {
  const tokens: Record<string, TokenConfig> = {};
  for (const pool of pools) {
    tokens[pool.faucetIdBech32] = {
      symbol: pool.symbol,
      name: pool.name,
      decimals: pool.decimals,
      faucetId: pool.faucetId,
      faucetIdBech32: pool.faucetIdBech32,
      oracleId: pool.oracleId,
    };
  }
  return tokens;
};
