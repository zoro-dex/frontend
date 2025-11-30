import type { AccountId, WebClient } from '@demox-labs/miden-sdk';
import { createContext } from 'react';
import type { PoolInfo, TokenConfig } from './ZoroProvider';

type ZoroProviderState = {
  poolAccountId?: AccountId;
  client?: WebClient;
  liquidity_pools: PoolInfo[];
  accountId?: AccountId;
  tokens: Record<string, TokenConfig>;
  tokensLoading: boolean;
};

const initialState: ZoroProviderState = {
  poolAccountId: undefined,
  liquidity_pools: [],
  tokens: {},
  tokensLoading: true,
};

export const ZoroContext = createContext<ZoroProviderState>(initialState);
