import { NETWORK } from '@/lib/config';
import { type AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWalletEventTracker } from './useWalletEvents';

interface OptimisticBalanceParams {
  readonly accountId: AccountId | null | undefined;
  readonly faucetId: AccountId | undefined;
}

interface OptimisticBalanceState {
  readonly balance: bigint | null;
  readonly isOptimistic: boolean;
  readonly lastUpdated: number;
  readonly refreshBalance: () => Promise<void>;
  readonly applyOptimisticUpdate: (delta: bigint) => void;
}

interface CachedBalance {
  readonly balance: bigint;
  readonly timestamp: number;
  readonly accountId: string;
  readonly faucetId: string;
}

interface SerializedCachedBalance {
  readonly balance: string; // BigInt as string
  readonly timestamp: number;
  readonly accountId: string;
  readonly faucetId: string;
}

// Cache configuration
const BALANCE_CACHE_TTL = 30000; // 30 seconds
const OPTIMISTIC_TIMEOUT = 60000; // 1 minute before reverting optimistic updates
const STORAGE_KEY = 'zoro_balance_cache';

/**
 * Optimistic balance hook with localStorage caching and background sync
 * Provides immediate UI updates while syncing with blockchain in background
 */
export const useBalance = (
  { accountId, faucetId }: OptimisticBalanceParams,
): OptimisticBalanceState => {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [isOptimistic, setIsOptimistic] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  // Refs for managing optimistic updates
  const optimisticTimerRef = useRef<NodeJS.Timeout>();
  const baseBalanceRef = useRef<bigint | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  // Create stable cache key
  const cacheKey = useMemo(() => {
    if (!accountId || !faucetId) return null;
    return `${accountId.toBech32()}-${faucetId.toBech32()}`;
  }, [accountId, faucetId]);

  /**
   * Load cached balance from localStorage with BigInt deserialization
   */
  const loadCachedBalance = useCallback((): CachedBalance | null => {
    if (!cacheKey) return null;

    try {
      const cached = localStorage.getItem(`${STORAGE_KEY}-${cacheKey}`);
      if (!cached) return null;

      const parsed: SerializedCachedBalance = JSON.parse(cached);

      // Check if cache is still valid
      const now = Date.now();
      if (now - parsed.timestamp > BALANCE_CACHE_TTL) {
        localStorage.removeItem(`${STORAGE_KEY}-${cacheKey}`);
        return null;
      }

      // Convert balance string back to BigInt
      return {
        ...parsed,
        balance: BigInt(parsed.balance),
      };
    } catch (error) {
      console.warn('Failed to load cached balance:', error);
      // Clean up corrupted cache entry
      try {
        localStorage.removeItem(`${STORAGE_KEY}-${cacheKey}`);
      } catch (cleanupError) {
        console.warn('Failed to clean up corrupted cache:', cleanupError);
      }
      return null;
    }
  }, [cacheKey]);

  /**
   * Save balance to localStorage cache with BigInt serialization
   */
  const saveCachedBalance = useCallback((balance: bigint): void => {
    if (!cacheKey || !accountId || !faucetId) return;

    try {
      const serialized: SerializedCachedBalance = {
        balance: balance.toString(), // Convert BigInt to string
        timestamp: Date.now(),
        accountId: accountId.toBech32(),
        faucetId: faucetId.toBech32(),
      };

      localStorage.setItem(`${STORAGE_KEY}-${cacheKey}`, JSON.stringify(serialized));
    } catch (error) {
      console.warn('Failed to save cached balance:', error);
      // If localStorage is full or unavailable, try to clear old entries
      try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(STORAGE_KEY)) {
            keysToRemove.push(key);
          }
        }
        // Remove old cache entries and try again
        keysToRemove.forEach(key => {
          try {
            localStorage.removeItem(key);
          } catch {}
        });
        // Retry saving
        localStorage.setItem(`${STORAGE_KEY}-${cacheKey}`, JSON.stringify(serialized));
      } catch (retryError) {
        console.warn('Failed to save cached balance after cleanup:', retryError);
      }
    }
  }, [cacheKey, accountId, faucetId]);

  /**
   * Fetch balance from blockchain
   */
  const fetchBalance = useCallback(
    async (useCache: boolean = true): Promise<bigint | null> => {
      // Early return if no accountId or faucetId
      if (!accountId || !faucetId) {
        return null;
      }

      // Prevent concurrent fetches
      if (isFetchingRef.current) {
        console.log('Balance fetch already in progress, skipping...');
        return balance;
      }

      // Try cache first if requested
      if (useCache) {
        const cached = loadCachedBalance();
        if (cached) {
          console.log('Using cached balance:', cached.balance.toString());
          return cached.balance;
        }
      }

      try {
        isFetchingRef.current = true;

        const client = await WebClient.createClient(NETWORK.rpcEndpoint);
        await client.syncState();

        let acc = await client.getAccount(accountId);
        if (acc == null) {
          await client.importAccountById(accountId);
          console.log('imported new account', accountId.toBech32(), 'to client');
          acc = await client.getAccount(accountId);
        }

        const fetchedBalance = acc?.vault().getBalance(faucetId);
        const balanceBigInt = BigInt(fetchedBalance ?? 0);

        // Save to cache
        saveCachedBalance(balanceBigInt);

        console.log('Fetched fresh balance:', balanceBigInt.toString());
        return balanceBigInt;
      } catch (error) {
        console.error('Error fetching balance:', error);

        // Return cached balance as fallback
        const cached = loadCachedBalance();
        return cached ? cached.balance : null;
      } finally {
        isFetchingRef.current = false;
      }
    },
    [accountId, faucetId, balance, loadCachedBalance, saveCachedBalance],
  );

  /**
   * Refresh balance with optimistic state management
   */
  const refreshBalance = useCallback(async (): Promise<void> => {
    const freshBalance = await fetchBalance(false); // Force fresh fetch

    if (freshBalance !== null) {
      baseBalanceRef.current = freshBalance;
      setBalance(freshBalance);
      setLastUpdated(Date.now());

      // Clear optimistic state if we got fresh data
      if (isOptimistic) {
        setIsOptimistic(false);
        if (optimisticTimerRef.current) {
          clearTimeout(optimisticTimerRef.current);
          optimisticTimerRef.current = undefined;
        }
      }
    }
  }, [fetchBalance, isOptimistic]);

  /**
   * Apply optimistic balance update
   */
  const applyOptimisticUpdate = useCallback((delta: bigint): void => {
    const currentBase = baseBalanceRef.current ?? balance ?? BigInt(0);
    const newOptimisticBalance = currentBase + delta;

    // Don't allow negative balances
    if (newOptimisticBalance < BigInt(0)) {
      console.warn('Optimistic update would result in negative balance, ignoring');
      return;
    }

    console.log('Applying optimistic update:', {
      current: currentBase.toString(),
      delta: delta.toString(),
      new: newOptimisticBalance.toString(),
    });

    setBalance(newOptimisticBalance);
    setIsOptimistic(true);
    setLastUpdated(Date.now());

    // Clear existing timer
    if (optimisticTimerRef.current) {
      clearTimeout(optimisticTimerRef.current);
    }

    // Set timer to revert optimistic update and refresh
    optimisticTimerRef.current = setTimeout(() => {
      console.log('Optimistic update timeout, refreshing balance...');
      refreshBalance();
    }, OPTIMISTIC_TIMEOUT);
  }, [balance, refreshBalance]);

  // Memoized wallet event handlers to prevent re-registration
  const walletEventHandlers = useMemo(() => ({
    onConnect: () => {
      console.log('Wallet connected - refreshing balance');
      refreshBalance();
    },
    onDisconnect: () => {
      console.log('Wallet disconnected - clearing balance');
      setBalance(null);
      setIsOptimistic(false);
      setLastUpdated(0);
      baseBalanceRef.current = null;
    },
    onTransactionStatusChange: (status: any) => {
      if (status.status === 'confirmed' || status.status === 'ready_to_claim') {
        console.log('Transaction status changed - refreshing balance');
        // Small delay to allow blockchain to update
        setTimeout(() => refreshBalance(), 2000);
      }
    },
    onReadyStateChange: (state: string) => {
      if (state === 'Connected') {
        console.log('Wallet ready state changed to Connected - refreshing balance');
        refreshBalance();
      }
    },
  }), [refreshBalance]);

  // Set up wallet event tracking
  useWalletEventTracker(walletEventHandlers);

  // Initial balance loading
  useEffect(() => {
    const loadInitialBalance = async (): Promise<void> => {
      if (!accountId || !faucetId) {
        setBalance(null);
        setIsOptimistic(false);
        setLastUpdated(0);
        baseBalanceRef.current = null;
        return;
      }

      // Try cache first for immediate UI update
      const cached = loadCachedBalance();
      if (cached) {
        setBalance(cached.balance);
        baseBalanceRef.current = cached.balance;
        setLastUpdated(cached.timestamp);
        console.log(
          'Loaded cached balance for immediate display:',
          cached.balance.toString(),
        );
      }

      // Then fetch fresh data in background
      const freshBalance = await fetchBalance(false);
      if (freshBalance !== null && (!cached || cached.balance !== freshBalance)) {
        baseBalanceRef.current = freshBalance;
        setBalance(freshBalance);
        setLastUpdated(Date.now());
        console.log('Updated with fresh balance:', freshBalance.toString());
      }
    };

    loadInitialBalance();
  }, [accountId, faucetId, fetchBalance, loadCachedBalance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (optimisticTimerRef.current) {
        clearTimeout(optimisticTimerRef.current);
      }
    };
  }, []);

  return {
    balance,
    isOptimistic,
    lastUpdated,
    refreshBalance,
    applyOptimisticUpdate,
  };
};
