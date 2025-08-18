import { type AccountId } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useState } from 'react';
import { useWebClient } from '@/components/WebClientContext';

interface UseBalanceParams {
  accountId: AccountId;
  faucetId: AccountId;
}

export const useBalance = ({ accountId, faucetId }: UseBalanceParams) => {
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const { client, isReady } = useWebClient();

  const fetchBalance = useCallback(async (): Promise<void> => {
    if (!client || !isReady) return;

    try {
      await client.syncState();
      
      let acc = await client.getAccount(accountId);
      if (acc === null) {
        await client.importAccountById(accountId);
        acc = await client.getAccount(accountId);
      }
      
      const balanceValue = acc?.vault().getBalance(faucetId);
      setBalance(BigInt(balanceValue ?? 0));
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  }, [client, isReady, accountId, faucetId]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return balance;
};