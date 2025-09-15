import { type AccountId, WebClient } from '@demox-labs/miden-sdk';
import { useCallback, useEffect, useState } from 'react';

interface BalanceParams {
  readonly accountId?: AccountId;
  readonly faucetId?: AccountId;
  client?: WebClient;
}

const getBalanceFromClient = async (
  client: WebClient,
  accountId: AccountId,
  faucetId: AccountId,
) => {
  let acc = await client.getAccount(accountId);
  let balance = acc?.vault().getBalance(faucetId);
  return balance;
};

export const useBalance = (
  { accountId, faucetId, client }: BalanceParams,
) => {
  const [balance, setBalance] = useState<bigint | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const refreshBalance = useCallback(async () => {
    if (!accountId || !faucetId || !client) return;
    await client.syncState();
    let newBalance = await getBalanceFromClient(client, accountId, faucetId);
    setLastUpdated(Date.now());
    setBalance(BigInt(newBalance ?? 0));
  }, [client, faucetId, accountId]);

  useEffect(() => {
    refreshBalance();
    let clear = setInterval(refreshBalance, 10000);
    return () => clearInterval(clear);
  }, [refreshBalance]);

  return {
    balance,
    lastUpdated,
    refreshBalance,
  };
};