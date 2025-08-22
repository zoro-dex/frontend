import { type AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useState, useMemo } from 'react';
import { NETWORK } from '@/lib/config';
import { useWalletEventTracker } from './useWalletEvents';

export const useBalance = (
  { accountId, faucetId }: { accountId: AccountId | null | undefined; faucetId: AccountId | undefined },
) => {
  let [balance, setBalance] = useState<bigint | null>(null);

  const fetchBalance = useCallback(async () => {
    // Early return if no accountId or faucetId
    if (!accountId || !faucetId) {
      setBalance(null);
      return;
    }

    try {
      const client = await WebClient.createClient(NETWORK.rpcEndpoint);
      await client.syncState();
      let acc = await client.getAccount(accountId);
      if (acc == null) {
        await client.importAccountById(accountId);
        console.log('imported new account', accountId.toBech32(), 'to client');
        acc = await client.getAccount(accountId);
      }
      let balance = acc?.vault().getBalance(faucetId);
      setBalance(BigInt(balance ?? 0));
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(null);
    }
  }, [accountId, faucetId]);

  // Memoized handlers to prevent re-registration
  const walletEventHandlers = useMemo(() => ({
    onConnect: () => {
      console.log('Wallet connected - refreshing balance');
      fetchBalance();
    },
    onDisconnect: () => {
      console.log('Wallet disconnected - clearing balance');
      setBalance(null);
    },
    onTransactionStatusChange: (status) => {
      if (status.status === 'confirmed' || status.status === 'ready_to_claim') {
        console.log('Transaction status changed - refreshing balance');
        fetchBalance();
      }
    },
    onReadyStateChange: (state) => {
      if (state === 'Connected') {
        console.log('Wallet ready state changed to Connected - refreshing balance');
        fetchBalance();
      }
    }
  }), [fetchBalance]);

  // Set up wallet event tracking to refresh balance on state changes
  useWalletEventTracker(walletEventHandlers);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, refreshBalance: fetchBalance };
};