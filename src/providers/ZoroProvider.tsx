import { type PoolInfo, usePoolsInfo } from '@/hooks/usePoolsInfo';
import { bech32ToAccountId, instantiateClient } from '@/lib/utils';
import { Account, AccountId, Address, WebClient } from '@demox-labs/miden-sdk';
import { useWallet } from '@demox-labs/miden-wallet-adapter';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import { ZoroContext } from './ZoroContext';

enum ClientState {
  NOT_INITIALIZED,
  IDLE,
  ACTIVE,
}

export function ZoroProvider({
  children,
}: { children: ReactNode }) {
  const { data: poolsInfo, isFetched: isPoolsInfoFetched } = usePoolsInfo();
  const { address } = useWallet();
  const accountId = useMemo(
    () => address ? Address.fromBech32(address).accountId() : undefined,
    [address],
  );
  const [, forceUpdate] = useReducer(x => x + 1, 0);
  const client = useRef<WebClient | undefined>(undefined);
  const clientState = useRef<ClientState>(ClientState.NOT_INITIALIZED);

  useEffect(() => {
    if (client.current || !accountId || !poolsInfo) {
      return;
    }
    (async () => {
      const c = await instantiateClient({
        accountsToImport: [
          ...(accountId
            ? [accountId, bech32ToAccountId(poolsInfo.poolAccountId) as AccountId]
            : []),
        ],
      });
      client.current = c;
      clientState.current = ClientState.IDLE;
      forceUpdate();
    })();
  }, [poolsInfo, accountId]);

  const syncState = useCallback(async () => {
    if (clientState.current === ClientState.NOT_INITIALIZED) {
      return;
    }
    if (clientState.current === ClientState.ACTIVE) {
      await new Promise<void>(async r => {
        while (clientState.current === ClientState.ACTIVE) {
          await new Promise(r2 => setTimeout(r2, 500));
        }
        clientState.current = ClientState.ACTIVE;
        await client.current?.syncState();
        clientState.current = ClientState.IDLE;
        r();
      });
    } else if (clientState.current === ClientState.IDLE) {
      clientState.current = ClientState.ACTIVE;
      await client.current?.syncState();
      clientState.current = ClientState.IDLE;
    }
  }, []);

  const getAccount = useCallback(async (accountId: AccountId) => {
    if (clientState.current === ClientState.NOT_INITIALIZED) {
      return;
    }
    if (clientState.current === ClientState.ACTIVE) {
      let acc = await new Promise<Account | undefined>(async r => {
        while (clientState.current === ClientState.ACTIVE) {
          await new Promise(r2 => setTimeout(r2, 500));
        }
        clientState.current = ClientState.ACTIVE;
        let acc = await client.current?.getAccount(accountId);
        clientState.current = ClientState.IDLE;
        r(acc);
      });
      return acc;
    } else if (clientState.current === ClientState.IDLE) {
      clientState.current = ClientState.ACTIVE;
      await client.current?.syncState();
      let acc = await client.current?.getAccount(accountId);
      clientState.current = ClientState.IDLE;
      return acc;
    }
  }, []);

  const value = useMemo(() => {
    console.log(client.current);
    return {
      tokens: generateTokenMetadata(poolsInfo?.liquidityPools || []),
      tokensLoading: !isPoolsInfoFetched,
      liquidity_pools: poolsInfo?.liquidityPools || [],
      poolAccountId: poolsInfo?.poolAccountId
        ? bech32ToAccountId(poolsInfo.poolAccountId)
        : undefined,
      accountId,
      client: client.current,
      syncState,
      getAccount,
    };
  }, [accountId, poolsInfo, isPoolsInfoFetched, syncState]);

  return (
    <ZoroContext.Provider value={{ ...value, client: client.current }}>
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
