import { type AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import { clientTracker } from '@/lib/clientTracker';

interface BalanceParams {
  readonly accountId?: AccountId;
  readonly faucetId?: AccountId;
  client?: WebClient;
}

const getBalanceFromClient = async (
  client: WebClient,
  accountId: AccountId,
  faucetId: AccountId,
  hookId: string,
): Promise<bigint> => {
  const syncOpId = clientTracker.trackAccess(`balance-${hookId}-syncState`);
  
  try {
    await client.syncState();
    clientTracker.trackComplete(syncOpId);
    
    const getAccountOpId = clientTracker.trackAccess(`balance-${hookId}-getAccount`);
    const acc = await client.getAccount(accountId);
    const balance = acc?.vault().getBalance(faucetId);
    clientTracker.trackComplete(getAccountOpId);
    
    return BigInt(balance ?? 0);
  } catch (error) {
    console.error(`Balance operation ${hookId} failed:`, error);
    throw error;
  }
};

export const useBalance = (
  { accountId, faucetId, client }: BalanceParams,
) => {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [isCorrupted, setIsCorrupted] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Safe hook ID creation with error handling
  const hookId = useMemo(() => {
    try {
      if (!accountId || !faucetId) return 'unknown';
      return `${accountId.toString().slice(-4)}-${faucetId.toString().slice(-4)}`;
    } catch (error) {
      console.error('Error creating hook ID:', error);
      return `unknown-${Date.now()}`;
    }
  }, [accountId, faucetId]);

  const refreshBalance = useCallback(async () => {
    if (!accountId || !faucetId || !client || isCorrupted) return;
    
    // Additional safety check - ensure objects are still valid
    try {
      // Test if AccountId objects are still valid by calling toString
      accountId.toString();
      faucetId.toString();
    } catch (error) {
      console.error(`AccountId objects corrupted for ${hookId}:`, error);
      setIsCorrupted(true);
      // Clear the interval to stop further attempts
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    
    try {
      const newBalance = await getBalanceFromClient(client, accountId, faucetId, hookId);
      setLastUpdated(Date.now());
      setBalance(newBalance);
    } catch (error) {
      console.error(`❌ Balance refresh failed for ${hookId}:`, error);
      // If this is a corruption error, mark as corrupted
      if (error instanceof Error && error.message.includes('null pointer passed to rust')) {
        setIsCorrupted(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }
  }, [client, faucetId, accountId, hookId, isCorrupted]);

  useEffect(() => {
    
    // Don't start if already corrupted
    if (isCorrupted) return;
    
    refreshBalance();
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = setInterval(() => {
      refreshBalance();
    }, 10000);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshBalance, isCorrupted]);

  return {
    balance,
    lastUpdated,
    refreshBalance,
    isCorrupted,
  };
};