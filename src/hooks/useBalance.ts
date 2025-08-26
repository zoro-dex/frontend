import { type AccountId } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWalletEventTracker } from '@/hooks/useWalletEvents';
import { midenClientService } from '@/lib/client';

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
 * No optimistic updates, no localStorage - reliable and predictable
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
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await midenClientService.getBalance(accountId, faucetId, false);
      setBalance(result.balance);
      setLastUpdated(result.lastUpdated);
      
      console.log('🔄 Balance refreshed:', {
        account: accountId.toBech32(),
        faucet: faucetId.toBech32(), 
        balance: result.balance.toString(),
      });
      
    } catch (error) {
      console.error('❌ Failed to refresh balance:', error);
      // Don't clear existing balance on error - keep showing last known value
    } finally {
      setIsLoading(false);
    }
  }, [accountId, faucetId]);

  // Memoized wallet event handlers
  const walletEventHandlers = useMemo(() => ({
    onConnect: () => {
      console.log('Wallet connected - refreshing balance');
      refreshBalance();
    },
    onDisconnect: () => {
      console.log('Wallet disconnected - clearing balances');
      midenClientService.clearBalanceCaches();
      setBalance(null);
      setLastUpdated(0);
    },
    onTransactionStatusChange: (status: any) => {
      if (status.status === 'confirmed' || status.status === 'ready_to_claim') {
        console.log('Transaction confirmed - refreshing all balances');
        // Refresh this specific balance and all others
        setTimeout(() => {
          Promise.all([
            refreshBalance(),
            midenClientService.refreshAllBalances()
          ]);
        }, 2000); // Small delay for blockchain propagation
      }
    },
    onReadyStateChange: (state: string) => {
      if (state === 'Connected') {
        console.log('Wallet ready - refreshing balance');
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

    console.log('🔄 Setting up balance subscription for:', {
      account: accountId.toBech32(),
      faucet: faucetId.toBech32()
    });

    // Subscribe to real-time updates from service
    const unsubscribe = midenClientService.subscribeToBalanceUpdates(
      accountId,
      faucetId,
      (newBalance, newLastUpdated) => {
        console.log('📊 Balance update received:', {
          account: accountId.toBech32(),
          faucet: faucetId.toBech32(),
          balance: newBalance.toString()
        });
        setBalance(newBalance);
        setLastUpdated(newLastUpdated);
        setIsLoading(false);
      }
    );

    // Load initial balance immediately
    const loadInitialBalance = async () => {
      try {
        console.log('📥 Loading initial balance for:', {
          account: accountId.toBech32(),
          faucet: faucetId.toBech32()
        });
        
        const result = await midenClientService.getBalance(accountId, faucetId, true);
        setBalance(result.balance);
        setLastUpdated(result.lastUpdated);
        
        console.log('✅ Initial balance loaded:', {
          account: accountId.toBech32(),
          faucet: faucetId.toBech32(),
          balance: result.balance.toString()
        });
      } catch (error) {
        console.error('❌ Failed to load initial balance:', error);
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
      console.log('🧹 Cleaning up balance subscription for:', {
        account: accountId.toBech32(),
        faucet: faucetId.toBech32()
      });
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