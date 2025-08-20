import { AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useState } from 'react';
import { useWallet } from "@demox-labs/miden-wallet-adapter";

interface TokenConfig {
  symbol: string;
  name: string;
  priceId: string;
  faucetId: string;
}

interface BalanceState {
  [tokenSymbol: string]: {
    balance: bigint;
    isLoading: boolean;
    error: string | null;
  };
}

interface UseWalletBalancesResult {
  balances: BalanceState;
  refetchBalance: (tokenSymbol: string) => Promise<void>;
  refetchAllBalances: () => Promise<void>;
  isAnyLoading: boolean;
}

// Updated TOKENS config with faucet IDs
const TOKENS: Record<string, TokenConfig> = {
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    priceId: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    faucetId: 'mtst1qppen8yngje35gr223jwe6ptjy7gedn9'
  },
  ETH: {
    symbol: 'ETH', 
    name: 'Ethereum',
    priceId: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    faucetId: 'mtst1qppen8yngje35gr223jwe6ptjy7gedn9'
  }
} as const;

/**
 * Create a fresh WebClient instance for each operation to avoid WASM aliasing issues
 * This pattern prevents the "recursive use of an object detected" error
 */
const createFreshClient = async (): Promise<WebClient> => {
  const client = await WebClient.createClient('https://rpc.testnet.miden.io:443');
  await client.syncState();
  return client;
};

/**
 * Ensure account exists in client, importing if necessary
 */
const ensureAccountExists = async (
  client: WebClient, 
  userAccountId: string
): Promise<void> => {
  const accountId = AccountId.fromBech32(userAccountId);
  let account = await client.getAccount(accountId);
  
  if (account === null) {
    await client.importAccountById(accountId);
    account = await client.getAccount(accountId);
    if (account === null) {
      throw new Error(`Failed to import account: ${userAccountId}`);
    }
  }
};

/**
 * Centralized hook for managing all wallet token balances
 * Uses fresh WebClient instances to avoid WASM aliasing issues
 */
export const useWalletBalances = (): UseWalletBalancesResult => {
  const { wallet } = useWallet();
  const [balances, setBalances] = useState<BalanceState>({});

  const userAccountId = wallet?.adapter.accountId?.toString() || null;

  // Fetch balance for specific token using fresh client
  const fetchTokenBalance = useCallback(async (
    tokenSymbol: string
  ): Promise<void> => {
    if (!userAccountId) return;

    const tokenConfig = TOKENS[tokenSymbol];
    if (!tokenConfig) {
      console.error(`Unknown token symbol: ${tokenSymbol}`);
      return;
    }

    setBalances(prev => ({
      ...prev,
      [tokenSymbol]: { 
        balance: prev[tokenSymbol]?.balance || BigInt(0),
        isLoading: true, 
        error: null 
      }
    }));

    try {
      // Create fresh client for this operation to avoid WASM aliasing
      const client = await createFreshClient();
      
      // Ensure account exists
      await ensureAccountExists(client, userAccountId);
      
      // Fetch balance
      const accountId = AccountId.fromBech32(userAccountId);
      const faucetId = AccountId.fromBech32(tokenConfig.faucetId);
      
      const account = await client.getAccount(accountId);
      const balance = account?.vault().getBalance(faucetId) ?? 0;
      
      setBalances(prev => ({
        ...prev,
        [tokenSymbol]: {
          balance: BigInt(balance),
          isLoading: false,
          error: null
        }
      }));
      
      console.log(`Fetched ${tokenSymbol} balance: ${balance}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to fetch ${tokenSymbol} balance:`, error);
      
      setBalances(prev => ({
        ...prev,
        [tokenSymbol]: {
          balance: BigInt(0),
          isLoading: false,
          error: errorMessage
        }
      }));
    }
  }, [userAccountId]);

  // Public API: Refetch specific token balance
  const refetchBalance = useCallback(async (tokenSymbol: string): Promise<void> => {
    await fetchTokenBalance(tokenSymbol);
  }, [fetchTokenBalance]);

  // Public API: Refetch all token balances
  const refetchAllBalances = useCallback(async (): Promise<void> => {
    if (!userAccountId) return;

    const tokenSymbols = Object.keys(TOKENS);
    
    // Fetch balances sequentially to avoid creating too many concurrent clients
    for (const symbol of tokenSymbols) {
      await fetchTokenBalance(symbol);
    }
  }, [userAccountId, fetchTokenBalance]);

  // Initialize balances on mount and when user changes
  useEffect(() => {
    if (!userAccountId) {
      setBalances({});
      return;
    }

    // Initial balance fetch
    refetchAllBalances();
  }, [userAccountId, refetchAllBalances]);

  // Computed property for loading state
  const isAnyLoading = Object.values(balances).some(balance => balance.isLoading);

  return {
    balances,
    refetchBalance,
    refetchAllBalances,
    isAnyLoading
  };
};

/**
 * Helper hook for getting a specific token balance
 * This is what your Swap component should use
 */
export const useTokenBalance = (tokenSymbol: string, userAccountIdString: string | null) => {
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async (): Promise<void> => {
    if (!userAccountIdString || !tokenSymbol) {
      setBalance(BigInt(0));
      return;
    }

    const tokenConfig = TOKENS[tokenSymbol];
    if (!tokenConfig) {
      console.error(`Unknown token symbol: ${tokenSymbol}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create fresh client for this operation to avoid WASM aliasing
      const client = await createFreshClient();
      
      // Ensure account exists
      await ensureAccountExists(client, userAccountIdString);
      
      // Fetch balance
      const accountId = AccountId.fromBech32(userAccountIdString);
      const faucetId = AccountId.fromBech32(tokenConfig.faucetId);
      
      const account = await client.getAccount(accountId);
      const balance = account?.vault().getBalance(faucetId) ?? 0;
      
      setBalance(BigInt(balance));
      console.log(`Fetched ${tokenSymbol} balance: ${balance}`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Failed to fetch ${tokenSymbol} balance:`, err);
      setError(errorMessage);
      setBalance(BigInt(0));
    } finally {
      setIsLoading(false);
    }
  }, [userAccountIdString, tokenSymbol]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance
  };
};