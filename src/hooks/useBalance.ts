import { type AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useState } from 'react';
import { NETWORK } from '@/lib/config';

export const useBalance = (
  { accountId, faucetId }: { accountId: AccountId | null | undefined; faucetId: AccountId },
) => {
  let [balance, setBalance] = useState<bigint | null>(null);

  const fetchBalance = useCallback(async () => {
    // Early return if no accountId
    if (!accountId) {
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

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return balance;
};