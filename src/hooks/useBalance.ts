import { type AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useState } from 'react';

export const useBalance = (
  { accountId, faucetId }: { accountId: AccountId; faucetId: AccountId },
) => {
  let [balance, setBalance] = useState(BigInt(0));

  const fetchBalance = useCallback(async () => {
    const client = await WebClient.createClient('https://rpc.testnet.miden.io:443');
    await client.syncState();
    let acc = await client.getAccount(accountId);
    if (acc == null) {
      await client.importAccountById(accountId);
      console.log('imported new account', accountId.toBech32(), 'to client');
      acc = await client.getAccount(accountId);
    }
    let balance = acc?.vault().getBalance(faucetId);
    setBalance(BigInt(balance ?? 0));
  }, [accountId, faucetId]);

  useEffect(() => {
    if (fetchBalance) {
      fetchBalance();
    }
  }, [fetchBalance]);

  return balance;
};
