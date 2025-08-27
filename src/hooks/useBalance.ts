import { type AccountId } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWalletEventTracker } from './useWalletEvents';
import { midenClientService } from '@/services/client';

interface BalanceParams {
  readonly accountId: AccountId | null | undefined;
  readonly faucetId: AccountId | undefined;
}

interface BalanceState {
  readonly balance: bigint | null;
  readonly lastUpdated: number;
  readonly isLoading: boolean;
  readonly refreshBalance: () => Promise<void>;
}

/**
 * Simple balance hook that just fetches fresh data
 */
export const useBalance = (
  { accountId, faucetId }: BalanceParams,
): BalanceState => {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * Refresh balance from blockchain
   */
  const refreshBalance = useCallback(async (): Promise<void> => {
    if (!accountId || !faucetId) {
      setBalance(null);
      setLastUpdated(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Balance fetch timeout')), 15000); // 15 second timeout
      });
      
      const balancePromise = midenClientService.getBalance(accountId, faucetId, false);
      
      // Race between balance fetch and timeout
      const result = await Promise.race([balancePromise, timeoutPromise]);
      
      setBalance(result.balance);
      setLastUpdated(result.lastUpdated);
      
    } catch (error) {
      // Set balance to 0 instead of null so UI shows "0 TOKEN" instead of "Loading..."
      setBalance(BigInt(0));
      setLastUpdated(Date.now());
    } finally {
      setIsLoading(false);
    }
  }, [accountId, faucetId]);

  // Memoized wallet event handlers
  const walletEventHandlers = useMemo(() => ({
    onConnect: () => {
      refreshBalance();
    },
    onDisconnect: () => {
      midenClientService.clearBalanceCaches();
      setBalance(null);
      setLastUpdated(0);
    },
    onReadyStateChange: (state: string) => {
      if (state === 'Connected') {
        refreshBalance();
      }
    },
  }), [refreshBalance]);

  // Set up wallet event tracking
  useWalletEventTracker(walletEventHandlers);

  // Subscribe to balance updates from the service
  useEffect(() => {
    if (!accountId || !faucetId) {
      setBalance(null);
      setLastUpdated(0);
      setIsLoading(false);
      return;
    }

    // Clear previous state immediately when tokens change
    setBalance(null);
    setLastUpdated(0);
    setIsLoading(true);

    // Subscribe to real-time updates from service
    const unsubscribe = midenClientService.subscribeToBalanceUpdates(
      accountId,
      faucetId,
      (newBalance, newLastUpdated) => {
        setBalance(newBalance);
        setLastUpdated(newLastUpdated);
        setIsLoading(false);
      }
    );

    // Load initial balance immediately
    const loadInitialBalance = async () => {
      try {
        // Add timeout here too
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Initial balance load timeout')), 15000);
        });
        
        const balancePromise = midenClientService.getBalance(accountId, faucetId, true);
        const result = await Promise.race([balancePromise, timeoutPromise]);
        
        setBalance(result.balance);
        setLastUpdated(result.lastUpdated);
        
      } catch (error) {
        setBalance(BigInt(0)); // Set to 0 instead of null to show "no balance"
        setLastUpdated(0);
      } finally {
        setIsLoading(false);
      }
    };

    // Load balance immediately - don't wait
    loadInitialBalance();

    // Cleanup subscription when accountId or faucetId changes
    return () => {
      unsubscribe();
    };
  }, [accountId?.toBech32(), faucetId?.toBech32()]); // Use string values to prevent object reference issues

  return {
    balance,
    lastUpdated,
    isLoading,
    refreshBalance,
  };
};